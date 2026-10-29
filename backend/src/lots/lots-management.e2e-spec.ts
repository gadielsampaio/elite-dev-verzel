import { AuctionEvents } from '../events/auction-events.js';
import { configureTestValidation } from '../../test/support/http-app.js';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from '../app.module.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('Lot listing and cancellation (HTTP)', () => {
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const lotId = '22222222-2222-4222-8222-222222222222';
  const prisma = {
    user: { findUnique: vi.fn() },
    lot: {
      updateManyAndReturn: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    bid: { count: vi.fn() },
    auctionResult: { findUnique: vi.fn() },
    walletHold: { findMany: vi.fn(), update: vi.fn() },
    auditEvent: { create: vi.fn() },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  };
  let app: INestApplication;
  let token: string;
  let accountNotification: ReturnType<typeof vi.spyOn>;
  let lot: {
    id: string;
    ownerId: string;
    status: string;
    endTime: Date;
    cancelledAt?: Date;
    cancellationReason?: string;
  };
  beforeAll(async () => {
    vi.stubEnv('JWT_SECRET', 'test-only-secret-with-at-least-32-characters');
    vi.stubEnv('CATALOG_PROVIDER', 'mock');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    accountNotification = vi.spyOn(module.get(AuctionEvents), 'publishAccount');
    token = await module.get(JwtService).signAsync({ sub: ownerId });
    app = module.createNestApplication();
    configureTestValidation(app);
    await app.init();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.lot.updateManyAndReturn.mockResolvedValue([]);
    lot = {
      id: lotId,
      ownerId,
      status: 'scheduled',
      endTime: new Date(Date.now() + 3600000),
    };
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => unknown) => fn(prisma),
    );
    prisma.$queryRaw.mockResolvedValue([{ id: lotId }]);
    prisma.user.findUnique.mockResolvedValue({
      id: ownerId,
      role: 'auctioneer',
      isActive: true,
    });
    prisma.lot.findUniqueOrThrow.mockImplementation(() => Promise.resolve(lot));
    prisma.bid.count.mockResolvedValue(0);
    prisma.auctionResult.findUnique.mockResolvedValue(null);
    prisma.walletHold.findMany.mockResolvedValue([]);
    prisma.lot.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...lot, ...data }),
    );
    prisma.lot.findMany.mockResolvedValue([]);
    prisma.lot.count.mockResolvedValue(0);
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });
  const cancel = (body: object = {}) =>
    request(app.getHttpServer())
      .patch(`/lots/${lotId}/cancel`)
      .auth(token, { type: 'bearer' })
      .send(body);

  it('lists public lots with pagination, status filter and stable order', async () => {
    await request(app.getHttpServer())
      .get('/lots?status=open&page=2&limit=5')
      .expect(200)
      .expect({ items: [], total: 0, page: 2, limit: 5 });
    expect(prisma.lot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'open' },
        skip: 5,
        take: 5,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(prisma.lot.count).toHaveBeenCalledWith({
      where: { status: 'open' },
    });
    const [close, open] = prisma.lot.updateManyAndReturn.mock.calls.map(
      ([query]) => query,
    );
    expect(close).toMatchObject({
      where: {
        status: { in: ['scheduled', 'open'] },
        endTime: { lte: expect.any(Date) },
      },
      data: { status: 'closed' },
    });
    expect(open).toMatchObject({
      where: {
        status: 'scheduled',
        startTime: { lte: close.where.endTime.lte },
        endTime: { gt: close.where.endTime.lte },
      },
      data: { status: 'open' },
    });
  });

  it('excludes draft/cancelled states by default', async () => {
    await request(app.getHttpServer()).get('/lots').expect(200);
    expect(prisma.lot.findMany.mock.calls[0][0].where).toEqual({
      status: { in: ['scheduled', 'open', 'closed'] },
    });
  });

  it.each([
    'status=cancelled',
    'status=draft',
    'status=live',
    'page=0',
    'page=1.5',
    'limit=51',
    'limit=abc',
    'ownerId=spoof',
  ])('rejects invalid query %s', async (query) => {
    await request(app.getHttpServer())
      .get('/lots?' + query)
      .expect(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lists only token-owned lots, including cancellations, with bid eligibility', async () => {
    prisma.lot.findMany.mockResolvedValue([
      { ...lot, _count: { bids: 0 } },
      { ...lot, id: 'with-bids', _count: { bids: 1 } },
      { ...lot, id: 'cancelled', status: 'cancelled', _count: { bids: 0 } },
    ]);
    prisma.lot.count.mockResolvedValue(3);
    const response = await request(app.getHttpServer())
      .get('/lots/mine?page=2&limit=5')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(
      response.body.items.map((item: { canCancel: boolean }) => item.canCancel),
    ).toEqual([true, true, false]);
    expect(response.body.items[0]).not.toHaveProperty('_count');
    expect(prisma.lot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId }, skip: 5, take: 5 }),
    );
    expect(prisma.lot.count).toHaveBeenCalledWith({ where: { ownerId } });
    expect(
      prisma.lot.updateManyAndReturn.mock.calls.every(
        ([args]) => args.where.ownerId === ownerId,
      ),
    ).toBe(true);
  });

  it('protects the seller list and rejects owner spoofing', async () => {
    await request(app.getHttpServer()).get('/lots/mine').expect(401);
    await request(app.getHttpServer())
      .get('/lots/mine?ownerId=spoof')
      .auth(token, { type: 'bearer' })
      .expect(400);
    for (const role of ['bidder', 'admin']) {
      prisma.user.findUnique.mockResolvedValue({
        id: ownerId,
        role,
        isActive: true,
      });
      await request(app.getHttpServer())
        .get('/lots/mine')
        .auth(token, { type: 'bearer' })
        .expect(403);
    }
    expect(prisma.lot.findMany).not.toHaveBeenCalled();
  });

  it.each(['scheduled', 'open'])(
    'allows owner cancellation of a %s lot without bids',
    async (status) => {
      lot.status = status;
      const res = await cancel({ reason: '  No longer available  ' }).expect(
        200,
      );
      expect(res.body).toMatchObject({
        status: 'cancelled',
        cancellationReason: 'No longer available',
      });
      expect(res.body.cancelledAt).toBeTruthy();
      expect(prisma.walletHold.findMany).toHaveBeenCalled();
      expect(prisma.$queryRaw).toHaveBeenCalled();
    },
  );
  it('requires login', async () => {
    await request(app.getHttpServer())
      .patch(`/lots/${lotId}/cancel`)
      .send({})
      .expect(401);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['bidder', 'admin'])('rejects %s cancellation', async (role) => {
    prisma.user.findUnique.mockResolvedValue({
      id: ownerId,
      role,
      isActive: true,
    });
    await cancel().expect(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects another auctioneer', async () => {
    lot.ownerId = lotId;
    await cancel().expect(403);
    expect(prisma.lot.update).not.toHaveBeenCalled();
  });

  it('returns 404 for missing lots', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await cancel().expect(404);
  });

  it('releases reservations and records exact credit memos without changing bids', async () => {
    const hold = {
      id: 'hold',
      walletId: 'wallet',
      bidId: 'bid',
      amount: new Prisma.Decimal('9007199254740993.01'),
      wallet: { userId: 'bidder' },
    };
    prisma.walletHold.findMany.mockResolvedValue([hold]);
    await cancel().expect(200);
    expect(accountNotification).toHaveBeenCalledExactlyOnceWith('bidder');
    expect(prisma.walletHold.update).toHaveBeenCalledWith({
      where: { id: hold.id },
      data: { status: 'released', releasedAt: expect.any(Date) },
    });
    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'lot.credit_memo',
        entityId: hold.id,
        lotId,
        metadata: expect.objectContaining({
          bidderId: 'bidder',
          amount: '9007199254740993.01',
          bidId: 'bid',
        }),
      }),
    });
  });

  it('rejects a lot with an existing settlement result', async () => {
    prisma.auctionResult.findUnique.mockResolvedValue({ id: 'result' });
    await cancel().expect(409);
    expect(prisma.walletHold.update).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
    expect(accountNotification).not.toHaveBeenCalled();
  });

  it.each(['closed', 'draft', 'expired'])('rejects %s lots', async (status) => {
    if (status === 'expired') lot.endTime = new Date(Date.now() - 1000);
    else lot.status = status;
    await cancel().expect(409);
    expect(prisma.lot.update).not.toHaveBeenCalled();
  });

  it('repeated cancellation preserves its original time/reason', async () => {
    lot.status = 'cancelled';
    lot.cancelledAt = new Date();
    lot.cancellationReason = 'original';
    const res = await cancel({ reason: 'replacement' }).expect(200);
    expect(res.body.cancelledAt).toBe(lot.cancelledAt.toISOString());
    expect(res.body.cancellationReason).toBe('original');
    expect(prisma.walletHold.update).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
    expect(accountNotification).not.toHaveBeenCalled();
    expect(prisma.lot.update).not.toHaveBeenCalled();
  });

  it.each([
    { reason: null },
    { reason: '' },
    { reason: ' '.repeat(3) },
    { reason: 'x'.repeat(501) },
    { ownerId },
  ])('rejects invalid cancellation %j', async (body) => {
    await cancel(body).expect(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
