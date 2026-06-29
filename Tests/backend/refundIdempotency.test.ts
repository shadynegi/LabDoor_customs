import { describe, it, expect } from 'vitest';
import {
  buildPayPalRefundDedupeKey,
  buildWebhookRefundDedupeKey,
} from '../../backend/src/lib/refundIdempotency';

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
