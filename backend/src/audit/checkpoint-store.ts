import { mkdir, open, readFile, readdir, link, unlink } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hashBidAudit, type BidAuditInput } from './bid-hash.js';

export type AuditEntry = BidAuditInput & { hash: string };
// Private storage only. Never return bidderId from a public endpoint.
export type Witness = {
  version: 1;
  entry: AuditEntry;
  bidderId: string;
  completeHistory: boolean;
};
export type Checkpoint = Witness & { confirmed: boolean };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const DIRECTORY_MODE = 0o700;
const CHECKPOINT_MODE = 0o600;

async function writeDurableFile(path: string, body: string) {
  const file = await open(path, 'wx', CHECKPOINT_MODE);
  try {
    await file.writeFile(body);
    await file.sync();
  } finally {
    await file.close();
  }
}

async function syncDirectory(directory: string) {
  const folder = await open(directory, 'r');
  try {
    await folder.sync();
  } finally {
    await folder.close();
  }
}

async function publishImmutableFile(
  temporary: string,
  destination: string,
  body: string,
) {
  try {
    // Hard linking publishes atomically without replacing an existing witness.
    await link(temporary, destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if ((await readFile(destination, 'utf8')) !== body) {
      throw new Error('Checkpoint cannot be overwritten');
    }
  }
}

async function isConfirmed(directory: string, witness: Witness) {
  try {
    const marker: unknown = JSON.parse(
      await readFile(
        join(directory, `${witness.entry.bidId}.confirmed`),
        'utf8',
      ),
    );
    if (marker !== witness.entry.hash)
      throw new Error('Invalid checkpoint confirmation');

    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function validateWitness(witness: Witness, lotId: string, name: string) {
  if (
    witness.version !== 1 ||
    witness.entry.lotId !== lotId ||
    name !== `${witness.entry.bidId}.json` ||
    !uuid.test(witness.bidderId) ||
    typeof witness.completeHistory !== 'boolean' ||
    hashBidAudit(witness.entry) !== witness.entry.hash
  ) {
    throw new Error('Invalid external checkpoint');
  }
}

async function readCheckpoint(
  directory: string,
  name: string,
  lotId: string,
): Promise<Checkpoint> {
  const witness = JSON.parse(
    await readFile(join(directory, name), 'utf8'),
  ) as Witness;
  validateWitness(witness, lotId, name);
  const confirmed = await isConfirmed(directory, witness);
  return { ...witness, confirmed };
}

export class CheckpointStore {
  constructor(readonly directory = process.env.AUDIT_CHECKPOINT_DIR) {
    if (directory && !isAbsolute(directory))
      throw new Error('AUDIT_CHECKPOINT_DIR must be absolute');
  }

  private path(lotId: string) {
    if (!this.directory || !uuid.test(lotId))
      throw new Error('Invalid checkpoint location');

    return join(this.directory, lotId);
  }

  private async immutable(directory: string, name: string, value: unknown) {
    await mkdir(directory, { recursive: true, mode: DIRECTORY_MODE });
    const body = JSON.stringify(value);
    const temporary = join(directory, `.pending-${randomUUID()}`);
    await writeDurableFile(temporary, body);
    try {
      await publishImmutableFile(temporary, join(directory, name), body);
      await syncDirectory(directory);
    } finally {
      await unlink(temporary);
    }
  }

  async prepare(witness: Witness) {
    if (
      !uuid.test(witness.bidderId) ||
      hashBidAudit(witness.entry) !== witness.entry.hash
    )
      throw new Error('Invalid checkpoint');
    await this.immutable(
      this.path(witness.entry.lotId),
      `${witness.entry.bidId}.json`,
      witness,
    );
  }

  async confirm(witness: Witness) {
    await this.immutable(
      this.path(witness.entry.lotId),
      `${witness.entry.bidId}.confirmed`,
      witness.entry.hash,
    );
  }

  async read(lotId: string): Promise<Checkpoint[]> {
    const directory = this.path(lotId);
    let names: string[];
    try {
      names = await readdir(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const checkpoints: Checkpoint[] = [];
    for (const name of names.filter((n) => n.endsWith('.json'))) {
      // Sequential reads bound file descriptors; ordering is canonicalized below.
      checkpoints.push(await readCheckpoint(directory, name, lotId));
    }

    return checkpoints.sort((a, b) => a.entry.sequence - b.entry.sequence);
  }

  async lots() {
    if (!this.directory) return [];
    await mkdir(this.directory, { recursive: true, mode: DIRECTORY_MODE });

    return (await readdir(this.directory))
      .filter((name) => uuid.test(name))
      .sort();
  }
}
