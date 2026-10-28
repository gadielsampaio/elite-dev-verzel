# Frontend integration inventory

[Documentation index](README.md) · Updated 2026-10-27

The challenge rules take precedence over the implementation plan. The main HAUS
application uses the backend; `/preview` is the isolated visual prototype and
never serves as a fallback for failed API requests.

## Connected workflows

| View | Behavior |
| --- | --- |
| Storefront `/` | Persisted lots, server status filters, pagination, saved artwork. Text search applies only to the displayed page. |
| Registration/login | API registration and JWT login, current-user profile and role restrictions. Tokens stay in memory; reload requires login. |
| Seller Studio `/#/seller` | Cleveland search by text/type/both, images/CC0 restrictions, selection, publication, owned lots and eligible cancellation. |
| Seller results | Actual owned/live/sold counts and settled sale credits; paginated closed results with pending/no-winner/sold states and receipt links. |
| Auction room | Server history/current bid, deadline and own position; exact-decimal bid entry, rejection feedback and safe idempotent retries. |
| Wallet `/#/wallet` | Total/committed/available balances and bidder-only simulated deposits with safe retries. |
| My bids `/#/activity` | Distinct participated lots, highest own bid, settled outcome and confirmed-wins filter with public receipt links. |
| Receipt `/#/receipt/:lotId` | Public settlement result and shareable URL; no personal account data. |

## Interaction and safety

- Seller creation reuses the prototype cards, pagination, artwork summary and
  paired-field layout. Summary text displays uppercase without altering source data.
- Choose Publish now (server timestamp after catalog validation) or Schedule—one
  hour from now, with editable local dates. Field errors appear beside inputs;
  server publication errors appear at the submit action.
- Money inputs use exact decimal strings and right-aligned cents entry:
  typing 12345 displays $123.45. Backspace removes a digit; decimal paste is supported.
- Museum failures never substitute fixtures automatically. Published metadata is
  saved locally; remote image availability remains a limitation.
- Unconfirmed publication blocks another attempt until the user checks MY LOTS.
  Bid/deposit retries retain their original amount/key across navigation.
- Bid history displays per-lot Bidder A/B labels and You for the authenticated bidder.
- A closed lot is not labelled sold until settlement is confirmed. Seller totals
  use credited ledger entries, not starting prices or provisional winners.

## Validation and limits

Frontend production build and 42 standard browser tests passed. Backend lint,
typecheck, 76 unit tests and 214 e2e tests passed, including PostgreSQL settlement,
isolation, pagination and idempotency checks.

The opt-in live browser journey passed with Cleveland, the running API and
PostgreSQL: seller publishes now; two bidders deposit and bid; only the test lot’s
deadline is advanced; the real worker settles; balances, seller totals, winner/
loser views and a logged-out shared receipt are verified. Cleanup removes only
test-owned records. The test also exposed and fixed a currency focus race.

```sh
npm run build --prefix frontend
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e --prefix frontend
RUN_LIVE_TESTS=1 PLAYWRIGHT_CHANNEL=chrome npm run test:e2e --prefix frontend -- live-bidding.spec.ts
```

Other bidders’ updates now trigger automatic HTTP resynchronization through per-lot
WebSocket subscriptions. Reconnection refreshes missed state; manual refresh remains available.
Production demo seeding, independent image availability and full production
journey verification remain pending. No integrity claim is made by the receipt or readable bid history.

Public audit is connected at `/#/audit/:id`, with room/receipt links, complete
pseudonymous history and browser SHA-256 verification against the external head.
See [audit coverage and limits](audit.md).

Rooms now distinguish pending settlement, confirmed receipts and no-winner closure.
Lifecycle/settlement signals refresh room and receipt HTTP state; cancelled or missing
lots clear retained room data.
