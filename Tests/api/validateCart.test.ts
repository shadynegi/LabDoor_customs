import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import { sqlMock } from '../setup';
import { createCsrfAgent, withCsrf } from '../helpers/http';

describe('POST /api/products/validate-cart', () => {
  beforeEach(() => {
    sqlMock.mockReset();
  });

  it('rejects empty cart payload', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/products/validate-cart'), csrfToken).send({
      items: [],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects missing product id', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/products/validate-cart'), csrfToken).send({
      items: [{ quantity: 1 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects out-of-stock product', async () => {
    sqlMock.mockResolvedValueOnce([
      {
        id: 1,
        name: 'Sold Out Shoe',
        price: 98,
        image: '/assets/test.png',
        stock: 0,
        is_out_of_stock: true,
      },
    ]);

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/products/validate-cart'), csrfToken).send({
      items: [{ product_id: 1, quantity: 1 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(String(res.body.message || res.body.error)).toMatch(/out of stock|unavailable/i);
  });

  it('returns refreshed prices for valid cart', async () => {
    sqlMock.mockResolvedValueOnce([
      {
        id: 1,
        name: 'Test Shoe',
        price: 98,
        image: '/assets/test.png',
        stock: 10,
        is_out_of_stock: false,
      },
    ]);

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/products/validate-cart'), csrfToken).send({
      items: [{ product_id: 1, quantity: 2 }],
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].price).toBe(98);
    expect(res.body.subtotal).toBe(196);
  });
});
