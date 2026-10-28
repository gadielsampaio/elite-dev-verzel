# Public bid audit

Stage 09 provides `GET /lots/:id/audit` and `/#/audit/:id`, without login.
Open **Verify bid history** in an auction room or receipt, or **Public audit** in
the footer. The page shows the complete recorded history with public pseudonyms
and recomputes SHA-256 hashes in the browser before displaying **INTACT**.

| Status | Meaning |
| --- | --- |
| `intact` | Every bid and snapshot matches the complete, protected audit history. |
| `tampered` | A confirmed bid was changed/deleted, the chain was rewritten, or an inserted bid lacks a matching acceptance snapshot. |
| `not_verifiable` | No checkpoint, pre-migration coverage, unavailable configured storage, or an interrupted/unconfirmed write. Never treated as intact. |

Verification is a point-in-time result; WebSocket bid/confirmation events refresh it.
Direct SQL changes require a fresh HTTP check (manual refresh or reopening the page). Zero-bid lots have
no checkpoint and remain not verifiable. Historical data is never backfilled and
then described as proven intact.

## Hash format

SHA-256 of this UTF-8, fixed-order JSON tuple:

```text
["auction-bid-audit-v1", lotId, sequence, previousHash, bidId,
 bidderAlias, amount, currency, acceptedAt, endTime]
```

Sequence starts at 1, with a null previous hash. Amounts are exact positive decimal
strings with two places; dates are UTC ISO strings with milliseconds. The snapshot
includes the deadline after anti-sniping. Aliases are stored at acceptance, so JWT
rotation does not invalidate old snapshots. Names, emails and account IDs are
excluded from the public response.

## Trigger-backed history

The `20261028220000_bid_audit_history` migration adds `bid_audit_history`.
PostgreSQL triggers record every INSERT, UPDATE and DELETE on `bids` and
`bid_audit_entries` and settlement receipts, including direct SQL, with original/new JSON, transaction ID
and timestamp. No foreign keys cascade-delete this evidence. Direct history-table
inserts, updates, deletes and truncation are rejected; truncation of the source
history tables is also rejected.

Accepted bids and their hash snapshots commit with the trigger evidence in one
transaction. Verification checks their original INSERT records, transaction pairing,
current rows and hash chain. Changes/deletions remain detectable even if reverted;
an inserted bid without a matching acceptance snapshot is tampered. Failed
transactions roll back evidence along with balances and holds. The winner flag
may change from false to true only alongside its recorded settlement receipt in
the same transaction; other winner-flag edits are reported as tampered. Pre-migration rows
are not backfilled or retroactively certified. Empty history is not verifiable.

Without `AUDIT_CHECKPOINT_DIR`, this database history supplies the checkpoint
returned to the browser. No external storage subscription is required.

## Optional external checkpoints

When `AUDIT_CHECKPOINT_DIR` is configured, the API additionally writes a private,
non-overwriting filesystem witness before commit. Storage failure rolls back the
bid with HTTP 503. A worker confirms committed witnesses and retries after restart.
Pending/orphan witnesses remain not verifiable; they are never silently deleted.
Compose retains its separate `.local/audit-checkpoints/` mount for this option.
Keep that directory private, backed up and shared by all API instances.

## Trust boundary

The protected table, triggers, accepted-snapshot writer and API are trusted. Grant
ordinary SQL users only the source-table privileges they need, not access to write
accepted snapshots or evidence, create triggers, or change schema/roles. Runtime
accounts should not own these objects or have superuser/DDL privileges. The current
Render owner credential is not an independent security boundary against its holder.

This detects direct DML changes to history under those permissions. It cannot
prove integrity against a database owner/superuser who disables protections,
restores an older whole database, or impersonates the complete acceptance writer.
The supplementary table is not an independent external witness or WORM archive.
Do not advertise protection against arbitrary administrator compromise. Private
bidder IDs in stored snapshots never appear in the public response.

## Validation

Tests cover known canonical digests, database edits/insertions/deletions, identity
changes, full-chain rewriting, storage failure with transaction rollback, restart
confirmation, orphan witnesses, legacy coverage, idempotent replay and public HTTP
access without personal data. Browser tests cover local hash recomputation, forged
hashes, pending/tampered states and error handling. The opt-in live journey also
opens the public audit after real bidding and settlement.

Trigger-history validation: 127 unit tests, 260 backend e2e tests and five audit
browser tests passed; two external-only cases are skipped in database-only mode.
Run database suites serially to avoid shared-fixture pagination interference:

```sh
# From backend/; uses the local database in backend/.env.
NODE_ENV=test RUN_DATABASE_TESTS=1 node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.config.e2e.ts --no-file-parallelism
```

Both new migrations were applied locally. Production deployment and the full
production bidding/settlement journey remain pending.
