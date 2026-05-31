import { describe, it, expect } from 'vitest';
import {
  extractCaptureIdFromWebhookResource,
  parseCaptureFromPayPalOrder,
  extractCaptureAmountFromWebhookResource,
  extractRefundAmountFromWebhookResource,
} from '../../src/lib/paypalWebhookUtils';
import { isFullRefundAmount } from '../../src/lib/refundSync';

describe('paypalWebhookUtils', () => {
  it('extracts capture ID from refund webhook up link', () => {
    const captureId = extractCaptureIdFromWebhookResource({
      id: 'REFUND123',
      links: [
        {
          rel: 'up',
          href: 'https://api.paypal.com/v2/payments/captures/CAPTURE999',
        },
      ],
    });
    expect(captureId).toBe('CAPTURE999');
  });

  it('returns null when capture link is missing', () => {
    expect(extractCaptureIdFromWebhookResource({ id: 'REFUND123' })).toBeNull();
  });

  it('parses capture from PayPal order response', () => {
    const parsed = parseCaptureFromPayPalOrder({
      purchase_units: [
        {
          payments: {
            captures: [{ id: 'CAP123', amount: { value: '99.00' } }],
          },
        },
      ],
    });
    expect(parsed.captureId).toBe('CAP123');
    expect(parsed.capturedAmount).toBe(99);
  });

  it('extracts capture amount from webhook resource', () => {
    expect(
      extractCaptureAmountFromWebhookResource({ amount: { value: '42.50' } })
    ).toBe(42.5);
  });

  it('extracts refund amount from webhook resource', () => {
    expect(
      extractRefundAmountFromWebhookResource({ amount: { value: '10.00' } })
    ).toBe('10.00');
  });
});

describe('isFullRefundAmount', () => {
  it('treats missing amount as not a full refund', () => {
    expect(isFullRefundAmount(100)).toBe(false);
  });

  it('detects partial refund amounts', () => {
    expect(isFullRefundAmount(100, '50.00')).toBe(false);
    expect(isFullRefundAmount(100, '100.00')).toBe(true);
  });

  it('detects cumulative full refund', () => {
    expect(isFullRefundAmount(100, '100.00')).toBe(true);
    expect(isFullRefundAmount(100, '99.99')).toBe(false);
  });
});
