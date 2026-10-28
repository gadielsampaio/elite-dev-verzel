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
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const body = JSON.stringify(value);
    const temporary = join(directory, `.pending-${randomUUID()}`);
    const file = await open(temporary, 'wx', 0o600);
    try {
      await file.writeFile(body);
      await file.sync();
    } finally {
      await file.close();
    }
    try {
      try {
        await link(temporary, join(directory, name));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        if ((await readFile(join(directory, name), 'utf8')) !== body)
          throw new Error('Checkpoint cannot be overwritten');
      }
      const folder = await open(directory, 'r');
      try {
        await folder.sync();
      } finally {
        await folder.close();
      }
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
      const witness = JSON.parse(
        await readFile(join(directory, name), 'utf8'),
      ) as Witness;
      if (
        witness.version !== 1 ||
        witness.entry.lotId !== lotId ||
        name !== `${witness.entry.bidId}.json` ||
        !uuid.test(witness.bidderId) ||
        typeof witness.completeHistory !== 'boolean' ||
        hashBidAudit(witness.entry) !== witness.entry.hash
      )
        throw new Error('Invalid external checkpoint');
      let confirmed = false;
      try {
        const marker = JSON.parse(
          await readFile(
            join(directory, `${witness.entry.bidId}.confirmed`),
            'utf8',
          ),
        ) as unknown;
        if (marker !== witness.entry.hash)
          throw new Error('Invalid checkpoint confirmation');
        confirmed = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      checkpoints.push({ ...witness, confirmed });
    }
    return checkpoints.sort((a, b) => a.entry.sequence - b.entry.sequence);
  }
  async lots() {
    if (!this.directory) return [];
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    return (await readdir(this.directory))
      .filter((name) => uuid.test(name))
      .sort();
  }
}
