import { describe, it, expect, vi, beforeEach } from 'vitest';
import { amountsMatch } from '../../backend/src/lib/paypalCheckout';

vi.mock('../../backend/src/lib/paypalCaptureAmount', () => ({
  fetchPayPalCapturedAmount: vi.fn(),
}));

vi.mock('../../backend/src/lib/paypalClient', () => ({
  PAYPAL_API: 'https://api-m.sandbox.paypal.com',
  getPayPalAccessToken: vi.fn(),
  parseJson: vi.fn(),
  paypalFetch: vi.fn(),
}));

import { fetchPayPalCapturedAmount } from '../../backend/src/lib/paypalCaptureAmount';
import { resolveVerifiedCaptureDetails } from '../../backend/src/lib/paymentReconciliation';

describe('resolveVerifiedCaptureDetails', () => {
  beforeEach(() => {
    vi.mocked(fetchPayPalCapturedAmount).mockReset();
  });

  it('returns verified capture when amount and id are present', async () => {
    const result = await resolveVerifiedCaptureDetails(
      'PAYPAL-1',
      'CAP-1',
      100,
      100
    );
    expect(result).toEqual({ ok: true, captureId: 'CAP-1', amount: 100 });
  });

  it('fails closed when amount cannot be resolved', async () => {
    vi.mocked(fetchPayPalCapturedAmount).mockResolvedValue(null);
    const result = await resolveVerifiedCaptureDetails(
      'PAYPAL-1',
      'CAP-1',
      100,
      null
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('amount_missing');
    }
  });

  it('rejects amount mismatch', async () => {
    const result = await resolveVerifiedCaptureDetails(
      'PAYPAL-1',
      'CAP-1',
      100,
      50
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('amount_mismatch');
      expect(amountsMatch(100, 50)).toBe(false);
    }
  });
});
