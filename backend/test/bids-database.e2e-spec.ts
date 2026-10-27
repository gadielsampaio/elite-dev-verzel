import { randomUUID } from 'node:crypto';
import { BidsService } from '../src/bids/bids.service.js';
import { WalletsService } from '../src/wallets/wallets.service.js';
import { LotsService } from '../src/lots/lots.service.js';
import { CatalogService } from '../src/catalog/catalog.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Independent transactions require committed fixtures. Cleanup only IDs created here.
describe.runIf(process.env.RUN_DATABASE_TESTS === '1')(
  'Concurrent bids (PostgreSQL)',
  () => {
    let db: PrismaService,
      bids: BidsService,
      wallets: WalletsService,
      lots: LotsService;
    let userIds: string[], lotIds: string[], ownerId: string;
    async function bidder(amount = '500.00') {
      const user = await db.user.create({
        data: {
          name: 'Bid test',
          email: `bid-test-${randomUUID()}@example.invalid`,
          role: 'bidder',
        },
      });
      userIds.push(user.id);
      await wallets.deposit(user.id, { amount, idempotencyKey: randomUUID() });
      return user.id;
    }
    async function lot(remaining = 600000) {
      const result = await db.lot.create({
        data: {
          ownerId,
          title: 'Bid concurrency fixture',
          status: 'scheduled',
          startTime: new Date(Date.now() - 60000),
          endTime: new Date(Date.now() + remaining),
          startingBid: '100',
          bidIncrement: '5',
        },
      });
      lotIds.push(result.id);
      return result;
    }
    const place = (
      lotId: string,
      userId: string,
      amount: string,
      key = randomUUID(),
    ) => bids.place(lotId, userId, { amount, idempotencyKey: key });
    beforeEach(async () => {
      db = new PrismaService();
      bids = new BidsService(db);
      wallets = new WalletsService(db);
      lots = new LotsService(db, {} as CatalogService);
      userIds = [];
      lotIds = [];
      const owner = await db.user.create({
        data: {
          name: 'Bid test seller',
          email: `bid-test-${randomUUID()}@example.invalid`,
          role: 'auctioneer',
        },
      });
      ownerId = owner.id;
      userIds.push(ownerId);
    });
    afterEach(async () => {
      try {
        await db.walletHold.deleteMany({
          where: { bid: { lotId: { in: lotIds } } },
        });
        await db.bid.deleteMany({ where: { lotId: { in: lotIds } } });
        await db.lot.deleteMany({ where: { id: { in: lotIds } } });
        await db.walletTransaction.deleteMany({
          where: { wallet: { userId: { in: userIds } } },
        });
        await db.wallet.deleteMany({ where: { userId: { in: userIds } } });
        await db.user.deleteMany({ where: { id: { in: userIds } } });
        expect(await db.user.count({ where: { id: { in: userIds } } })).toBe(0);
      } finally {
        await db.$disconnect();
      }
    });
    it('atomically transfers reservations without deactivating eligible bids', async () => {
      const a = await bidder(),
        b = await bidder(),
        l = await lot();
      const first = await place(l.id, a, '100.00');
      await expect(place(l.id, a, '105.00')).rejects.toMatchObject({
        status: 409,
      });
      await expect(place(l.id, b, '104.99')).rejects.toMatchObject({
        status: 409,
      });
      const second = await place(l.id, b, '105.00');
      expect(await wallets.balance(a)).toMatchObject({
        total: '500.00',
        committed: '0.00',
        available: '500.00',
      });
      expect(await wallets.balance(b)).toMatchObject({
        total: '500.00',
        committed: '105.00',
        available: '395.00',
      });
      expect(
        (await db.bid.findUniqueOrThrow({ where: { id: first.id } })).isActive,
      ).toBe(true);
      expect(
        (await db.walletHold.findUniqueOrThrow({ where: { bidId: first.id } }))
          .status,
      ).toBe('released');
      expect(
        (await db.walletHold.findUniqueOrThrow({ where: { bidId: second.id } }))
          .status,
      ).toBe('active');
      await expect(lots.cancel(l.id, ownerId, {})).rejects.toMatchObject({
        status: 409,
      });
      expect(await db.auctionResult.count({ where: { lotId: l.id } })).toBe(0);
    });
    it('accepts only one of two simultaneous equal bids', async () => {
      const a = await bidder(),
        b = await bidder(),
        l = await lot();
      const result = await Promise.allSettled([
        place(l.id, a, '100.00'),
        place(l.id, b, '100.00'),
      ]);
      expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = result.find((r) => r.status === 'rejected');
      expect(rejected?.status === 'rejected' && rejected.reason.status).toBe(
        409,
      );
      expect(await db.bid.count({ where: { lotId: l.id } })).toBe(1);
      expect(
        await db.walletHold.count({
          where: { bid: { lotId: l.id }, status: 'active' },
        }),
      ).toBe(1);
    });
    it('prevents overspending across simultaneous lots', async () => {
      const a = await bidder('150.00'),
        one = await lot(),
        two = await lot();
      const result = await Promise.allSettled([
        place(one.id, a, '100.00'),
        place(two.id, a, '100.00'),
      ]);
      expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await wallets.balance(a)).toMatchObject({
        total: '150.00',
        committed: '100.00',
        available: '50.00',
      });
      expect(
        await db.bid.count({ where: { lotId: { in: [one.id, two.id] } } }),
      ).toBe(1);
    });
    it('replays concurrent requests once and extends the deadline once', async () => {
      const a = await bidder(),
        l = await lot(60000),
        key = randomUUID();
      const result = await Promise.all(
        Array.from({ length: 4 }, () => place(l.id, a, '100.00', key)),
      );
      expect(new Set(result.map((r) => r.id)).size).toBe(1);
      expect(
        await db.walletHold.count({ where: { bid: { lotId: l.id } } }),
      ).toBe(1);
      expect(
        (
          await db.lot.findUniqueOrThrow({ where: { id: l.id } })
        ).endTime.getTime(),
      ).toBe(l.endTime.getTime() + 120000);
      await db.lot.update({ where: { id: l.id }, data: { status: 'closed' } });
      expect(await place(l.id, a, '100.00', key)).toEqual(result[0]);
    });
    it('rolls back cross-lot key collisions without leaking a reservation', async () => {
      const a = await bidder(),
        one = await lot(60000),
        two = await lot(60000),
        key = randomUUID();
      const result = await Promise.allSettled([
        place(one.id, a, '100.00', key),
        place(two.id, a, '100.00', key),
      ]);
      expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await db.bid.count({ where: { lotId: { in: lotIds } } })).toBe(1);
      expect(await wallets.balance(a)).toMatchObject({ committed: '100.00' });
      for (const l of [one, two]) {
        const count = await db.bid.count({ where: { lotId: l.id } });
        expect(
          (
            await db.lot.findUniqueOrThrow({ where: { id: l.id } })
          ).endTime.getTime(),
        ).toBe(l.endTime.getTime() + (count ? 120000 : 0));
      }
    });
    it('serializes cancellation against the first bid', async () => {
      const a = await bidder(),
        l = await lot();
      const result = await Promise.allSettled([
        place(l.id, a, '100.00'),
        lots.cancel(l.id, ownerId, { reason: 'Race test' }),
      ]);
      expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const saved = await db.lot.findUniqueOrThrow({ where: { id: l.id } }),
        count = await db.bid.count({ where: { lotId: l.id } });
      expect(saved.status === 'cancelled' ? count === 0 : count === 1).toBe(
        true,
      );
      expect((await wallets.balance(a)).committed).toBe(
        count ? '100.00' : '0.00',
      );
    });
    it('coordinates deposits with bid foreign-key checks without deadlocking', async () => {
      const a = await bidder('100.00'),
        l = await lot();
      const results = await Promise.all([
        place(l.id, a, '100.00'),
        wallets.deposit(a, { amount: '20.00', idempotencyKey: randomUUID() }),
      ]);
      expect(results).toHaveLength(2);
      expect(await wallets.balance(a)).toMatchObject({
        total: '120.00',
        committed: '100.00',
        available: '20.00',
      });
    });
    it('locks shared wallets consistently when leaders swap across lots', async () => {
      const a = await bidder(),
        b = await bidder(),
        one = await lot(),
        two = await lot();
      await place(one.id, a, '100.00');
      await place(two.id, b, '100.00');
      await Promise.all([
        place(one.id, b, '105.00'),
        place(two.id, a, '105.00'),
      ]);
      expect(await wallets.balance(a)).toMatchObject({
        committed: '105.00',
        available: '395.00',
      });
      expect(await wallets.balance(b)).toMatchObject({
        committed: '105.00',
        available: '395.00',
      });
      expect(
        await db.walletHold.count({
          where: { bid: { lotId: { in: lotIds } }, status: 'active' },
        }),
      ).toBe(2);
    });
  },
);
