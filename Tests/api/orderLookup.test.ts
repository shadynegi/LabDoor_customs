import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import { sqlMock } from '../setup';
import { createCsrfAgent, withCsrf } from '../helpers/http';

const ORDER_ID = '00000000-0000-4000-8000-000000000099';
const EMAIL = 'customer@example.com';

describe('POST /api/orders/lookup', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    sqlMock.mockResolvedValue([]);
  });

  it('returns 400 when orderId or email is missing', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/orders/lookup'), csrfToken).send({
      orderId: ORDER_ID,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/orderId and email are required/i);
  });

  it('returns 400 when email is missing', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/orders/lookup'), csrfToken).send({
      email: EMAIL,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/orderId and email are required/i);
  });

  it('returns uniform 404 for unknown order', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/orders/lookup'), csrfToken).send({
      orderId: ORDER_ID,
      email: EMAIL,
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Order not found or invalid credentials');
  });

  it('returns uniform 404 for wrong email on known order', async () => {
    sqlMock.mockResolvedValueOnce([]);

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/orders/lookup'), csrfToken).send({
      orderId: ORDER_ID,
      email: 'wrong@example.com',
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Order not found or invalid credentials');
  });

  it('returns order when orderId and email match', async () => {
    sqlMock.mockResolvedValueOnce([
      {
        id: ORDER_ID,
        order_number: 'GSS-TEST-1',
        customer_email: EMAIL,
        customer_name: 'Test User',
        items: '[]',
        shipping_address: '{}',
        subtotal: '10',
        shipping_cost: '0',
        tax: '0',
        total: '10',
        payment_status: 'completed',
        status: 'processing',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/orders/lookup'), csrfToken).send({
      orderId: ORDER_ID,
      email: EMAIL,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.order_number).toBe('GSS-TEST-1');
    expect(res.body.data.id).toBe(ORDER_ID);
    expect(res.body.data.access_token_hash).toBeUndefined();
  });
});
