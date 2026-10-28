import { createHash } from 'node:crypto';
import { hash, truncates } from 'bcryptjs';
import { Pool } from 'pg';
import { artworkResponses } from '../src/catalog/fixtures/artworks.ts';

export function seedConfig(env) {
  const password = env.SEED_PASSWORD;
  if (!password || password.length < 12 || truncates(password))
    throw new Error(
      'SEED_PASSWORD must contain at least 12 characters and at most 72 UTF-8 bytes',
    );
  const namespace = env.SEED_NAMESPACE || 'auction-demo-v1';
  if (!/^[a-z0-9-]{1,60}$/.test(namespace))
    throw new Error('Invalid SEED_NAMESPACE');
  return { password, namespace };
}
const id = (key) => {
  const hex = createHash('sha256').update(key).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

export async function seedDemo(connectionString, config) {
  const schema =
    new URL(connectionString).searchParams.get('schema') || 'public';
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema))
    throw new Error('Unsupported database schema name');
  const passwordHash = await hash(config.password, 12);
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 10000,
    options: `-c search_path=${schema}`,
  });
  const client = await pool.connect().catch(async (error) => {
    await pool.end();
    throw error;
  });
  const key = (suffix) => id(`${config.namespace}:${suffix}`);
  const artwork = artworkResponses[0].data;
  const snapshot = {
    provider: 'cleveland',
    articArtworkId: artwork.id,
    articImageId: null,
    name: artwork.title,
    imageUrl: artwork.images.web.url,
    printImageUrl: artwork.images.print?.url ?? null,
    artistDisplay: artwork.creators[0].description,
    creditLine: artwork.creditline,
    isPublicDomain: true,
    dateDisplay: artwork.creation_date,
    mediumDisplay: artwork.technique,
    dimensions: artwork.measurements,
    artworkType: artwork.type,
  };
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `seed:${config.namespace}`,
    ]);
    for (const [label, role] of [
      ['auctioneer', 'auctioneer'],
      ['bidder-a', 'bidder'],
      ['bidder-b', 'bidder'],
    ]) {
      const email = `${label}@${config.namespace}.example.invalid`;
      const existing = await client.query(
        'SELECT id, email, role FROM users WHERE id = $1 OR email = $2',
        [key(label), email],
      );
      if (
        existing.rows.some(
          (u) => u.id !== key(label) || u.email !== email || u.role !== role,
        )
      )
        throw new Error('Seed identity conflicts with an existing account');
      await client.query(
        `INSERT INTO users (id,name,email,role,password_hash,updated_at)
        VALUES ($1,$2,$3,$4,$5,now()) ON CONFLICT (id) DO NOTHING`,
        [key(label), `Demo ${label}`, email, role, passwordHash],
      );
      await client.query(
        'INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
        [key(label)],
      );
    }
    const lot = await client.query(
      `INSERT INTO lots
      (id,owner_id,title,status,start_time,end_time,starting_bid,bid_increment,updated_at)
      VALUES ($1,$2,$3,'open',now(),now() + interval '7 days',100,5,now())
      ON CONFLICT (id) DO NOTHING RETURNING id`,
      [key('lot'), key('auctioneer'), `Demo — ${artwork.title}`],
    );
    if (lot.rowCount)
      await client.query(
        `INSERT INTO items
      (lot_id,name,estimated_value,image_url,artic_artwork_id,artist_display,credit_line,
       is_public_domain,source_snapshot,source_fetched_at,print_image_url,updated_at)
      VALUES ($1,$2,500,$3,$4,$5,$6,true,$7,now(),$8,now())`,
        [
          key('lot'),
          snapshot.name,
          snapshot.imageUrl,
          artwork.id,
          snapshot.artistDisplay,
          snapshot.creditLine,
          JSON.stringify(snapshot),
          snapshot.printImageUrl,
        ],
      );
    await client.query('COMMIT');
    return { lotId: key('lot'), lotCreated: Boolean(lot.rowCount) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
