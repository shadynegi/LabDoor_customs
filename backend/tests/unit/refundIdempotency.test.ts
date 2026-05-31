import { describe, it, expect } from 'vitest';
import {
  buildPayPalRefundDedupeKey,
  buildWebhookRefundDedupeKey,
} from '../../src/lib/refundIdempotency';
import { isFullRefundAmount } from '../../src/lib/refundSync';

describe('refundIdempotency helpers', () => {
  it('builds PayPal refund dedupe key', () => {
    expect(buildPayPalRefundDedupeKey('REFUND123')).toBe('paypal-refund:REFUND123');
  });

  it('prefers transmission id for webhook dedupe', () => {
    expect(buildWebhookRefundDedupeKey('tx-abc', 'PAYMENT.CAPTURE.REVERSED', 'REV1')).toBe(
      'webhook:tx-abc'
    );
  });

  it('falls back to event type and resource id', () => {
    expect(buildWebhookRefundDedupeKey(undefined, 'PAYMENT.CAPTURE.REVERSED', 'REV1')).toBe(
      'webhook:PAYMENT.CAPTURE.REVERSED:REV1'
    );
  });
});

describe('isFullRefundAmount', () => {
  it('treats missing amount as not a full refund', () => {
    expect(isFullRefundAmount(100)).toBe(false);
  });

  it('detects partial and full refund amounts', () => {
    expect(isFullRefundAmount(100, '50.00')).toBe(false);
    expect(isFullRefundAmount(100, '100.00')).toBe(true);
  });
});
