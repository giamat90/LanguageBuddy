import * as SQLite from 'expo-sqlite';
import { runMigrations } from './schema';

type NativeDb = SQLite.SQLiteDatabase;

/** The part of the database API the app uses. Everything goes through `getDb()`. */
export type AppDb = Pick<
  NativeDb,
  'execAsync' | 'runAsync' | 'getFirstAsync' | 'getAllAsync' | 'withTransactionAsync'
>;

/*
 * Why this file is more than "open once and cache":
 *
 * expo-sqlite's native database is a shared object. If a second JS wrapper is created for the
 * same open database (the old behaviour after a restore, which re-opened the file in the same
 * process) and the first wrapper is garbage-collected, the native side releases the SHARED
 * handle. From then on every call on the survivor fails with
 *   "Call to function 'NativeDatabase.prepareAsync' has been rejected.
 *    Caused by: java.lang.NullPointerException"
 * and, because the dead handle was cached, "Retry" could not help until the process was killed.
 *
 * So: (1) every open asks for its own connection, which never shares a native object;
 * (2) a failed open is never cached; (3) if a handle still dies, it is replaced once and the
 * operation is retried (never in the middle of a transaction, which must stay atomic).
 */

let rawPromise: Promise<NativeDb> | null = null;
/** The open handle once `rawPromise` has settled; lets `recover` compare handles synchronously. */
let rawDb: NativeDb | null = null;
let transactionDepth = 0;

async function closeQuietly(db: NativeDb): Promise<void> {
  try {
    await db.closeAsync();
  } catch {
    // Already closed or already dead: nothing left to release.
  }
}

/** True while another connection (typically one that is still closing) holds the file. */
export function isLockedError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return /database is locked|SQLITE_BUSY/i.test(message);
}

const LOCK_RETRIES = 5;
const LOCK_RETRY_MS = 150;

/** Runs `fn`, retrying a few times with a growing pause while the database reports "locked".
 *  After a restore the previous connection is still checkpointing its WAL when the new one opens. */
async function whileLocked<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isLockedError(e) || attempt > LOCK_RETRIES) throw e;
      await new Promise((r) => setTimeout(r, LOCK_RETRY_MS * attempt));
    }
  }
}

async function openRaw(): Promise<NativeDb> {
  // enableChangeListener lets the automatic backup (lib/autoBackup) hear about every write.
  const db = await SQLite.openDatabaseAsync('germanbuddy.db', {
    enableChangeListener: true,
    useNewConnection: true,
  });
  try {
    await whileLocked(() => db.execAsync('PRAGMA journal_mode = WAL;'));
    await whileLocked(() => runMigrations(db));
  } catch (e) {
    await closeQuietly(db);
    throw e;
  }
  return db;
}

function currentRaw(): Promise<NativeDb> {
  if (!rawPromise) {
    const p: Promise<NativeDb> = openRaw().then((db) => {
      // A reset while this open was in flight must not leave a stale handle behind.
      if (rawPromise === p) rawDb = db;
      return db;
    });
    rawPromise = p;
    // Never keep a failed open: the next caller must try again.
    p.catch(() => {
      if (rawPromise === p) rawPromise = null;
    });
  }
  return rawPromise;
}

/** True for the errors a released/closed native handle produces (and nothing else). */
export function isDeadHandleError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return /NullPointerException/i.test(message) || /access to closed resource/i.test(message);
}

/** Replaces `dead` with a fresh connection, unless somebody already did. */
function recover(dead: NativeDb): Promise<NativeDb> {
  if (rawDb !== dead) return currentRaw(); // already replaced (or reset): use the newer one
  rawDb = null;
  rawPromise = null;
  const fresh = currentRaw();
  void closeQuietly(dead);
  return fresh;
}

async function guarded<T>(
  op: (db: NativeDb) => Promise<T>,
  canRetry: () => boolean = () => transactionDepth === 0,
): Promise<T> {
  const db = await currentRaw();
  try {
    return await op(db);
  } catch (e) {
    if (!isDeadHandleError(e) || !canRetry()) throw e;
    console.error('[db] native handle lost, reopening:', e);
    return op(await recover(db));
  }
}

const facade: AppDb = {
  execAsync: (sql) => guarded((db) => db.execAsync(sql)),
  runAsync: ((sql: string, ...params: unknown[]) =>
    guarded((db) => (db.runAsync as (...a: unknown[]) => Promise<unknown>)(sql, ...params))) as AppDb['runAsync'],
  getFirstAsync: ((sql: string, ...params: unknown[]) =>
    guarded((db) => (db.getFirstAsync as (...a: unknown[]) => Promise<unknown>)(sql, ...params))) as AppDb['getFirstAsync'],
  getAllAsync: ((sql: string, ...params: unknown[]) =>
    guarded((db) => (db.getAllAsync as (...a: unknown[]) => Promise<unknown>)(sql, ...params))) as AppDb['getAllAsync'],
  withTransactionAsync: (task) => {
    let started = false;
    return guarded(
      (db) =>
        db.withTransactionAsync(async () => {
          started = true;
          transactionDepth += 1;
          try {
            await task();
          } finally {
            transactionDepth -= 1;
          }
        }),
      // Only a handle that was already dead when the transaction began may be replaced;
      // once the task ran, a retry would repeat (or split) its writes.
      () => !started,
    );
  },
};

/** The app's database. The returned object stays valid across handle replacements. */
export function getDb(): Promise<AppDb> {
  return currentRaw().then(() => facade);
}

/** Closes the current connection; the next getDb() re-opens and re-migrates. Used after a
 *  data restore (which awaits it) and by tests. */
export function resetDbHandle(): Promise<void> {
  const old = rawPromise;
  rawPromise = null;
  rawDb = null;
  // Resolves once the old connection is closed, so the next open does not race its checkpoint.
  return old ? old.then(closeQuietly, () => {}) : Promise.resolve();
}

/** @deprecated use resetDbHandle */
export const _resetDbForTests = resetDbHandle;

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM schema_meta WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO schema_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}
