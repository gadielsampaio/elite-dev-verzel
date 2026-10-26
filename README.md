# Auction API

NestJS and TypeScript (ESM), Prisma 7, PostgreSQL 18, and Docker Compose.
The database schema, initial migration, Prisma integration, and `GET /health`
are implemented, along with user create/read/update and password-hashed registration.
JWT login, user-route authorization, external health checks, and Art Institute catalog search are implemented; auction operations remain planned.
Live catalog verification is currently blocked by an upstream Cloudflare 403; see [limitations](docs/api.md#art-institute-catalog).

See the [project documentation](docs/README.md) for the overview and structure,
[development setup](docs/development.md) for environment and migration commands,
[database reference](docs/database.md) for entities and constraints, and
[API and Postman guide](docs/api.md) for supported endpoints and testing.
