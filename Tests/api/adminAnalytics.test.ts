import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import { sqlMock } from '../setup';
import { clearCache } from '../../backend/src/lib/cache';
import { adminSessionCookie, createTestAdminToken } from '../helpers/adminAuth';

const analyticsRow = {
  total_orders: 12,
  total_revenue: 500,
  orders_last_30_days: 3,
  revenue_last_30_days: 100,
  total_customers: 5,
  new_customers_30_days: 1,
  total_products: 10,
  out_of_stock_products: 1,
  total_views: 100,
  total_cart_adds: 20,
  view_count: 5,
  cart_count: 2,
  name: 'Test Product',
  id: 1,
  country: 'US',
  order_count: 1,
  order_number: 'GSS-1',
  customer_name: 'Test User',
  customer_email: 'test@example.com',
  total: 50,
  status: 'processing',
  payment_status: 'completed',
  created_at: '2026-01-01T00:00:00.000Z',
  date: '2026-01-01',
  orders: 1,
  revenue: 50,
  new: 1,
  read: 0,
  replied: 0,
  archived: 0,
};

describe('GET /api/admin/analytics', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    clearCache();
    sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
      const q = strings.join(' ');
      if (q.includes('admin_sessions')) {
        return [{ username: 'admin' }];
      }
      return [analyticsRow];
    });
  });

  it('returns dashboard analytics payload for authenticated admin', async () => {
    const token = createTestAdminToken();
    const res = await request(app)
      .get('/api/admin/analytics')
      .set('Cookie', adminSessionCookie(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orders.total_orders).toBe(12);
    expect(res.body.data.products.total_products).toBe(10);
  });
});
