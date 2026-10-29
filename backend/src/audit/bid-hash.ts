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

const LOWERCASE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const AUDIT_HASH_PATTERN = /^[0-9a-f]{64}$/;
const BIDDER_ALIAS_PATTERN = /^bidder_[0-9a-f]{32}$/;
const CANONICAL_AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,16})\.\d{2}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const AUDIT_FORMAT_VERSION = 'auction-bid-audit-v1';

function validPreviousHash(input: BidAuditInput) {
  if (input.sequence === 1) return input.previousHash === null;
  return (
    typeof input.previousHash === 'string' &&
    AUDIT_HASH_PATTERN.test(input.previousHash)
  );
}

function utcTimestamp(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

// Versioned, fixed-order JSON tuple encoded as UTF-8. Reject noncanonical inputs
// rather than silently rounding money or changing identifiers/timestamps.
function validateAuditInput(input: BidAuditInput) {
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1)
    throw new Error('Audit sequence must be a positive safe integer');
  if (!validPreviousHash(input)) throw new Error('Invalid previous audit hash');
  if (!LOWERCASE_UUID.test(input.lotId) || !LOWERCASE_UUID.test(input.bidId))
    throw new Error('Audit identifiers must be lowercase UUIDs');
  if (!BIDDER_ALIAS_PATTERN.test(input.bidderAlias))
    throw new Error('Audit bidder must use a public alias');
  if (!CANONICAL_AMOUNT_PATTERN.test(input.amount) || input.amount === '0.00')
    throw new Error('Audit amount must be a positive canonical decimal string');
  if (!CURRENCY_PATTERN.test(input.currency))
    throw new Error('Invalid audit currency');
  if (!utcTimestamp(input.acceptedAt) || !utcTimestamp(input.endTime))
    throw new Error('Audit timestamps must use UTC ISO milliseconds');
}

export function canonicalBidAudit(input: BidAuditInput): string {
  validateAuditInput(input);

  return JSON.stringify([
    AUDIT_FORMAT_VERSION,
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
