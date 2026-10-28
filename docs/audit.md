# Public audit — in progress

Stage 09 starts with a tested hash format in `backend/src/audit/bid-hash.ts`.
It is not yet connected to bid placement, storage or a public verification route.

Version 1 hashes the UTF-8 encoding of this fixed-order JSON array using SHA-256:

```text
["auction-bid-audit-v1", lotId, sequence, previousHash, bidId,
 bidderAlias, amount, currency, acceptedAt, endTime]
```

- Sequence starts at 1 with a null previous hash. Later entries reference the
  previous 64-character hexadecimal digest.
- Amounts are positive decimal strings with exactly two decimal places. No float
  conversion is allowed. Timestamps use UTC ISO strings with milliseconds.
- Store the lot-scoped public alias at acceptance time; do not later recompute it
  from a potentially rotated secret. Names, emails and account IDs are excluded.
- Record the resulting deadline so anti-sniping extensions are covered.

Next: persist entries atomically with accepted bids, then publish a trusted
checkpoint outside PostgreSQL and add public verification. Existing bids predate
this mechanism; reconstructing their hashes must not claim historical integrity.

Changing recorded data changes its digest. This alone cannot detect an attacker
rewriting the whole chain or deleting its tail and recalculating hashes. Without
an independently trusted checkpoint, history must remain **not verifiable**.

Validation: 27 tests cover a fixed digest calculated independently, property-order
independence, exact large amounts, changed fields, chain links and invalid inputs.
