import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ResultsController } from './results.controller.js';
import { ResultsService } from './results.service.js';
const id = '22222222-2222-4222-8222-222222222222';
const winner = '11111111-1111-4111-8111-111111111111';
const owner = '33333333-3333-4333-8333-333333333333';
const otherSeller = '55555555-5555-4555-8555-555555555555';
const stranger = '44444444-4444-4444-8444-444444444444';
describe('Receipt access over HTTP', () => {
  let app: INestApplication;
  beforeAll(async () => {
    vi.stubEnv(
      'JWT_SECRET',
      'receipt-tests-only-secret-at-least-32-characters',
    );
    const tx = {
      lot: {
        findFirst: vi.fn().mockResolvedValue({
          id,
          ownerId: owner,
          title: 'Artwork',
          currency: 'USD',
          status: 'closed',
          endTime: new Date(),
          items: [],
          result: {
            id: 'private-receipt-id',
            endedAt: new Date(),
            settledAt: new Date(),
            winningBid: {
              id: 'private-bid-id',
              bidderId: winner,
              amount: { toFixed: () => '100.00' },
            },
          },
        }),
      },
    };
    const module = await Test.createTestingModule({
      controllers: [ResultsController],
      providers: [
        ResultsService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: (fn: (tx: unknown) => unknown) => fn(tx),
            user: {
              findUnique: ({ where }: { where: { id: string } }) => ({
                id: where.id,
                role: [owner, otherSeller].includes(where.id)
                  ? 'auctioneer'
                  : 'bidder',
                isActive: true,
              }),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: async (token: string) => {
              if (![winner, owner, stranger, otherSeller].includes(token))
                throw Error('invalid');
              return { sub: token, exp: Math.floor(Date.now() / 1000) + 900 };
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  it('public result does not expose the receipt', async () => {
    const { body } = await request(app.getHttpServer())
      .get(`/lots/${id}/result`)
      .expect(200);
    expect(body).toMatchObject({
      status: 'settled',
      receipt: null,
      canViewReceipt: false,
    });
    expect(body.winnerAlias).toBeTypeOf('string');
    expect(JSON.stringify(body)).not.toContain('private-receipt-id');
    expect(JSON.stringify(body)).not.toContain('private-bid-id');
  });

  it('requires authentication for the receipt', async () => {
    await request(app.getHttpServer()).get(`/lots/${id}/receipt`).expect(401);
  });

  it('rejects unrelated users even with a valid login', async () => {
    await request(app.getHttpServer())
      .get(`/lots/${id}/receipt`)
      .set('Authorization', `Bearer ${stranger}`)
      .expect(403);
  });

  it('rejects a different auctioneer', async () => {
    await request(app.getHttpServer())
      .get(`/lots/${id}/receipt`)
      .set('Authorization', `Bearer ${otherSeller}`)
      .expect(403);
  });
  for (const user of [winner, owner])
    it('allows the winner or lot owner ' + user, async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/lots/${id}/receipt`)
        .set('Authorization', `Bearer ${user}`)
        .expect(200);
      expect(body.receipt).toMatchObject({
        id: 'private-receipt-id',
        amount: '100.00',
      });
      const publicResponse = await request(app.getHttpServer())
        .get(`/lots/${id}/result`)
        .set('Authorization', `Bearer ${user}`)
        .expect(200);
      expect(publicResponse.body).toMatchObject({
        canViewReceipt: true,
        receipt: null,
      });
    });

  it('rejects invalid supplied credentials on public personalized reads', async () => {
    await request(app.getHttpServer())
      .get(`/lots/${id}/result`)
      .set('Authorization', 'Bearer invalid')
      .expect(401);
  });
});
