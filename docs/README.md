# Auction API documentation

The Auction API is being built to manage auction lots and items, bidding, wallets,
and settlement history. The implemented foundation consists of the database
schema and initial migration, Prisma integration, Docker development environment,
a database health endpoint, user reads/updates, and password-hashed registration.
JWT login, user-route authorization, external health checks, and Art Institute catalog search/details with explicit mocks are implemented. Lot publication, listing/details, on-demand lifecycle and owner cancellation are implemented; bid placement with reservations is implemented; settlement remains planned.

- [Challenge requirements, progress and next steps](progress.md)
- [Development setup and commands](development.md)
- [Database entities, relationships, and constraints](database.md)
- [Implemented API, planned modules, and Postman](api.md)

## Technologies and structure

NestJS 12, TypeScript with ESM (`.js` relative imports), Prisma 7 with the PostgreSQL
driver adapter, PostgreSQL 18, and Docker Compose. The container uses Node.js 24;
Vitest and Oxlint provide backend tests and linting. The initial React/Vite frontend
uses React Router and Playwright browser tests.

| Path                                                                                     | Purpose                                                          |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [frontend/](../frontend/) | React login/registration, lot browsing and wallet/deposit UI |
| [backend/src/bids/](../backend/src/bids/) | Bid placement, lot/wallet locking and reservation orchestration |
| [backend/src/wallets/](../backend/src/wallets/) | Own balances and idempotent simulated deposits |
| [backend/src/main.ts](../backend/src/main.ts)                                            | Bootstrap; port 3000 by default; no global route prefix          |
| [backend/src/app.module.ts](../backend/src/app.module.ts)                                | Registers Prisma, Health, Users, Auth, Catalog, Lots, Wallets and Bids modules |
| [backend/src/lots/](../backend/src/lots/) | Publication, listings/details, lifecycle and owner cancellation |
| [backend/src/catalog/](../backend/src/catalog/) | Art Institute adapter, mock/HTTP transports, search/details and external health |
| [backend/src/auth/](../backend/src/auth/) | Registration, login and JWT verification |
| [backend/src/users/](../backend/src/users/) | User operations and profile/admin permissions |
| [backend/src/health/](../backend/src/health/)                                            | Health controller, module, and `healthservice.ts`                |
| [backend/src/prisma/](../backend/src/prisma/)                                            | Prisma service using `DATABASE_URL` and `@prisma/adapter-pg`     |
| [backend/prisma/schema.prisma](../backend/prisma/schema.prisma)                          | Database model source of truth                                   |
| [backend/prisma/migrations/](../backend/prisma/migrations/)                              | Initial schema, password-hash migration and migration lock              |
| [backend/prisma7.config.ts](../backend/prisma7.config.ts)                                | Prisma schema/migration paths and datasource URL                 |
| [backend/Dockerfile](../backend/Dockerfile), [docker-compose.yml](../docker-compose.yml) | Web, API and database development containers                          |
| [backend/test/](../backend/test/)                                                        | HTTP tests for root, user authorization and catalog/provider failures                             |
| [postman/](postman/)                                                                     | Importable collection and local environment                      |

The generated Prisma client lives in `backend/src/generated/prisma/` and is ignored
by Git. The [backend README](../backend/README.md) links back to these guides.
Observe is not initialized; its installed dependency does not enable instrumentation.
