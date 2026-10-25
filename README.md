# Auction API

NestJS and TypeScript (ESM), Prisma 7, and PostgreSQL. The current implementation
contains the application scaffold, auction database schema, and initial migration.

## Docker development

Copy `.env.example` to `.env`, then run `docker compose up --build`.
The API listens on port 3000 and PostgreSQL on localhost port 5432.
The API container generates the Prisma client before starting in watch mode.
Starting the containers does not apply database migrations.

## Local backend setup and validation

Use Node.js 24, matching the Docker image. From `backend/`:

```sh
npm ci
npx prisma generate --config prisma7.config.ts
npm run build
npm run lint
npm test
```

Create a local `backend/.env` containing `DATABASE_URL` for your PostgreSQL
instance. For the example Compose credentials, the local connection URL is
`postgresql://app:dev_password@localhost:5432/app_db?schema=public`.
Keep actual credentials out of version control.

Run the existing HTTP smoke test with the environment loaded:

```sh
node --env-file=.env ./node_modules/vitest/vitest.mjs run --config ./vitest.config.e2e.ts
```

This test checks `GET /`; it does not validate database queries or migrations.
For a local application run with the environment loaded:

```sh
node --env-file=.env dist/main.js
```
