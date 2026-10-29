import { receiptShareToken, validReceiptShare } from './receipt-share.js';

describe('Receipt share tokens', () => {
  beforeEach(() =>
    vi.stubEnv(
      'JWT_SECRET',
      'receipt-share-tests-secret-at-least-32-characters',
    ),
  );
  afterEach(() => vi.unstubAllEnvs());

  it('binds access to one lot and receipt, rejecting tampering and malformed tokens', () => {
    const token = receiptShareToken('lot', 'receipt');
    expect(validReceiptShare(token, 'lot', 'receipt')).toBe(true);
    expect(validReceiptShare(token, 'other-lot', 'receipt')).toBe(false);
    expect(validReceiptShare(token, 'lot', 'other-receipt')).toBe(false);
    for (const invalid of ['', 'invalid', token.slice(1), '0'.repeat(64)])
      expect(validReceiptShare(invalid, 'lot', 'receipt')).toBe(false);
  });

  it('invalidates existing links when the signing secret changes', () => {
    const token = receiptShareToken('lot', 'receipt');
    vi.stubEnv(
      'JWT_SECRET',
      'rotated-receipt-share-secret-at-least-32-characters',
    );
    expect(validReceiptShare(token, 'lot', 'receipt')).toBe(false);
  });
});
