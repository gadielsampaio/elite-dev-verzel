import type { Prisma } from '../../src/generated/prisma/client.js';
import items from './data/items.json' with { type: 'json' };

export async function seedItems(tx: Prisma.TransactionClient) {
  for (const item of items) {
    const artwork = item.artwork,
      lotId = item.lotId;
    await tx.item.upsert({
      where: {
        lotId_articArtworkId: { lotId, articArtworkId: artwork.articArtworkId },
      },
      update: {},
      create: {
        lotId,
        name: artwork.name,
        estimatedValue: item.estimatedValue,
        imageUrl: artwork.imageUrl,
        printImageUrl: artwork.printImageUrl,
        articArtworkId: artwork.articArtworkId,
        artistDisplay: artwork.artistDisplay,
        creditLine: artwork.creditLine,
        isPublicDomain: artwork.isPublicDomain,
        sourceSnapshot: artwork,
        sourceFetchedAt: new Date(),
      },
    });
  }
}
