import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import { sqlMock } from '../setup';
import { hashOrderAccessToken } from '../../backend/src/lib/orderTokens';

describe('GET /api/paypal/checkout-context/:paypalOrderId', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    sqlMock.mockResolvedValue([]);
  });

  it('returns 401 without order access token', async () => {
    const res = await request(app).get('/api/paypal/checkout-context/PAYPAL-CTX-1');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token required');
  });

  it('returns 404 when PayPal order is unknown', async () => {
    const accessToken = 'a'.repeat(64);

    const res = await request(app)
      .get('/api/paypal/checkout-context/PAYPAL-MISSING')
      .set('X-Order-Access-Token', accessToken);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Order not found');
  });

  it('returns 403 for invalid access token', async () => {
    const accessToken = 'b'.repeat(64);
    const tokenHash = hashOrderAccessToken('c'.repeat(64));

    sqlMock.mockResolvedValueOnce([
      {
        id: '00000000-0000-0000-0000-0000000000aa',
        order_number: 'GSS-CTX-1',
        payment_status: 'pending',
        total: 120,
        paypal_order_id: 'PAYPAL-CTX-1',
        access_token_hash: tokenHash,
      },
    ]);

    const res = await request(app)
      .get('/api/paypal/checkout-context/PAYPAL-CTX-1')
      .set('X-Order-Access-Token', accessToken);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Invalid order access token');
  });

  it('ignores deprecated aid query without header token', async () => {
    const res = await request(app)
      .get('/api/paypal/checkout-context/PAYPAL-CTX-1')
      .query({ aid: 'b'.repeat(64) });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token required');
  });

  it('returns checkout context for valid token on pending order', async () => {
    const accessToken = 'd'.repeat(64);
    const tokenHash = hashOrderAccessToken(accessToken);

    sqlMock.mockResolvedValueOnce([
      {
        id: '00000000-0000-0000-0000-0000000000bb',
        order_number: 'GSS-CTX-2',
        payment_status: 'pending',
        total: 120,
        paypal_order_id: 'PAYPAL-CTX-2',
        access_token_hash: tokenHash,
      },
    ]);

    const res = await request(app)
      .get('/api/paypal/checkout-context/PAYPAL-CTX-2')
      .set('X-Order-Access-Token', accessToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.serverOrderId).toBe('00000000-0000-0000-0000-0000000000bb');
    expect(res.body.orderNumber).toBe('GSS-CTX-2');
    expect(res.body.total).toBe(120);
    expect(res.body.paypalOrderId).toBe('PAYPAL-CTX-2');
  });

  it('returns alreadyCompleted when order is paid', async () => {
    const accessToken = 'e'.repeat(64);
    const tokenHash = hashOrderAccessToken(accessToken);

    sqlMock.mockResolvedValueOnce([
      {
        id: '00000000-0000-0000-0000-0000000000cc',
        order_number: 'GSS-CTX-3',
        payment_status: 'completed',
        total: 99,
        paypal_order_id: 'PAYPAL-CTX-3',
        access_token_hash: tokenHash,
      },
    ]);

    const res = await request(app)
      .get('/api/paypal/checkout-context/PAYPAL-CTX-3')
      .set('X-Order-Access-Token', accessToken);

    expect(res.status).toBe(200);
    expect(res.body.alreadyCompleted).toBe(true);
    expect(res.body.orderNumber).toBe('GSS-CTX-3');
  });
});
