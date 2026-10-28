import { vi } from 'vitest';
import { LotsService } from './lots.service.js';
import { AuctionEvents } from '../events/auction-events.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

describe('Lifecycle notification transaction boundary', () => {
  it('does not notify if the transaction fails after its callback has completed', async () => {
    const events = new AuctionEvents();
    const observe = vi.fn();
    events.subscribe(observe);
    const updateManyAndReturn = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'lot', endTime: new Date() }])
      .mockResolvedValueOnce([]);
    const prisma = {
      $transaction: async (
        callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
      ) => {
        await callback({
          lot: { updateManyAndReturn },
        } as unknown as Prisma.TransactionClient);
        throw new Error('commit failed');
      },
    } as unknown as PrismaService;
    const service = new LotsService(prisma, {} as CatalogService, events);
    await expect(service.reconcileLifecycle()).rejects.toThrow('commit failed');
    expect(observe).not.toHaveBeenCalled();
  });
});
