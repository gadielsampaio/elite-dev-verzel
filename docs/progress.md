# Challenge requirements and progress

[Documentation index](README.md) · Reviewed 2026-10-28

This checklist follows the local challenge reference `DESAFIO_ELITE_DEV_VERZEL.md`;
the implementation plan `PLANO_IMPLEMENTACAO_ELITE_DEV_VERZEL.md` proposes the
architecture. Challenge rules take precedence. Both reference files are intentionally
ignored by Git; this summary is available in a fresh checkout.

## Current status

| Requirement / plan area | Status and remaining work |
| --- | --- |
| Foundation | NestJS, Prisma migrations, PostgreSQL and Docker implemented. React/Vite frontend implemented; HAUS shell now connects auth, public reads and wallets. |
| Authentication | HAUS registration/login UI now uses JWT sessions and the existing own-profile/admin guards. Lot publication is auctioneer-only with JWT-derived ownership. Cancellation requires the owning auctioneer. Bid placement rejects auctioneers/admins and self-owned lots. |
| Public item API | Search, artwork details and explicit mock/real transport selection implemented. Cleveland live search/detail verified; Cleveland fixtures remain available. Snapshots are persisted during publication; connected seller search/selection UI implemented with text/type filters and mandatory images/CC0. |
| Lots and storefront | Single-artwork publication, paginated status listings, saved details and owner cancellation before any bids implemented. Lifecycle reconciles on reads; Public browsing/detail UI implemented; owner-scoped seller listing, publication and cancellation UI implemented; editing remains pending; background settlement is implemented. |
| Wallet | Own balances and bidder-only simulated deposits implemented in API/UI. Concurrent retries are idempotent. Bid placement reserves leader funds and atomically releases the previous hold. |
| Bids | Placement API implements timing, minimum/increment, leader restriction, funds, atomic holds, concurrent retries and two-minute anti-sniping. Public paginated history/current leader and protected own-position reads implemented. Connected bid entry uses exact decimals, idempotent retries and server rejection reasons. Accepted bids have atomic snapshots and external witnesses. |
| Live room | API reads expose current bid, history, user position and deadline. HAUS room shows server history, current bid, position and deadline. Post-commit WebSocket signals refresh price, history, position and deadline automatically. Reconnection resynchronizes over HTTP; entered bid amounts are preserved. |
| Settlement and results | Background winner debit/seller credit, hold capture and empty-lot closure implemented. Public per-lot result reads and shareable receipt page implemented; closed Seller Studio lots link to results. Seller totals, paginated closed results, bidder participation/wins and receipt links are connected. Totals count confirmed sale credits; wins require settled results. |
| External outages | Not satisfied yet: published storefront, rooms, audit and receipts must work without the museum provider. Lot details now read saved snapshots without the provider; image URLs still depend on the remote host. |
| Public audit and privacy | Implemented: atomic SHA-256 snapshots, protected checkpoints outside PostgreSQL, public verification and browser hash checks. Database changes/deletions/insertions are detected against confirmed evidence; legacy, interrupted and uncovered history is not verifiable. No personal identity exposure. See [audit guarantees](audit.md). |
| Demo seeds | Explicit `db:remote` script creates one auctioneer, two bidders, empty wallets and a lot open for bidding. Local isolated-schema tests pass; production seeding remains pending. |
| Delivery | Vercel frontend and Render API/PostgreSQL deployed. CORS, public lot reads and all three Render migrations verified. Required demo seeds, durable Render audit storage, full production journey and repository-visibility verification remain pending. |

Plan phase 08 is implemented end to end: background settlement, seller results/totals,
bidder participation/wins and public receipts. Foundation/auth/catalog/lot/wallet/bid
flows are connected. Phase 09 now includes external checkpoints and public verification. Phase 10
(realtime) is implemented locally, including lifecycle and settlement notifications. Seeds, production audit persistence and full deployment validation remain incomplete; the challenge is not yet complete.
The existing `admin` role is an implementation addition, not a required challenge role.

The original local-state prototype remains at `/preview` for visual regression
checks. It is not the application entry or a fallback when the backend fails.
See [frontend integration inventory](frontend-integration.md) for the exact boundary
and verification evidence. Closed status alone is not labelled sold; result pages confirm settlement from
server receipts. Integrity is not claimed without audit verification.

## Next small steps

1. Deploy and verify the realtime journey on Render/Vercel.
2. Run demo seeds on the target deployment, finish durable Render audit storage, provider-outage image handling and the full deployed journey.

Adapter, Facade-style orchestration in `BidsService`, and process-local Observer notifications are implemented.
Per-lot WebSocket transport and browser subscriptions are implemented. Hash chains, protected filesystem checkpoints and public verification are implemented.
Legacy and interrupted histories remain not verifiable; see [audit limits](audit.md).

## Submission checklist

- Deliver within seven calendar days of receiving the challenge; receipt date is not recorded here.
- Provide name/email, public GitHub repository link(s), and a working public deployment URL.
- Include setup/database instructions, demo seeds, known limitations and an explanation of audit verification.

Docker and automated tests are optional challenge extras already present.
Lot search/filtering, cancellation with automatic refunds and dark mode are optional.
Cancellation **before any bids** is mandatory. Invoicing, resale, native mobile apps
and password recovery are outside the required scope.

## Previous verification milestones

Phase 08 live browser verification passed against real Cleveland data and local
PostgreSQL: seller publishes now; two bidders deposit/bid; the test advances only
its own lot deadline; the real worker settles; seller totals show the credit;
the winner sees a win/receipt, the loser sees no win, and a logged-out browser
opens the shared receipt. Test-owned records were removed.

Audit milestone validation: backend typecheck, lint, 117 unit tests and 228 e2e
tests passed (database suites sequential); frontend production build and 47
standard browser tests passed. External checkpoint attack/failure cases and browser
hash verification are covered. Realtime remains pending.

The live publish → bid → settle → logged-out audit journey also passed after
restarting the API with checkpoint storage configured. Compose API/web and the
frontend health proxy are running. Test-owned records and checkpoints were removed.

## Phase 10 — bid updates and reconnection

`AuctionEvents` uses Node's EventEmitter. `BidsService` publishes `bid.accepted`
and, when anti-sniping extends the deadline, `lot.extended` **after Prisma confirms
commit**. Rejections, rollback and idempotent replays publish nothing. Subscriber
failures cannot fail an accepted bid or prevent other observers from receiving it.

Payloads contain only `type`, `lotId` and the committed `endTime`, plus `bidId` for bid events.
Subscriptions return an unsubscribe function. These are best-effort process-local
signals, not durable delivery or a cross-instance broker; HTTP remains authoritative.
The gateway now delivers these signals to public per-lot rooms. The browser resynchronizes
over HTTP on subscription, reconnection and events, with periodic fallback reads.
Opening, closing, cancellation and settlement notifications are implemented after commit. See [realtime contract](api.md#realtime-auction-rooms).

Observer foundation validation: 126 unit tests and 235 e2e tests passed, including separate PostgreSQL
reads proving that bids, holds, audit snapshots and deadlines are committed before
observers run. Build, typecheck and lint passed. No frontend changes in this increment.

Gateway increment validation: backend build/typecheck/lint, 126 unit tests and 238
e2e tests passed. Frontend build and 47 standard browser tests passed; the opt-in
live journey passed separately against Cleveland and PostgreSQL. It verifies
cross-session bid updates without manual refresh, preserved bid input, offline
reconnection, settlement and public audit. Socket tests cover room isolation,
room switching, invalid subscriptions and reconnect. Documentation links passed.
Vite reports transient EPIPE/ECONNRESET warnings when test sockets close; the
final API health check passed. An overlapping browser run lost its shared dev
server; the standalone rerun passed. This increment is validated locally, not yet deployed.

## Lifecycle and settlement notification validation

Opening, closing, cancellation and settlement signals now drive room/receipt HTTP
refreshes. Post-commit database reads verify the transfer and captured hold are
visible before settlement notification; concurrent retries notify once. Commit
failure and settlement rollback tests verify no notification escapes. Cancelled
lots clear retained UI data; closure alone never implies a completed sale.

Passed locally: both builds, backend lint/typecheck, 127 unit tests, 240 backend
e2e tests and 48 standard browser tests. The real publish/bid/reconnect/settle/audit
journey also passed, including automatic settlement confirmation in an open room.
An initial live run hit a stale Nest watch process (`EADDRINUSE`); restarting only
the API resolved it and the rerun passed. Vite socket-close warnings and the existing
pg concurrent-query deprecation remain. No database reset, production deployment
or remote seed execution was performed.
