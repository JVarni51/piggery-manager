import type { HerdDb } from './driver';

export async function openBrowserSql(): Promise<HerdDb> {
  throw new Error('The sql.js fallback is only used on web.');
}
