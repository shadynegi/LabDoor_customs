import { describe, it, expect } from 'vitest';
import { parseAnalyticsDateRange, salesAnalyticsToCsv } from '../../backend/src/lib/salesAnalytics';

describe('salesAnalytics', () => {
  it('parseAnalyticsDateRange defaults to month', () => {
    const range = parseAnalyticsDateRange({});
    expect(range.period).toBe('month');
    expect(range.from.getTime()).toBeLessThanOrEqual(range.to.getTime());
  });

  it('parseAnalyticsDateRange supports week period', () => {
    const range = parseAnalyticsDateRange({ period: 'week' });
    expect(range.period).toBe('week');
    expect(range.bucket).toBe('day');
  });

  it('salesAnalyticsToCsv formats product rows', () => {
    const csv = salesAnalyticsToCsv({
      range: { period: 'month', from: '', to: '', bucket: 'day' },
      summary: {
        total_units_sold: 5,
        total_revenue: 250,
        order_count: 2,
        average_order_value: 125,
        estimated_gross_profit: null,
      },
      compare: {
        total_revenue: 100,
        order_count: 1,
        total_units_sold: 2,
        revenue_change_pct: 150,
      },
      revenue_by_product: [
        {
          product_id: 1,
          product_name: 'Test Shoe',
          units_sold: 5,
          revenue: 250,
          revenue_share_pct: 100,
          estimated_profit: null,
        },
      ],
      top_sellers_by_units: [],
      top_sellers_by_revenue: [],
      category_breakdown: [],
      revenue_time_series: [],
      best_period: null,
    });
    expect(csv).toContain('product_name,units_sold,revenue');
    expect(csv).toContain('Test Shoe');
  });
});
