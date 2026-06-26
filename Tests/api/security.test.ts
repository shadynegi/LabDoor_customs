import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import { createCsrfAgent, withCsrf } from '../helpers/http';

describe('security hardening', () => {
  it('allows LAN dev origins on alternate Vite ports (e.g. 5174)', async () => {
    const res = await request(app)
      .options('/api/admin/login')
      .set('Origin', 'http://192.168.1.7:5174')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://192.168.1.7:5174');
  });

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

  it('returns generic 404 for order lookup without credentials', async () => {
    const res = await request(app).get('/api/orders/number/GSS-TEST-123');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Order not found or invalid credentials');
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

  it('requires admin auth for analytics dashboard', async () => {
    const res = await request(app).get('/api/admin/analytics?period=month');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('requires admin auth for analytics CSV export', async () => {
    const res = await request(app).get('/api/admin/analytics/export?period=month');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects CSRF on admin state-changing routes without token', async () => {
    const res = await request(app)
      .post('/api/admin/logout')
      .set('Cookie', 'admin_session=fake');

    expect([401, 403]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });
});
