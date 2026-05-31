import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/server';
import { createCsrfAgent, withCsrf } from '../helpers/http';

describe('security hardening', () => {
  it('requires admin auth for PayPal refunds', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(
      agent.post('/api/paypal/refund/CAPTURE123'),
      csrfToken
    ).send({ amount: '10.00', currency: 'USD' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('blocks public customer order listing by email', async () => {
    const res = await request(app).get('/api/orders/customer/user@example.com');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Access denied');
  });

  it('requires access token for order lookup by number', async () => {
    const res = await request(app).get('/api/orders/number/GSS-TEST-123');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token required');
  });

  it('rate limits failed admin login attempts (5 per 15 minutes)', async () => {
    const testIp = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    const { agent, csrfToken } = await createCsrfAgent();

    for (let i = 0; i < 5; i++) {
      const res = await withCsrf(
        agent.post('/api/admin/login').set('X-Forwarded-For', testIp),
        csrfToken
      ).send({ username: 'wrong', password: 'wrong' });

      expect(res.status).toBe(401);
    }

    const blocked = await withCsrf(
      agent.post('/api/admin/login').set('X-Forwarded-For', testIp),
      csrfToken
    ).send({ username: 'wrong', password: 'wrong' });

    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
    expect(blocked.body.error).toMatch(/too many login attempts/i);
    expect(blocked.body.retryAfter).toBeDefined();
  });

  it('rate limits review submissions (5 per hour)', async () => {
    const testIp = `203.0.114.${Math.floor(Math.random() * 200) + 1}`;
    const { agent, csrfToken } = await createCsrfAgent();

    for (let i = 0; i < 5; i++) {
      const res = await withCsrf(
        agent.post('/api/reviews').set('X-Forwarded-For', testIp),
        csrfToken
      ).send({});

      expect(res.status).toBe(400);
    }

    const blocked = await withCsrf(
      agent.post('/api/reviews').set('X-Forwarded-For', testIp),
      csrfToken
    ).send({});

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many reviews submitted/i);
    expect(blocked.body.retryAfter).toBeDefined();
  });

  it('rate limits coupon validation (20 per 15 minutes)', async () => {
    const testIp = `203.0.115.${Math.floor(Math.random() * 200) + 1}`;
    const { agent, csrfToken } = await createCsrfAgent();

    for (let i = 0; i < 20; i++) {
      const res = await withCsrf(
        agent.post('/api/coupons/validate').set('X-Forwarded-For', testIp),
        csrfToken
      ).send({ subtotal: 100 });

      expect(res.status).toBe(400);
    }

    const blocked = await withCsrf(
      agent.post('/api/coupons/validate').set('X-Forwarded-For', testIp),
      csrfToken
    ).send({ subtotal: 100 });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many coupon attempts/i);
    expect(blocked.body.retryAfter).toBeDefined();
  });
});
