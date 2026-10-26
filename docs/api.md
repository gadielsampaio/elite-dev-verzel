# API and Postman

[Documentation index](README.md) · [Development setup](development.md)

Base URL: `http://localhost:3000`. No global prefix. Registration, JWT login, and user-route protection are implemented.

## Implemented endpoints

| Method and path | Behavior                                                                  |
| --------------- | ------------------------------------------------------------------------- |
| `GET /`         | Starter response: HTTP 200 with plain text `Hello World!`                 |
| `GET /health`   | Executes `SELECT 1` through Prisma; reports API and database availability |

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
| `GET /health/external` | Probes Art Institute `/artworks?limit=1&fields=id`; 200 when usable, otherwise 503. Independent of the database health check. |
| `GET /catalog/search?q=cats&page=1&limit=10` | Searches artwork metadata through the Art Institute adapter. |

External health responses:

```json
{"status":"ok","services":{"artic":"up"}}
```

On HTTP 503:

```json
{"status":"error","services":{"artic":"down"}}
```

Search requires a nonblank `q` (maximum 100 characters). `page` defaults to 1
(range 1–100); `limit` defaults to 10 (range 1–20). Invalid query fields return 400.
The response contains `items`, `page`, `limit`, and `total`. Each item contains
`articArtworkId`, `name`, `articImageId`, `imageUrl`, `artistDisplay`, `creditLine`,
and `isPublicDomain`. Optional metadata and missing images remain null.
Images use the provider's IIIF URL format; image availability is not checked.

The adapter uses a five-second deadline. Network errors, upstream HTTP errors,
invalid responses, and timeouts return 503. Empty search results return 200.
There is no cache or retry yet. This step does not create items/lots or persist
snapshots. Lot publication and owner permissions remain planned.

Provider contract: [Art Institute API documentation](https://api.artic.edu/docs/#quick-start).
On 2026-10-26, live requests from the development host and Docker received a
Cloudflare HTTP 403 challenge. Local endpoints correctly return 503 in this case;
success responses are covered with mocked upstream HTTP tests, but live search
success remains unverified. Retry from the deployment environment or contact the
provider if the block persists.

## Planned modules

The modules below remain planned, except the implemented user operations above. Their business workflows are not available yet.

| Module / proposed path                       | Purpose and requests in the collection          |
| -------------------------------------------- | ----------------------------------------------- |
| Users — `/users`                             | Only delete remains planned                     |
| Wallets — `/wallets`                         | User wallets; list, get, create, patch, delete  |
| Wallet Transactions — `/wallet-transactions` | Financial entries; list, get, create            |
| Wallet Holds — `/wallet-holds`               | Bid reservations; list, get, create, patch      |
| Lots — `/lots`                               | Auction units; list, get, create, patch, delete |
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
