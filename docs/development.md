# Development environment

[Documentation index](README.md)

## Requirements and configuration

Install Docker with the Compose plugin and start its daemon. Use Node.js 24 and npm
only if running backend/frontend commands on the host. Postman is optional. Run the Docker
commands below from the repository root.

For a new checkout, copy the root template once (keep an existing `.env`):

```sh
cp .env.example .env
```

Edit the local file with your development values; do not commit it. The root
[.env.example](../.env.example) defines these variables:

| Variable            | Use                                |
| ------------------- | ---------------------------------- |
| `POSTGRES_USER`     | PostgreSQL initialization user     |
| `POSTGRES_PASSWORD` | PostgreSQL initialization password |
| `POSTGRES_DB`       | PostgreSQL initialization database |
| `CATALOG_PROVIDER` | `cleveland` (default); `mock` for offline Cleveland fixtures |
| `JWT_SECRET` | Required signing secret, at least 32 characters; generate with `openssl rand -hex 32` |

Compose builds the API's `DATABASE_URL` from those variables using hostname `db`
and port `5432`. Use URL-safe local development values: Compose interpolates them into the URL
without encoding. Encoding the root password alone would also change the password
given to PostgreSQL, so it is not a workaround for reserved characters. PostgreSQL
initialization variables apply when the data volume is first initialized; changing
`.env` does not change credentials in an existing database.

`backend/.env` is separate and is not required for Compose. For host execution,
copy [backend/.env.example](../backend/.env.example) to `backend/.env` if it does
not already exist, then configure `DATABASE_URL` to match the local database.
Use `localhost:5432` on the host. `PORT` optionally overrides the host API port.
Prisma's config and application bootstrap load dotenv from the working directory;
run local application commands from `backend/`. Existing environment variables
(including Compose's `DATABASE_URL`) take precedence. Tests that bypass bootstrap
still need the `--env-file` command below. Both actual `.env` files are ignored.

## Start, inspect, and stop

```sh
docker compose up --build
```

This runs in the foreground; use `docker compose up --build -d` for detached mode.
The API waits for PostgreSQL's health check, generates the Prisma client, then
starts Nest watch mode. Source is bind-mounted from `backend/` to `/app`, while
container dependencies use a separate volume. Startup does **not** apply migrations.

```sh
docker compose ps
docker compose logs --tail=100 api db
curl -i http://localhost:3000/health
```

| Service    | Host access             | Container access         |
| ---------- | ----------------------- | ------------------------ |
| Frontend | `http://127.0.0.1:5175` | Vite proxies `/api` to `api:3000` |
| API        | `http://localhost:3000` | API listens on port 3000 |
| PostgreSQL | `127.0.0.1:5432`        | `db:5432` from the API   |

PostgreSQL is bound to host loopback; the API port is published on all host
interfaces. For a database shell using the configured container variables:

```sh
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Stop without removing data:

```sh
docker compose stop
```

`docker compose down` also removes containers and the network but retains the
named `postgres_data` volume. Do not add `--volumes` / `-v` when retaining data.
The PostgreSQL 18 data volume is mounted at `/var/lib/postgresql`.

If watch mode logs `EADDRINUSE` and serves stale routes, inspect API logs and use
`docker compose restart api` to clear stale processes without restarting PostgreSQL.

## Prisma inside Docker

For a fresh database, start the services first with `docker compose up --build -d`.
PostgreSQL initializes its database and user when the named volume is empty. Then
run the following commands to create the application tables from the checked-in
migration and generate the client. Use the same commands for an existing database;
Prisma skips migrations that are already recorded as applied.

```sh
docker compose exec api npx prisma migrate deploy --config prisma7.config.ts
docker compose exec api npx prisma generate --config prisma7.config.ts
```

`migrate deploy` applies pending SQL migrations to the configured database; it does
not create migrations or reset data. Client generation only writes generated code.
The checked-in migrations are
[initial schema](../backend/prisma/migrations/20261025183545_init/migration.sql) and
[password hash](../backend/prisma/migrations/20261026180000_add_user_password_hash/migration.sql).
No seed script exists yet; migrations alone do not create the required demo users/lots.
For inspection without applying migrations:

```sh
docker compose exec api npx prisma migrate status --config prisma7.config.ts
docker compose exec api npx prisma validate --config prisma7.config.ts
```

A successful health check runs `SELECT 1`; it does not prove migrations are applied.

## Optional local backend workflow

Before building on the host, run `docker compose stop api` from the repository
root. The container and host share `backend/dist`; a separate build can remove
files while Nest watch mode is using them. PostgreSQL can remain running.

Then, from `backend/`, with Node.js 24 and the local `DATABASE_URL` configured:

```sh
npm ci
npx prisma generate --config prisma7.config.ts
npm run build
npm run lint
npm test
node --env-file=.env ./node_modules/vitest/vitest.mjs run --config ./vitest.config.e2e.ts
```

`npm run lint` runs Oxlint with type-aware checks; ESLint is not configured.

Tests cover root, user operations, registration/login, authorization and catalog
normalization/failure handling. Catalog HTTP tests mock the external provider; they
do not prove live provider availability. Lot, wallet and bidding API increments are also covered by their domain tests; settlement remains pending. Start the compiled application with:

```sh
node --env-file=.env dist/main.js
```

See [API and Postman](api.md) for health tests.

## Registration increment

Apply migrations before starting new code: `password_hash` is added by
`20261026180000_add_user_password_hash`. Existing users retain a null hash.
After dependency changes, synchronize the container and restart the API:

```sh
docker compose up -d db
docker compose run --rm --no-deps api npx prisma migrate deploy --config prisma7.config.ts
docker compose build api
docker compose up -d --no-deps --force-recreate --renew-anon-volumes api
```

The last command renews only the API’s disposable dependency volume; the named
PostgreSQL data volume is retained. Do not run `npm ci` inside a starting API
container, because it temporarily removes packages needed by startup.

See [registration](api.md#users-and-registration) for the request body. Log in and
send `Authorization: Bearer <accessToken>` to user routes. Ordinary users can
read/update their own profile; listing and legacy creation require an admin.
There is no admin seed or public admin registration yet.

## JWT signing secret

Generate a secret with `openssl rand -hex 32`. Set `JWT_SECRET` in root `.env`
for Docker and in `backend/.env` for host execution. There is no fallback secret;
startup requires at least 32 characters. Never commit actual environment files.
After changing root `.env`, run `docker compose up -d --force-recreate api`.
Tokens expire after 15 minutes. Changing the secret invalidates existing tokens.

## Catalog development

The example environment files set `CATALOG_PROVIDER=cleveland`. Set it in root `.env`
for Docker or `backend/.env` for host execution. No new dependency or API key is
required. After changing the Docker setting, recreate only the API:

```sh
docker compose up -d --force-recreate api
curl -i 'http://localhost:3000/catalog/search?q=painting&limit=2'
curl -i http://localhost:3000/catalog/artworks/141639
curl -i http://localhost:3000/health/external
```

Search/detail return `provider: "cleveland"`; external health reports `cleveland: up`.
`/health` continues to check PostgreSQL. Use `CATALOG_PROVIDER=mock` for the
existing offline Cleveland fixtures. Real failures never fall back to mock data.
See [catalog behavior](api.md#museum-catalog).

## Lot database verification

The PostgreSQL lifecycle test is opt-in; it runs HTTP checks inside a transaction
and rolls back all fixtures and lifecycle writes. With migrations applied:

```sh
docker compose exec -e RUN_DATABASE_TESTS=1 api npm run test:e2e -- lots-database.e2e-spec.ts
```

Normal e2e runs skip this test. It verifies lifecycle persistence, public filtering,
pagination, cancellation, existing-bid rejection and rollback; it does not prove
future concurrent bid handling or settlement.

## Initial frontend

`docker compose up --build -d` also starts the React frontend at
`http://127.0.0.1:5175`. Register a bidder to try simulated deposits; no demo
accounts or lots are seeded automatically. Browse lots publicly, or log in to view
your wallet. `/` uses the HAUS UI with real API calls; `/#/login`,
`/#/register` and `/#/wallet` are the connected account routes. The room reads
saved details, public bid history and authenticated position, with manual refresh.
`/preview` is an isolated local-state visual reference, not the application.
The older API screens remain at `/lots`, `/login` and `/wallet` during transition.
Seller Studio at `/#/seller` is now available to signed-in auctioneers for
backend catalog search, publication, persistent own-lot listing and cancellation.
Bid-entry screens and seller results/receipts are still pending. Bid
placement is available through the API/Postman.

For host development, stop the Docker web service, then:

```sh
docker compose stop web
cd frontend
npm ci
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:3000` by default; Docker sets
`API_PROXY_TARGET=http://api:3000`. No CORS change or browser secret is needed.
The session token stays in memory (refresh logs out). A pending deposit's amount/
retry UUID is kept in session storage per user until confirmed, preventing a
network retry from generating a new credit. This is not payment processing.

Frontend checks, from `frontend/`:

```sh
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser contract tests use mocked API responses, including retry/session/mobile cases.
`connected.spec.ts` covers the HAUS integration; `app.spec.ts` preserves the older
API UI regressions; `preview.spec.ts` covers the isolated visual prototype.
Shared response fixtures live in `tests/support/api.ts`. These tests alone do not
prove database persistence or live provider availability; see the separate live
verification evidence in [frontend integration](frontend-integration.md).
To use installed Chrome, set `PLAYWRIGHT_CHANNEL=chrome` for the test command.
The production build outputs `frontend/dist`; a deployed host must serve SPA routes
and proxy `/api` separately. The Compose/Vite setup is development-only.

For real wallet concurrency verification:

```sh
docker compose exec -e RUN_DATABASE_TESTS=1 api npm run test:e2e -- wallets-database.e2e-spec.ts
```

This opt-in test creates uniquely identified users and ledger/hold fixtures to test
independent concurrent transactions. Cleanup removes only those test IDs, preserving
existing data. It verifies single credit on repeated keys, cross-user conflicts and
exact balances; it does not execute settlement.

## Bid concurrency verification

```sh
docker compose exec -e RUN_DATABASE_TESTS=1 api npm run test:e2e -- bids-database.e2e-spec.ts
```

This opt-in test creates dedicated users, wallets, lots, deposits and bids, then
removes only its own fixture IDs. It checks concurrent equal bids, cross-lot funds,
leader changes, idempotent retries, deadline extension, cancellation races and
concurrent deposits. It does not test settlement or audit integrity. No schema
migration is needed for this increment.
