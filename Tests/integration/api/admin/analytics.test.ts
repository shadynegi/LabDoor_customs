import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../../backend/src/server';
import { sqlMock } from '../../../setup';
import { clearCache } from '../../../../backend/src/lib/cache';
import { adminSessionCookie, createTestAdminToken } from '../../../shared/helpers/adminAuth';

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

function mockAdminAnalyticsDb() {
  sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
    const q = strings.join(' ');
    if (q.includes('admin_sessions')) {
      return [{ username: 'admin' }];
    }
    if (q.includes('order_line_items') && q.includes('COUNT')) {
      return [{ c: 0 }];
    }
    if (q.includes('SELECT COUNT(*)::int AS c') && q.includes('is_out_of_stock = FALSE') && q.includes('stock <=')) {
      return [{ c: 0 }];
    }
    if (q.includes('total_products')) {
      return [
        {
          total_products: 10,
          out_of_stock_products: 1,
          low_stock_products: 0,
          total_views: 100,
          total_cart_adds: 20,
        },
      ];
    }
    if (q.includes('FROM products') && q.includes('is_out_of_stock = FALSE') && q.includes('stock <=')) {
      return [];
    }
    if (q.includes('FROM orders') && q.includes('payment_status') && q.includes('created_at')) {
      return [];
    }
    return [analyticsRow];
  });
}

describe('GET /api/admin/analytics', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    clearCache();
    mockAdminAnalyticsDb();
  });

  it('returns 401 without admin session', async () => {
    const res = await request(app).get('/api/admin/analytics');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
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

  it('returns sales analytics for period=month with line items present', async () => {
    sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
      const q = strings.join(' ');
      if (q.includes('admin_sessions')) {
        return [{ username: 'admin' }];
      }
      if (q.includes('order_line_items') && q.includes('COUNT(*)::int AS c')) {
        return [{ c: 3 }];
      }
      if (q.includes('total_units_sold') && q.includes('estimated_gross_profit')) {
        return [{ total_units_sold: 2, total_revenue: 100, order_count: 1, estimated_gross_profit: 20 }];
      }
      if (q.includes('GROUP BY li.product_id')) {
        return [
          {
            product_id: 1,
            product_name: 'Widget',
            units_sold: 2,
            revenue: 100,
            estimated_profit: 20,
          },
        ];
      }
      if (q.includes('GROUP BY 1') && q.includes('period_start')) {
        return [
          {
            period_start: '2026-07-01T00:00:00.000Z',
            orders: 1,
            revenue: 100,
            units_sold: 2,
          },
          {
            period_start: null,
            orders: 0,
            revenue: 0,
            units_sold: 0,
          },
        ];
      }
      if (q.includes('SELECT COUNT(*)::int AS c') && q.includes('is_out_of_stock = FALSE') && q.includes('stock <=')) {
        return [{ c: 0 }];
      }
      if (q.includes('FROM products') && q.includes('is_out_of_stock = FALSE') && q.includes('stock <=')) {
        return [];
      }
      return [analyticsRow];
    });

    const token = createTestAdminToken();
    const res = await request(app)
      .get('/api/admin/analytics?period=month')
      .set('Cookie', adminSessionCookie(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sales?.range?.period).toBe('month');
    expect(res.body.data.sales?.revenue_time_series).toHaveLength(1);
  });

  it('accepts custom IST date range query params', async () => {
    const token = createTestAdminToken();
    const res = await request(app)
      .get(
        '/api/admin/analytics?period=custom&from=2026-01-01T00:00:00.000%2B05:30&to=2026-01-31T23:59:59.999%2B05:30',
      )
      .set('Cookie', adminSessionCookie(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sales?.range?.period).toBe('custom');
    expect(res.body.data.sales?.range?.from).toContain('2025-12-31T18:30:00.000Z');
    expect(res.body.data.sales?.range?.to).toContain('2026-01-31T18:29:59.999Z');
  });

  it('falls back safely for unknown period value', async () => {
    const token = createTestAdminToken();
    const res = await request(app)
      .get('/api/admin/analytics?period=not-a-real-period')
      .set('Cookie', adminSessionCookie(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sales?.range?.period).toBe('not-a-real-period');
  });
});

describe('GET /api/admin/analytics/export', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    clearCache();
    mockAdminAnalyticsDb();
  });

  it('returns 401 without admin session', async () => {
    const res = await request(app).get('/api/admin/analytics/export?period=day');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns CSV attachment for authenticated admin', async () => {
    const token = createTestAdminToken();
    const res = await request(app)
      .get('/api/admin/analytics/export?period=day')
      .set('Cookie', adminSessionCookie(token));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/product-sales-day\.csv/);
    expect(res.text).toContain('product_name,units_sold,revenue');
  });

  it('uses IST dates in custom export filename', async () => {
    const token = createTestAdminToken();
    const res = await request(app)
      .get(
        '/api/admin/analytics/export?period=custom&from=2026-01-01T00:00:00.000%2B05:30&to=2026-01-31T23:59:59.999%2B05:30',
      )
      .set('Cookie', adminSessionCookie(token));

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(
      /product-sales-2026-01-01_2026-01-31\.csv/,
    );
  });
});
