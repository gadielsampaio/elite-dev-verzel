import { configureTestValidation } from '../../test/support/http-app.js';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LotStatus } from '../generated/prisma/client.js';

// Opt in with RUN_DATABASE_TESTS=1. All fixtures and lifecycle writes roll back.
describe.runIf(process.env.RUN_DATABASE_TESTS === '1')(
  'Lot lifecycle (PostgreSQL)',
  () => {
    it('transitions, filters and cancels atomically without leaving test data', async () => {
      const db = new PrismaService();
      const email = `lot-lifecycle-${randomUUID()}@example.invalid`;
      const rollback = new Error('rollback fixtures');
      const ids: string[] = [];
      try {
        try {
          await db.$transaction(
            async (tx) => {
              const owner = await tx.user.create({
                data: { name: 'Test owner', email, role: 'auctioneer' },
              });
              const bidder = await tx.user.create({
                data: {
                  name: 'Test bidder',
                  email: `bidder-${email}`,
                  role: 'bidder',
                },
              });
              const now = Date.now();
              const create = async (
                status: LotStatus,
                start: number,
                end: number,
              ) => {
                const lot = await tx.lot.create({
                  data: {
                    ownerId: owner.id,
                    title: 'Lifecycle fixture',
                    status,
                    startTime: new Date(now + start),
                    endTime: new Date(now + end),
                    startingBid: '100',
                    bidIncrement: '1',
                  },
                });
                ids.push(lot.id);
                return lot;
              };
              const scheduled = await create('scheduled', 3600000, 7200000);
              const live = await create('scheduled', -3600000, 3600000);
              const savedImage = await tx.item.create({
                data: {
                  lotId: live.id,
                  name: 'Image fixture',
                  estimatedValue: '500',
                  imageUrl: 'https://example.org/web.jpg',
                  printImageUrl: 'https://example.org/print.jpg',
                },
              });
              expect(
                await tx.item.findUnique({ where: { id: savedImage.id } }),
              ).toMatchObject({
                imageUrl: 'https://example.org/web.jpg',
                printImageUrl: 'https://example.org/print.jpg',
              });
              const expired = await create('open', -7200000, -3600000);
              const skippedWindow = await create(
                'scheduled',
                -7200000,
                -3600000,
              );
              const draft = await create('draft', -3600000, 3600000);
              const cancelled = await create('cancelled', -3600000, 3600000);
              const withBids = await create('open', -3600000, 3600000);
              const reservedBid = await tx.bid.create({
                data: {
                  lotId: withBids.id,
                  bidderId: bidder.id,
                  amount: '100',
                  idempotencyKey: randomUUID(),
                  isActive: true,
                },
              });
              const wallet = await tx.wallet.create({
                data: { userId: bidder.id },
              });
              await tx.walletTransaction.create({
                data: {
                  walletId: wallet.id,
                  type: 'deposit',
                  amount: '150',
                  idempotencyKey: randomUUID(),
                },
              });
              const hold = await tx.walletHold.create({
                data: {
                  walletId: wallet.id,
                  bidId: reservedBid.id,
                  amount: '100',
                },
              });
              // Services execute within this outer transaction, so every write is rolled back.
              const transactionalDb = new Proxy(tx, {
                get(target, key) {
                  if (key === '$transaction')
                    return (callback: (client: typeof tx) => unknown) =>
                      callback(tx);
                  return Reflect.get(target, key);
                },
              });
              const module = await Test.createTestingModule({
                imports: [AppModule],
              })
                .overrideProvider(PrismaService)
                .useValue(transactionalDb)
                .compile();
              const app = module.createNestApplication({ logger: false });
              configureTestValidation(app);
              try {
                await app.init();
                const http = app.getHttpServer();
                const token = await module
                  .get(JwtService)
                  .signAsync({ sub: owner.id });
                const otherOwner = await tx.user.create({
                  data: {
                    name: 'Other owner',
                    email: `other-${email}`,
                    role: 'auctioneer',
                  },
                });
                const otherLot = await tx.lot.create({
                  data: {
                    ownerId: otherOwner.id,
                    title: 'Not yours',
                    status: 'scheduled',
                    startTime: new Date(now + 3600000),
                    endTime: new Date(now + 7200000),
                    startingBid: '100',
                    bidIncrement: '1',
                  },
                });
                ids.push(otherLot.id);
                const own = await request(http)
                  .get('/lots/mine?limit=50')
                  .auth(token, { type: 'bearer' })
                  .expect(200);
                expect(
                  own.body.items.every(
                    (item: { ownerId: string }) => item.ownerId === owner.id,
                  ),
                ).toBe(true);
                expect(
                  own.body.items.some(
                    (item: { id: string }) => item.id === otherLot.id,
                  ),
                ).toBe(false);
                expect(
                  own.body.items.find(
                    (item: { id: string }) => item.id === withBids.id,
                  ).canCancel,
                ).toBe(true);
                expect(
                  own.body.items.find(
                    (item: { id: string }) => item.id === cancelled.id,
                  ).status,
                ).toBe('cancelled');
                const list = await request(http)
                  .get('/lots?limit=50')
                  .expect(200);
                const returned = new Map(
                  list.body.items.map((lot: { id: string; status: string }) => [
                    lot.id,
                    lot.status,
                  ]),
                );
                expect(returned.get(scheduled.id)).toBe('scheduled');
                expect(returned.get(live.id)).toBe('open');
                expect(returned.get(expired.id)).toBe('closed');
                expect(returned.get(skippedWindow.id)).toBe('closed');
                expect(returned.has(draft.id)).toBe(false);
                expect(returned.has(cancelled.id)).toBe(false);
                const filtered = await request(http)
                  .get('/lots?status=open&limit=50')
                  .expect(200);
                expect(
                  filtered.body.items.every(
                    (lot: { status: string }) => lot.status === 'open',
                  ),
                ).toBe(true);
                expect(
                  (await tx.lot.findUniqueOrThrow({ where: { id: live.id } }))
                    .status,
                ).toBe('open');
                const page1 = await request(http)
                  .get('/lots?limit=1')
                  .expect(200);
                const page2 = await request(http)
                  .get('/lots?limit=1&page=2')
                  .expect(200);
                expect(page1.body.items[0].id).not.toBe(page2.body.items[0].id);
                expect(page1.body.total).toBe(page2.body.total);
                const first = await request(http)
                  .patch(`/lots/${live.id}/cancel`)
                  .auth(token, { type: 'bearer' })
                  .send({ reason: 'Withdrawn' })
                  .expect(200);
                expect(first.body.status).toBe('cancelled');
                const repeat = await request(http)
                  .patch(`/lots/${live.id}/cancel`)
                  .auth(token, { type: 'bearer' })
                  .send({ reason: 'Changed' })
                  .expect(200);
                expect(repeat.body.cancelledAt).toBe(first.body.cancelledAt);
                expect(repeat.body.cancellationReason).toBe('Withdrawn');
                await request(http).get(`/lots/${live.id}`).expect(404);
                const after = await request(http)
                  .get('/lots?limit=50')
                  .expect(200);
                expect(
                  after.body.items.some(
                    (lot: { id: string }) => lot.id === live.id,
                  ),
                ).toBe(false);
                const bidderToken = await module
                  .get(JwtService)
                  .signAsync({ sub: bidder.id });
                const beforeRelease = await request(http)
                  .get('/wallet')
                  .auth(bidderToken, { type: 'bearer' })
                  .expect(200);
                expect(beforeRelease.body).toMatchObject({
                  total: '150.00',
                  committed: '100.00',
                  available: '50.00',
                });
                for (let attempt = 0; attempt < 2; attempt++) {
                  await request(http)
                    .patch(`/lots/${withBids.id}/cancel`)
                    .auth(token, { type: 'bearer' })
                    .send({})
                    .expect(200);
                }
                const afterRelease = await request(http)
                  .get('/wallet')
                  .auth(bidderToken, { type: 'bearer' })
                  .expect(200);
                expect(afterRelease.body).toMatchObject({
                  total: '150.00',
                  committed: '0.00',
                  available: '150.00',
                });
                expect(
                  await tx.walletHold.findUnique({ where: { id: hold.id } }),
                ).toMatchObject({ status: 'released' });
                expect(
                  await tx.bid.findUnique({ where: { id: reservedBid.id } }),
                ).toMatchObject({ isActive: true, amount: reservedBid.amount });
                const memos = await request(http)
                  .get('/wallet/credit-memos')
                  .auth(bidderToken, { type: 'bearer' })
                  .expect(200);
                expect(memos.body).toHaveLength(1);
                expect(memos.body[0]).toMatchObject({
                  lotId: withBids.id,
                  amount: '100.00',
                  currency: 'USD',
                });
                await request(http).get('/wallet/credit-memos').expect(401);
                await request(http)
                  .get('/wallet/credit-memos')
                  .auth(token, { type: 'bearer' })
                  .expect(200)
                  .expect([]);
                await request(http)
                  .patch(`/lots/${expired.id}/cancel`)
                  .auth(token, { type: 'bearer' })
                  .send({})
                  .expect(409);
                expect(
                  await tx.auctionResult.count({
                    where: { lotId: { in: ids } },
                  }),
                ).toBe(0);
              } finally {
                await app.close();
              }
              throw rollback;
            },
            { timeout: 20000 },
          );
        } catch (error) {
          if (error !== rollback) throw error;
        }
        expect(await db.user.count({ where: { email } })).toBe(0);
        expect(await db.lot.count({ where: { id: { in: ids } } })).toBe(0);
        expect(await db.bid.count({ where: { lotId: { in: ids } } })).toBe(0);
      } finally {
        await db.$disconnect();
      }
    }, 30000);
  },
);
