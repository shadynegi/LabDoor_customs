import { describe, it, expect, beforeEach } from 'vitest';
import { sqlMock } from '../../../setup';
import { clearCache } from '../../../../backend/src/lib/cache';
import { getAdminAnalytics } from '../../../../backend/src/lib/adminAnalytics';

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

describe('getAdminAnalytics cache', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    clearCache();
    sqlMock.mockResolvedValue([analyticsRow]);
  });

  it('reuses cached payload without additional database queries', async () => {
    const first = await getAdminAnalytics();
    expect(first.orders.total_orders).toBe(12);
    const callsAfterFirst = sqlMock.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    const second = await getAdminAnalytics();
    expect(second.orders.total_orders).toBe(12);
    expect(sqlMock.mock.calls.length).toBe(callsAfterFirst);
  });
});
