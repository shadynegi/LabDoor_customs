/** Admin sales analytics — all calendar boundaries use India Standard Time (IST, Asia/Kolkata). */

export const ANALYTICS_TIME_ZONE = 'Asia/Kolkata';
const MS_DAY = 24 * 60 * 60 * 1000;

const IST_WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function isValidAnalyticsDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

function istCalendarParts(date: Date): { year: number; month: number; day: number } {
  if (!isValidAnalyticsDate(date)) {
    throw new RangeError('Invalid time value');
  }
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

/** Calendar date `YYYY-MM-DD` in IST for the given instant. */
export function istYmd(date: Date): string {
  const { year, month, day } = istCalendarParts(date);
  return ymdFromParts(year, month, day);
}

export function startOfIstDayFromYmd(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000+05:30`);
}

export function endOfIstDayFromYmd(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999+05:30`);
}

export function startOfIstDay(date: Date): Date {
  return startOfIstDayFromYmd(istYmd(date));
}

export function startOfIstWeek(date: Date): Date {
  const dayStart = startOfIstDay(date);
  const weekday = dayStart.toLocaleDateString('en-US', {
    timeZone: ANALYTICS_TIME_ZONE,
    weekday: 'short',
  });
  const dow = IST_WEEKDAY[weekday.slice(0, 3)] ?? 0;
  const diff = dow === 0 ? 6 : dow - 1;
  return new Date(dayStart.getTime() - diff * MS_DAY);
}

export function startOfIstMonth(date: Date): Date {
  const { year, month } = istCalendarParts(date);
  return startOfIstDayFromYmd(ymdFromParts(year, month, 1));
}

export function startOfIstYear(date: Date): Date {
  const { year } = istCalendarParts(date);
  return startOfIstDayFromYmd(`${year}-01-01`);
}
