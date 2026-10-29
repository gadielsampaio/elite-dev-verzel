import type { Prisma } from '../../src/generated/prisma/client.js';
import lots from './data/lots.json' with { type: 'json' };

export async function seedLots(tx: Prisma.TransactionClient) {
  const now = new Date();
  for (const lot of lots) {
    await tx.lot.upsert({
      where: { id: lot.id },
      update: {},
      create: {
        id: lot.id,
        ownerId: lot.ownerId,
        title: lot.title,
        status: 'open',
        startTime: now,
        endTime: new Date(now.getTime() + lot.durationDays * 86400000),
        startingBid: lot.startingBid,
        bidIncrement: lot.bidIncrement,
        currency: lot.currency,
      },
    });
  }
}
