# Public bid audit

Stage 09 provides `GET /lots/:id/audit` and `/#/audit/:id`, without login.
Open **Verify bid history** in an auction room or receipt, or **Public audit** in
the footer. The page shows the complete recorded history with public pseudonyms
and recomputes SHA-256 hashes in the browser before displaying **INTACT**.

| Status | Meaning |
| --- | --- |
| `intact` | Every bid and snapshot matches the complete, confirmed external history. |
| `tampered` | A confirmed bid was changed/deleted, the chain was rewritten, or an uncheckpointed bid was inserted into fully covered history. |
| `not_verifiable` | No checkpoint, legacy coverage, inaccessible storage, or an interrupted/unconfirmed write. Never treated as intact. |

Verification is a point-in-time result; refresh after new bids. Zero-bid lots have
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

## External checkpoints and failure handling

1. Under the existing lot lock, record the bid, holds, deadline and `BidAuditEntry`
   in one PostgreSQL transaction.
2. Before commit, write and flush an immutable external witness containing that
   snapshot, its hash, coverage flag and a private bidder-ID binding. A configured
   storage failure returns HTTP 503 and rolls back the bid/financial writes.
3. A worker scans up to 50 checkpoint directories every five seconds, confirming
   only witnesses matching committed bids and snapshots. It retries after restart;
   it never manufactures trusted evidence from database contents alone.
4. Verification compares actual bids, chain snapshots and external witnesses.
   The browser independently recomputes the returned chain and compares its head
   with the external checkpoint supplied by the API.

Files are atomically published without overwriting existing evidence. A crash or
transaction rollback can leave an unconfirmed witness. Such a lot stays **not
verifiable** unless the exact witnessed bid commits and can be confirmed. There
is intentionally no automatic orphan deletion: a missing bid could also indicate
DB tampering. Preserve the files and investigate; do not erase evidence to obtain
an intact badge. The same rule covers a deleted tail before confirmation.

## Storage and trust boundary

Compose mounts `.local/audit-checkpoints/` into **only the API**, at
`/var/lib/auction-audit`. It is outside PostgreSQL, persistent across container
restarts, and Git-ignored. Host execution must set `AUDIT_CHECKPOINT_DIR` to the
absolute path of that same directory. All API instances must share this store.
Without configuration, bids still work but have no external proof.

Directories/files are created with modes 0700/0600. Keep checkpoints private:
the identity binding is for server verification, not public download. Back up
and retain them independently of PostgreSQL. Do not remove them when stopping
containers, restoring the database or switching between host and Docker.

This protects against **database-only** edits, including rewritten chains and
whole-lot deletion after confirmation. It trusts the API and protected filesystem;
it is not a blockchain, WORM storage or a third-party timestamp service. An attacker
controlling the API host/checkpoint files is outside this guarantee. Production
must preserve that separation and use durable, access-controlled storage.

## Validation

Tests cover known canonical digests, database edits/insertions/deletions, identity
changes, full-chain rewriting, storage failure with transaction rollback, restart
confirmation, orphan witnesses, legacy coverage, idempotent replay and public HTTP
access without personal data. Browser tests cover local hash recomputation, forged
hashes, pending/tampered states and error handling. The opt-in live journey also
opens the public audit after real bidding and settlement.
