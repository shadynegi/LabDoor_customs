import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import { sqlMock } from '../setup';
import { createCsrfAgent, withCsrf } from '../helpers/http';

const ORDER_ID = '00000000-0000-4000-8000-000000000088';
const EMAIL = 'tracker@example.com';

describe('Order tracking API', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    sqlMock.mockResolvedValue([]);
  });

  describe('POST /api/orders/lookup', () => {
    it('returns 404 for malformed orderId (not a UUID)', async () => {
      const { agent, csrfToken } = await createCsrfAgent();
      const res = await withCsrf(agent.post('/api/orders/lookup'), csrfToken).send({
        orderId: 'GSS-NOT-A-UUID',
        email: EMAIL,
      });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Order not found');
    });

    it('matches email case-insensitively', async () => {
      sqlMock.mockResolvedValueOnce([
        {
          id: ORDER_ID,
          order_number: 'GSS-TRACK-1',
          customer_email: EMAIL,
          customer_name: 'Tracker User',
          items: '[]',
          shipping_address: '{}',
          subtotal: '50',
          shipping_cost: '0',
          tax: '0',
          total: '50',
          payment_status: 'completed',
          status: 'shipped',
          tracking_number: 'TRACK123',
          tracking_url: 'https://track.example/123',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      const { agent, csrfToken } = await createCsrfAgent();
      const res = await withCsrf(agent.post('/api/orders/lookup'), csrfToken).send({
        orderId: ORDER_ID,
        email: '  TRACKER@EXAMPLE.COM  ',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.order_number).toBe('GSS-TRACK-1');
      expect(res.body.data.tracking_number).toBe('TRACK123');
      expect(res.body.data.access_token_hash).toBeUndefined();
      expect(res.body.data.access_token_encrypted).toBeUndefined();
    });

    it('returns shipped order with tracking fields for customer tracking', async () => {
      sqlMock.mockResolvedValueOnce([
        {
          id: ORDER_ID,
          order_number: 'GSS-SHIP-1',
          customer_email: EMAIL,
          customer_name: 'Shipped User',
          items: JSON.stringify([{ product_name: 'Shoe', quantity: 1, price: 80 }]),
          shipping_address: JSON.stringify({ phone: '9876543210', country: 'India' }),
          subtotal: '80',
          shipping_cost: '10',
          tax: '0',
          total: '90',
          payment_status: 'completed',
          status: 'shipped',
          tracking_number: '1Z999',
          tracking_url: 'https://carrier.example/track/1Z999',
          carrier: 'UPS',
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
      expect(res.body.data.status).toBe('shipped');
      expect(res.body.data.tracking_url).toBe('https://carrier.example/track/1Z999');
      expect(res.body.data.carrier).toBe('UPS');
    });
  });

  describe('GET /api/orders/access-exchange/:code', () => {
    it('returns 410 for deprecated email tracking links', async () => {
      const res = await request(app).get('/api/orders/access-exchange/legacy-code-abc');

      expect(res.status).toBe(410);
      expect(res.body.error).toMatch(/deprecated/i);
      expect(res.body.message).toMatch(/order ID and checkout email/i);
    });
  });

  describe('GET /api/orders/:id', () => {
    it('requires admin auth for direct order lookup by UUID', async () => {
      const res = await request(app).get(`/api/orders/${ORDER_ID}`);

      expect(res.status).toBe(401);
    });
  });
});
