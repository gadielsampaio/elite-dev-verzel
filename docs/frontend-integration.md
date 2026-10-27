# Frontend integration inventory

[Documentation index](README.md) · Updated 2026-10-27

The challenge reference `DESAFIO_ELITE_DEV_VERZEL.md` takes precedence over the
implementation plan `PLANO_IMPLEMENTACAO_ELITE_DEV_VERZEL.md`. The connected increments cover auth, lot reads, wallets and seller management. It does
not implement settlement, tamper detection, realtime delivery, or new backend APIs.

## Prototype findings

| Prototype behavior | Actual requirement / disposition |
| --- | --- |
| “Visual prototype”, “no authentication”, “no account saved” notices | Removed from connected auth; forms now register/login through the API. |
| Collector A/B, Auctioneer, Guest profile switcher | Only in `/preview`. Main app roles come from the authenticated profile; API guards remain authoritative. |
| Three hardcoded artworks and relative countdowns | Only in `/preview`. Main storefront uses persisted published lots, server status filters and pagination. No fixtures on API errors. |
| $90,000/$75,000 balances; committed funds always zero | Main wallet renders total/committed/available decimal strings from `/wallet`. |
| Browser-only simulated deposits | Replaced with idempotent `/wallet/deposits`. Simulated money is a challenge requirement and remains clearly described. |
| Local demo bids, unrestricted wallet checks, missing anti-sniping | Isolated in `/preview`; no local bid submission in the main app. Backend bid integration follows the settlement prerequisite in `progress.md`. |
| Seller catalog fetched directly from Cleveland; sample artwork; localStorage publication | Isolated in `/preview`. Main seller flow now uses backend catalog/publication and JWT ownership, with `/lots/mine` for owner management. |
| Closed lots labelled sold/winning; computed “total received” | Not shown as settled outcomes in the main app. Backend `closed` only ends bidding; the public result page confirms completed settlement. Seller totals remain pending. |
| “Public audit” with illustrative records | Not offered as verification in the main app. History is readable but is not proof of integrity. |
| “My bids” derived from the selected fake profile | Isolated in `/preview`; a complete participation/results API remains pending. |
| “Frontend concept” footer | Removed from the main application; retained in the prototype. |

Required future demo **seeds** are persisted backend fixtures, not a browser role
switcher. They remain outstanding; this increment does not silently create them.

## Connected routes and contracts

- `/`: public listing (`GET /lots`), server status filters and pagination, explicit
  loading/empty/error/retry states. Search currently applies to the displayed page,
  labelled “Search this page”; the API does not yet accept a search query.
- The featured lot uses the first open lot and its public bid summary. Cards show
  **starting bid**, not an invented current/winning price. No live carousel across
  backend pages is implemented in this increment; the original carousel remains
  in the preview.
- Opening a lot fetches saved `GET /lots/:id` details, paginated public
  `GET /lots/:id/bids`, and `GET /lots/:id/bids/me` when signed in. Current bid,
  position and deadline come from these responses. The displayed countdown is
  anchored to response server time; **Refresh lot** resynchronizes the snapshot.
  There is no bid-entry or realtime claim. Public history displays server aliases.
- `/#/register`: `POST /auth/register` followed by login; selected role is submitted.
  Client validation includes the documented 72 UTF-8-byte password limit. If the
  account is created but subsequent login fails, the UI directs the user to login
  instead of resubmitting non-idempotent registration.
- `/#/login`: `POST /auth/login`, then own profile read through the shared session
  provider. JWT stays in memory; reload signs out. Protected 401s clear the session.
- `/#/wallet`: requires a session; displays actual server balances. Only bidders
  get the deposit form. `POST /wallet/deposits` sends decimal strings and a UUID;
  uncertain retries retain the same key and amount across navigation. A successful
  receipt followed by a failed balance read offers refresh, not another deposit.
- `/#/seller`: auctioneer-only search and detail through `/catalog`, publication
  through `POST /lots`, persistent paginated owner listing through `GET /lots/mine`,
  and eligible cancellation through `PATCH /lots/:id/cancel`. Decimal amounts
  remain strings; schedules are sent as UTC ISO timestamps. Failed publication
  with an uncertain outcome blocks resubmission and directs users to MY LOTS.
  Cancellation conflicts display the server reason and refresh eligibility.
- Activity/audit remain unavailable rather than showing local fake results.
  Seller Studio appears in the footer for authenticated auctioneers only.

`/preview` preserves the original visual prototype for comparisons. The older
API-backed screens at `/lots`, `/lots/:id`, `/login`, `/wallet` remain available
as transition regressions. `useWallet.ts` is shared by both connected UIs; the
prototype keeps its separate local behavior. No dependency or schema changes.
The existing six design stylesheets and responsive rules remain in use.

## Verification and limits

- Strict TypeScript + Vite production build.
- 25 Playwright tests: eight older API UI regressions, six isolated preview
  regressions, seven connected HAUS contract scenarios and four seller scenarios. Test API setup is shared.
- Connected scenarios cover real request shapes/selected roles, empty/failure
  behavior without sample fallback, server filters/pagination, public aliases,
  large exact decimal values, saved metadata without a museum request, partial
  auth failure, token storage/expiry, role restrictions and deposit retry safety.
- Live local verification on 2026-10-27: API/database health and an empty public
  list; browser registration/login, a 12.34 USD simulated deposit, persisted wallet
  balance after sign-out/login, mobile layout and no browser page errors. A unique
  temporary test account and its wallet/transaction records were removed afterward.
- The live database contained no published lots. Populated lot-room behavior was
  verified against mocked API contracts, not represented as a live lot test.
- Image URLs still depend on the remote host. Museum metadata is not fetched for
  published detail reads; offline image availability remains an explicit gap.

Run from `frontend/`:

```sh
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
# For just the connected increment:
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- connected.spec.ts
```

Next: connect bid entry to the tested backend; add seller totals and bidder participation/wins. Seller publication/cancellation
and owner listing are now connected. Complete participation, audit,
realtime, seeds and deployment in the documented dependency order.

## Seller verification (2026-10-27)

The existing in-progress seller create/cancel implementation was retained and
extended with persistent MY LOTS. Backend HTTP tests cover token-derived owner
filtering, anonymous/bidder/admin rejection, owner spoofing and cancellation
eligibility. An opt-in PostgreSQL rollback test verifies actual cross-owner
isolation and retained cancelled records. Browser tests cover publication request
shape/exact decimal strings, navigation persistence, cancellation/conflicts,
uncertain publication and bidder exclusion.

A live browser smoke passed against local PostgreSQL and real Cleveland search/
detail: register auctioneer → search/select → publish → navigate away/back to
MY LOTS → cancel. Mobile layout passed. Only that run's temporary seller, lot and
item records were removed afterward. Seller totals are not
inferred from closed status; their read endpoints/UI remain pending.

## Public result increment

`/#/receipt/:lotId` reads `GET /lots/:lotId/result` without login. Closed lots in
Seller Studio link to this page. Pending/no-winner/error states are explicit;
only a settled server result displays the amount, winner alias and shareable link.
Money stays a decimal string. No personal account data or audit claims are shown.

Verified: frontend build and 28 browser tests (including three receipt scenarios);
backend lint, 76 unit tests and 189 e2e tests, including PostgreSQL receipt reads
following settlement. Browser receipt tests use mocked HTTP; no live browser
settlement journey was executed in this increment.

## Restored catalog filters

Seller Studio supports artwork/artist text, artwork type, or both. Type-only
search works with blank text. Requests go through the backend adapter, with
mandatory image and CC0 restrictions. Pagination preserves submitted filters;
returning to change artwork retains the category. Publication revalidates both
restrictions. No automatic mock fallback or direct museum calls in the connected UI.

Filter restoration verification: both builds, backend lint, 76 unit tests and
198 e2e tests passed. Live text-only, type-only and combined Cleveland searches
returned HTTP 200 with images and public-domain metadata. The browser suite now
covers all three search modes and filter retention across pages/artwork changes.
