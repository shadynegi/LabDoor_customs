/** Admin analytics custom date range — IST (Asia/Kolkata) calendar dates. */

export const ANALYTICS_TIME_ZONE = 'Asia/Kolkata';
const MS_DAY = 24 * 60 * 60 * 1000;

export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'year' | 'all' | 'custom';

function istCalendarParts(date: Date): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ANALYTICS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function ymdFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function istYmd(date: Date): string {
  const { year, month, day } = istCalendarParts(date);
  return ymdFromParts(year, month, day);
}

export function defaultCustomFromYmd(): string {
  return istYmd(new Date(Date.now() - 30 * MS_DAY));
}

export function todayIstYmd(): string {
  return istYmd(new Date());
}

export function buildAnalyticsQueryParams(
  period: AnalyticsPeriod,
  customFrom: string,
  customTo: string,
): string {
  const params = new URLSearchParams({ period });
  if (period === 'custom') {
    params.set('from', `${customFrom}T00:00:00.000+05:30`);
    params.set('to', `${customTo}T23:59:59.999+05:30`);
  }
  return params.toString();
}

export function analyticsExportFilename(
  period: AnalyticsPeriod,
  customFrom: string,
  customTo: string,
): string {
  if (period === 'custom') return `product-sales-${customFrom}_${customTo}.csv`;
  return `product-sales-${period}.csv`;
}

export function isCustomAnalyticsRangeApplied(
  draftFrom: string,
  draftTo: string,
  appliedFrom: string | null,
  appliedTo: string | null,
): boolean {
  return (
    appliedFrom !== null &&
    appliedTo !== null &&
    draftFrom === appliedFrom &&
    draftTo === appliedTo
  );
}
