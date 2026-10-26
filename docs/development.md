# Development environment

[Documentation index](README.md)

## Requirements and configuration

Install Docker with the Compose plugin and start its daemon. Use Node.js 24 and npm
only if running backend commands on the host. Postman is optional. Run the Docker
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
| `CATALOG_PROVIDER` | `mock` for local fixtures; `artic` for real HTTP |
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
do not prove live provider availability. Auction workflows have no implementation yet. Start the compiled application with:

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

The example environment files set `CATALOG_PROVIDER=mock`. Set it in root `.env`
for Docker or `backend/.env` for host execution. No new dependency or API key is
required. After changing the Docker setting, recreate only the API:

```sh
docker compose up -d --force-recreate api
curl -i 'http://localhost:3000/catalog/search?q=painting&limit=2'
curl -i http://localhost:3000/catalog/artworks/27992
curl -i http://localhost:3000/health/external
```

Search/detail return `provider: "mock"`; external health reports `mocked` and
`artic: not_checked`. `/health` continues to check PostgreSQL. Use
`CATALOG_PROVIDER=artic` and recreate the API to switch back; real failures never
fall back to mock data. See [catalog behavior](api.md#art-institute-catalog).
