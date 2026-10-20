/** Local calendar dates as YYYY-MM-DD. UTC noon math avoids DST shifts. */

export function todayISO(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

export function formatISODate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISODate(date);
}

export function addMonths(iso: string, months: number): string {
  const date = parseISODate(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return formatISODate(date);
}

export function diffDays(from: string, to: string): number {
  const start = parseISODate(from).getTime();
  const end = parseISODate(to).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: string): string {
  const start = parseISODate(startOfMonth(iso));
  start.setUTCMonth(start.getUTCMonth() + 1);
  start.setUTCDate(0);
  return formatISODate(start);
}

export type RangePreset =
  | '7d'
  | 'month'
  | 'last_month'
  | '3m'
  | '6m'
  | '12m'
  | 'last_year'
  | '3y'
  | '6y'
  | 'all'
  | 'custom';

export const RANGE_LABELS: Record<RangePreset, string> = {
  '7d': 'Last 7 days',
  month: 'This month',
  last_month: 'Last month',
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
  last_year: 'Last year',
  '3y': 'Last 3 years',
  '6y': 'Last 6 years',
  all: 'All time',
  custom: 'Custom range',
};

export function rangeFor(
  preset: RangePreset,
  today: string,
  custom?: { from?: string | null; to?: string | null },
): { from: string | null; to: string } {
  if (preset === 'custom') {
    return {
      from: custom?.from || null,
      to: custom?.to || today,
    };
  }
  if (preset === 'all') return { from: null, to: today };
  if (preset === 'month') return { from: startOfMonth(today), to: today };
  if (preset === 'last_month') {
    const previous = addMonths(startOfMonth(today), -1);
    return { from: previous, to: endOfMonth(previous) };
  }
  if (preset === 'last_year') {
    const year = Number(today.slice(0, 4)) - 1;
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  const days: Record<string, number> = {
    '7d': 6,
    '3m': 89,
    '6m': 182,
    '12m': 364,
    '3y': 365 * 3,
    '6y': 365 * 6,
  };
  const span = days[preset] ?? 0;
  return { from: addDays(today, -span), to: today };
}

export function inRange(iso: string, from: string | null, to: string | null): boolean {
  const day = iso.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function shiftDate(iso: string, anchor: string, today: string): string {
  return addDays(iso, diffDays(anchor, today));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function prettyDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return iso;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

export function relativeDay(iso: string, today: string): string {
  const days = diffDays(iso, today);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days === -1) return 'tomorrow';
  if (days > 1 && days < 30) return `${days} days ago`;
  if (days < -1 && days > -30) return `in ${-days} days`;
  return prettyDate(iso);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  if (!year || !month) return key;
  return `${MONTHS[month - 1]} ${year}`;
}
