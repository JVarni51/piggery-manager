import initSqlJs, { type Database, type SqlValue as JsSqlValue } from 'sql.js';
import type { HerdDb } from './driver';
import type { SqlValue } from './ids';

type Persist = (bytes: Uint8Array) => Promise<void>;

function asParams(params: SqlValue[] | undefined): JsSqlValue[] | undefined {
  if (!params || params.length === 0) return undefined;
  return params.map((value) => (value === undefined ? null : value));
}

function wrap(database: Database, persist?: Persist): HerdDb {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();

  const schedule = () => {
    if (!persist) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const bytes = database.export();
      chain = persist(bytes).catch((error) => {
        console.warn('Could not save the herd book', error);
      });
    }, 40);
  };

  return {
    kind: 'sql.js',
    async exec(sql: string) {
      database.exec(sql);
      schedule();
    },
    async run(sql: string, params?: SqlValue[]) {
      database.run(sql, asParams(params));
      schedule();
    },
    async all<T>(sql: string, params?: SqlValue[]) {
      const statement = database.prepare(sql);
      try {
        const bound = asParams(params);
        if (bound) statement.bind(bound);
        const rows: T[] = [];
        while (statement.step()) rows.push(statement.getAsObject() as T);
        return rows;
      } finally {
        statement.free();
      }
    },
    async get<T>(sql: string, params?: SqlValue[]) {
      const statement = database.prepare(sql);
      try {
        const bound = asParams(params);
        if (bound) statement.bind(bound);
        if (!statement.step()) return null;
        return statement.getAsObject() as T;
      } finally {
        statement.free();
      }
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
        if (persist) await persist(database.export());
      }
      await chain;
    },
  };
}

export async function openMemoryDatabase(): Promise<HerdDb> {
  const SQL = await initSqlJs();
  return wrap(new SQL.Database());
}

async function loadBytes(): Promise<Uint8Array | null> {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('herdkeep', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('files')) request.result.createObjectStore('files');
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('files', 'readonly');
      const get = transaction.objectStore('files').get('db');
      get.onsuccess = () => {
        const value = get.result as ArrayBuffer | Uint8Array | undefined;
        database.close();
        if (!value) resolve(null);
        else resolve(value instanceof Uint8Array ? value : new Uint8Array(value));
      };
      get.onerror = () => {
        database.close();
        reject(get.error);
      };
    };
  });
}

async function saveBytes(bytes: Uint8Array): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('herdkeep', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('files')) request.result.createObjectStore('files');
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('files', 'readwrite');
      transaction.objectStore('files').put(bytes, 'db');
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
    };
  });
}

export async function openBrowserSql(): Promise<HerdDb> {
  const SQL = await initSqlJs({ locateFile: (file: string) => `/${file}` });
  let saved: Uint8Array | null = null;
  try {
    saved = await loadBytes();
  } catch (error) {
    console.warn('Could not read the saved herd book', error);
  }
  const database = saved ? new SQL.Database(saved) : new SQL.Database();
  return wrap(database, saveBytes);
}
