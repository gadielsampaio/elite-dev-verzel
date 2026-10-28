import {
  canonicalBidAudit,
  hashBidAudit,
  type BidAuditInput,
} from './bid-hash.js';

const first: BidAuditInput = {
  lotId: '11111111-1111-4111-8111-111111111111',
  bidId: '22222222-2222-4222-8222-222222222222',
  bidderAlias: 'bidder_' + 'a'.repeat(32),
  sequence: 1,
  previousHash: null,
  amount: '100.00',
  currency: 'USD',
  acceptedAt: '2026-10-28T01:00:00.000Z',
  endTime: '2026-10-28T02:00:00.000Z',
};

describe('Versioned bid audit hashing', () => {
  it('matches an independently calculated SHA-256 fixture', () => {
    expect(hashBidAudit(first)).toBe(
      'e1371ec0c9a87f0531a4544e9da49338a80a7e55c310d3fc9d9e90a3a186f2a3',
    );
    expect(JSON.parse(canonicalBidAudit(first))[0]).toBe(
      'auction-bid-audit-v1',
    );
  });
  it('is independent of object property insertion order and ignores extra data', () => {
    const reversed = Object.fromEntries(
      Object.entries(first).reverse(),
    ) as BidAuditInput;
    expect(hashBidAudit(reversed)).toBe(hashBidAudit(first));
    const withPrivateData = {
      ...first,
      email: 'must-not-be-included@example.invalid',
    };
    expect(canonicalBidAudit(withPrivateData)).not.toContain('email');
    expect(hashBidAudit(withPrivateData)).toBe(hashBidAudit(first));
  });
  it('preserves amounts beyond JavaScript safe-integer precision', () => {
    const amount = '9007199254740993.01';
    expect(canonicalBidAudit({ ...first, amount })).toContain(amount);
    expect(hashBidAudit({ ...first, amount })).not.toBe(
      hashBidAudit({ ...first, amount: '9007199254740993.02' }),
    );
  });
  it.each([
    { lotId: '33333333-3333-4333-8333-333333333333' },
    { bidId: '33333333-3333-4333-8333-333333333333' },
    { bidderAlias: 'bidder_' + 'b'.repeat(32) },
    { amount: '105.00' },
    { currency: 'EUR' },
    { acceptedAt: '2026-10-28T01:00:00.001Z' },
    { endTime: '2026-10-28T02:02:00.000Z' },
  ])('changes the hash when recorded bid data changes: %j', (patch) => {
    expect(hashBidAudit({ ...first, ...patch })).not.toBe(hashBidAudit(first));
  });
  it('binds the next entry to its sequence and previous digest', () => {
    const second = { ...first, sequence: 2, previousHash: hashBidAudit(first) };
    expect(hashBidAudit(second)).not.toBe(
      hashBidAudit({ ...second, sequence: 3 }),
    );
    expect(hashBidAudit(second)).not.toBe(
      hashBidAudit({
        ...second,
        previousHash: hashBidAudit({ ...first, amount: '101.00' }),
      }),
    );
  });
  it.each([
    '0.00',
    '01.00',
    '100',
    '1e2',
    '-1.00',
    '1.001',
    '100000000000000000.00',
  ])('rejects noncanonical money %s', (amount) => {
    expect(() => hashBidAudit({ ...first, amount })).toThrow();
  });
  it.each([
    { sequence: 0 },
    { sequence: 1.5 },
    { sequence: Number.MAX_SAFE_INTEGER + 1 },
    { sequence: 2, previousHash: null },
    { previousHash: 'a'.repeat(64) },
    { sequence: 2, previousHash: 'invalid' },
    { bidderAlias: 'private-user-id' },
    { acceptedAt: '2026-10-27T21:00:00-04:00' },
    { endTime: 'not-a-date' },
  ])('rejects invalid chain metadata %j', (patch) => {
    expect(() => hashBidAudit({ ...first, ...patch })).toThrow();
  });
});
