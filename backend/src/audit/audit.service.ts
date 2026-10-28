import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { BidAuditEntry, Prisma } from '../generated/prisma/client.js';
import { CheckpointStore, type AuditEntry } from './checkpoint-store.js';
import { AuctionEvents } from '../events/auction-events.js';
import { databaseCheckpoints } from './database-checkpoints.js';
import {
  matchesCheckpoint,
  verifyAudit,
  type RecordedBid,
} from './verify-audit.js';

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
async function recordedBids(
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
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly events?: AuctionEvents,
  ) {}
  async verify(lotId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        // Normal writers take FOR UPDATE on this row. Hold a shared lock while
        // reading both stores so a concurrent accepted bid cannot look inserted.
        await tx.$queryRaw`SELECT id FROM lots WHERE id = ${lotId}::uuid FOR SHARE`;
        const lot = await tx.lot.findUnique({
          where: { id: lotId },
          select: { title: true },
        });
        const database = await databaseCheckpoints(tx, lotId);
        let checkpoints = database.checkpoints;
        let unavailable = false;
        if (process.env.AUDIT_CHECKPOINT_DIR) {
          try {
            checkpoints = await new CheckpointStore().read(lotId);
          } catch {
            unavailable = true;
          }
        }
        if (!lot && !checkpoints.length && !database.exists)
          throw new NotFoundException('Lot not found');
        const entries = (
          await tx.bidAuditEntry.findMany({
            where: { lotId },
            orderBy: { sequence: 'asc' },
          })
        ).map(publicEntry);
        const bids = await recordedBids(tx, lotId);
        const uncovered = bids.some(
          (b) => !database.checkpoints.some((c) => c.entry.bidId === b.id),
        );
        const verdict =
          database.changed || database.unpaired
            ? {
                status: 'tampered' as const,
                reason:
                  'The trigger history records changed, deleted or unauthorized inserted bids.',
              }
            : !process.env.AUDIT_CHECKPOINT_DIR && uncovered
              ? {
                  status: 'not_verifiable' as const,
                  reason: 'Pre-migration history is outside trigger coverage.',
                }
              : unavailable
                ? {
                    status: 'not_verifiable' as const,
                    reason:
                      'External checkpoint storage is unavailable or not configured.',
                  }
                : verifyAudit(entries, bids, checkpoints);
        const aliases = new Map<string, string>();
        // Public data is explicitly projected. Private checkpoint identity bindings
        // and account IDs never leave the server; legacy identities stay hidden.
        const history = bids.map((b) => {
          const entry = entries.find((e) => e.bidId === b.id);
          const identity = entry?.bidderAlias ?? b.bidderId;
          if (!aliases.has(identity))
            aliases.set(identity, `Bidder ${aliases.size + 1}`);
          return {
            bidId: b.id,
            bidderLabel: aliases.get(identity),
            amount: b.amount,
            acceptedAt: b.createdAt,
            covered: !!entry,
          };
        });
        if (!process.env.AUDIT_CHECKPOINT_DIR && verdict.status === 'intact')
          verdict.reason =
            'The complete recorded bid history matches protected trigger snapshots.';
        const latest = checkpoints.filter((c) => c.confirmed).at(-1);
        return {
          lotId,
          title: lot?.title ?? 'Unavailable lot',
          ...verdict,
          checkedAt: new Date().toISOString(),
          history,
          entries: entries.map((e) => ({
            ...e,
            bidderAlias: /^bidder_[0-9a-f]{32}$/.test(e.bidderAlias)
              ? e.bidderAlias
              : 'invalid',
          })),
          checkpoint: latest
            ? { sequence: latest.entry.sequence, hash: latest.entry.hash }
            : null,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async confirm(lotId: string) {
    const store = new CheckpointStore();
    if (!store.directory) return;
    const pending = (await store.read(lotId)).filter((c) => !c.confirmed);
    if (!pending.length) return;
    const entries = new Map(
      (await this.prisma.bidAuditEntry.findMany({ where: { lotId } })).map(
        (e) => [e.bidId, publicEntry(e)],
      ),
    );
    const bids = new Map(
      (await recordedBids(this.prisma, lotId)).map((b) => [b.id, b]),
    );
    for (const checkpoint of pending) {
      if (
        matchesCheckpoint(
          checkpoint,
          entries.get(checkpoint.entry.bidId),
          bids.get(checkpoint.entry.bidId),
        )
      ) {
        await store.confirm(checkpoint);
        this.events?.publish({
          type: 'audit.confirmed',
          lotId,
          endTime: checkpoint.entry.endTime,
        });
      }
    }
  }
}
