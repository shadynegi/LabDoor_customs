import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';

describe('POST /api/paypal/webhook', () => {
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
