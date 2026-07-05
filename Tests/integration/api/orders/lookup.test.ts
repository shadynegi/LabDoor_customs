import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../../backend/src/server';
import { sqlMock } from '../../../setup';
import { createCsrfAgent, withCsrf } from '../../../shared/helpers/http';
import { mockOrderRow } from '../../../shared/helpers/api/orders';

const ORDER_ID = '00000000-0000-4000-8000-000000000099';
const TRACKING_ORDER_ID = '00000000-0000-4000-8000-000000000088';
const EMAIL = 'customer@example.com';
const TRACKER_EMAIL = 'tracker@example.com';

describe('Order lookup and tracking API', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    sqlMock.mockResolvedValue([]);
  });

  describe('POST /api/orders/lookup', () => {
    it('returns 400 when orderId is missing', async () => {
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
      expect(res.body.error).toBe('Order not found');
    });

    it('returns uniform 404 for wrong email on known order', async () => {
      sqlMock.mockResolvedValueOnce([]);

      const { agent, csrfToken } = await createCsrfAgent();
      const res = await withCsrf(agent.post('/api/orders/lookup'), csrfToken).send({
        orderId: ORDER_ID,
        email: 'wrong@example.com',
      });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Order not found');
    });

    it('returns 404 for malformed orderId (not a UUID)', async () => {
      const { agent, csrfToken } = await createCsrfAgent();
      const res = await withCsrf(agent.post('/api/orders/lookup'), csrfToken).send({
        orderId: 'GSS-NOT-A-UUID',
        email: TRACKER_EMAIL,
      });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Order not found');
    });

    it('returns order when orderId and email match', async () => {
      sqlMock.mockResolvedValueOnce([
        mockOrderRow({
          id: ORDER_ID,
          customer_email: EMAIL,
        }),
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

    it('matches email case-insensitively', async () => {
      sqlMock.mockResolvedValueOnce([
        mockOrderRow({
          id: TRACKING_ORDER_ID,
          order_number: 'GSS-TRACK-1',
          customer_email: TRACKER_EMAIL,
          customer_name: 'Tracker User',
          status: 'shipped',
          tracking_number: 'TRACK123',
          tracking_url: 'https://track.example/123',
          subtotal: '50',
          total: '50',
        }),
      ]);

      const { agent, csrfToken } = await createCsrfAgent();
      const res = await withCsrf(agent.post('/api/orders/lookup'), csrfToken).send({
        orderId: TRACKING_ORDER_ID,
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
        mockOrderRow({
          id: TRACKING_ORDER_ID,
          order_number: 'GSS-SHIP-1',
          customer_email: TRACKER_EMAIL,
          customer_name: 'Shipped User',
          items: JSON.stringify([{ product_name: 'Shoe', quantity: 1, price: 80 }]),
          shipping_address: JSON.stringify({ phone: '9876543210', country: 'India' }),
          subtotal: '80',
          shipping_cost: '10',
          total: '90',
          status: 'shipped',
          tracking_number: '1Z999',
          tracking_url: 'https://carrier.example/track/1Z999',
          carrier: 'UPS',
        }),
      ]);

      const { agent, csrfToken } = await createCsrfAgent();
      const res = await withCsrf(agent.post('/api/orders/lookup'), csrfToken).send({
        orderId: TRACKING_ORDER_ID,
        email: TRACKER_EMAIL,
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
