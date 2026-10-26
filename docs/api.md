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

## Art Institute catalog

Public, read-only endpoints; no credentials or database writes:

| Endpoint | Behavior |
| --- | --- |
| `GET /catalog/search?q=painting&page=1&limit=10` | Search normalized artworks; returns `items`, `page`, `limit`, `total`, `provider`. |
| `GET /catalog/artworks/27992` | Fetch one artwork with date, medium, dimensions and artwork type; 404 if missing. ID must be a positive safe integer. |
| `GET /health/external` | Real provider: 200/up or 503/down. Mock provider: 200/mocked, without contacting Art Institute. |

`CATALOG_PROVIDER=mock` enables deterministic local fixtures; `artic` selects real
HTTP calls. If unset, the application uses `artic`; invalid values prevent startup.
The example environment files select `mock` for local development. There is **no
automatic fallback** from real errors to fixtures.

Search requires nonblank `q` (maximum 100 characters). `page`: 1–100, default 1;
`limit`: 1–20, default 10. Invalid parameters return 400; no matches return 200
with an empty array. Search items contain `articArtworkId`, `name`, `articImageId`,
`imageUrl`, `artistDisplay`, `creditLine`, and `isPublicDomain`. Detail adds
`dateDisplay`, `mediumDisplay`, `dimensions`, and `artworkType`.
Search and detail responses include `provider: "mock"` or `"artic"`.
Optional metadata and missing images remain null; image URLs are not fetched or
cached by this API, so images can still require external connectivity.

Mock search uses case-insensitive substring matching on title, artist and type;
it does not reproduce Elasticsearch ranking. Try `painting`, `Seurat`, `Bedroom`
or `Alma Thomas`. Fixtures cover public-domain/non-public-domain metadata and null
images. They are curated examples, not verified live captures or persisted items.
See [fixture contract and source](../backend/src/catalog/fixtures/README.md).

Mock external health:

```json
{"status":"mocked","services":{"artic":"not_checked"}}
```

Real external health returns `{"status":"ok","services":{"artic":"up"}}`
on success and `{"status":"error","services":{"artic":"down"}}` with 503
on failure. The real adapter uses a five-second deadline; network errors, invalid
responses and provider errors return 503 (artwork detail 404 stays 404).
The database health endpoint remains independent of either mode.

Real Art Institute access last returned a Cloudflare 403 on 2026-10-26. Real success
remains unverified; development proceeds with mocks. Revisit provider access or a
replacement after the core workflows work. Lot publication now persists normalized snapshots, including the provider marker.

## Lot publication

`POST /lots` requires an active **auctioneer** and Bearer JWT. Bidder/admin accounts
receive 403; missing or invalid tokens receive 401. The owner comes from the token;
clients cannot supply `ownerId`, status, currency or snapshot data.

```json
{
  "title": "Weekend art auction",
  "artworkId": 27992,
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
snapshot, provider (`mock`/`artic`) and fetch time. Missing artwork returns 404;
provider failure returns 503 and creates no lot. Decimal response values are strings.
Mock-sourced lots are development examples, identifiable by the saved provider.

`GET /lots/:id` is public and reads only PostgreSQL, including saved item details.
Missing, draft or cancelled lots return 404; invalid UUIDs return 400. It does not
fetch fresh catalog data. Stored image URLs still depend on the remote image host.

Listing, editing, cancellation and automatic status transitions remain pending.
Published lots stay `scheduled` in storage until lifecycle handling is implemented;
no bids or settlement run in this increment.

## Planned modules

The modules below remain planned, except the implemented user and lot operations above.
These collection requests are placeholders, not mandatory challenge endpoints.
Prioritize challenge workflows over blanket CRUD: deposits, holds, bids, settlement
and audit must enforce their business rules, not expose arbitrary record edits.

| Module / proposed path                       | Purpose and requests in the collection          |
| -------------------------------------------- | ----------------------------------------------- |
| Users — `/users`                             | Only delete remains planned                     |
| Wallets — `/wallets`                         | User wallets; list, get, create, patch, delete  |
| Wallet Transactions — `/wallet-transactions` | Financial entries; list, get, create            |
| Wallet Holds — `/wallet-holds`               | Bid reservations; list, get, create, patch      |
| Lots — `/lots`                               | Create/get implemented; list, patch, delete remain planned |
| Items — `/items`                             | Lot contents; list, get, create, patch, delete  |
| Bids — `/bids`                               | Offers; list, get, create                       |
| Auction Results — `/auction-results`         | Outcomes; list, get                             |
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
