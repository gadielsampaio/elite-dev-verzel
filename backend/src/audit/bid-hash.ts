import { createHash } from 'node:crypto';

// Stored aliases are public pseudonyms, never account IDs or personal data.
export type BidAuditPayload = {
  lotId: string;
  bidId: string;
  bidderAlias: string;
  amount: string;
  currency: string;
  acceptedAt: string;
  endTime: string;
};
export type BidAuditInput = BidAuditPayload & {
  sequence: number;
  previousHash: string | null;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function utcTimestamp(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

// Versioned, fixed-order JSON tuple encoded as UTF-8. Reject noncanonical inputs
// rather than silently rounding money or changing identifiers/timestamps.
export function canonicalBidAudit(input: BidAuditInput): string {
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1)
    throw new Error('Audit sequence must be a positive safe integer');
  if (
    input.sequence === 1
      ? input.previousHash !== null
      : typeof input.previousHash !== 'string' ||
        !/^[0-9a-f]{64}$/.test(input.previousHash)
  )
    throw new Error('Invalid previous audit hash');
  if (!uuid.test(input.lotId) || !uuid.test(input.bidId))
    throw new Error('Audit identifiers must be lowercase UUIDs');
  if (!/^bidder_[0-9a-f]{32}$/.test(input.bidderAlias))
    throw new Error('Audit bidder must use a public alias');
  if (
    !/^(?:0|[1-9]\d{0,16})\.\d{2}$/.test(input.amount) ||
    input.amount === '0.00'
  )
    throw new Error('Audit amount must be a positive canonical decimal string');
  if (!/^[A-Z]{3}$/.test(input.currency))
    throw new Error('Invalid audit currency');
  if (!utcTimestamp(input.acceptedAt) || !utcTimestamp(input.endTime))
    throw new Error('Audit timestamps must use UTC ISO milliseconds');
  return JSON.stringify([
    'auction-bid-audit-v1',
    input.lotId,
    input.sequence,
    input.previousHash,
    input.bidId,
    input.bidderAlias,
    input.amount,
    input.currency,
    input.acceptedAt,
    input.endTime,
  ]);
}

export function hashBidAudit(input: BidAuditInput): string {
  return createHash('sha256')
    .update(canonicalBidAudit(input), 'utf8')
    .digest('hex');
}
