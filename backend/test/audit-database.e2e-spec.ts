import { AuctionEvents } from '../src/events/auction-events.js';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { BidsService } from '../src/bids/bids.service.js';
import { WalletsService } from '../src/wallets/wallets.service.js';
import { AuditService } from '../src/audit/audit.service.js';
import { AuditController } from '../src/audit/audit.controller.js';
import { CheckpointStore } from '../src/audit/checkpoint-store.js';
import { SettlementService } from '../src/settlement/settlement.service.js';
import { hashBidAudit } from '../src/audit/bid-hash.js';

describe.runIf(process.env.RUN_DATABASE_TESTS === '1')(
  'Public audit (PostgreSQL)',
  () => {
    describe.each(['external', 'database'])('%s checkpoints', (storage) => {
      let db: PrismaService, audit: AuditService, bids: BidsService;
      let directory: string, lotId: string, ownerId: string, bidderId: string;
      const place = (key = randomUUID()) =>
        bids.place(lotId, bidderId, { amount: '100.00', idempotencyKey: key });
      beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), 'auction-audit-'));
        vi.stubEnv(
          'AUDIT_CHECKPOINT_DIR',
          storage === 'external' ? directory : '',
        );
        db = new PrismaService();
        audit = new AuditService(db);
        bids = new BidsService(db, new AuctionEvents());
        ownerId = (
          await db.user.create({
            data: {
              name: 'Audit test owner',
              email: `${randomUUID()}@example.invalid`,
              role: 'auctioneer',
            },
          })
        ).id;
        bidderId = (
          await db.user.create({
            data: {
              name: 'Audit test bidder',
              email: `${randomUUID()}@example.invalid`,
              role: 'bidder',
            },
          })
        ).id;
        await new WalletsService(db).deposit(bidderId, {
          amount: '500.00',
          idempotencyKey: randomUUID(),
        });
        lotId = (
          await db.lot.create({
            data: {
              ownerId,
              title: 'Audit test',
              status: 'open',
              startingBid: '100',
              bidIncrement: '5',
              startTime: new Date(Date.now() - 60000),
              endTime: new Date(Date.now() + 600000),
            },
          })
        ).id;
      });
      afterEach(async () => {
        try {
          await db.walletTransaction.deleteMany({
            where: { auctionResult: { lotId } },
          });
          await db.auctionResult.deleteMany({ where: { lotId } });
          await db.walletHold.deleteMany({ where: { bid: { lotId } } });
          await db.bid.deleteMany({ where: { lotId } });
          await db.lot.deleteMany({ where: { id: lotId } });
          await db.walletTransaction.deleteMany({
            where: { wallet: { userId: { in: [ownerId, bidderId] } } },
          });
          await db.wallet.deleteMany({
            where: { userId: { in: [ownerId, bidderId] } },
          });
          await db.user.deleteMany({
            where: { id: { in: [ownerId, bidderId] } },
          });
        } finally {
          await db.$disconnect();
          vi.unstubAllEnvs();
          await rm(directory, { recursive: true, force: true });
        }
      });
      it('recovers confirmation after restart, verifies without login and hides private identities', async () => {
        const key = randomUUID();
        await place(key);
        expect((await audit.verify(lotId)).status).toBe(
          storage === 'external' ? 'not_verifiable' : 'intact',
        );
        await new AuditService(db).confirm(lotId);
        await place(key); // Replay must not create a second witness.
        if (storage === 'external')
          expect(await new CheckpointStore().read(lotId)).toHaveLength(1);
        const module = await Test.createTestingModule({
          controllers: [AuditController],
          providers: [{ provide: AuditService, useValue: audit }],
        }).compile();
        const app = module.createNestApplication();
        await app.init();
        try {
          const response = await request(app.getHttpServer())
            .get(`/lots/${lotId}/audit`)
            .expect(200);
          expect(response.body.status).toBe('intact');
          expect(response.body.history).toHaveLength(1);
          expect(JSON.stringify(response.body)).not.toContain(bidderId);
          expect(JSON.stringify(response.body)).not.toContain(
            '@example.invalid',
          );
          await request(app.getHttpServer())
            .get('/lots/not-a-uuid/audit')
            .expect(400);
        } finally {
          await app.close();
        }
      });
      it('detects database history rewriting even with recomputed hashes', async () => {
        const bid = await place();
        await audit.confirm(lotId);
        const entry = (await audit.verify(lotId)).entries[0];
        const changed = { ...entry, amount: '200.00' };
        await db.bid.update({ where: { id: bid.id }, data: { amount: '200' } });
        await db.bidAuditEntry.update({
          where: { bidId: bid.id },
          data: { amount: '200', hash: hashBidAudit(changed) },
        });
        expect((await audit.verify(lotId)).status).toBe('tampered');
      });
      it('detects bidder identity changes', async () => {
        const bid = await place();
        await audit.confirm(lotId);
        await db.bid.update({
          where: { id: bid.id },
          data: { bidderId: ownerId },
        });
        expect((await audit.verify(lotId)).status).toBe('tampered');
      });
      it.each(['microseconds', 'eligibility'])(
        'detects direct edits to %s',
        async (field) => {
          const bid = await place();
          await audit.confirm(lotId);
          if (field === 'microseconds')
            await db.$executeRaw`UPDATE bids SET created_at = created_at + interval '1 microsecond' WHERE id = ${bid.id}::uuid`;
          else
            await db.bid.update({
              where: { id: bid.id },
              data: { isActive: false },
            });
          expect((await audit.verify(lotId)).status).toBe('tampered');
        },
      );
      it('detects insertion directly into PostgreSQL', async () => {
        await place();
        await audit.confirm(lotId);
        await db.bid.create({
          data: {
            lotId,
            bidderId,
            amount: '150',
            idempotencyKey: randomUUID(),
            isActive: false,
          },
        });
        expect((await audit.verify(lotId)).status).toBe('tampered');
      });
      it('detects deletion of the complete lot and its history', async () => {
        await place();
        await audit.confirm(lotId);
        await db.walletHold.deleteMany({ where: { bid: { lotId } } });
        await db.bid.deleteMany({ where: { lotId } });
        await db.lot.delete({ where: { id: lotId } });
        expect((await audit.verify(lotId)).status).toBe('tampered');
      });
      it.runIf(storage === 'external')(
        'fails bidding atomically when configured checkpoint storage is inaccessible',
        async () => {
          const file = join(directory, 'not-a-directory');
          await writeFile(file, 'fixture');
          vi.stubEnv('AUDIT_CHECKPOINT_DIR', file);
          await expect(place()).rejects.toThrow('Audit checkpoint unavailable');
          expect(await db.bid.count({ where: { lotId } })).toBe(0);
          expect(await db.bidAuditEntry.count({ where: { lotId } })).toBe(0);
          expect(await db.walletHold.count({ where: { bid: { lotId } } })).toBe(
            0,
          );
          expect((await audit.verify(lotId)).status).toBe('not_verifiable');
        },
      );
      it.runIf(storage === 'external')(
        'retains orphan witnesses after transaction rollback and never silently blesses them',
        async () => {
          const original = db.$transaction.bind(db);
          vi.spyOn(db, '$transaction').mockImplementationOnce((async (
            callback: (tx: unknown) => Promise<unknown>,
          ) =>
            original(async (tx) => {
              await callback(tx);
              throw new Error('Commit failed fixture');
            })) as unknown as typeof db.$transaction);
          await expect(place()).rejects.toThrow('Commit failed fixture');
          await audit.confirm(lotId);
          expect(await db.bid.count({ where: { lotId } })).toBe(0);
          expect(await new CheckpointStore().read(lotId)).toHaveLength(1);
          expect((await audit.verify(lotId)).status).toBe('not_verifiable');
        },
      );
      it('remains intact after real settlement', async () => {
        await place();
        await audit.confirm(lotId);
        await db.lot.update({
          where: { id: lotId },
          data: { endTime: new Date(Date.now() - 1) },
        });
        await new SettlementService(db, new AuctionEvents()).settle(lotId);
        expect((await audit.verify(lotId)).status).toBe('intact');
      });
      it('detects a winner flag set outside settlement', async () => {
        const bid = await place();
        await db.bid.update({
          where: { id: bid.id },
          data: { isWinner: true },
        });
        expect((await audit.verify(lotId)).status).toBe('tampered');
      });
      it('retains evidence after an edit is reverted', async () => {
        const bid = await place();
        await audit.confirm(lotId);
        await db.$executeRaw`UPDATE bids SET amount = 101 WHERE id = ${bid.id}::uuid`;
        await db.$executeRaw`UPDATE bids SET amount = 100 WHERE id = ${bid.id}::uuid`;
        expect((await audit.verify(lotId)).status).toBe('tampered');
      });
      it('rejects direct evidence writes and truncation', async () => {
        await place();
        await expect(
          db.$executeRaw`UPDATE bid_audit_history SET operation = 'DELETE' WHERE lot_id = ${lotId}::uuid`,
        ).rejects.toThrow('append-only');
        await expect(
          db.$executeRaw`DELETE FROM bid_audit_history WHERE lot_id = ${lotId}::uuid`,
        ).rejects.toThrow('append-only');
        await expect(
          db.$executeRaw`INSERT INTO bid_audit_history (lot_id, source_table, operation) VALUES (${lotId}::uuid, 'bids', 'INSERT')`,
        ).rejects.toThrow('trigger-managed');
        // Transaction rollback ensures a broken guard cannot erase unrelated data.
        for (const table of [
          'bid_audit_history',
          'bids',
          'bid_audit_entries',
        ]) {
          await expect(
            db.$transaction(async (tx) => {
              await tx.$executeRawUnsafe(`TRUNCATE ${table} CASCADE`);
              throw new Error('Truncate unexpectedly allowed');
            }),
          ).rejects.toThrow(/append-only|Cannot truncate/);
        }
      });
      it('rolls back trigger evidence with failed transactions', async () => {
        await expect(
          db.$transaction(async (tx) => {
            await tx.bid.create({
              data: {
                lotId,
                bidderId,
                amount: '100',
                idempotencyKey: randomUUID(),
              },
            });
            throw new Error('rollback fixture');
          }),
        ).rejects.toThrow('rollback fixture');
        expect(await db.bidAuditHistory.count({ where: { lotId } })).toBe(0);
        expect((await audit.verify(lotId)).status).toBe('not_verifiable');
      });
      it('does not certify pre-migration bids', async () => {
        vi.stubEnv('AUDIT_CHECKPOINT_DIR', '');
        // Simulate one legacy row without dropping or resetting the database.
        // DDL and row insertion are atomic; the trigger is re-enabled before commit.
        await db.$transaction(async (tx) => {
          await tx.$executeRaw`ALTER TABLE bids DISABLE TRIGGER capture_bids_history`;
          await tx.bid.create({
            data: {
              lotId,
              bidderId,
              amount: '50',
              isActive: false,
              idempotencyKey: randomUUID(),
            },
          });
          await tx.$executeRaw`ALTER TABLE bids ENABLE TRIGGER capture_bids_history`;
        });
        expect((await audit.verify(lotId)).status).toBe('not_verifiable');
        await place();
        expect((await audit.verify(lotId)).status).toBe('not_verifiable');
      });
      it('detects unpaired SQL insertions even before the first accepted bid', async () => {
        await db.bid.create({
          data: {
            lotId,
            bidderId,
            amount: '50',
            idempotencyKey: randomUUID(),
            isActive: false,
          },
        });
        await place();
        await audit.confirm(lotId);
        const result = await audit.verify(lotId);
        expect(result.status).toBe('tampered');
        expect(result.history).toHaveLength(2);
      });
    });
  },
);
