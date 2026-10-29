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

function firstById<T>(items: T[], key: (item: T) => string) {
  const index = new Map<string, T>();
  for (const item of items) {
    const id = key(item);
    if (!index.has(id)) index.set(id, item);
  }
  return index;
}

function validHashChain(entries: AuditEntry[]) {
  let previousHash: string | null = null;
  for (const [index, entry] of entries.entries()) {
    if (
      entry.sequence !== index + 1 ||
      entry.previousHash !== previousHash ||
      hashBidAudit(entry) !== entry.hash
    )
      return false;
    previousHash = entry.hash;
  }
  return true;
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
    return result('not_verifiable', 'No audit checkpoint covers this history.');
  try {
    if (!validHashChain(entries))
      return result('tampered', 'The recorded hash chain is inconsistent.');
    const entriesByBid = firstById(entries, (entry) => entry.bidId);
    const bidsById = firstById(bids, (bid) => bid.id);

    for (const checkpoint of checkpoints) {
      const entry = entriesByBid.get(checkpoint.entry.bidId);
      const bid = bidsById.get(checkpoint.entry.bidId);
      if (checkpoint.confirmed && !matchesCheckpoint(checkpoint, entry, bid))
        return result(
          'tampered',
          'Confirmed history differs from the audit checkpoint.',
        );
      if (entry && bid && !matchesCheckpoint(checkpoint, entry, bid))
        return result(
          'tampered',
          'A recorded bid differs from its audit witness.',
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
      bids.some((bid) => !entriesByBid.has(bid.id))
    )
      return result(
        'tampered',
        'Bids were inserted or removed outside the checkpointed history.',
      );

    return result(
      'intact',
      'The complete recorded bid history matches the audit checkpoints.',
    );
  } catch {
    return result(
      'tampered',
      'Recorded history contains invalid canonical data.',
    );
  }
}
