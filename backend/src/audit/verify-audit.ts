import { hashBidAudit } from './bid-hash.js';
import type { AuditEntry, Checkpoint } from './checkpoint-store.js';
export type RecordedBid = {
  id: string;
  bidderId: string;
  amount: string;
  createdAt: string;
  eligible?: boolean;
};
export function matchesCheckpoint(
  checkpoint: Checkpoint,
  entry: AuditEntry | undefined,
  bid: RecordedBid | undefined,
) {
  return (
    !!entry &&
    !!bid &&
    entry.hash === checkpoint.entry.hash &&
    hashBidAudit(entry) === checkpoint.entry.hash &&
    bid.id === entry.bidId &&
    bid.bidderId === checkpoint.bidderId &&
    bid.amount === entry.amount &&
    bid.createdAt === entry.acceptedAt &&
    bid.eligible !== false
  );
}
export function verifyAudit(
  entries: AuditEntry[],
  bids: RecordedBid[],
  checkpoints: Checkpoint[],
) {
  const result = (
    status: 'intact' | 'tampered' | 'not_verifiable',
    reason: string,
  ) => ({ status, reason });
  if (!checkpoints.length)
    return result(
      'not_verifiable',
      'No external checkpoint covers this history.',
    );
  try {
    let previousHash: string | null = null;
    for (const [index, entry] of entries.entries()) {
      if (
        entry.sequence !== index + 1 ||
        entry.previousHash !== previousHash ||
        hashBidAudit(entry) !== entry.hash
      )
        return result('tampered', 'The recorded hash chain is inconsistent.');
      previousHash = entry.hash;
    }
    for (const checkpoint of checkpoints) {
      const entry = entries.find((e) => e.bidId === checkpoint.entry.bidId);
      const bid = bids.find((b) => b.id === checkpoint.entry.bidId);
      if (checkpoint.confirmed && !matchesCheckpoint(checkpoint, entry, bid))
        return result(
          'tampered',
          'Confirmed history differs from the external checkpoint.',
        );
      if (entry && bid && !matchesCheckpoint(checkpoint, entry, bid))
        return result(
          'tampered',
          'A recorded bid differs from its external witness.',
        );
    }
    if (checkpoints.some((c) => !c.confirmed))
      return result(
        'not_verifiable',
        'Checkpoint confirmation is pending or a transaction was interrupted.',
      );
    if (checkpoints.some((c) => !c.completeHistory))
      return result(
        'not_verifiable',
        'Legacy bids are outside checkpoint coverage.',
      );
    if (
      entries.length !== checkpoints.length ||
      bids.length !== entries.length ||
      bids.some((b) => !entries.some((e) => e.bidId === b.id))
    )
      return result(
        'tampered',
        'Bids were inserted or removed outside the checkpointed history.',
      );
    return result(
      'intact',
      'The complete recorded bid history matches the external checkpoints.',
    );
  } catch {
    return result(
      'tampered',
      'Recorded history contains invalid canonical data.',
    );
  }
}
