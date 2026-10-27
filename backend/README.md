# Auction API backend

NestJS with TypeScript ESM, Prisma 7, and PostgreSQL. Implemented routes are
`GET /`, `GET /health`, user create/read/update, and `POST /auth/register`.
JWT login and user-route authorization are implemented (admin or own profile).
`GET /health/external`, `GET /catalog/search` and `GET /catalog/artworks/:id`
provide the Art Institute integration with configurable mock/real data;
`POST /lots` publishes one artwork for an auctioneer; public `GET /lots/:id`
reads its saved snapshot. `GET /lots` lists public lots; `PATCH /lots/:id/cancel`
allows owner cancellation before bids. Lifecycle updates occur on list/detail reads. See [known limitations](../README.md#known-limitations).

`GET /wallet` returns own balances; bidder-only `POST /wallet/deposits` records
idempotent simulated deposits. Bidder-only `POST /lots/:lotId/bids` applies auction
rules, reserves/releases funds and extends late deadlines. Background settlement
remains pending; leading holds are not captured/released on close yet.

See the [project documentation](../docs/README.md),
[development setup](../docs/development.md), and
[API and Postman guide](../docs/api.md).

NestJS Observe is not configured or initialized. Its installed dependency does
not enable instrumentation; no Observe credentials are required.

The project uses **Oxlint**, not ESLint. From this directory, use `npm run build`,
`npm run lint`, and `npm test`. See the development guide for environment loading
and e2e commands.
