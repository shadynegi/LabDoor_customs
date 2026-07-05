import { describe, it, expect } from 'vitest';
import { parseAnalyticsDateRange, salesAnalyticsToCsv } from '../../../../backend/src/lib/salesAnalytics';

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

  it('parseAnalyticsDateRange supports custom from/to in IST', () => {
    const range = parseAnalyticsDateRange({
      period: 'custom',
      from: '2026-01-01T00:00:00.000+05:30',
      to: '2026-01-31T23:59:59.999+05:30',
    });
    expect(range.period).toBe('custom');
    expect(range.from.toISOString()).toBe('2025-12-31T18:30:00.000Z');
    expect(range.to.toISOString()).toBe('2026-01-31T18:29:59.999Z');
  });

  it('parseAnalyticsDateRange falls back when custom dates are invalid', () => {
    const range = parseAnalyticsDateRange({
      period: 'custom',
      from: 'not-a-date',
      to: 'also-invalid',
    });
    expect(range.period).toBe('custom');
    expect(Number.isNaN(range.from.getTime())).toBe(false);
    expect(Number.isNaN(range.to.getTime())).toBe(false);
    expect(range.from.getTime()).toBeLessThanOrEqual(range.to.getTime());
  });

  it('parseAnalyticsDateRange does not throw for invalid month to param', () => {
    const range = parseAnalyticsDateRange({ period: 'month', to: 'not-a-date' });
    expect(range.period).toBe('month');
    expect(Number.isNaN(range.from.getTime())).toBe(false);
    expect(Number.isNaN(range.to.getTime())).toBe(false);
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
      revenue_time_series: [],
      best_period: null,
    });
    expect(csv).toContain('product_name,units_sold,revenue');
    expect(csv).toContain('Test Shoe');
  });
});
