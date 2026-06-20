import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import * as paymentReconciliation from '../../backend/src/lib/paymentReconciliation';

describe('POST /api/paypal/webhook', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 and reconciles PAYMENT.CAPTURE.COMPLETED when binding is present', async () => {
    const syncSpy = vi
      .spyOn(paymentReconciliation, 'syncWebhookPaymentCompleted')
      .mockResolvedValue();

    const res = await request(app)
      .post('/api/paypal/webhook')
      .send({
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'CAP-OK-1',
          amount: { value: '100.00', currency_code: 'USD' },
          supplementary_data: { related_ids: { order_id: 'PAYPAL-OK-1' } },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(syncSpy).toHaveBeenCalledWith('PAYPAL-OK-1', 'CAP-OK-1', 100);
  });

  it('returns 500 when PAYMENT.CAPTURE.DENIED has no order binding', async () => {
    const res = await request(app)
      .post('/api/paypal/webhook')
      .send({
        event_type: 'PAYMENT.CAPTURE.DENIED',
        resource: { id: 'CAP-DENIED-1' },
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 when PAYMENT.CAPTURE.COMPLETED lacks order id', async () => {
    const res = await request(app)
      .post('/api/paypal/webhook')
      .send({
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: { id: 'CAP-1' },
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
