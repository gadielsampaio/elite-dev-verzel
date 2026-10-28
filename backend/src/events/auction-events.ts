import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export type AuctionEvent = Readonly<
  { lotId: string; endTime: string } & (
    | { type: 'bid.accepted' | 'lot.extended'; bidId: string }
    | { type: 'lot.opened' | 'lot.closed' | 'lot.cancelled' | 'lot.settled' | 'audit.confirmed' }
  )
>;
type Observer = (event: AuctionEvent) => void | Promise<void>;

// Process-local invalidation signals; HTTP remains the source of truth.
@Injectable()
export class AuctionEvents implements OnModuleDestroy {
  private readonly emitter = new EventEmitter();
  private readonly logger = new Logger(AuctionEvents.name);

  subscribe(observer: Observer): () => void {
    const listener = (event: AuctionEvent) => {
      try {
        // An observer failure must never turn a committed bid into an HTTP error
        // or stop other observers. Network delivery will be best effort.
        void Promise.resolve(observer(event)).catch(() => this.failed());
      } catch {
        this.failed();
      }
    };
    this.emitter.on('change', listener);
    return () => {
      this.emitter.off('change', listener);
    };
  }

  publish(event: AuctionEvent): void {
    // Explicit public projection also prevents accidental private-field leakage.
    this.emitter.emit(
      'change',
      Object.freeze({
        type: event.type,
        lotId: event.lotId,
        ...('bidId' in event ? { bidId: event.bidId } : {}),
        endTime: event.endTime,
      }),
    );
  }

  private failed() {
    this.logger.warn(
      'Auction observer failed; persisted state remains authoritative',
    );
  }

  onModuleDestroy() {
    this.emitter.removeAllListeners();
  }
}
