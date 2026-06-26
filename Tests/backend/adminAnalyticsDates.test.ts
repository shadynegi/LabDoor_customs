import { describe, it, expect } from 'vitest';
import {
  ANALYTICS_TIME_ZONE,
  analyticsExportFilename,
  buildAnalyticsQueryParams,
  defaultCustomFromYmd,
  isCustomAnalyticsRangeApplied,
  istYmd,
  todayIstYmd,
} from '../../frontend/src/lib/adminAnalyticsDates';

describe('adminAnalyticsDates (frontend IST helpers)', () => {
  it('uses Asia/Kolkata timezone constant', () => {
    expect(ANALYTICS_TIME_ZONE).toBe('Asia/Kolkata');
  });

  it('istYmd formats midnight UTC as next IST calendar day when applicable', () => {
    expect(istYmd(new Date('2025-12-31T20:00:00.000Z'))).toBe('2026-01-01');
  });

  it('defaultCustomFromYmd and todayIstYmd return YYYY-MM-DD', () => {
    expect(defaultCustomFromYmd()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(todayIstYmd()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(defaultCustomFromYmd() <= todayIstYmd()).toBe(true);
  });

  it('buildAnalyticsQueryParams encodes IST offsets for custom period', () => {
    const qs = buildAnalyticsQueryParams('custom', '2026-01-01', '2026-01-31');
    expect(qs).toContain('period=custom');
    expect(qs).toContain('from=2026-01-01T00%3A00%3A00.000%2B05%3A30');
    expect(qs).toContain('to=2026-01-31T23%3A59%3A59.999%2B05%3A30');
  });

  it('buildAnalyticsQueryParams omits from/to for preset periods', () => {
    const qs = buildAnalyticsQueryParams('month', '2026-01-01', '2026-01-31');
    expect(qs).toBe('period=month');
  });

  it('isCustomAnalyticsRangeApplied requires matching applied range', () => {
    expect(isCustomAnalyticsRangeApplied('2026-01-01', '2026-01-31', null, null)).toBe(false);
    expect(isCustomAnalyticsRangeApplied('2026-01-01', '2026-01-31', '2026-01-01', '2026-01-30')).toBe(
      false,
    );
    expect(isCustomAnalyticsRangeApplied('2026-01-01', '2026-01-31', '2026-01-01', '2026-01-31')).toBe(
      true,
    );
  });

  it('analyticsExportFilename names custom and preset exports', () => {
    expect(analyticsExportFilename('month', '', '')).toBe('product-sales-month.csv');
    expect(analyticsExportFilename('custom', '2026-01-01', '2026-01-31')).toBe(
      'product-sales-2026-01-01_2026-01-31.csv',
    );
  });
});
