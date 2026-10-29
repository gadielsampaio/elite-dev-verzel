import { mkdtemp, rm, writeFile, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CheckpointStore, type Witness } from './checkpoint-store.js';
import { hashBidAudit } from './bid-hash.js';

describe('Protected external checkpoint files', () => {
  let directory: string, store: CheckpointStore, witness: Witness;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'checkpoint-store-'));
    store = new CheckpointStore(directory);
    const entry = {
      lotId: '11111111-1111-4111-8111-111111111111',
      bidId: '22222222-2222-4222-8222-222222222222',
      sequence: 1,
      previousHash: null,
      bidderAlias: `bidder_${'a'.repeat(32)}`,
      amount: '100.00',
      currency: 'USD',
      acceptedAt: '2026-10-28T12:00:00.000Z',
      endTime: '2026-10-29T12:00:00.000Z',
    };
    witness = {
      version: 1,
      entry: { ...entry, hash: hashBidAudit(entry) },
      bidderId: '33333333-3333-4333-8333-333333333333',
      completeHistory: true,
    };
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('publishes atomically, supports concurrent retries and survives a new reader', async () => {
    await Promise.all([store.prepare(witness), store.prepare(witness)]);
    expect((await store.read(witness.entry.lotId))[0].confirmed).toBe(false);
    await Promise.all([store.confirm(witness), store.confirm(witness)]);
    expect(
      (await new CheckpointStore(directory).read(witness.entry.lotId))[0]
        .confirmed,
    ).toBe(true);
    const names = await readdir(join(directory, witness.entry.lotId));
    expect(names).toHaveLength(2);
    expect(
      (
        await stat(
          join(directory, witness.entry.lotId, `${witness.entry.bidId}.json`),
        )
      ).mode & 0o777,
    ).toBe(0o600);
  });

  it('refuses to overwrite existing evidence', async () => {
    await store.prepare(witness);
    await expect(
      store.prepare({ ...witness, completeHistory: false }),
    ).rejects.toThrow('cannot be overwritten');
    expect((await store.read(witness.entry.lotId))[0].completeHistory).toBe(
      true,
    );
  });

  it('rejects corrupted external records instead of treating them as absent', async () => {
    await store.prepare(witness);
    await writeFile(
      join(directory, witness.entry.lotId, `${witness.entry.bidId}.json`),
      '{}',
    );
    await expect(store.read(witness.entry.lotId)).rejects.toThrow();
  });

  it('rejects relative roots and path traversal', async () => {
    expect(() => new CheckpointStore('./checkpoints')).toThrow('absolute');
    await expect(store.read('../escape')).rejects.toThrow('location');
  });

  it('distinguishes a missing confirmation from a corrupted confirmation', async () => {
    await store.prepare(witness);
    expect((await store.read(witness.entry.lotId))[0].confirmed).toBe(false);
    await writeFile(
      join(directory, witness.entry.lotId, `${witness.entry.bidId}.confirmed`),
      JSON.stringify('wrong-hash'),
    );
    await expect(store.read(witness.entry.lotId)).rejects.toThrow(
      'Invalid checkpoint confirmation',
    );
  });
});
