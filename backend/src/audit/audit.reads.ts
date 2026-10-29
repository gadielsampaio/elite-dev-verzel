import type { BidAuditEntry, Prisma } from '../generated/prisma/client.js';
import type { AuditEntry } from './checkpoint-store.js';
import type { RecordedBid } from './verify-audit.js';

export function publicEntry(entry: BidAuditEntry): AuditEntry {
  return {
    lotId: entry.lotId,
    bidId: entry.bidId,
    sequence: entry.sequence,
    previousHash: entry.previousHash,
    hash: entry.hash,
    bidderAlias: entry.bidderAlias,
    amount: entry.amount.toFixed(2),
    currency: entry.currency,
    acceptedAt: entry.acceptedAt.toISOString(),
    endTime: entry.endTime.toISOString(),
  };
}

// Preserve PostgreSQL microseconds: JS Date would hide sub-millisecond edits.
export async function recordedBids(
  tx: Prisma.TransactionClient,
  lotId: string,
): Promise<RecordedBid[]> {
  const rows = await tx.$queryRaw<RecordedBid[]>`
    SELECT id, bidder_id AS "bidderId", amount::text AS amount,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
      (is_active AND invalidated_at IS NULL AND invalidation_reason IS NULL) AS eligible
    FROM bids WHERE lot_id = ${lotId}::uuid ORDER BY created_at, id`;
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.replace(/(\.\d{3})000Z$/, '$1Z'),
  }));
}
