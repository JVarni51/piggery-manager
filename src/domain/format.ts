export function money(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return '—';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}$${dollars.toLocaleString('en-US')}.${String(remainder).padStart(2, '0')}`;
}

export function pounds(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return '—';
  const rounded = Number(value.toFixed(digits));
  return `${rounded.toLocaleString('en-US')} lb`;
}

export function adgLabel(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(2)} lb/day`;
}

export function percent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function titleCase(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

export function centsFromDollars(value: string): number | null {
  const number = parseNumber(value);
  if (number == null) return null;
  return Math.round(number * 100);
}

export function dollarsInput(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}
