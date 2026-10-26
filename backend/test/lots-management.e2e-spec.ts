import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Lot listing and cancellation (HTTP)', () => {
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const lotId = '22222222-2222-4222-8222-222222222222';
  const prisma = {
    user: { findUnique: vi.fn() },
    lot: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    bid: { count: vi.fn() },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  };
  let app: INestApplication;
  let token: string;
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
    token = await module.get(JwtService).signAsync({ sub: ownerId });
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  beforeEach(() => {
    vi.resetAllMocks();
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
  const cancel = (body: unknown = {}) =>
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
    const [close, open] = prisma.lot.updateMany.mock.calls.map(
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
      expect(prisma.bid.count).toHaveBeenCalledWith({ where: { lotId } });
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
  it('rejects any previous bids, including inactive bids', async () => {
    prisma.bid.count.mockResolvedValue(1);
    await cancel().expect(409);
    expect(prisma.lot.update).not.toHaveBeenCalled();
    expect(prisma.bid.count).toHaveBeenCalledWith({ where: { lotId } });
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
