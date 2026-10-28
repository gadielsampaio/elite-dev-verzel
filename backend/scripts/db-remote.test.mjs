import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { parse } from 'dotenv';
import { seedConfig } from './seed-demo.mjs';

const cwd = new URL('../', import.meta.url);
const run = (env, args = []) =>
  spawnSync(process.execPath, ['scripts/db-remote.mjs', ...args], {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
test('requires an explicit target and validates seed password before connecting', () => {
  assert.equal(run({ REMOTE_DATABASE_URL: '' }, ['--check']).status, 1);
  assert.throws(() => seedConfig({ SEED_PASSWORD: 'short' }));
  assert.throws(() => seedConfig({ SEED_PASSWORD: 'ü'.repeat(40) }));
});
test('check mode does not connect or expose credentials; migrations can run without seeds', () => {
  const result = run(
    {
      REMOTE_DATABASE_URL:
        'postgresql://secret-user:secret-password@invalid.example/db',
      SEED_PASSWORD: '',
    },
    ['--check', '--migrate-only'],
  );
  assert.equal(result.status, 0);
  assert.match(result.stdout, /No database connection made/);
  assert.doesNotMatch(
    result.stdout + result.stderr,
    /secret-user|secret-password/,
  );
});
test(
  'migrates and seeds an isolated schema; reruns preserve accounts and lot state',
  { skip: process.env.RUN_DATABASE_TESTS !== '1' },
  async () => {
    const env = parse(readFileSync(new URL('../.env', import.meta.url)));
    const url = new URL(env.DATABASE_URL);
    const schema = `seed_test_${randomUUID().replaceAll('-', '')}`;
    url.searchParams.set('schema', schema);
    const pool = new Pool({ connectionString: env.DATABASE_URL });
    try {
      await pool.query(`CREATE SCHEMA "${schema}"`);
      const config = {
        REMOTE_DATABASE_URL: url.href,
        SEED_PASSWORD: randomUUID(),
        SEED_NAMESPACE: 'seed-test',
      };
      const first = run(config);
      assert.equal(first.status, 0, first.stdout + first.stderr);
      const users = await pool.query(
        `SELECT id,password_hash FROM "${schema}".users ORDER BY id`,
      );
      assert.equal(users.rowCount, 3);
      assert.equal(
        (await pool.query(`SELECT * FROM "${schema}".wallets`)).rowCount,
        3,
      );
      assert.equal(
        (await pool.query(`SELECT * FROM "${schema}".items`)).rowCount,
        1,
      );
      await pool.query(`UPDATE "${schema}".lots SET status = 'cancelled'`);
      const before = await pool.query(`SELECT * FROM "${schema}".lots`);
      const second = run({ ...config, SEED_PASSWORD: randomUUID() });
      assert.equal(second.status, 0, second.stdout + second.stderr);
      assert.deepEqual(
        (
          await pool.query(
            `SELECT id,password_hash FROM "${schema}".users ORDER BY id`,
          )
        ).rows,
        users.rows,
      );
      assert.deepEqual(
        (await pool.query(`SELECT * FROM "${schema}".lots`)).rows,
        before.rows,
      );
      assert.equal(
        (await pool.query(`SELECT * FROM "${schema}".wallet_transactions`))
          .rowCount,
        0,
      );
    } finally {
      await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
      await pool.end();
    }
  },
);
