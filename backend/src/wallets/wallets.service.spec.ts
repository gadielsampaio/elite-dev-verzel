import { vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuctionEvents } from '../events/auction-events.js';
import { WalletsService } from './wallets.service.js';

describe('WalletsService', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const data = {
    amount: '100.10',
    idempotencyKey: '22222222-2222-4222-8222-222222222222',
  };
  const entry = {
    id: 'entry',
    walletId: 'wallet',
    type: 'deposit',
    amount: new Prisma.Decimal(data.amount),
    idempotencyKey: data.idempotencyKey,
    createdAt: new Date(),
    wallet: { userId },
  };
  const database = {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    wallet: { findUnique: vi.fn(), upsert: vi.fn() },
    walletTransaction: {
      findUnique: vi.fn(),
      create: vi.fn(),
      groupBy: vi.fn(),
    },
    walletHold: { aggregate: vi.fn() },
    auditEvent: { findMany: vi.fn() },
  };
  const events = { publishAccount: vi.fn() };
  const service = new WalletsService(
    database as unknown as PrismaService,
    events as unknown as AuctionEvents,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    database.$transaction.mockImplementation(
      async (operation: (tx: typeof database) => unknown) =>
        operation(database),
    );
    database.wallet.upsert.mockResolvedValue({ id: 'wallet', currency: 'USD' });
    database.walletTransaction.findUnique.mockResolvedValue(null);
    database.walletTransaction.create.mockResolvedValue(entry);
  });

  it('returns only the signed-in bidder’s credit memos with exact amounts', async () => {
    database.auditEvent.findMany.mockResolvedValue([
      {
        id: 'memo',
        lotId: 'lot',
        createdAt: entry.createdAt,
        metadata: {
          title: 'Cancelled lot',
          amount: '9007199254740993.01',
          currency: 'USD',
          bidderId: userId,
        },
      },
    ]);
    expect(await service.creditMemos(userId)).toEqual([
      {
        id: 'memo',
        lotId: 'lot',
        createdAt: entry.createdAt,
        title: 'Cancelled lot',
        amount: '9007199254740993.01',
        currency: 'USD',
      },
    ]);
    expect(database.auditEvent.findMany).toHaveBeenCalledWith({
      where: {
        action: 'lot.credit_memo',
        metadata: { path: ['bidderId'], equals: userId },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  });

  it('rejects nonpositive deposits before starting a transaction', async () => {
    await expect(
      service.deposit(userId, { ...data, amount: '0.00' }),
    ).rejects.toThrow(BadRequestException);
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('publishes the account change only after the transaction commits', async () => {
    database.$transaction.mockImplementation(
      async (operation: (tx: typeof database) => unknown) => {
        const result = await operation(database);
        expect(events.publishAccount).not.toHaveBeenCalled();
        return result;
      },
    );
    expect((await service.deposit(userId, data)).amount).toBe('100.10');
    expect(events.publishAccount).toHaveBeenCalledExactlyOnceWith(userId);
  });

  it('replays an identical deposit without writing or publishing again', async () => {
    database.walletTransaction.findUnique.mockResolvedValue(entry);
    expect((await service.deposit(userId, data)).id).toBe(entry.id);
    expect(database.wallet.upsert).not.toHaveBeenCalled();
    expect(database.walletTransaction.create).not.toHaveBeenCalled();
    expect(events.publishAccount).not.toHaveBeenCalled();
  });

  it.each([
    { ...entry, wallet: { userId: 'another-user' } },
    { ...entry, type: 'withdrawal' },
    { ...entry, amount: new Prisma.Decimal('100.11') },
  ])(
    'rejects reuse for a different account, operation or amount',
    async (existing) => {
      database.walletTransaction.findUnique.mockResolvedValue(existing);
      await expect(service.deposit(userId, data)).rejects.toThrow(
        ConflictException,
      );
      expect(database.walletTransaction.create).not.toHaveBeenCalled();
    },
  );

  it('recovers a unique-key race only after rollback', async () => {
    database.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    database.walletTransaction.findUnique.mockResolvedValue(entry);
    expect((await service.deposit(userId, data)).id).toBe(entry.id);
    expect(events.publishAccount).not.toHaveBeenCalled();
  });

  it('does not notify a failed commit', async () => {
    const failure = new Error('commit failed');
    database.$transaction.mockImplementation(
      async (operation: (tx: typeof database) => unknown) => {
        await operation(database);
        throw failure;
      },
    );
    await expect(service.deposit(userId, data)).rejects.toThrow(failure);
    expect(events.publishAccount).not.toHaveBeenCalled();
  });

  it('rejects wallets in another currency before crediting', async () => {
    database.wallet.upsert.mockResolvedValue({ id: 'wallet', currency: 'EUR' });
    await expect(service.deposit(userId, data)).rejects.toThrow(
      ConflictException,
    );
    expect(database.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('returns a read-only empty balance for an account without a wallet', async () => {
    database.wallet.findUnique.mockResolvedValue(null);
    expect(await service.balance(userId)).toEqual({
      walletId: null,
      currency: 'USD',
      total: '0.00',
      committed: '0.00',
      available: '0.00',
    });
    expect(database.wallet.upsert).not.toHaveBeenCalled();
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    });
  });

  it('serializes total, committed and available amounts from the wallet snapshot', async () => {
    database.wallet.findUnique.mockResolvedValue({
      id: 'wallet',
      currency: 'USD',
    });
    database.walletTransaction.groupBy.mockResolvedValue([
      { type: 'deposit', _sum: { amount: new Prisma.Decimal('100.10') } },
      {
        type: 'auction_purchase',
        _sum: { amount: new Prisma.Decimal('25.05') },
      },
    ]);
    database.walletHold.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal('10.01') },
    });

    expect(await service.balance(userId)).toEqual({
      walletId: 'wallet',
      currency: 'USD',
      total: '75.05',
      committed: '10.01',
      available: '65.04',
    });
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    });
  });
});
