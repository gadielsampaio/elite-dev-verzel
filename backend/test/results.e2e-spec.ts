import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { vi } from 'vitest';
import { ResultsController } from '../src/settlement/results.controller.js';
import { ResultsService } from '../src/settlement/results.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { bidderAlias } from '../src/bids/bidder-alias.js';

describe('Public auction results', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const bidder = '22222222-2222-4222-8222-222222222222';
  const tx = { lot: { findFirst: vi.fn() }, bid: { count: vi.fn() } };
  const transaction = vi.fn();
  let app: INestApplication;
  const closed = {
    id,
    title: 'Saved lot',
    currency: 'USD',
    endTime: new Date('2020-01-01'),
    status: 'closed',
    items: [{ name: 'Saved artwork', imageUrl: null }],
    result: null,
  };
  beforeAll(async () => {
    vi.stubEnv('JWT_SECRET', 'test-only-secret-with-at-least-32-characters');
    const module = await Test.createTestingModule({
      controllers: [ResultsController],
      providers: [
        ResultsService,
        { provide: PrismaService, useValue: { $transaction: transaction } },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    vi.resetAllMocks();
    transaction.mockImplementation((fn) => fn(tx));
    tx.lot.findFirst.mockResolvedValue(closed);
    tx.bid.count.mockResolvedValue(0);
  });
  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });
  const get = () => request(app.getHttpServer()).get(`/lots/${id}/result`);
  it('returns a public receipt without account identities or raw snapshots', async () => {
    tx.lot.findFirst.mockResolvedValue({
      ...closed,
      result: {
        id: 'receipt',
        endedAt: closed.endTime,
        settledAt: closed.endTime,
        winningBid: {
          id: 'bid',
          bidderId: bidder,
          amount: new Prisma.Decimal('9007199254740993.01'),
        },
      },
    });
    const res = await get().expect(200);
    expect(res.body).toMatchObject({
      status: 'settled',
      receipt: {
        amount: '9007199254740993.01',
        winnerAlias: bidderAlias(id, bidder),
      },
    });
    expect(JSON.stringify(res.body)).not.toContain(bidder);
    expect(Object.keys(res.body.receipt).sort()).toEqual([
      'amount',
      'endedAt',
      'id',
      'settledAt',
      'winnerAlias',
      'winningBidId',
    ]);
    expect(tx.bid.count).not.toHaveBeenCalled();
    expect(transaction.mock.calls[0][1]).toEqual({
      isolationLevel: 'RepeatableRead',
    });
  });
  it('reports no winner only for closed lots without eligible bids', async () => {
    expect((await get().expect(200)).body).toMatchObject({
      status: 'no_winner',
      receipt: null,
    });
  });
  it('does not equate a closed lot with a completed sale', async () => {
    tx.bid.count.mockResolvedValue(2);
    expect((await get().expect(200)).body).toMatchObject({
      status: 'pending_settlement',
      receipt: null,
    });
  });
  it('keeps an expired but unprocessed lot pending', async () => {
    tx.lot.findFirst.mockResolvedValue({ ...closed, status: 'open' });
    expect((await get().expect(200)).body.status).toBe('pending_settlement');
  });
  it('does not expose an unsettled result as a receipt', async () => {
    tx.lot.findFirst.mockResolvedValue({
      ...closed,
      result: { settledAt: null },
    });
    expect((await get().expect(200)).body).toMatchObject({
      status: 'pending_settlement',
      receipt: null,
    });
  });
  it('reports a future deadline without querying bids', async () => {
    tx.lot.findFirst.mockResolvedValue({
      ...closed,
      endTime: new Date(Date.now() + 600000),
      status: 'open',
    });
    expect((await get().expect(200)).body.status).toBe('awaiting_close');
    expect(tx.bid.count).not.toHaveBeenCalled();
  });
  it('hides missing and unpublished lots', async () => {
    tx.lot.findFirst.mockResolvedValue(null);
    await get().expect(404);
    expect(tx.lot.findFirst.mock.calls[0][0].where.status.in).toEqual([
      'scheduled',
      'open',
      'closed',
    ]);
  });
  it('validates the lot ID before accessing storage', async () => {
    await request(app.getHttpServer()).get('/lots/bad/result').expect(400);
    expect(transaction).not.toHaveBeenCalled();
  });
});
