import type { SqlValue } from './ids';

export function rowToCamel<T>(row: Record<string, SqlValue>): T {
  const out: Record<string, SqlValue> = {};
  for (const [key, value] of Object.entries(row)) {
    const camel = key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    out[camel] = value === undefined ? null : value;
  }
  return out as T;
}
