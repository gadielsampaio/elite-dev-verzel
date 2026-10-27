# Auction API

An online art-auction project for the Elite Dev / Verzel challenge, using items
from the Art Institute of Chicago API. NestJS, TypeScript ESM, Prisma 7,
PostgreSQL 18 and Docker Compose power the backend; React, TypeScript and Vite power the frontend.

Implemented: database schema/migrations, health checks, user create/read/update,
password-hashed registration, JWT login, user authorization, catalog search/details, single-artwork lot publication, listing/details and owner-only cancellation.
The initial frontend supports registration/login, lot browsing/details and wallet
balances with simulated deposits. Bidding and settlement are not implemented yet.
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

- Catalog development uses explicit local fixtures (`CATALOG_PROVIDER=mock`).
  Real Art Institute access returned Cloudflare 403; live success remains unverified.
  Mock external health reports `not_checked`, not real provider availability.
- Seller publication/cancellation UI, bidding, settlement, required demo seeds and
  verified public deployment remain pending.
  Lifecycle states update on list/detail requests; no background closing or
  settlement worker exists yet.
  Schema tables do not constitute working auction features.
- Sign in again after refreshing the page: tokens are kept in memory only.
- Legacy passwordless users cannot log in. No admin seed or public admin signup exists.
- Watch mode can leave stale processes (`EADDRINUSE`); restart only the API with
  `docker compose restart api`. Stop the API before building on the host.

[API and Postman](docs/api.md) · [Database](docs/database.md) ·
[Documentation index](docs/README.md)
