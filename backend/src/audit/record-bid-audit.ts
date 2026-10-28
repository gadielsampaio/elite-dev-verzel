import { CheckpointStore } from './checkpoint-store.js';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import type { Bid, Prisma } from '../generated/prisma/client.js';
import { bidderAlias } from '../bids/bidder-alias.js';
import { hashBidAudit } from './bid-hash.js';

// Caller must hold the lot lock and use the same transaction as bid/hold writes.
export async function recordBidAudit(
  tx: Prisma.TransactionClient,
  bid: Bid,
  currency: string,
  endTime: Date,
) {
  const previous = await tx.bidAuditEntry.findFirst({
    where: { lotId: bid.lotId },
    orderBy: { sequence: 'desc' },
  });
  if (previous) {
    const digest = hashBidAudit({
      ...previous,
      amount: previous.amount.toFixed(2),
      acceptedAt: previous.acceptedAt.toISOString(),
      endTime: previous.endTime.toISOString(),
    });
    if (digest !== previous.hash)
      throw new ConflictException(
        'Audit tail is inconsistent; bid was not recorded',
      );
  }
  const payload = {
    lotId: bid.lotId,
    bidId: bid.id,
    sequence: (previous?.sequence ?? 0) + 1,
    previousHash: previous?.hash ?? null,
    bidderAlias: bidderAlias(bid.lotId, bid.bidderId),
    amount: bid.amount.toFixed(2),
    currency,
    acceptedAt: bid.createdAt.toISOString(),
    endTime: endTime.toISOString(),
  };
  const hash = hashBidAudit(payload);
  await tx.bidAuditEntry.create({
    data: {
      ...payload,
      hash,
      acceptedAt: bid.createdAt,
      endTime,
    },
  });
  if (process.env.AUDIT_CHECKPOINT_DIR) {
    try {
      const store = new CheckpointStore();
      // Durable external witness BEFORE commit. A rollback can leave an orphan;
      // never silently discard it or certify the affected history as intact.
      await store.prepare({
        version: 1,
        entry: { ...payload, hash },
        bidderId: bid.bidderId,
        completeHistory:
          (await tx.bid.count({ where: { lotId: bid.lotId } })) ===
          payload.sequence,
      });
    } catch {
      throw new ServiceUnavailableException(
        'Audit checkpoint unavailable; bid was not accepted',
      );
    }
  }
}
