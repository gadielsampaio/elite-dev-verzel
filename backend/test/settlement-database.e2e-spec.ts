import { AuctionEvents } from '../src/events/auction-events.js';
import { AccountResultsService } from '../src/settlement/account-results.service.js';
import { ResultsService } from '../src/settlement/results.service.js';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SettlementService } from '../src/settlement/settlement.service.js';
import { WalletsService } from '../src/wallets/wallets.service.js';
import { BidsService } from '../src/bids/bids.service.js';

describe.runIf(process.env.RUN_DATABASE_TESTS === '1')(
  'Settlement (PostgreSQL)',
  () => {
    let db: PrismaService,
      settlement: SettlementService,
      wallets: WalletsService,
      bids: BidsService;
    let users: string[], lots: string[], seller: string, buyer: string;
    beforeEach(async () => {
      db = new PrismaService();
      settlement = new SettlementService(db);
      wallets = new WalletsService(db);
      bids = new BidsService(db, new AuctionEvents());
      users = [];
      lots = [];
      for (const role of ['auctioneer', 'bidder'] as const) {
        const u = await db.user.create({
          data: {
            name: 'Settlement fixture',
            email: `${randomUUID()}@example.invalid`,
            role,
          },
        });
        users.push(u.id);
      }
      [seller, buyer] = users;
      await wallets.deposit(buyer, {
        amount: '500.00',
        idempotencyKey: randomUUID(),
      });
    });
    afterEach(async () => {
      try {
        await db.walletTransaction.deleteMany({
          where: { wallet: { userId: { in: users } } },
        });
        await db.auctionResult.deleteMany({ where: { lotId: { in: lots } } });
        await db.walletHold.deleteMany({
          where: { bid: { lotId: { in: lots } } },
        });
        await db.bid.deleteMany({ where: { lotId: { in: lots } } });
        await db.lot.deleteMany({ where: { id: { in: lots } } });
        await db.wallet.deleteMany({ where: { userId: { in: users } } });
        await db.user.deleteMany({ where: { id: { in: users } } });
        expect(await db.user.count({ where: { id: { in: users } } })).toBe(0);
      } finally {
        await db.$disconnect();
      }
    });
    async function lot(withBid = true) {
      const l = await db.lot.create({
        data: {
          ownerId: seller,
          title: 'Settlement fixture',
          status: 'open',
          startTime: new Date(Date.now() - 60000),
          endTime: new Date(Date.now() + 600000),
          startingBid: '100',
          bidIncrement: '5',
        },
      });
      lots.push(l.id);
      if (withBid)
        await bids.place(l.id, buyer, {
          amount: '100',
          idempotencyKey: randomUUID(),
        });
      return l;
    }
    const expire = (id: string) =>
      db.lot.update({
        where: { id },
        data: { endTime: new Date(Date.now() - 1000) },
      });
    it('reads seller credits and distinct participation only after settlement, scoped to each account', async () => {
      const reads = new AccountResultsService(db);
      const l = await lot();
      const empty = await lot(false);
      expect(await reads.summary(seller)).toMatchObject({
        lots: 2,
        live: 2,
        sold: 0,
        totalReceived: '0.00',
      });
      expect(
        (
          await reads.participations(buyer, {
            page: 1,
            limit: 10,
            filter: 'all',
          })
        ).total,
      ).toBe(1);
      expect(
        (
          await reads.participations(buyer, {
            page: 1,
            limit: 10,
            filter: 'wins',
          })
        ).total,
      ).toBe(0);
      await expire(l.id);
      await expire(empty.id);
      expect(
        (await reads.seller(seller, { page: 1, limit: 10 })).items.every(
          (x) => x.amount === null,
        ),
      ).toBe(true);
      await settlement.settle(l.id);
      await settlement.settle(empty.id);
      await settlement.settle(l.id);
      expect(await reads.summary(seller)).toMatchObject({
        sold: 1,
        live: 0,
        totalReceived: '100.00',
      });
      expect(await reads.summary(buyer)).toMatchObject({
        sold: 0,
        totalReceived: '0.00',
        lots: 0,
      });
      const results = await reads.seller(seller, { page: 1, limit: 10 });
      expect(results.items.find((x) => x.lotId === empty.id)?.outcome).toBe(
        'no_winner',
      );
      expect(results.items.find((x) => x.lotId === l.id)).toMatchObject({
        outcome: 'settled',
        amount: '100.00',
        receiptPath: `/#/receipt/${l.id}`,
      });
      expect((await reads.seller(buyer, { page: 1, limit: 10 })).total).toBe(0);
      const wins = await reads.participations(buyer, {
        page: 1,
        limit: 1,
        filter: 'wins',
      });
      expect(wins.items[0]).toMatchObject({
        lotId: l.id,
        won: true,
        myBestBid: '100.00',
      });
      expect(
        (
          await reads.participations(seller, {
            page: 1,
            limit: 10,
            filter: 'all',
          })
        ).total,
      ).toBe(0);
      expect(
        (await reads.seller(seller, { page: 2, limit: 1 })).items,
      ).toHaveLength(1);
      expect(JSON.stringify(results)).not.toContain(buyer);
      expect(JSON.stringify(wins)).not.toContain(seller);
    });
    it('settles concurrent retries exactly once with balanced entries and a captured hold', async () => {
      const l = await lot();
      await expire(l.id);
      const results = await Promise.all(
        Array.from({ length: 4 }, () => settlement.settle(l.id)),
      );
      expect(new Set(results.map((r) => r?.id)).size).toBe(1);
      expect(results[0]?.settledAt).toBeInstanceOf(Date);
      const receipt = await new ResultsService(db).forLot(l.id);
      expect(receipt).toMatchObject({
        status: 'settled',
        receipt: { id: results[0]?.id, amount: '100.00' },
      });
      expect(JSON.stringify(receipt)).not.toContain(buyer);
      expect(JSON.stringify(receipt)).not.toContain(seller);
      const entries = await db.walletTransaction.findMany({
        where: { auctionResultId: results[0]!.id },
      });
      expect(entries).toHaveLength(2);
      expect(new Set(entries.map((e) => e.transferId)).size).toBe(1);
      expect(entries.map((e) => e.type).sort()).toEqual([
        'auction_purchase',
        'auction_sale',
      ]);
      expect(entries.every((e) => e.amount.toFixed(2) === '100.00')).toBe(true);
      expect(await wallets.balance(buyer)).toMatchObject({
        total: '400.00',
        committed: '0.00',
        available: '400.00',
      });
      expect(await wallets.balance(seller)).toMatchObject({
        total: '100.00',
        available: '100.00',
      });
      expect(
        await db.walletHold.findFirst({ where: { bid: { lotId: l.id } } }),
      ).toMatchObject({ status: 'captured' });
      expect(await db.bid.findFirst({ where: { lotId: l.id } })).toMatchObject({
        isWinner: true,
      });
      await expect(
        bids.place(l.id, buyer, {
          amount: '105',
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toMatchObject({ status: 409 });
    });
    it('closes empty lots without a result or transfer and replays safely', async () => {
      const l = await lot(false);
      await expire(l.id);
      await settlement.settle(l.id);
      await settlement.settle(l.id);
      expect(await db.lot.findUnique({ where: { id: l.id } })).toMatchObject({
        status: 'closed',
      });
      expect(await db.auctionResult.count({ where: { lotId: l.id } })).toBe(0);
      expect(await new ResultsService(db).forLot(l.id)).toMatchObject({
        status: 'no_winner',
        receipt: null,
      });
      expect(await wallets.balance(seller)).toMatchObject({
        walletId: null,
        total: '0.00',
      });
    });
    it('ignores unexpired, cancelled and draft lots', async () => {
      const l = await lot(false);
      expect(await settlement.settle(l.id)).toBeNull();
      await expire(l.id);
      for (const status of ['cancelled', 'draft'] as const) {
        await db.lot.update({ where: { id: l.id }, data: { status } });
        expect(await settlement.settle(l.id)).toBeNull();
        expect(await db.lot.findUnique({ where: { id: l.id } })).toMatchObject({
          status,
        });
      }
    });
    it('settles lots already closed by a read and preserves other lot reservations', async () => {
      const l = await lot(),
        other = await lot();
      await expire(l.id);
      await db.lot.update({ where: { id: l.id }, data: { status: 'closed' } });
      await Promise.all([
        settlement.settle(l.id),
        wallets.deposit(buyer, { amount: '25', idempotencyKey: randomUUID() }),
      ]);
      expect(await wallets.balance(buyer)).toMatchObject({
        total: '425.00',
        committed: '100.00',
        available: '325.00',
      });
      expect(await db.auctionResult.count({ where: { lotId: other.id } })).toBe(
        0,
      );
    });
    it('rejects missing reservation without partial transfers', async () => {
      const l = await lot();
      await expire(l.id);
      await db.walletHold.updateMany({
        where: { bid: { lotId: l.id } },
        data: { status: 'released' },
      });
      await expect(settlement.settle(l.id)).rejects.toMatchObject({
        status: 409,
      });
      expect(await db.auctionResult.count({ where: { lotId: l.id } })).toBe(0);
      expect(await wallets.balance(buyer)).toMatchObject({ total: '500.00' });
    });
    it('rolls back seller wallet creation when funds are inconsistent', async () => {
      const l = await lot();
      await expire(l.id);
      await db.walletTransaction.deleteMany({
        where: { wallet: { userId: buyer } },
      });
      await expect(settlement.settle(l.id)).rejects.toMatchObject({
        status: 409,
      });
      expect(
        await db.wallet.findUnique({ where: { userId: seller } }),
      ).toBeNull();
      expect(await db.auctionResult.count({ where: { lotId: l.id } })).toBe(0);
      expect(await db.bid.findFirst({ where: { lotId: l.id } })).toMatchObject({
        isWinner: false,
      });
      expect(
        await db.walletHold.findFirst({ where: { bid: { lotId: l.id } } }),
      ).toMatchObject({ status: 'active' });
    });
  },
);
