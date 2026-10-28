# Auction API

An online art-auction project for the Elite Dev / Verzel challenge, using items
from the Cleveland Museum of Art API. NestJS, TypeScript ESM, Prisma 7,
PostgreSQL 18 and Docker Compose power the backend; React, TypeScript and Vite power the frontend.

Implemented: database schema/migrations, health checks, user create/read/update,
password-hashed registration, JWT login, user authorization, catalog search/details, single-artwork lot publication, listing/details and owner-only cancellation.
The initial frontend supports registration/login, lot browsing/details and wallet
balances with simulated deposits. Bid placement and reservation/release now work
through the API. Background settlement is implemented; public results and shareable receipts are implemented. Bid entry, seller totals and bidder participation/wins are connected.
Public bid audit and browser hash verification are implemented; see [audit guarantees](docs/audit.md).
See [requirements and progress](docs/progress.md) for the remaining delivery scope.

## Run locally

Requires Docker with Compose. From the repository root, on a new checkout:

```sh
cp .env.example .env
openssl rand -hex 32
```

Set `JWT_SECRET` in `.env` to the generated value and configure the PostgreSQL
variables. Keep existing environment files; never commit secrets. Then:

```sh
docker compose up --build -d
docker compose exec api npx prisma migrate deploy --config prisma7.config.ts
curl -i http://localhost:3000/health
```

Frontend: `http://127.0.0.1:5175`; API: `http://localhost:3000`; PostgreSQL: `127.0.0.1:5432`. Startup generates the
Prisma Client but does not apply migrations. Stop safely with `docker compose stop`;
do not remove database volumes. See [development setup](docs/development.md) for
database access, host execution, tests and troubleshooting.

## Known limitations

- Catalog uses Cleveland (`CATALOG_PROVIDER=cleveland`), with verified live search/detail.
  Offline Cleveland fixtures remain available through explicit `mock` mode.
  Mock external health reports `not_checked`, not real provider availability.
- Public audit uses protected external checkpoints; legacy/unconfirmed history stays not verifiable.
  Post-commit Observer notifications are implemented; WebSocket delivery and required demo seeds remain pending.
  Public frontend/API access is verified; durable audit storage on Render and the full production journey remain pending.
  Other bidders’ updates currently require Refresh lot. Museum image hosting remains an external dependency.
  Lifecycle states update on reads and during background settlement. The worker
  transfers funds and captures winning holds; failed settlements retain holds for retry.
  Schema tables do not constitute working auction features.
- Sign in again after refreshing the page: tokens are kept in memory only.
- Legacy passwordless users cannot log in. No admin seed or public admin signup exists.
- Watch mode can leave stale processes (`EADDRINUSE`); restart only the API with
  `docker compose restart api`. Stop the API before building on the host.

[Live frontend](https://elite-dev-verzel-delta.vercel.app) ·
[API and Postman](docs/api.md) · [Database](docs/database.md) ·
[Documentation index](docs/README.md)
