import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../../../backend/src/server';
import { sqlMock } from '../../../setup';
import { adminSessionCookie, createTestAdminToken } from '../../../shared/helpers/adminAuth';
import { createCsrfAgent, withCsrf } from '../../../shared/helpers/http';
import { clearSessionVerifyCacheForTests } from '../../../../backend/src/routes/admin';

function countAdminSessionLookups(): number {
  return sqlMock.mock.calls.filter((call) => {
    const q = (call[0] as TemplateStringsArray).join(' ');
    return q.includes('admin_sessions') && q.includes('SELECT');
  }).length;
}

function mockValidAdminSession(username = 'admin') {
  sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
    const q = strings.join(' ');
    if (q.includes('admin_sessions') && q.includes('SELECT')) {
      return [{ username }];
    }
    if (q.includes('DELETE FROM admin_sessions')) {
      return [{ id: 1 }];
    }
    return [];
  });
}

describe('GET /api/admin/verify session cache', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    clearSessionVerifyCacheForTests();
    mockValidAdminSession();
  });

  afterEach(() => {
    clearSessionVerifyCacheForTests();
    vi.useRealTimers();
  });

  it('reuses in-memory cache for repeated verify probes within 10 seconds', async () => {
    const token = createTestAdminToken();
    const cookie = adminSessionCookie(token);

    const first = await request(app).get('/api/admin/verify').set('Cookie', cookie);
    expect(first.status).toBe(200);
    expect(first.body.authenticated).toBe(true);
    expect(countAdminSessionLookups()).toBe(1);

    const second = await request(app).get('/api/admin/verify').set('Cookie', cookie);
    expect(second.status).toBe(200);
    expect(second.body.authenticated).toBe(true);
    expect(countAdminSessionLookups()).toBe(1);
  });

  it('re-queries admin_sessions after cache TTL expires', async () => {
    vi.useFakeTimers();
    const token = createTestAdminToken();
    const cookie = adminSessionCookie(token);

    await request(app).get('/api/admin/verify').set('Cookie', cookie);
    expect(countAdminSessionLookups()).toBe(1);

    vi.advanceTimersByTime(10_001);

    await request(app).get('/api/admin/verify').set('Cookie', cookie);
    expect(countAdminSessionLookups()).toBe(2);
  });

  it('invalidates cache on logout so the next verify hits the database', async () => {
    const token = createTestAdminToken();
    const cookie = adminSessionCookie(token);

    await request(app).get('/api/admin/verify').set('Cookie', cookie);
    expect(countAdminSessionLookups()).toBe(1);

    const { agent, csrfToken } = await createCsrfAgent();
    const logout = await withCsrf(agent.post('/api/admin/logout').set('Cookie', cookie), csrfToken);
    expect(logout.status).toBe(200);

    sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
      const q = strings.join(' ');
      if (q.includes('admin_sessions') && q.includes('SELECT')) {
        return [];
      }
      if (q.includes('DELETE FROM admin_sessions')) {
        return [{ id: 1 }];
      }
      return [];
    });

    const afterLogout = await request(app).get('/api/admin/verify').set('Cookie', cookie);
    expect(afterLogout.status).toBe(200);
    expect(afterLogout.body.authenticated).toBe(false);
    expect(countAdminSessionLookups()).toBe(2);
  });

  it('caches verifyAdmin-protected routes under concurrent requests', async () => {
    const token = createTestAdminToken();
    const cookie = adminSessionCookie(token);

    sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
      const q = strings.join(' ');
      if (q.includes('admin_sessions') && q.includes('SELECT')) {
        return [{ username: 'admin' }];
      }
      if (q.includes('total_products')) {
        return [
          {
            total_products: 1,
            out_of_stock_products: 0,
            low_stock_products: 0,
            total_views: 0,
            total_cart_adds: 0,
          },
        ];
      }
      if (q.includes('order_line_items') && q.includes('COUNT')) {
        return [{ c: 0 }];
      }
      if (q.includes('SELECT COUNT(*)::int AS c') && q.includes('is_out_of_stock = FALSE') && q.includes('stock <=')) {
        return [{ c: 0 }];
      }
      if (q.includes('FROM products') && q.includes('is_out_of_stock = FALSE') && q.includes('stock <=')) {
        return [];
      }
      if (q.includes('FROM orders') && q.includes('payment_status')) {
        return [];
      }
      return [
        {
          total_orders: 0,
          total_revenue: 0,
          orders_last_30_days: 0,
          revenue_last_30_days: 0,
          total_customers: 0,
          new_customers_30_days: 0,
          view_count: 0,
          cart_count: 0,
          name: 'Test',
          id: 1,
          country: 'US',
          order_count: 0,
          order_number: 'GSS-1',
          customer_name: 'Test',
          customer_email: 'test@example.com',
          total: 0,
          status: 'pending',
          payment_status: 'pending',
          created_at: '2026-01-01T00:00:00.000Z',
          date: '2026-01-01',
          orders: 0,
          revenue: 0,
          new: 0,
          read: 0,
          replied: 0,
          archived: 0,
        },
      ];
    });

    const [first, second] = await Promise.all([
      request(app).get('/api/admin/analytics').set('Cookie', cookie),
      request(app).get('/api/admin/analytics').set('Cookie', cookie),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(countAdminSessionLookups()).toBe(1);
  });
});
