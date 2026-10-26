# Auction API backend

NestJS with TypeScript ESM, Prisma 7, and PostgreSQL. Implemented routes are
`GET /`, `GET /health`, user create/read/update, and `POST /auth/register`.
JWT login and user-route authorization are implemented (admin or own profile).
`GET /health/external`, `GET /catalog/search` and `GET /catalog/artworks/:id`
provide the Art Institute integration with configurable mock/real data;
see [known limitations](../README.md#known-limitations).

See the [project documentation](../docs/README.md),
[development setup](../docs/development.md), and
[API and Postman guide](../docs/api.md).

NestJS Observe is not configured or initialized. Its installed dependency does
not enable instrumentation; no Observe credentials are required.

The project uses **Oxlint**, not ESLint. From this directory, use `npm run build`,
`npm run lint`, and `npm test`. See the development guide for environment loading
and e2e commands.
