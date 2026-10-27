import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { Prisma } from '../src/generated/prisma/client.js';

describe('Wallet HTTP', () => {
  const userId = '11111111-1111-4111-8111-111111111111',
    walletId = '22222222-2222-4222-8222-222222222222',
    key = '33333333-3333-4333-8333-333333333333';
  const db = {
    user: { findUnique: vi.fn() },
    wallet: { findUnique: vi.fn(), upsert: vi.fn() },
    walletTransaction: {
      findUnique: vi.fn(),
      create: vi.fn(),
      groupBy: vi.fn(),
    },
    walletHold: { aggregate: vi.fn() },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  };
  let app: INestApplication, token: string;
  const entry = {
    id: key,
    walletId,
    type: 'deposit',
    amount: new Prisma.Decimal('100.10'),
    idempotencyKey: key,
    createdAt: new Date(),
    wallet: { userId },
  };
  beforeAll(async () => {
    vi.stubEnv('JWT_SECRET', 'test-only-secret-with-at-least-32-characters');
    vi.stubEnv('CATALOG_PROVIDER', 'mock');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .compile();
    token = await module.get(JwtService).signAsync({ sub: userId });
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
    db.user.findUnique.mockResolvedValue({
      id: userId,
      role: 'bidder',
      isActive: true,
    });
    db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) =>
      fn(db),
    );
    db.wallet.findUnique.mockResolvedValue({ id: walletId, currency: 'USD' });
    db.wallet.upsert.mockResolvedValue({ id: walletId, currency: 'USD' });
    db.walletTransaction.findUnique.mockResolvedValue(null);
    db.walletTransaction.create.mockResolvedValue(entry);
    db.walletTransaction.groupBy.mockResolvedValue([]);
    db.walletHold.aggregate.mockResolvedValue({ _sum: { amount: null } });
  });
  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });
  const deposit = (body: object = { amount: '100.10', idempotencyKey: key }) =>
    request(app.getHttpServer())
      .post('/wallet/deposits')
      .auth(token, { type: 'bearer' })
      .send(body);
  it('requires login for balances and deposits', async () => {
    await request(app.getHttpServer()).get('/wallet').expect(401);
    await request(app.getHttpServer())
      .post('/wallet/deposits')
      .send({})
      .expect(401);
  });
  it('returns zero for a wallet not yet created, without writing', async () => {
    db.wallet.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get('/wallet')
      .auth(token, { type: 'bearer' })
      .expect(200)
      .expect({
        walletId: null,
        currency: 'USD',
        total: '0.00',
        committed: '0.00',
        available: '0.00',
      });
    expect(db.wallet.upsert).not.toHaveBeenCalled();
  });
  it('uses all ledger directions and active holds with exact decimals', async () => {
    db.walletTransaction.groupBy.mockResolvedValue(
      [
        ['deposit', '100.10'],
        ['auction_sale', '25.00'],
        ['refund', '5.20'],
        ['withdrawal', '10.00'],
        ['auction_purchase', '20.05'],
      ].map(([type, amount]) => ({
        type,
        _sum: { amount: new Prisma.Decimal(amount) },
      })),
    );
    db.walletHold.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal('30.10') },
    });
    await request(app.getHttpServer())
      .get('/wallet')
      .auth(token, { type: 'bearer' })
      .expect(200)
      .expect({
        walletId,
        currency: 'USD',
        total: '100.25',
        committed: '30.10',
        available: '70.15',
      });
    expect(db.wallet.findUnique).toHaveBeenCalledWith({ where: { userId } });
    expect(db.walletHold.aggregate).toHaveBeenCalledWith({
      where: { walletId, status: 'active' },
      _sum: { amount: true },
    });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    });
  });
  it('creates a simulated deposit for the authenticated wallet', async () => {
    await deposit().expect(201);
    expect(db.walletTransaction.create.mock.calls[0][0].data).toMatchObject({
      walletId,
      type: 'deposit',
      idempotencyKey: key,
      description: 'Simulated deposit',
    });
    expect(db.$queryRaw).toHaveBeenCalledTimes(2);
  });
  it('replays the original receipt without another credit', async () => {
    db.walletTransaction.findUnique.mockResolvedValue(entry);
    await deposit().expect(201);
    expect(db.walletTransaction.create).not.toHaveBeenCalled();
  });
  it.each([
    { wallet: { userId: walletId } },
    { amount: new Prisma.Decimal('20') },
    { type: 'withdrawal' },
  ])('rejects mismatched key reuse %j', async (patch) => {
    db.walletTransaction.findUnique.mockResolvedValue({ ...entry, ...patch });
    await deposit().expect(409);
    expect(db.walletTransaction.create).not.toHaveBeenCalled();
  });
  it('checks a key conflict after rollback', async () => {
    db.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '7',
      }),
    );
    db.walletTransaction.findUnique.mockResolvedValue({
      ...entry,
      wallet: { userId: walletId },
    });
    await deposit().expect(409);
  });
  it.each(['auctioneer', 'admin'])('rejects %s deposits', async (role) => {
    db.user.findUnique.mockResolvedValue({ id: userId, role, isActive: true });
    await deposit().expect(403);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it.each([
    { amount: '0' },
    { amount: '-1' },
    { amount: 10 },
    { amount: '1.001' },
    { amount: '1e3' },
    { amount: '100000000000000000' },
    { idempotencyKey: 'invalid' },
    { userId: walletId },
    { walletId },
    { type: 'auction_sale' },
    { currency: 'EUR' },
  ])('rejects invalid deposit %j', async (patch) => {
    await deposit({ amount: '100.10', idempotencyKey: key, ...patch }).expect(
      400,
    );
    expect(db.walletTransaction.create).not.toHaveBeenCalled();
  });
  it('rejects deposits into a non-USD wallet', async () => {
    db.wallet.upsert.mockResolvedValue({ id: walletId, currency: 'EUR' });
    await deposit().expect(409);
    expect(db.walletTransaction.create).not.toHaveBeenCalled();
  });
});
