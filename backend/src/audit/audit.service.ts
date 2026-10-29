import { publicEntry, recordedBids } from './audit.reads.js';
import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CheckpointStore, type AuditEntry } from './checkpoint-store.js';
import { AuctionEvents } from '../events/auction-events.js';
import { databaseCheckpoints } from './database-checkpoints.js';
import {
  matchesCheckpoint,
  verifyAudit,
  type RecordedBid,
} from './verify-audit.js';

function auditVerdict(
  database: Awaited<ReturnType<typeof databaseCheckpoints>>,
  uncovered: boolean,
  unavailable: boolean,
  entries: AuditEntry[],
  bids: RecordedBid[],
  checkpoints: Awaited<ReturnType<CheckpointStore['read']>>,
) {
  if (database.changed || database.unpaired) {
    return {
      status: 'tampered' as const,
      reason:
        'The trigger history records changed, deleted or unauthorized inserted bids.',
    };
  }
  if (!process.env.AUDIT_CHECKPOINT_DIR && uncovered) {
    return {
      status: 'not_verifiable' as const,
      reason: 'Pre-migration history is outside trigger coverage.',
    };
  }
  if (unavailable) {
    return {
      status: 'not_verifiable' as const,
      reason: 'External checkpoint storage is unavailable or not configured.',
    };
  }
  return verifyAudit(entries, bids, checkpoints);
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
        const verdict = auditVerdict(
          database,
          uncovered,
          unavailable,
          entries,
          bids,
          checkpoints,
        );
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
        !matchesCheckpoint(
          checkpoint,
          entries.get(checkpoint.entry.bidId),
          bids.get(checkpoint.entry.bidId),
        )
      )
        continue;

      await store.confirm(checkpoint);
      this.events?.publish({
        type: 'audit.confirmed',
        lotId,
        endTime: checkpoint.entry.endTime,
      });
    }
  }
}
