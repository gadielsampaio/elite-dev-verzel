# Auction House frontend

React + TypeScript + Vite. The HAUS SAMPAIO application at `/` now connects to the
backend for registration/login, public lots and bid-history reads, and wallets with
idempotent simulated deposits. It retains the migrated design and responsive CSS.

- Connected account routes: `/#/login`, `/#/register`, `/#/wallet`.
- Original local-state prototype: `/preview` (visual regression reference only).
- Earlier API UI: `/lots`, `/lots/:id`, `/login`, `/wallet` during transition.

Seller Studio at `/#/seller` now supports backend catalog search, publication,
persistent own-lot listing and cancellation for auctioneers. Bid entry,
results/receipts and verifiable audit are not yet available in the main UI. See the authoritative [integration inventory](../docs/frontend-integration.md)
and [progress](../docs/progress.md); [migration notes](MIGRATION.md) describe the
original component extraction.

Copy `.env.example` to `.env`, run `npm install`, then `npm run dev`, or use `docker compose up --build -d` from
the repository root. Open http://127.0.0.1:5175. Vite proxies `/api` to the backend;
the main application requires the API and database. No sample fallback is used.

```sh
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

The browser suite separates connected app contracts, earlier API regressions and
prototype-only behaviors. No new dependencies were added. See
[development](../docs/development.md#initial-frontend) for setup.

Frontend settings live in `.env` (Git-ignored); see [the template](.env.example).
`VITE_API_BASE_URL` configures browser API requests; `VITE_CATALOG_API_URL` is
only for the preview catalog. `API_PROXY_TARGET`, `DEV_SERVER_HOST` and
`DEV_SERVER_PORT` configure Vite locally. Docker overrides the proxy target and
port to match its service network. Restart Vite after changes; public `VITE_*`
values are embedded during a production build. Production hosting must route
`/api` to NestJS; the Vite dev proxy is not part of the built static files.
