import { LotsService } from '../lots/lots.service.js';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettlementService } from './settlement.service.js';

@Injectable()
export class SettlementWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SettlementWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private cursor?: string;
  constructor(
    private readonly prisma: PrismaService,
    private readonly settlement: SettlementService,
    private readonly lifecycle: LotsService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => this.tick(), 10000);
    this.timer.unref();
    this.tick();
  }
  private tick() {
    if (this.running) return;
    this.running = this.runBatch()
      .catch(() => {
        this.logger.error('Settlement scan failed; retrying next tick');
      })
      .finally(() => {
        this.running = undefined;
      });
  }
  async runBatch() {
    await this.lifecycle.reconcileLifecycle();
    const lots = await this.prisma.lot.findMany({
      where: {
        id: this.cursor ? { gt: this.cursor } : undefined,
        endTime: { lte: new Date() },
        result: { is: null },
        OR: [
          { status: { in: ['scheduled', 'open'] } },
          {
            status: 'closed',
            // Reconciliation may close the lot before this scan. Keep inconsistent
            // active holds eligible for diagnosis/retry even if no bid is eligible.
            bids: {
              some: {
                OR: [
                  { isActive: true },
                  { hold: { is: { status: 'active' } } },
                ],
              },
            },
          },
        ],
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 50,
    });
    for (const lot of lots) {
      try {
        await this.settlement.settle(lot.id);
      } catch {
        this.logger.error(
          `Settlement failed for lot ${lot.id}; retrying on a later pass`,
        );
      }
    }
    // Advance past failures so one broken lot cannot starve later lots.
    this.cursor = lots.length === 50 ? lots[lots.length - 1].id : undefined;
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
