# HAUS SAMPAIO

**English** · [Português (Brasil)](README.pt-BR.md)

An art auction house featuring the Cleveland Museum of Art catalog, real-time bidding, a simulated wallet, and public audits. Auctioneers publish artworks; bidders compete for lots with funds reserved until the auction ends.

[Application](https://elite-dev-verzel-delta.vercel.app/) · [API health](https://elite-dev-verzel-2c5n.onrender.com/health) · [Repository](https://github.com/gadielsampaio/elite-dev-verzel)

## Production access

**Application:** https://elite-dev-verzel-delta.vercel.app/

**Login:** https://elite-dev-verzel-delta.vercel.app/#/login

| Person | Role | Email |
| --- | --- | --- |
| João | Auctioneer | `joao@mail.com` |
| Pedro | Bidder | `pedro@mail.com` |
| Tiago | Bidder | `tiago@mail.com` |

**Password for all three accounts: `12345678`.** These are demonstration accounts; deposits and payments are simulated.

## Features

- Collection of live, scheduled, and closed lots; cancelled lots are excluded from public listings.
- Seller Studio: search by artwork/artist and category, immediate or scheduled publication, cancellation of scheduled or live lots, and seller results.
- Auction room with a 3D viewer, zoom, bid history, bidder position, and WebSocket updates.
- Wallet with simulated deposits and total, committed, and available balances.
- Cancellation refunds release reserved funds and appear automatically in the wallet without reloading the page.
- Bids with minimum increments, fund reservations/releases, and a two-minute extension near the end of an auction.
- Automatic settlement, participation history, wins, and receipts accessible to the winner, auctioneer, and anyone holding the signed share link.
- Public audits with pseudonymous identification and history verification.
- Registration, login, renewal through an HttpOnly cookie, light/dark themes, and a Portuguese/English language selector with the preference saved in the browser.
- Responsive layout for desktop and mobile devices.

## Technology and organization

React, TypeScript, Vite, shadcn/ui, and Tailwind on the frontend; NestJS with ESM, Prisma 7, PostgreSQL, and Socket.IO on the backend. Docker Compose runs the three local services. Vitest, Playwright, and Oxlint provide testing and code analysis.

| Directory | Contents |
| --- | --- |
| `frontend/src/haus/app/` | Pages, domain components, theme, and layout |
| `frontend/src/api/` and `frontend/src/hooks/` | HTTP queries, actions, and event-driven updates |
| `frontend/src/components/ui/` | Shared UI components |
| `backend/src/` | Authentication, catalog, lots, bids, wallet, settlement, and audit modules |
| `backend/prisma/` | Schema, migrations, and seeds by entity |
| `docs/` | [Architecture and ideas](docs/architecture.md), [database](docs/database.md), and Postman |

## Running locally

Requires Docker with Docker Compose. For commands outside containers, use Node.js 24 and npm. Run the following steps from the repository root.

### 1. Configure the environment

For a fresh checkout:

```sh
git clone https://github.com/gadielsampaio/elite-dev-verzel.git
cd elite-dev-verzel
cp .env.example .env
openssl rand -hex 32
```

Copy the generated value into `JWT_SECRET` in `.env`. Configure `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`; the example development values can be used locally. Preserve an already configured `.env`.

Compose builds `DATABASE_URL` automatically. Use local credentials without URL-reserved characters. `CATALOG_PROVIDER=cleveland` queries the museum; `mock` uses explicit fixtures with no automatic fallback. No catalog API key is required.

### 2. Create the tables and start

```sh
docker compose up -d db
docker compose run --build --rm api npx prisma migrate deploy --config prisma7.config.ts
docker compose up -d --build
docker compose exec -e SEED_PASSWORD=12345678 api npm run db:seed
```

API startup generates the Prisma Client. Migrations and seeds are explicit; they do not run automatically in the local environment.

| Service | Address |
| --- | --- |
| Frontend | http://127.0.0.1:5175 |
| API | http://localhost:3000 |
| PostgreSQL | `127.0.0.1:5432`, using the credentials in `.env` |

### 3. Try the workflow

The seed command above creates the same demonstration accounts listed under [Production access](#production-access).

The seed creates the three accounts, their empty wallets, and an open lot featuring **[Stag at Sharkey's](https://www.clevelandart.org/art/1922.1133)** by George Bellows, from the Cleveland Museum of Art collection. The lot is published under João's account, starts when the seed first runs, and initially ends **7 days after publication**. Bids near the end remain subject to the auction extension rule.

The title is `Stag at Sharkey's`, without “mock”. The actual artwork metadata and image URLs are stored in the [lot JSON](backend/prisma/seeds/data/lot.json), so seeding does not require the external API. Demonstration prices are a US$100 starting bid, a US$10 increment, and a US$1,000 estimate; these are not an appraisal of the artwork. No artificial bids or wallet credits are created.

1. Open the `Stag at Sharkey's` lot in the collection. To publish more lots, sign in as João in Seller Studio.
2. In separate browser sessions, sign in as Pedro and Tiago, make simulated deposits, and bid on the lot.
3. After closing and settlement, check the balances, result, and receipt. The audit is accessible without signing in.

Rerunning the seed does not delete data, change existing passwords, duplicate the lot, or restart its seven-day period. A closed or cancelled lot stays in that state. Publish another lot through the dashboard for a new auction.

### Local maintenance

```sh
docker compose ps
docker compose logs --tail=100 api db
docker compose exec api npx prisma migrate status --config prisma7.config.ts
docker compose exec api npx prisma migrate deploy --config prisma7.config.ts
docker compose exec api npx prisma generate --config prisma7.config.ts
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose stop
```

The `postgres_data` volume preserves data. Do not use `docker compose down -v` just to stop the project. Changing credentials in `.env` does not change an already initialized database. Local audit checkpoints are stored in `.local/audit-checkpoints/`; preserve them alongside the database.

To edit the frontend outside Docker: stop `web`, enter `frontend/`, copy `.env.example` to `.env`, then run `npm ci` and `npm run dev`. To run the backend on the host, configure `backend/.env` from the example, using `localhost` in `DATABASE_URL`; stop the Docker API before starting or building the API on the host, since they share `dist`.

## API and Postman

Import the [collection](docs/postman/Auction%20API.postman_collection.json) and [local environment](docs/postman/Auction%20API%20Local.postman_environment.json). Select the environment with `baseUrl=http://localhost:3000`.

`GET /health` runs `SELECT 1`. When PostgreSQL is reachable, it returns HTTP 200:

```json
{"status":"ok","services":{"api":"up","database":"up"}}
```

Without a database connection, it returns HTTP 503 with `status: "error"` and `database: "down"`. This does not check whether migrations have been applied. `GET /health/external` checks the catalog separately.

Protected routes use `Authorization: Bearer <accessToken>`. Login, renewal, and logout also require `X-Session-Request: 1`; the refresh token is stored in an HttpOnly cookie. The application sends these automatically.

## Tests

With the containers running:

```sh
docker compose exec api npm run build
docker compose exec api npm run lint
docker compose exec api npm test
docker compose exec api npm run test:e2e
docker compose exec web npm run build
```

Database tests are opt-in. Run them sequentially, only in the local environment:

```sh
docker compose exec -e RUN_DATABASE_TESTS=1 api npm run test:e2e -- --no-file-parallelism
```

For browser tests on the host:

```sh
cd frontend
npm ci
npx playwright install chromium
npm run test:e2e
```

The default browser suite mocks API responses. The separate `live-bidding.spec.ts` and `refresh-live.spec.ts` tests are enabled by `RUN_LIVE_TESTS=1` and require the local API and a configured `backend/.env`; they must not target production.

## Deployment

The frontend is hosted on Vercel; the API and PostgreSQL are on Render. On Render, configure `DATABASE_URL`, `JWT_SECRET`, `CATALOG_PROVIDER=cleveland`, and `CORS_ORIGINS` with the exact frontend origin. Use `backend/` as the root and `npm run start:render` as the Docker command: it applies migrations, generates the client, builds, and starts the API.

On Vercel, use `frontend/`, build command `npm run build`, output directory `dist`, `VITE_API_BASE_URL=/api`, and `VITE_SOCKET_BASE_URL=https://elite-dev-verzel-2c5n.onrender.com`. [vercel.json](frontend/vercel.json) forwards HTTP to the backend; Socket.IO connects directly. Update that destination for a different deployment. Keep cookies Secure in production; Compose already configures the exception for local HTTP.

The command `npm run db:remote --prefix backend -- --check` validates `REMOTE_DATABASE_URL` and `SEED_PASSWORD` from the root `.env` without writing. Without `--check`, it applies migrations and seeds; `--migrate-only` applies only migrations. It does not clear the database. `VITE_*` variables are public: do not put passwords or database URLs in them.

## Known behavior and limitations

- **No live lots in the collection:** run the seed to create `Stag at Sharkey's`. If it has already closed or been cancelled, publish another lot through Seller Studio; rerunning the seed does not reopen it.
- **Catalog:** the adapter normalizes Cleveland data. Published lots store artwork details, so queries and operations do not need to call the catalog again. Images still depend on the museum CDN and may fail to display during an outage.
- **Money:** deposits are simulated, with no payment gateway. Balances are derived from the ledger and reservations, with critical operations inside transactions. Cancelling scheduled or live lots releases reservations without changing the total balance.
- **Closing:** the worker checks lots every ten seconds while the API is running. There may be a delay between the end of bidding and result confirmation; bids are not accepted after the deadline.
- **Audit:** chained SHA-256 snapshots are compared against supplementary trigger-backed history. This detects direct history changes under the protections described in the [architecture documentation](docs/architecture.md). It does not guarantee integrity against an administrator who disables these protections or rewrites all evidence. Empty or uncovered history is not certified as intact.
- **Access:** Public Audit lists closed lots with audit links only. Receipts require the winner or auctioneer to sign in, or possession of a signed share link. Anyone receiving or forwarding that link can access the pseudonymous receipt. Share tokens are scoped to a single receipt; rotating `JWT_SECRET` invalidates existing share links.
- **Real-time updates:** events are local to the process, with no distributed broker. Reconnection and HTTP queries restore state; running multiple instances requires additional coordination.
- **Validation:** complete bidding and settlement flows have been verified locally. Since the last reset, health and logins have been verified in production; the full production flow still needs to be rerun.

## Screenshots

### Collection — dark theme

![Auction collection in the dark theme](docs/image%20copy%204.png)

### Seller Studio — collection

![Auctioneer's lot collection](docs/image%20copy%202.png)

### Lot publication

![Configuring and publishing a lot in Seller Studio](docs/image.png)

### Auction room

![Auction room with artwork viewer and bidding panel](docs/image%20copy%203.png)
