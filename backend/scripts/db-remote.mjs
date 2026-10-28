import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
import { seedConfig, seedDemo } from './seed-demo.mjs';

const backend = fileURLToPath(new URL('../', import.meta.url));
const root = resolve(backend, '..');
async function main() {
  const args = process.argv.slice(2);
  let envFile = resolve(root, '.env'),
    migrateOnly = false,
    check = false;
  while (args.length) {
    const arg = args.shift();
    if (arg === '--env-file' && args[0]) envFile = resolve(root, args.shift());
    else if (arg === '--migrate-only') migrateOnly = true;
    else if (arg === '--check') check = true;
    else
      throw new Error(
        'Usage: npm run db:remote -- [--env-file path] [--migrate-only] [--check]',
      );
  }
  let fileEnv = {};
  try {
    fileEnv = parse(readFileSync(envFile));
  } catch (error) {
    if (error.code !== 'ENOENT')
      throw new Error('Cannot read environment file');
  }
  const env = { ...fileEnv, ...process.env };
  // Explicit remote variable prevents accidentally using backend/.env's local database.
  if (!env.REMOTE_DATABASE_URL)
    throw new Error('REMOTE_DATABASE_URL is required');
  let url;
  try {
    url = new URL(env.REMOTE_DATABASE_URL);
  } catch {
    throw new Error('Invalid REMOTE_DATABASE_URL');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    url.pathname.length < 2
  )
    throw new Error('REMOTE_DATABASE_URL must be a PostgreSQL database URL');
  const config = migrateOnly ? null : seedConfig(env);
  console.log(`Target: ${url.hostname}:${url.port || '5432'}${url.pathname}`);
  if (check) {
    console.log(
      `Configuration valid. Would apply migrations${config ? ' and demo seeds' : ''}. No database connection made.`,
    );
    return;
  }
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/prisma/build/index.js',
      'migrate',
      'deploy',
      '--config',
      'prisma7.config.ts',
    ],
    {
      cwd: backend,
      env: { ...env, DATABASE_URL: env.REMOTE_DATABASE_URL },
      encoding: 'utf8',
    },
  );
  // Never relay CLI errors containing credentials or connection strings.
  if (result.error || result.status !== 0)
    throw new Error(
      'Migration deployment failed; seeds were not run. Check connectivity and migration status.',
    );
  console.log('Migrations applied successfully.');
  if (config) {
    try {
      const seeded = await seedDemo(env.REMOTE_DATABASE_URL, config);
      console.log(
        `Demo accounts/wallets ready. Lot ${seeded.lotId}: ${seeded.lotCreated ? 'created, open for 7 days' : 'preserved (schedule/status unchanged)'}.`,
      );
    } catch {
      throw new Error(
        'Seed transaction failed and was rolled back. Check database permissions, schema and seed account conflicts. Migrations remain applied.',
      );
    }
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
