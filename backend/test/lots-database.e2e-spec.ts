import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { LotStatus } from '../src/generated/prisma/client.js';

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
              const expired = await create('open', -7200000, -3600000);
              const skippedWindow = await create(
                'scheduled',
                -7200000,
                -3600000,
              );
              const draft = await create('draft', -3600000, 3600000);
              const cancelled = await create('cancelled', -3600000, 3600000);
              const withBids = await create('open', -3600000, 3600000);
              await tx.bid.create({
                data: {
                  lotId: withBids.id,
                  bidderId: bidder.id,
                  amount: '100',
                  idempotencyKey: randomUUID(),
                  isActive: false,
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
              app.useGlobalPipes(
                new ValidationPipe({
                  whitelist: true,
                  forbidNonWhitelisted: true,
                  transform: true,
                }),
              );
              try {
                await app.init();
                const http = app.getHttpServer();
                const token = await module
                  .get(JwtService)
                  .signAsync({ sub: owner.id });
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
                await request(http)
                  .patch(`/lots/${withBids.id}/cancel`)
                  .auth(token, { type: 'bearer' })
                  .send({})
                  .expect(409);
                expect(
                  (
                    await tx.lot.findUniqueOrThrow({
                      where: { id: withBids.id },
                    })
                  ).status,
                ).toBe('open');
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
