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

No public settlement mutation is exposed. `GET /lots/:lotId/result` returns a
public result and, after settlement, a privacy-safe receipt. The frontend
`/#/receipt/:lotId` is shareable without login; closed Seller Studio lots link to
it. Seller totals and bidder participation/wins are connected through protected
account reads. Audit integrity is covered by [public verification](audit.md). No external museum requests occur during settlement. No schema changes are required.

Validation (uses only test-created records and removes those fixtures):

```sh
# Stop the live worker so it cannot touch concurrent test fixtures.
docker compose stop api
docker compose run --rm --no-deps -e RUN_DATABASE_TESTS=1 api npm run test:e2e -- --no-file-parallelism
docker compose up -d api
```

## Public results

Statuses: `awaiting_close`, `pending_settlement`, `no_winner`, `settled`.
Only `settled` includes a receipt: result ID, winning bid ID, exact decimal
amount, lot-scoped winner alias, ended time and settlement time. No account IDs,
names, emails, raw snapshots or ledger keys are returned. Missing, draft and
cancelled lots return 404; invalid UUIDs return 400.

Reads use a consistent database snapshot and never contact Cleveland or trigger
settlement. A receipt records simulated funds; it does not claim tamper detection.
Aliases match public bid history and change when `JWT_SECRET` rotates.


## Account results (Stage 08)

- Auctioneers: `GET /me/auction-summary` returns owned/live/sold counts and exact USD
  total received from settled `auction_sale` credits. `GET /me/auction-results`
  lists ended owned lots, distinguishing pending, no-winner and settled outcomes.
- Bidders: `GET /me/participations?filter=all|wins` lists distinct lots they bid on;
  wins require a settled result naming that bidder. Lists accept `page` and `limit`.
- Identity comes from JWT; role guards prevent access to the other account view.
  Consistent database snapshots avoid partially observed settlement.
- Seller Studio’s RESULTS tab and `/#/activity` show these reads and public receipt
  links. Empty/error/retry states never infer a sale from closed status.

## Notifications

The existing worker reconciles scheduled/expired lot states before each settlement
batch. Reads also reconcile lifecycle. Actual transitions publish `lot.opened` or
`lot.closed` after commit; owner cancellation publishes `lot.cancelled` once.
Successful winner settlement publishes `lot.settled` only after the result,
transfer and captured hold commit. Failed transactions and retries publish nothing.
Empty lots close without a settlement event or invented receipt.

Signals contain public lot metadata only. Rooms and shared receipt pages re-read
HTTP state; closure alone is never labelled a completed sale. Delivery is process-local
and best-effort, with reconnect/periodic HTTP recovery. See [protocol](api.md#realtime-auction-rooms).
