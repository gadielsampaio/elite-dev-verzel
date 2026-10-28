import { vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BidsService } from './bids.service.js';

describe('Bid transaction rules', () => {
  const now = new Date('2030-01-01T12:00:00Z'),
    lotId = '11111111-1111-4111-8111-111111111111',
    bidderId = 'bidder',
    walletId = 'wallet';
  const db = {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    lot: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    bid: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    wallet: { findMany: vi.fn() },
    walletHold: {
      findUnique: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    walletTransaction: { groupBy: vi.fn() },
    bidAuditEntry: { findFirst: vi.fn(), create: vi.fn() },
  };
  const service = new BidsService(db as unknown as PrismaService);
  const data = { amount: '100.00', idempotencyKey: 'key' };
  const bid = {
    id: '22222222-2222-4222-8222-222222222222',
    lotId,
    bidderId,
    amount: new Prisma.Decimal(100),
    idempotencyKey: 'key',
    createdAt: now,
  };
  let lot: {
    id: string;
    ownerId: string;
    status: string;
    startTime: Date;
    endTime: Date;
    startingBid: Prisma.Decimal;
    bidIncrement: Prisma.Decimal;
    currency: string;
  };
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', 'test-only-secret-with-at-least-32-characters');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.resetAllMocks();
    lot = {
      id: lotId,
      ownerId: 'seller',
      status: 'scheduled',
      startTime: new Date(now.getTime() - 1000),
      endTime: new Date(now.getTime() + 600000),
      startingBid: new Prisma.Decimal(100),
      bidIncrement: new Prisma.Decimal(5),
      currency: 'USD',
    };
    db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) =>
      fn(db),
    );
    db.$queryRaw.mockResolvedValue([{ id: lotId }]);
    db.lot.findUniqueOrThrow.mockImplementation(() => Promise.resolve(lot));
    db.bid.findUnique.mockResolvedValue(null);
    db.bid.findFirst.mockResolvedValue(null);
    db.bid.create.mockResolvedValue(bid);
    db.wallet.findMany.mockResolvedValue([
      { id: walletId, userId: bidderId, currency: 'USD' },
    ]);
    db.walletTransaction.groupBy.mockResolvedValue([
      { type: 'deposit', _sum: { amount: new Prisma.Decimal(200) } },
    ]);
    db.walletHold.aggregate.mockResolvedValue({ _sum: { amount: null } });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });
  it('accepts first bid at the minimum and reserves the amount', async () => {
    expect(await service.place(lotId, bidderId, data)).toMatchObject({
      id: '22222222-2222-4222-8222-222222222222',
      amount: '100.00',
    });
    expect(db.walletHold.create).toHaveBeenCalledWith({
      data: {
        walletId,
        bidId: '22222222-2222-4222-8222-222222222222',
        amount: new Prisma.Decimal(100),
      },
    });
    expect(db.lot.update).toHaveBeenCalledWith({
      where: { id: lotId },
      data: { status: 'open', endTime: lot.endTime },
    });
  });
  it.each([
    ['start', 0, 600000, true],
    ['before-start', 1, 600000, false],
    ['end', -600000, 0, false],
    ['expired', -600000, -1, false],
  ])('respects %s boundary', async (_label, start, end, allowed) => {
    lot.startTime = new Date(now.getTime() + Number(start));
    lot.endTime = new Date(now.getTime() + Number(end));
    if (allowed) await service.place(lotId, bidderId, data);
    else
      await expect(service.place(lotId, bidderId, data)).rejects.toMatchObject({
        status: 409,
      });
  });
  it.each(['draft', 'closed', 'cancelled'])('rejects %s', async (status) => {
    lot.status = status;
    await expect(service.place(lotId, bidderId, data)).rejects.toMatchObject({
      status: 409,
    });
    expect(db.bid.create).not.toHaveBeenCalled();
  });
  it('rejects self-owned lot', async () => {
    lot.ownerId = bidderId;
    await expect(service.place(lotId, bidderId, data)).rejects.toMatchObject({
      status: 403,
    });
  });
  it('rejects missing lot', async () => {
    db.$queryRaw.mockResolvedValue([]);
    await expect(service.place(lotId, bidderId, data)).rejects.toMatchObject({
      status: 404,
    });
  });
  it('rejects below minimum and zero', async () => {
    await expect(
      service.place(lotId, bidderId, { ...data, amount: '99.99' }),
    ).rejects.toThrow('100.00');
    await expect(
      service.place(lotId, bidderId, { ...data, amount: '0' }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('rejects current leader with a new key', async () => {
    db.bid.findFirst.mockResolvedValue(bid);
    await expect(service.place(lotId, bidderId, data)).rejects.toThrow(
      'already leading',
    );
  });
  it('requires the previous bid plus increment', async () => {
    db.bid.findFirst.mockResolvedValue({ ...bid, bidderId: 'other' });
    await expect(service.place(lotId, bidderId, data)).rejects.toThrow(
      '105.00',
    );
  });
  it('reserves new leader funds and releases old hold without invalidating the bid', async () => {
    db.bid.findFirst.mockResolvedValue({
      ...bid,
      id: 'old',
      bidderId: 'other',
      amount: new Prisma.Decimal(90),
    });
    db.wallet.findMany.mockResolvedValue([
      { id: walletId, userId: bidderId, currency: 'USD' },
      { id: 'old-wallet', userId: 'other', currency: 'USD' },
    ]);
    db.walletHold.findUnique.mockResolvedValue({
      id: 'old-hold',
      walletId: 'old-wallet',
      status: 'active',
      amount: new Prisma.Decimal(90),
    });
    await service.place(lotId, bidderId, data);
    expect(db.walletHold.update).toHaveBeenCalledWith({
      where: { id: 'old-hold' },
      data: { status: 'released', releasedAt: now },
    });
  });
  it('rejects missing or inconsistent leader reservations', async () => {
    db.bid.findFirst.mockResolvedValue({
      ...bid,
      id: 'old',
      bidderId: 'other',
      amount: new Prisma.Decimal(90),
    });
    db.walletHold.findUnique.mockResolvedValue(null);
    await expect(service.place(lotId, bidderId, data)).rejects.toThrow(
      'reservation',
    );
    expect(db.bid.create).not.toHaveBeenCalled();
  });
  it('checks available rather than total balance', async () => {
    db.walletHold.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(101) },
    });
    await expect(service.place(lotId, bidderId, data)).rejects.toThrow(
      'Insufficient',
    );
  });
  it('rejects missing wallets and currency mismatch', async () => {
    db.wallet.findMany.mockResolvedValue([]);
    await expect(service.place(lotId, bidderId, data)).rejects.toThrow(
      'Insufficient',
    );
    db.wallet.findMany.mockResolvedValue([
      { id: walletId, userId: bidderId, currency: 'EUR' },
    ]);
    await expect(service.place(lotId, bidderId, data)).rejects.toThrow(
      'currencies',
    );
  });
  it.each([120001, 120000, 119999, 1])(
    'extends the existing deadline only in last two minutes: %i ms',
    async (remaining) => {
      lot.endTime = new Date(now.getTime() + remaining);
      await service.place(lotId, bidderId, data);
      expect(db.lot.update.mock.calls[0][0].data.endTime.getTime()).toBe(
        lot.endTime.getTime() + (remaining <= 120000 ? 120000 : 0),
      );
    },
  );
  it('rejects expiry while waiting for wallet locks', async () => {
    db.walletTransaction.groupBy.mockImplementation(() => {
      vi.setSystemTime(lot.endTime);
      return Promise.resolve([
        { type: 'deposit', _sum: { amount: new Prisma.Decimal(200) } },
      ]);
    });
    await expect(service.place(lotId, bidderId, data)).rejects.toThrow('ended');
    expect(db.bid.create).not.toHaveBeenCalled();
  });
  it('replays before checking current state without extending again', async () => {
    db.bid.findUnique.mockResolvedValue(bid);
    lot.status = 'closed';
    expect(await service.place(lotId, bidderId, data)).toMatchObject({
      id: bid.id,
    });
    expect(db.walletHold.create).not.toHaveBeenCalled();
    expect(db.lot.update).not.toHaveBeenCalled();
  });
  it.each([
    { bidderId: 'other' },
    { lotId: 'other' },
    { amount: new Prisma.Decimal(101) },
  ])('rejects conflicting retry %j', async (patch) => {
    db.bid.findUnique.mockResolvedValue({ ...bid, ...patch });
    await expect(service.place(lotId, bidderId, data)).rejects.toMatchObject({
      status: 409,
    });
  });
});
