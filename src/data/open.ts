import { Platform } from 'react-native';
import type { HerdDb } from './driver';
import type { SqlValue } from './ids';

async function openExpo(): Promise<HerdDb> {
  const SQLite = await import('expo-sqlite');
  const database = await SQLite.openDatabaseAsync('herdkeep.db');
  return {
    kind: 'expo-sqlite',
    exec: (sql) => database.execAsync(sql),
    run: async (sql, params: SqlValue[] = []) => {
      await database.runAsync(sql, params);
    },
    all: async <T,>(sql: string, params: SqlValue[] = []) => database.getAllAsync<T>(sql, params),
    get: async <T,>(sql: string, params: SqlValue[] = []) => {
      const row = await database.getFirstAsync<T>(sql, params);
      return row ?? null;
    },
    flush: async () => undefined,
  };
}

export async function openHerdDatabase(): Promise<HerdDb> {
  // Web uses sql.js. expo-sqlite's wa-sqlite asset is not served as wasm by the
  // dev server, and a failed instantiate takes down the page. Native keeps expo-sqlite.
  if (Platform.OS === 'web') {
    const web = await import('./sqljs');
    return web.openBrowserSql();
  }
  return openExpo();
}
