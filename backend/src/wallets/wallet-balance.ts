import { Prisma } from '../generated/prisma/client.js';

const DEBIT_TYPES = new Set(['withdrawal', 'auction_purchase']);

// Caller supplies a consistent snapshot or holds the wallet lock before mutating funds.
export async function walletBalance(
  tx: Prisma.TransactionClient,
  walletId: string,
) {
  const entries = await tx.walletTransaction.groupBy({
    by: ['type'],
    where: { walletId },
    _sum: { amount: true },
  });

  // Each row is an aggregated transaction type; this loop performs no I/O.
  let total = new Prisma.Decimal(0);
  for (const entry of entries) {
    const amount = entry._sum.amount ?? new Prisma.Decimal(0);
    total = DEBIT_TYPES.has(entry.type)
      ? total.minus(amount)
      : total.plus(amount);
  }

  const holds = await tx.walletHold.aggregate({
    where: { walletId, status: 'active' },
    _sum: { amount: true },
  });
  const committed = holds._sum.amount ?? new Prisma.Decimal(0);

  return { total, committed, available: total.minus(committed) };
}
