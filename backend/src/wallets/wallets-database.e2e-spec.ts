import { configureTestValidation } from '../../test/support/http-app.js';
import { AuctionEvents } from '../events/auction-events.js';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Real concurrent transactions need committed fixtures. Cleanup targets only IDs created here.
describe.runIf(process.env.RUN_DATABASE_TESTS === '1')(
  'Wallet deposits (PostgreSQL)',
  () => {
    it('credits concurrent retries once and isolates wallets', async () => {
      const db = new PrismaService();
      const userIds: string[] = [];
      const lotIds: string[] = [];
      let app: INestApplication | undefined;
      try {
        for (const role of ['bidder', 'bidder', 'auctioneer'] as const) {
          const user = await db.user.create({
            data: {
              name: 'Wallet test',
              email: `wallet-test-${randomUUID()}@example.invalid`,
              role,
            },
          });
          userIds.push(user.id);
        }
        const module = await Test.createTestingModule({ imports: [AppModule] })
          .overrideProvider(PrismaService)
          .useValue(db)
          .compile();
        app = module.createNestApplication({ logger: false });
        configureTestValidation(app);
        await app.init();
        const http = app.getHttpServer(),
          jwt = module.get(JwtService);
        const tokens = await Promise.all(
          userIds.map((sub) => jwt.signAsync({ sub })),
        );
        const key = randomUUID();
        const notifications: string[] = [];
        const committed: Promise<number>[] = [];
        module.get(AuctionEvents).subscribeAccount((userId) => {
          notifications.push(userId);
          committed.push(
            db.walletTransaction.count({ where: { idempotencyKey: key } }),
          );
        });
        const deposit = (
          token: string,
          amount: string,
          idempotencyKey: string,
        ) =>
          request(http)
            .post('/wallet/deposits')
            .auth(token, { type: 'bearer' })
            .send({ amount, idempotencyKey });
        const results = await Promise.all(
          Array.from({ length: 4 }, () => deposit(tokens[0], '100.10', key)),
        );
        expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201]);
        expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
        expect(notifications).toEqual([userIds[0]]);
        expect(await Promise.all(committed)).toEqual([1]);
        expect(
          await db.walletTransaction.count({ where: { idempotencyKey: key } }),
        ).toBe(1);
        await deposit(tokens[0], '100.11', key).expect(409);
        await deposit(tokens[1], '100.10', key).expect(409);
        await deposit(tokens[2], '100.10', randomUUID()).expect(403);
        const extra = await Promise.all(
          ['0.10', '0.20'].map((amount) =>
            deposit(tokens[0], amount, randomUUID()),
          ),
        );
        expect(extra.every((r) => r.status === 201)).toBe(true);
        const wallet = await db.wallet.findUniqueOrThrow({
          where: { userId: userIds[0] },
        });
        const lot = await db.lot.create({
          data: {
            ownerId: userIds[2],
            title: 'Wallet hold fixture',
            status: 'open',
            startTime: new Date(Date.now() - 60000),
            endTime: new Date(Date.now() + 3600000),
            startingBid: '1',
            bidIncrement: '1',
          },
        });
        lotIds.push(lot.id);
        for (const [status, amount] of [
          ['active', '30.10'],
          ['released', '9.00'],
          ['captured', '5.00'],
        ] as const) {
          const bid = await db.bid.create({
            data: {
              lotId: lot.id,
              bidderId: userIds[0],
              amount,
              idempotencyKey: randomUUID(),
            },
          });
          await db.walletHold.create({
            data: { walletId: wallet.id, bidId: bid.id, amount, status },
          });
        }
        const balance = await request(http)
          .get('/wallet')
          .auth(tokens[0], { type: 'bearer' })
          .expect(200);
        expect(balance.body).toMatchObject({
          total: '100.40',
          committed: '30.10',
          available: '70.30',
        });
        const other = await request(http)
          .get('/wallet')
          .auth(tokens[1], { type: 'bearer' })
          .expect(200);
        expect(other.body).toMatchObject({
          total: '0.00',
          committed: '0.00',
          available: '0.00',
        });
        const raceKey = randomUUID();
        const race = await Promise.all([
          deposit(tokens[0], '1.00', raceKey),
          deposit(tokens[1], '1.00', raceKey),
        ]);
        expect(race.map((r) => r.status).sort((a, b) => a - b)).toEqual([
          201, 409,
        ]);
        expect(
          await db.walletTransaction.count({
            where: { idempotencyKey: raceKey },
          }),
        ).toBe(1);
      } finally {
        if (app) await app.close();
        await db.walletHold.deleteMany({
          where: { wallet: { userId: { in: userIds } } },
        });
        await db.bid.deleteMany({ where: { lotId: { in: lotIds } } });
        await db.lot.deleteMany({ where: { id: { in: lotIds } } });
        await db.walletTransaction.deleteMany({
          where: { wallet: { userId: { in: userIds } } },
        });
        await db.wallet.deleteMany({ where: { userId: { in: userIds } } });
        await db.user.deleteMany({ where: { id: { in: userIds } } });
        expect(await db.user.count({ where: { id: { in: userIds } } })).toBe(0);
        await db.$disconnect();
      }
    }, 30000);
  },
);
