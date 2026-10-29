import type { Prisma } from '../../src/generated/prisma/client.js';
import wallets from './data/wallets.json' with { type: 'json' };

export async function seedWallets(tx: Prisma.TransactionClient) {
  for (const wallet of wallets) {
    await tx.wallet.upsert({
      where: { userId: wallet.userId },
      update: {},
      create: wallet,
    });
  }
}
