import { describe, it, expect } from 'vitest';
import {
  istYmd,
  startOfIstDayFromYmd,
  endOfIstDayFromYmd,
  startOfIstMonth,
} from '../../../../backend/src/lib/analyticsIst';

describe('analyticsIst', () => {
  it('istYmd formats calendar date in IST', () => {
    // 2026-01-01 00:30 UTC = 2026-01-01 06:00 IST
    expect(istYmd(new Date('2026-01-01T00:30:00.000Z'))).toBe('2026-01-01');
    // 2025-12-31 20:00 UTC = 2026-01-01 01:30 IST
    expect(istYmd(new Date('2025-12-31T20:00:00.000Z'))).toBe('2026-01-01');
  });

  it('startOfIstDayFromYmd and endOfIstDayFromYmd use +05:30 offset', () => {
    const start = startOfIstDayFromYmd('2026-06-10');
    const end = endOfIstDayFromYmd('2026-06-10');
    expect(start.toISOString()).toBe('2026-06-09T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-06-10T18:29:59.999Z');
  });

  it('startOfIstMonth uses IST calendar month', () => {
    const instant = new Date('2026-03-15T10:00:00.000+05:30');
    expect(startOfIstMonth(instant).toISOString()).toBe('2026-02-28T18:30:00.000Z');
  });
});
