import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { CheckpointStore } from './checkpoint-store.js';
import { AuditService } from './audit.service.js';

const CONFIRMATION_INTERVAL_MS = 5000;
const CONFIRMATION_BATCH_SIZE = 50;

@Injectable()
export class AuditWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AuditWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private cursor = '';
  constructor(private readonly audit: AuditService) {}
  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test' || !process.env.AUDIT_CHECKPOINT_DIR)
      return;
    this.timer = setInterval(() => this.tick(), CONFIRMATION_INTERVAL_MS);
    this.timer.unref();
    this.tick();
  }

  private tick() {
    if (this.running) return;
    this.running = this.runBatch()
      .catch(() => {
        this.logger.error('Checkpoint confirmation failed; retrying next tick');
      })
      .finally(() => {
        this.running = undefined;
      });
  }

  async runBatch() {
    const lots = (await new CheckpointStore().lots())
      .filter((id) => id > this.cursor)
      .slice(0, CONFIRMATION_BATCH_SIZE);
    for (const id of lots) {
      try {
        await this.audit.confirm(id);
      } catch {
        this.logger.error(
          `Checkpoint confirmation failed for ${id}; retrying on a later pass`,
        );
      }
    }
    this.cursor =
      lots.length === CONFIRMATION_BATCH_SIZE ? lots[lots.length - 1] : '';
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
