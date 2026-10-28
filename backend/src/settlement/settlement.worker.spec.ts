import { LotsService } from '../lots/lots.service.js';
import { Logger } from '@nestjs/common';
import { vi } from 'vitest';
import { SettlementWorker } from './settlement.worker.js';
import { SettlementService } from './settlement.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('Settlement worker', () => {
  it('continues after failures and advances the batch cursor', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue(
        Array.from({ length: 50 }, (_, i) => ({ id: String(i) })),
      );
    const settle = vi
      .fn()
      .mockRejectedValueOnce(new Error('bad reservation'))
      .mockResolvedValue(null);
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    try {
      const worker = new SettlementWorker(
        { lot: { findMany } } as unknown as PrismaService,
        { settle } as unknown as SettlementService,
        {
          reconcileLifecycle: vi.fn().mockResolvedValue(undefined),
        } as unknown as LotsService,
      );
      await worker.runBatch();
      expect(settle).toHaveBeenCalledTimes(50);
      findMany.mockResolvedValue([]);
      await worker.runBatch();
      expect(findMany.mock.calls[1][0].where.id).toEqual({ gt: '49' });
      await worker.runBatch();
      expect(findMany.mock.calls[2][0].where.id).toBeUndefined();
      expect(log).toHaveBeenCalledTimes(1);
    } finally {
      log.mockRestore();
    }
  });
  it('does not overlap scans and drains work during shutdown', async () => {
    vi.useFakeTimers();
    vi.stubEnv('NODE_ENV', 'development');
    let finish!: (value: []) => void;
    const findMany = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const worker = new SettlementWorker(
      { lot: { findMany } } as unknown as PrismaService,
      {} as SettlementService,
      {
        reconcileLifecycle: vi.fn().mockResolvedValue(undefined),
      } as unknown as LotsService,
    );
    try {
      worker.onApplicationBootstrap();
      await vi.advanceTimersByTimeAsync(30000);
      expect(findMany).toHaveBeenCalledTimes(1);
      const shutdown = worker.onModuleDestroy();
      finish([]);
      await shutdown;
      await vi.advanceTimersByTimeAsync(30000);
      expect(findMany).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    }
  });
});
