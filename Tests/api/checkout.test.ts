import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import { sqlMock } from '../setup';
import { createCsrfAgent, withCsrf } from '../helpers/http';

describe('checkout path', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    sqlMock.mockResolvedValue([]);
  });

  it('rejects create-payment without cart items', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/paypal/create-payment'), csrfToken).send({
      currency: 'USD',
      customerInfo: { fullName: 'Test User', email: 'test@example.com' },
      items: [],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/items/i);
  });

  it('rejects create-payment with invalid email', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/paypal/create-payment'), csrfToken).send({
      currency: 'USD',
      customerInfo: { fullName: 'Test User', email: 'not-an-email' },
      items: [{ product_id: 1, quantity: 1 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid email format');
  });

  it('requires serverOrderId when capturing payment', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(
      agent.post('/api/paypal/capture-payment/PAYPAL-ORDER-123'),
      csrfToken
    ).send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('serverOrderId is required');
  });

  it('requires access token when capturing payment', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(
      agent.post('/api/paypal/capture-payment/PAYPAL-ORDER-123'),
      csrfToken
    ).send({ serverOrderId: '00000000-0000-0000-0000-000000000001' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token required');
  });

  it('rejects capture when PayPal order is not bound to server order', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(
      agent.post('/api/paypal/capture-payment/PAYPAL-ORDER-123'),
      csrfToken
    ).send({
      serverOrderId: '00000000-0000-0000-0000-000000000001',
      accessToken: 'test-access-token',
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Order binding mismatch');
  });

  it('allows webhook in non-production when PAYPAL_WEBHOOK_ID is unset', async () => {
    const res = await request(app)
      .post('/api/paypal/webhook')
      .send({ event_type: 'CHECKOUT.ORDER.APPROVED' });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('does not rate limit PayPal webhooks when payment limit is exhausted', async () => {
    const testIp = `203.0.116.${Math.floor(Math.random() * 200) + 1}`;
    const { agent, csrfToken } = await createCsrfAgent();

    for (let i = 0; i < 30; i++) {
      await withCsrf(
        agent.post('/api/paypal/create-payment').set('X-Forwarded-For', testIp),
        csrfToken
      ).send({ items: [] });
    }

    const limited = await withCsrf(
      agent.post('/api/paypal/create-payment').set('X-Forwarded-For', testIp),
      csrfToken
    ).send({ items: [] });

    expect(limited.status).toBe(429);
    expect(limited.body.retryAfter).toBeDefined();

    const webhook = await request(app)
      .post('/api/paypal/webhook')
      .set('X-Forwarded-For', testIp)
      .send({ event_type: 'CHECKOUT.ORDER.APPROVED' });

    expect(webhook.status).toBe(200);
    expect(webhook.body.received).toBe(true);
  });
});
