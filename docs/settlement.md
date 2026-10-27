# Background settlement

The API scans expired lots on startup and every 10 seconds, in batches of 50.
Each process runs one scan at a time; PostgreSQL lot locks serialize competing
workers and bid placement. The deadline is rechecked after locking, so an
anti-sniping extension prevents premature settlement. Missed work is recovered
on restart. Tests disable the automatic timer (`NODE_ENV=test`).

For a winning bid, one transaction:

1. Validates the active reservation and wallet currencies/funds.
2. Creates the auction result and matching purchase/sale ledger entries.
3. Captures the winning hold, marks the winning bid and closes the lot.

The seller wallet is created if needed. Wallets are locked in ID order, matching
bid placement. A unique result per lot and the lot lock make retries idempotent.
Failures roll back all writes and are logged for retry; inconsistent reservations
require investigation, not automatic release or fabricated funds.

Lots without eligible bids close without a winner, result or money transfer.
Already-closed lots with eligible bids but no result are still settled. Cancelled
and draft lots are excluded. A closed status alone does not prove settlement.

No public settlement route is exposed. Shareable receipts, result reads, seller
totals, winner screens and audit integrity remain pending. No external museum
requests occur during settlement. No schema changes are required.

Validation (uses only test-created records and removes those fixtures):

```sh
# Stop the live worker so it cannot touch concurrent test fixtures.
docker compose stop api
docker compose run --rm --no-deps -e RUN_DATABASE_TESTS=1 api npm run test:e2e -- --no-file-parallelism
docker compose up -d api
```
