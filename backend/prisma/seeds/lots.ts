import type { Prisma } from '../../src/generated/prisma/client.js';
import lot from './data/lot.json' with { type: 'json' };

const LOT_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export async function seedLots(tx: Prisma.TransactionClient) {
  const { estimatedValue, artwork, ...details } = lot;
  const publishedAt = new Date();
  await tx.lot.upsert({
    where: { id: lot.id },
    update: {},
    create: {
      ...details,
      status: 'open',
      startTime: publishedAt,
      endTime: new Date(publishedAt.getTime() + LOT_DURATION_MS),
      createdAt: publishedAt,
      items: {
        create: {
          name: artwork.name,
          estimatedValue,
          imageUrl: artwork.imageUrl,
          printImageUrl: artwork.printImageUrl,
          articArtworkId: artwork.articArtworkId,
          articImageId: artwork.articImageId,
          artistDisplay: artwork.artistDisplay,
          creditLine: artwork.creditLine,
          isPublicDomain: artwork.isPublicDomain,
          sourceSnapshot: artwork,
        },
      },
    },
  });
}
