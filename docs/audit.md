# Public audit — in progress

Stage 09 records accepted bids in `BidAuditEntry` using the tested format in
`backend/src/audit/bid-hash.ts`. Public verification and external checkpoints
are not implemented.

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

Next: publish a trusted checkpoint outside PostgreSQL and add public verification. Existing bids predate
this mechanism; reconstructing their hashes must not claim historical integrity.

Changing recorded data changes its digest. This alone cannot detect an attacker
rewriting the whole chain or deleting its tail and recalculating hashes. Without
an independently trusted checkpoint, history must remain **not verifiable**.

Validation: 27 tests cover a fixed digest calculated independently, property-order
independence, exact large amounts, changed fields, chain links and invalid inputs.


## Atomic recording and rollout

New bids write their snapshot/hash in the same transaction as the bid, reservation
transfer and deadline update. The existing lot lock serializes sequence allocation.
The last stored digest is checked before appending; failure rolls back all writes.
Idempotent replays do not append entries. Bid acceptance explicitly stores the same
millisecond timestamp used by its audit snapshot.

The additive migration creates `bid_audit_entries` with unique bid IDs and
`(lotId, sequence)`, positive sequence/amount and hash-shape constraints. Deleting
a bid does not delete its snapshot. Deleting a whole lot cascades its audit entries;
an external checkpoint is still needed to detect whole-history deletion.

Deploy the migration, generate Prisma Client, then restart writers. Old writers
can still run against the expanded schema, but their bids are unaudited. Rollback:
redeploy the previous application while retaining the table and recorded data.
Do not drop the table or backfill old records as historically verified.
Mixed-version writes and legacy lots must remain explicitly not verifiable.

PostgreSQL tests cover canonical snapshots, anti-sniping deadlines, rollback after
audit-write failure, inconsistent tails, concurrent requests, idempotency and legacy
coverage. Hash-chain storage alone is not proof of integrity.
