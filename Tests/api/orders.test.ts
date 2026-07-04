import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import { createCsrfAgent, withCsrf } from '../helpers/http';

const validOrderPayload = {
  customer_email: 'buyer@example.com',
  customer_name: 'Test Buyer',
  shipping_address: {
    full_name: 'Test Buyer',
    email: 'buyer@example.com',
    phone: '555-0100',
    address: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zip_code: '78701',
    country: 'US',
  },
  items: [
    {
      product_id: 1,
      product_name: 'Test Shoe',
      quantity: 1,
      price: 99,
    },
  ],
  subtotal: 99,
  shipping_cost: 10,
  tax: 8,
  total: 117,
  payment_method: 'WhatsApp',
  payment_status: 'completed',
  status: 'shipped',
};

describe('POST /api/orders', () => {
  it('returns 410 — direct order creation deprecated (use checkout place-order)', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/orders'), csrfToken).send(validOrderPayload);

    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/deprecated/i);
    expect(res.body.message).toMatch(/checkout\/place-order/i);
  });
});
