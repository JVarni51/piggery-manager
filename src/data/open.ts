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
  if (Platform.OS !== 'web') return openExpo();
  const isolated = typeof crossOriginIsolated === 'boolean' && crossOriginIsolated;
  if (isolated) {
    try {
      const database = await openExpo();
      await database.get('SELECT 1 as ok');
      return database;
    } catch (error) {
      console.warn('expo-sqlite is unavailable in this browser. Using the sql.js fallback.', error);
    }
  }
  const web = await import('./sqljs');
  return web.openBrowserSql();
}
