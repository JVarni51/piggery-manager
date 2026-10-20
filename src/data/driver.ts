import type { SqlValue } from './ids';

/** Client-side SQL handle. expo-sqlite on device; sql.js if the web build cannot use SharedArrayBuffer. */
export interface HerdDb {
  kind: 'expo-sqlite' | 'sql.js';
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  flush(): Promise<void>;
}
