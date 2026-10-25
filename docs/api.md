# API and Postman

[Documentation index](README.md) · [Development setup](development.md)

Base URL: `http://localhost:3000`. No global prefix or authentication is configured.

## Implemented endpoints

| Method and path | Behavior                                                                  |
| --------------- | ------------------------------------------------------------------------- |
| `GET /`         | Starter response: HTTP 200 with plain text `Hello World!`                 |
| `GET /health`   | Executes `SELECT 1` through Prisma; reports API and database availability |

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

## Planned modules

These are Postman proposals only. No domain controllers, request DTO validation,
or business workflows exist yet; these requests currently return 404.

| Module / proposed path                       | Purpose and requests in the collection                |
| -------------------------------------------- | ----------------------------------------------------- |
| Users — `/users`                             | Participant records; list, get, create, patch, delete |
| Wallets — `/wallets`                         | User wallets; list, get, create, patch, delete        |
| Wallet Transactions — `/wallet-transactions` | Financial entries; list, get, create                  |
| Wallet Holds — `/wallet-holds`               | Bid reservations; list, get, create, patch            |
| Lots — `/lots`                               | Auction units; list, get, create, patch, delete       |
| Items — `/items`                             | Lot contents; list, get, create, patch, delete        |
| Bids — `/bids`                               | Offers; list, get, create                             |
| Auction Results — `/auction-results`         | Outcomes; list, get                                   |
| Audit Logs — `/audit-logs`                   | `AuditEvent` history; list, get                       |

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

There are 36 requests across 10 folders: two implemented requests in Health and
34 planned domain requests. Run the Health folder for current verification rather
than treating failures in planned requests as regressions. Example UUIDs are not
seeded records. Future use requires replacing related IDs consistently and using
a fresh idempotency key for each new logical operation. Example monetary values
are strings and timestamps are UTC ISO 8601; these are proposed payload conventions.
