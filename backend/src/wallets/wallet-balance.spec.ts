import { vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { walletBalance } from './wallet-balance.js';

describe('walletBalance', () => {
  function transaction(
    entries: { type: string; _sum: { amount: Prisma.Decimal | null } }[],
    hold: string | null,
  ) {
    return {
      walletTransaction: { groupBy: vi.fn().mockResolvedValue(entries) },
      walletHold: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: { amount: hold === null ? null : new Prisma.Decimal(hold) },
        }),
      },
    };
  }

  it('returns exact zero when the ledger and active holds are empty', async () => {
    const tx = transaction([], null);
    const balance = await walletBalance(
      tx as unknown as Prisma.TransactionClient,
      'wallet',
    );
    expect(Object.values(balance).map((value) => value.toFixed(2))).toEqual([
      '0.00',
      '0.00',
      '0.00',
    ]);
  });

  it('subtracts debits and active holds without rounding large decimal values', async () => {
    const tx = transaction(
      [
        {
          type: 'deposit',
          _sum: { amount: new Prisma.Decimal('9007199254740993.01') },
        },
        { type: 'auction_sale', _sum: { amount: new Prisma.Decimal('10.09') } },
        { type: 'withdrawal', _sum: { amount: new Prisma.Decimal('1.10') } },
        {
          type: 'auction_purchase',
          _sum: { amount: new Prisma.Decimal('2.00') },
        },
        { type: 'deposit', _sum: { amount: null } },
      ],
      '3.25',
    );
    const balance = await walletBalance(
      tx as unknown as Prisma.TransactionClient,
      'wallet',
    );
    expect(balance.total.toFixed(2)).toBe('9007199254741000.00');
    expect(balance.available.toFixed(2)).toBe('9007199254740996.75');
    expect(tx.walletHold.aggregate).toHaveBeenCalledWith({
      where: { walletId: 'wallet', status: 'active' },
      _sum: { amount: true },
    });
  });

  it('keeps negative availability visible for settlement consistency checks', async () => {
    const balance = await walletBalance(
      transaction([], '1.00') as unknown as Prisma.TransactionClient,
      'wallet',
    );
    expect(balance.available.toFixed(2)).toBe('-1.00');
  });
});
