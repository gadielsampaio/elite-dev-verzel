import type { Prisma } from '../generated/prisma/client.js';
import type { AuditEntry, Checkpoint } from './checkpoint-store.js';

// These reads use trigger snapshots, not mutable ORM bid rows. JSON comparisons
// and transaction identity are part of the evidence, not just query optimizations.
async function readTriggerState(tx: Prisma.TransactionClient, lotId: string) {
  const [state] = await tx.$queryRaw<
    {
      exists: boolean;
      changed: boolean;
      unpaired: boolean;
    }[]
  >`
    -- Any later mutation is tampering except the winner flag change paired with
    -- an actual settlement INSERT in the very same transaction.
    SELECT EXISTS(SELECT 1 FROM bid_audit_history WHERE lot_id = ${lotId}::uuid) AS exists,
      EXISTS(SELECT 1 FROM bid_audit_history h WHERE h.lot_id = ${lotId}::uuid
        AND h.operation <> 'INSERT' AND NOT (
          h.source_table = 'bids' AND h.operation = 'UPDATE'
          AND h.old_row - 'is_winner' = h.new_row - 'is_winner'
          AND h.old_row->>'is_winner' = 'false' AND h.new_row->>'is_winner' = 'true'
          AND EXISTS(SELECT 1 FROM bid_audit_history r
            WHERE r.lot_id = h.lot_id AND r.source_table = 'auction_results' AND r.operation = 'INSERT'
            AND r.transaction_id = h.transaction_id
            AND r.new_row->>'winning_bid_id' = h.new_row->>'id'
            AND r.new_row->>'settled_at' IS NOT NULL)
        )) AS changed,
      -- An INSERT without its matching bid/audit counterpart is unauthorized.
      EXISTS(SELECT 1 FROM bid_audit_history b
        WHERE b.lot_id = ${lotId}::uuid AND b.source_table IN ('bids', 'bid_audit_entries') AND b.operation = 'INSERT'
        AND NOT EXISTS(SELECT 1 FROM bid_audit_history a
          WHERE a.lot_id = b.lot_id AND a.source_table IN ('bids', 'bid_audit_entries') AND a.source_table <> b.source_table AND a.operation = 'INSERT'
          AND a.transaction_id = b.transaction_id AND coalesce(a.new_row->>'bid_id', a.new_row->>'id') = coalesce(b.new_row->>'bid_id', b.new_row->>'id'))) AS unpaired`;
  return state;
}

// Pair the bid and audit INSERT snapshots from the same committed transaction.
// Decimal/date casts retain the canonical representation used by the hash protocol.
async function readOriginalWitnesses(
  tx: Prisma.TransactionClient,
  lotId: string,
) {
  const originals = await tx.$queryRaw<(AuditEntry & { bidderId: string })[]>`
    SELECT a.new_row->>'lot_id' AS "lotId", a.new_row->>'bid_id' AS "bidId",
      (a.new_row->>'sequence')::int AS sequence,
      a.new_row->>'previous_hash' AS "previousHash", a.new_row->>'hash' AS hash,
      a.new_row->>'bidder_alias' AS "bidderAlias",
      ((a.new_row->>'amount')::numeric(19,2))::text AS amount,
      a.new_row->>'currency' AS currency,
      to_char((a.new_row->>'accepted_at')::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "acceptedAt",
      to_char((a.new_row->>'end_time')::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "endTime",
      b.new_row->>'bidder_id' AS "bidderId"
    FROM bid_audit_history a JOIN bid_audit_history b
      ON b.lot_id = a.lot_id AND b.source_table = 'bids' AND b.operation = 'INSERT'
      AND b.transaction_id = a.transaction_id AND b.new_row->>'id' = a.new_row->>'bid_id'
    WHERE a.lot_id = ${lotId}::uuid AND a.source_table = 'bid_audit_entries' AND a.operation = 'INSERT'
    ORDER BY (a.new_row->>'sequence')::int, a.id`;
  return originals;
}

export async function databaseCheckpoints(
  tx: Prisma.TransactionClient,
  lotId: string,
) {
  const state = await readTriggerState(tx, lotId);
  const originals = await readOriginalWitnesses(tx, lotId);
  const checkpoints: Checkpoint[] = originals.map(({ bidderId, ...entry }) => ({
    version: 1,
    entry,
    bidderId,
    completeHistory: true,
    confirmed: true,
  }));
  return { ...state, checkpoints };
}
