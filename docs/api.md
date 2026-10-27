# API and Postman

[Documentation index](README.md) · [Development setup](development.md)

Base URL: `http://localhost:3000`. No global prefix. Registration, JWT login, and user-route protection are implemented.

## Implemented endpoints

| Method and path | Behavior                                                                  |
| --------------- | ------------------------------------------------------------------------- |
| `GET /`         | Starter response: HTTP 200 with plain text `Hello World!`                 |
| `GET /health`   | Executes `SELECT 1` through Prisma; reports API and database availability |

The full challenge scope and outstanding workflows are tracked in
[requirements and progress](progress.md).

## Users and registration

- `POST /auth/register`: creates a user (201), hashes the password with bcrypt (cost 12), and returns only public user fields. Duplicate email: 409; invalid input: 400.
- `GET /users`, `GET /users/:id`, `PATCH /users/:id`: implemented. Updates accept only name and email; explicit null is rejected. Missing user: 404.
- `POST /users`: legacy passwordless creation, now admin-only. Use `/auth/register` for public signup.

Registration body:

```json
{
  "name": "Test Bidder",
  "email": "bidder@example.com",
  "password": "test-password-123",
  "role": "bidder"
}
```

Registration accepts only `bidder` or `auctioneer`, never `admin`. Passwords need at least 8 characters and at most 72 UTF-8 bytes. Passwords/hashes are never returned. Existing users with a null hash cannot log in. Registration does not issue a JWT yet.

```sh
curl -i http://localhost:3000/health
```

Successful query — HTTP **200**:

```json
{
  "status": "ok",
  "services": { "api": "up", "database": "up" }
}
```

Database query failure — HTTP **503**:

```json
{
  "status": "error",
  "services": { "api": "up", "database": "down" }
}
```

The health service catches query errors, so 503 may indicate connection or query
failure. `api: up` means the API handled the request. A missing `DATABASE_URL`
prevents application initialization instead of producing this health response.
The check does not verify schema tables, applied migrations, or auction behavior.

Implementation: [HealthModule](../backend/src/health/health.module.ts),
[controller](../backend/src/health/health.controller.ts), and
[healthservice.ts](../backend/src/health/healthservice.ts). The actual service
filename has no dot between `health` and `service`.

## Login

`POST /auth/login` accepts `email` and `password`. Success: HTTP 200 with
`accessToken`, `tokenType: "Bearer"`, and `expiresIn: 900` (15 minutes).
Invalid credentials, inactive users, and users without a password hash return
401 with `Invalid credentials`. Invalid body fields return 400.
JWTs are signed using HS256 and contain `sub` (user ID), `role`, and timestamps.

Send `Authorization: Bearer <accessToken>` for all implemented `/users` routes.

| Routes | Access |
| --- | --- |
| `GET /users`, `POST /users` | Admin only |
| `GET /users/:id`, `PATCH /users/:id` | Own profile or admin |
| `/auth/register`, `/auth/login`, `GET /health`, `GET /` | Public |

Missing, invalid, or expired tokens and inactive/deleted accounts return 401.
Authenticated users without permission receive 403. The guard checks current
account status and role in PostgreSQL on each request, ignoring stale token roles.
Updates still accept only name/email; users cannot promote themselves.
There is no public admin signup or admin seed. No refresh tokens or rate limiting
yet; bidder/auctioneer permissions for lots and bids will accompany those modules.

## Museum catalog

Cleveland Museum of Art is the default live provider, through `ClevelandAdapter`
implementing the existing `ExternalItemProvider` interface. [Official contract](https://openaccess-api.clevelandart.org/).

| Endpoint | Behavior |
| --- | --- |
| `GET /catalog/search?q=painting&page=1&limit=10` | Normalized items with page, limit, total and provider. |
| `GET /catalog/artworks/141639` | Artwork detail; missing artwork returns 404. |
| `GET /health/external` | Cleveland: 200 with `{"status":"ok","services":{"cleveland":"up"}}`; failure: 503 with `status: error`, `cleveland: down`. |

`CATALOG_PROVIDER=cleveland` is the default. `mock` selects offline Cleveland fixtures. No automatic fallback.
Mock health remains `{"status":"mocked","services":{"cleveland":"not_checked"}}`.
Database health is independent. Requests have a five-second timeout; provider,
network and invalid-response failures return 503.

Search accepts `q` (artwork/artist text, maximum 100 characters), `type`, or both.
At least one must be supplied. Page: 1–100; limit: 1–20. Supported types match the
Seller Studio choices: Painting, Drawing, Sculpture, Photograph, Print, Ceramic,
Textile, Jewelry, Furniture and woodwork. Invalid filters return 400.
The adapter always sends `has_image=1` and `cc0` to Cleveland. Publication also
rejects artworks without an image or confirmed CC0 status. Existing lots are unchanged.

Examples: `?type=Painting`, `?q=Monet`, `?q=Monet&type=Painting`.
Seller Studio retains submitted filters across pagination and the category when
returning from artwork details; editing fields requires SEARCH to apply them.
Cleveland pagination uses `skip=(page-1)*limit`, with total from `info.total`.
Metadata maps title, creators, creditline, web image, license, creation date,
technique, measurements and type. Missing optional metadata remains null.
Only `share_license_status: CC0` maps to `isPublicDomain: true`.

For compatibility, responses/storage retain `articArtworkId` (now the selected
provider's numeric ID) and `articImageId` (null for Cleveland). Always interpret IDs
with `provider`; saved lots retain it in `sourceSnapshot`. Existing snapshots are
unchanged. Use artwork IDs returned by the current catalog.
Images use remote URLs; they are not cached for outages. Live Cleveland search,
detail and health are verified locally; this does not guarantee future uptime.

## Lot publication

`POST /lots` requires an active **auctioneer** and Bearer JWT. Bidder/admin accounts
receive 403; missing or invalid tokens receive 401. The owner comes from the token;
clients cannot supply `ownerId`, status, currency or snapshot data.

```json
{
  "title": "Weekend art auction",
  "artworkId": 141639,
  "startingBid": "100.00",
  "bidIncrement": "5.00",
  "estimatedValue": "300.00",
  "startTime": "2027-01-01T18:00:00Z",
  "endTime": "2027-01-01T19:00:00Z"
}
```

Replace dates with future timestamps including a timezone. End must follow start.
Prices are positive decimal **strings**, at most 17 integer digits and two decimal
places. `estimatedValue` is supplied by the seller, not a museum valuation.
This increment supports one artwork per lot and USD only. Title is trimmed,
1–200 characters. Unknown fields are rejected.

Success: 201 with the lot and its item. A single nested Prisma write creates both
atomically with status `scheduled`; it saves artwork metadata, normalized detail
snapshot, provider (`cleveland`/`mock`) and fetch time. Missing artwork returns 404;
provider failure returns 503 and creates no lot. Decimal response values are strings.
Mock-sourced lots are development examples, identifiable by the saved provider.

`GET /lots/:id` is public and reads only PostgreSQL, including saved item details.
Missing, draft or cancelled lots return 404; invalid UUIDs return 400. It does not
fetch fresh catalog data. Stored image URLs still depend on the remote image host.

## Lot listing, lifecycle and cancellation

`GET /lots?status=open&page=1&limit=10` is public. `status` optionally accepts
`scheduled`, `open` or `closed`; omit it for all three. Page starts at 1 (maximum
1,000,000); limit is 1–50, default 10. Response: `items`, `total`, `page`, `limit`.
Results include saved artwork details, ordered by creation time then ID descending.
Draft and cancelled lots never appear. Invalid query fields return 400.

List/detail reads update lifecycle states from server time before returning:

- `scheduled → open` when `startTime <= now < endTime`.
- `scheduled/open → closed` when `endTime <= now`, including missed start windows.
- Draft, cancelled and closed states are not reopened.

These are **on-demand updates**, not a background scheduler. Stored states can lag
while no requests arrive. `closed` means the bidding window ended; it does not mean
settlement occurred. No winner, transfer or result is created by this read transition; the background worker settles expired lots separately.

`PATCH /lots/:id/cancel` requires the owning auctioneer's JWT. Send `{}` or
`{"reason":"No longer available"}` (trimmed, 1–500 characters if supplied).
A scheduled/live, unexpired lot can be cancelled only if it has **never received
a bid**, including inactive bids. Returns 200 with `status: cancelled`,
`cancelledAt` and `cancellationReason`; repeat requests preserve the first result.
Missing lot: 404; wrong owner/role: 403; expired/draft/closed or any bid: 409.
Cancelled details subsequently return 404 publicly.

Cancellation locks the lot row and checks ownership/state/bids in one transaction.
Bid placement acquires the same lot lock before validating state and writing a bid.
Editing and realtime remain pending; [background settlement](settlement.md) is implemented.

## Seller lot management

`GET /lots/mine?page=1&limit=9` requires an active auctioneer's JWT. Ownership
comes exclusively from the token; `ownerId` query parameters are rejected.
Pagination matches the public listing (limit up to 50). An optional `status`
filter accepts scheduled/open/closed; omitting it includes the owner's draft and
cancelled lots as well. Other owners' lots are never returned.

Response: `items`, `total`, `page`, `limit`. Each lot includes saved items,
`bidCount` (all bids, including inactive bids) and `canCancel`. Eligibility requires
scheduled/open status, an unexpired deadline and no bid ever received. The
existing cancellation endpoint rechecks eligibility transactionally; the displayed
flag is not authorization. No bidder identity or settlement totals are added.
Reads reconcile only this owner's lifecycle and use a consistent snapshot.

## Wallet balances and simulated deposits

Both routes require a valid JWT and use only the authenticated user's wallet.
`GET /wallet` returns `walletId`, `currency`, `total`, `committed`, and `available`.
No wallet yet: `walletId: null` and zero balances. Reads do not create a wallet.
All amounts are decimal strings with two places; available = total − committed.
Total adds deposits/sales/refunds and subtracts withdrawals/purchases; committed
sums only active holds. A repeatable-read transaction keeps both sums consistent.

`POST /wallet/deposits` is **bidder-only**, USD, simulated funds (no payment):

```json
{"amount":"100.00","idempotencyKey":"33333333-3333-4333-8333-333333333333"}
```

Use a fresh UUID for each intended deposit. Amount must be positive, with at most
17 integer digits and two decimal places. The server creates a wallet on first
deposit and returns 201 with the transaction receipt. Retrying the same key/user/
amount returns the same receipt without another credit, including concurrent retries.
Reusing a key for another user, amount or operation returns 409. Invalid input: 400;
missing token: 401; non-bidder: 403. No client-supplied user/wallet IDs are accepted.

Deposits lock the user (`FOR NO KEY UPDATE`) then wallet row, allowing concurrent
bid foreign-key checks. Bid placement locks the lot then affected wallets in ID
order; settlement uses the same wallet lock order. Active bid holds
contribute to committed balance. Withdrawal and refunds are not implemented. Settlement now captures holds and creates purchase/sale entries. No schema changes were needed.

## Bid placement

`POST /lots/:lotId/bids` requires an active **bidder** and Bearer JWT.
Auctioneers/admins receive 403. The bidder comes from the token, not the request.

```json
{"amount":"105.00","idempotencyKey":"44444444-4444-4444-8444-444444444444"}
```

Amount is a positive decimal string (up to 17 integer digits/two decimals).
Success: 201 with `id`, `lotId`, `amount`, `idempotencyKey`, `createdAt`.
Retry the same key/lot/bidder/amount to receive the original receipt without another
hold or extension, even after the lot closes. A different bid needs a new UUID.
Conflicting key reuse returns 409; invalid body/UUID: 400; missing lot: 404.

Within one transaction, `BidsService` coordinates:

- Scheduled/open lots only, with `startTime <= server time < endTime`; own lots are forbidden.
- First bid ≥ starting bid; later bids ≥ highest eligible bid + minimum increment.
- Current leader cannot bid again with a new key.
- Matching wallet/lot currency and enough **available** funds across all lots.
- New active reservation and immediate release of the old leader's hold. Being
  outbid does not deactivate the historical bid. Rejection rolls back all changes.
- Accepted bids with at most two minutes remaining add two minutes to the existing
  deadline. Expiry is rechecked after waiting for wallet locks.

Rule failures return 409 with a specific reason. Lot locking serializes bids with
cancellation; ordered wallet locks prevent concurrent overspending across lots.
An inconsistent legacy leader without a valid active hold is rejected for repair.
No payment, winning-bid designation or ledger debit is performed during bidding.

Use a live lot and deposit funds first. Public lot details expose the updated
`endTime`; a receipt does not imply the bid is still leading. History/current-leader reads are described below; bid UI, realtime events and
tamper-evident history remain pending.
Leading holds remain committed until the [settlement worker](settlement.md) captures
them and transfers funds. Closing the lot alone does not transfer money. Failed
settlements retain reservations for investigation and retry.

## Bid history and position

- `GET /lots/:lotId/bids?page=1&limit=20`: public, newest-first history plus current leader, current price, minimum next bid, server time and deadline. Page: 1–1,000,000; limit: 1–50.
- `GET /lots/:lotId/bids/me`: JWT required; adds `bestBid`, `position` and `isLeading` for the authenticated user. Position counts distinct bidders with higher active bids; no active bid means null position.

Both read a consistent PostgreSQL snapshot without calling the catalog provider or
changing state. Missing/draft/cancelled lots return 404. History includes inactive
bids, but only active bids determine leadership and position. Closed lots have no
minimum next bid; the current leader is not a settled winner.

Public bid fields are `id`, `bidderAlias`, `amount`, `createdAt`, `isActive`.
Aliases are scoped to each lot using HMAC with `JWT_SECRET`; rotating that secret
changes aliases. No user IDs, names, emails or idempotency keys are exposed.
This pseudonymization does **not** provide tamper detection; public audit remains pending.

## Public results and shareable receipts

`GET /lots/:lotId/result` is public. Returns lot ID/title/currency, saved item names
and image URLs, deadline, result status and a nullable receipt. Statuses distinguish
`awaiting_close`, `pending_settlement`, `no_winner` and `settled`; only settled
results return a receipt. Invalid UUID: 400; missing/draft/cancelled lot: 404.

Receipt fields: `id`, `winningBidId`, `amount` (decimal string), `winnerAlias`,
`endedAt`, `settledAt`. Account identifiers and personal profile data are excluded.
Reads use PostgreSQL only. Frontend link: `/#/receipt/:lotId`, accessible without
login and linked from closed lots in Seller Studio. No integrity guarantee is
claimed. See [settlement](settlement.md).

## Planned modules

The modules below remain planned, except the implemented user, lot, wallet and bid operations above.
These collection requests are placeholders, not mandatory challenge endpoints.
Prioritize challenge workflows over blanket CRUD: deposits, holds, bids, settlement
and audit must enforce their business rules, not expose arbitrary record edits.

| Module / proposed path                       | Purpose and requests in the collection          |
| -------------------------------------------- | ----------------------------------------------- |
| Users — `/users`                             | Only delete remains planned                     |
| Wallets — `/wallet` | Own balance/deposit implemented; generic `/wallets` CRUD remains planned |
| Wallet Transactions — `/wallet-transactions` | Financial entries; list, get, create            |
| Wallet Holds — `/wallet-holds`               | Bid reservations; list, get, create, patch      |
| Lots — `/lots`                               | Create/list/get/cancel implemented; generic patch/delete remain planned |
| Items — `/items`                             | Lot contents; list, get, create, patch, delete  |
| Bids — `/lots/:lotId/bids` | Placement, public history and own position implemented |
| Auction Results — `/auction-results`         | Generic list/get planned; per-lot result implemented|
| Audit Logs — `/audit-logs`                   | `AuditEvent` history; list, get                 |

List/create proposals use the collection path; get/patch/delete proposals use
`/{id}`. Proposed append-only/read-only restrictions and workflow-managed fields
are not implemented protections. Prisma fields describe storage, not an agreed
HTTP contract.

## Postman

Import both existing files using Postman's **Import** action:

- [Auction API.postman_collection.json](<postman/Auction API.postman_collection.json>)
- [Auction API Local.postman_environment.json](<postman/Auction API Local.postman_environment.json>)

Select the **Auction API Local** environment. Its `baseUrl` is
`http://localhost:3000`, matching the collection default. Open **Auction API →
Health → [IMPLEMENTED] GET /health**, then send the request. The test script checks
HTTP 200, `status: ok`, `services.api: up`, and `services.database: up`. A legitimate
503 response fails these success assertions.

The collection includes registration/login and protected user requests. Login saves
`accessToken` in the selected environment; registration saves `userId`. Register,
log in, then get/update that user. List/create users require an admin token. Re-import it to update an existing Postman workspace. Run the Health folder for current verification rather
than treating failures in planned requests as regressions. Example UUIDs are not
seeded records. Future use requires replacing related IDs consistently and using
a fresh idempotency key for each new logical operation. Example monetary values
are strings and timestamps are UTC ISO 8601; these are proposed payload conventions.
