import { CheckpointStore } from './checkpoint-store.js';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import type { Bid, BidAuditEntry, Prisma } from '../generated/prisma/client.js';
import { bidderAlias } from '../bids/bidder-alias.js';
import { hashBidAudit, type BidAuditInput } from './bid-hash.js';

function validateAuditTail(previous: BidAuditEntry | null) {
  if (!previous) return;
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
  validateAuditTail(previous);

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
  await prepareCheckpoint(tx, payload, hash, bid.bidderId);
}

async function prepareCheckpoint(
  tx: Prisma.TransactionClient,
  payload: BidAuditInput,
  hash: string,
  bidderId: string,
) {
  if (!process.env.AUDIT_CHECKPOINT_DIR) return;
  try {
    const store = new CheckpointStore();
    // Durable external witness BEFORE commit. A rollback can leave an orphan;
    // never silently discard it or certify the affected history as intact.
    await store.prepare({
      version: 1,
      entry: { ...payload, hash },
      bidderId,
      completeHistory:
        (await tx.bid.count({ where: { lotId: payload.lotId } })) ===
        payload.sequence,
    });
  } catch {
    throw new ServiceUnavailableException(
      'Audit checkpoint unavailable; bid was not accepted',
    );
  }
}
