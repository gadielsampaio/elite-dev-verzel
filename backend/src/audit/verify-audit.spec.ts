import { hashBidAudit } from './bid-hash.js';
import type { AuditEntry, Checkpoint } from './checkpoint-store.js';
import { verifyAudit, type RecordedBid } from './verify-audit.js';
const lotId = '00000000-0000-4000-8000-000000000001';
function fixture() {
  const entries: AuditEntry[] = [];
  const bids: RecordedBid[] = [];
  const checkpoints: Checkpoint[] = [];
  for (let sequence = 1; sequence <= 3; sequence++) {
    const data = {
      lotId,
      bidId: `00000000-0000-4000-8000-00000000000${sequence + 1}`,
      sequence,
      previousHash: entries.at(-1)?.hash ?? null,
      bidderAlias: `bidder_${'a'.repeat(32)}`,
      amount: `${sequence * 100}.00`,
      currency: 'USD',
      acceptedAt: '2026-10-28T12:00:00.000Z',
      endTime: '2026-10-29T12:00:00.000Z',
    };
    const entry = { ...data, hash: hashBidAudit(data) };
    const bid = {
      id: data.bidId,
      bidderId: '00000000-0000-4000-8000-000000000010',
      amount: data.amount,
      createdAt: data.acceptedAt,
    };
    entries.push(entry);
    bids.push(bid);
    checkpoints.push({
      version: 1,
      entry: { ...entry },
      bidderId: bid.bidderId,
      completeHistory: true,
      confirmed: true,
    });
  }
  return { entries, bids, checkpoints };
}
describe('External bid history verification', () => {
  it('accepts complete matching history', () => {
    const f = fixture();
    expect(verifyAudit(f.entries, f.bids, f.checkpoints).status).toBe('intact');
  });
  it.each(['middle', 'tail', 'all'])(
    'detects %s deletion even after rehashing',
    (position) => {
      const f = fixture();
      const index = position === 'middle' ? 1 : 2;
      if (position === 'all') {
        f.entries = [];
        f.bids = [];
      } else {
        f.entries.splice(index, 1);
        f.bids.splice(index, 1);
      }
      f.entries = f.entries.map((e, i, all) => {
        e.sequence = i + 1;
        e.previousHash = i ? all[i - 1].hash : null;
        e.hash = hashBidAudit(e);
        return e;
      });
      expect(verifyAudit(f.entries, f.bids, f.checkpoints).status).toBe(
        'tampered',
      );
    },
  );
  it('detects entire chain rewriting', () => {
    const f = fixture();
    f.entries.forEach((e, i) => {
      e.amount = '900.00';
      f.bids[i].amount = e.amount;
      e.previousHash = i ? f.entries[i - 1].hash : null;
      e.hash = hashBidAudit(e);
    });
    expect(verifyAudit(f.entries, f.bids, f.checkpoints).status).toBe(
      'tampered',
    );
  });
  it.each(['amount', 'bidderId', 'createdAt'] as const)(
    'detects changed bid %s',
    (key) => {
      const f = fixture();
      f.bids[0][key] = 'changed';
      expect(verifyAudit(f.entries, f.bids, f.checkpoints).status).toBe(
        'tampered',
      );
    },
  );
  it('detects inserted bids', () => {
    const f = fixture();
    f.bids.push({ ...f.bids[0], id: lotId });
    expect(verifyAudit(f.entries, f.bids, f.checkpoints).status).toBe(
      'tampered',
    );
  });
  it('does not certify missing checkpoints, legacy coverage or pending commits', () => {
    const f = fixture();
    expect(verifyAudit(f.entries, f.bids, []).status).toBe('not_verifiable');
    f.checkpoints[0].completeHistory = false;
    expect(verifyAudit(f.entries, f.bids, f.checkpoints).status).toBe(
      'not_verifiable',
    );
    f.checkpoints[0].completeHistory = true;
    f.checkpoints[2].confirmed = false;
    expect(verifyAudit(f.entries, f.bids, f.checkpoints).status).toBe(
      'not_verifiable',
    );
    f.entries.pop();
    f.bids.pop();
    expect(verifyAudit(f.entries, f.bids, f.checkpoints).status).toBe(
      'not_verifiable',
    );
  });
});
