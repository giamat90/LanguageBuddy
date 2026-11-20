/**
 * The native expo-sqlite handle can die while the JS runtime lives on (on a phone:
 * "Call to function 'NativeDatabase.prepareAsync' has been rejected. Caused by:
 * java.lang.NullPointerException"). Every query then failed until the process was
 * killed, and "Riprova" never helped because getDb() cached the dead handle.
 * These tests pin the self-healing behaviour of src/data/db.ts.
 */
interface FakeHandle {
  options: Record<string, unknown>;
  dead: boolean;
  failWith: Error | null;
  alwaysNpeOnRead: boolean;
  closeAsync: jest.Mock;
  execAsync: (...a: unknown[]) => Promise<unknown>;
  runAsync: (...a: unknown[]) => Promise<unknown>;
  getFirstAsync: (...a: unknown[]) => Promise<unknown>;
  getAllAsync: (...a: unknown[]) => Promise<unknown>;
  withTransactionAsync: (fn: () => Promise<void>) => Promise<void>;
}

const mockHandles: FakeHandle[] = [];
let mockOpenFailures = 0;
let mockNextAlwaysNpe = false;

const mockNpe = () => new Error(
  "Call to function 'NativeDatabase.prepareAsync' has been rejected.\n→ Caused by: java.lang.NullPointerException: java.lang.NullPointerException",
);

jest.mock('expo-sqlite', () => {
  const actual = jest.requireActual('../__mocks__/expo-sqlite');
  return {
    ...actual,
    openDatabaseAsync: async (name: string, options: Record<string, unknown>) => {
      if (mockOpenFailures > 0) { mockOpenFailures -= 1; throw new Error('open failed'); }
      const real = await actual.openDatabaseAsync(name, options);
      const guard = (method: string, isRead = false) => async (...a: unknown[]) => {
        if (h.dead) throw mockNpe();
        if (h.failWith) throw h.failWith;
        if (isRead && h.alwaysNpeOnRead) throw mockNpe();
        return real[method](...a);
      };
      const h: FakeHandle = {
        options, dead: false, failWith: null, alwaysNpeOnRead: mockNextAlwaysNpe,
        closeAsync: jest.fn(async () => {}),
        execAsync: guard('execAsync'),
        runAsync: guard('runAsync'),
        getFirstAsync: guard('getFirstAsync', true),
        getAllAsync: guard('getAllAsync', true),
        withTransactionAsync: async (fn) => { if (h.dead) throw mockNpe(); await fn(); },
      };
      mockHandles.push(h);
      return h;
    },
  };
});

import { getDb, getMeta, setMeta, resetDbHandle } from '../src/data/db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require('expo-sqlite');

const flush = () => new Promise((r) => setImmediate(r));

beforeEach(async () => {
  sqlite.__reset();
  resetDbHandle();
  await flush();
  mockHandles.length = 0;
  mockOpenFailures = 0;
  mockNextAlwaysNpe = false;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('opening', () => {
  it('does not cache a failed open: the next getDb() tries again', async () => {
    mockOpenFailures = 1;
    await expect(getDb()).rejects.toThrow('open failed');
    await expect(getDb()).resolves.toBeDefined();
    expect(mockHandles).toHaveLength(1);
  });

  it('opens its own connection, never the module-cached one that another JS wrapper can release', async () => {
    await getDb();
    expect(mockHandles[0].options).toMatchObject({ useNewConnection: true, enableChangeListener: true });
  });

  it('resetDbHandle closes the old connection and the next getDb() opens a fresh one', async () => {
    await getDb();
    resetDbHandle();
    await flush();
    expect(mockHandles[0].closeAsync).toHaveBeenCalledTimes(1);
    await getDb();
    expect(mockHandles).toHaveLength(2);
  });
});

describe('a dead native handle', () => {
  it('is replaced and the query succeeds (data lives in the file, so it is still there)', async () => {
    await setMeta('k', 'v');
    mockHandles[0].dead = true;
    expect(await getMeta('k')).toBe('v');
    expect(mockHandles).toHaveLength(2);
    expect(mockHandles[0].closeAsync).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it('keeps working for code that obtained db before the handle died, without reopening again', async () => {
    const db = await getDb();
    mockHandles[0].dead = true;
    await db.getAllAsync('SELECT key FROM schema_meta');
    await db.getAllAsync('SELECT key FROM schema_meta');
    expect(mockHandles).toHaveLength(2);
  });

  it('is recovered once when several queries fail at the same time', async () => {
    await setMeta('k', 'v');
    mockHandles[0].dead = true;
    const out = await Promise.all([getMeta('k'), getMeta('k'), getMeta('k')]);
    expect(out).toEqual(['v', 'v', 'v']);
    expect(mockHandles).toHaveLength(2);
  });

  it('does not retry ordinary SQL errors', async () => {
    await getDb();
    mockHandles[0].failWith = new Error('no such table: nope');
    await expect(getMeta('k')).rejects.toThrow('no such table');
    expect(mockHandles).toHaveLength(1);
  });

  it('retries only once: a failure that survives a fresh connection is reported, not looped', async () => {
    await getDb();
    mockNextAlwaysNpe = true; // the replacement handle also throws on reads
    mockHandles[0].dead = true;
    await expect(getMeta('k')).rejects.toThrow(/NullPointerException/);
    expect(mockHandles).toHaveLength(2);
  });
});

describe('transactions', () => {
  it('are re-run on a fresh connection when the handle was dead before they started', async () => {
    const db = await getDb();
    mockHandles[0].dead = true;
    let runs = 0;
    await db.withTransactionAsync(async () => {
      runs += 1;
      await db.runAsync("INSERT INTO schema_meta (key, value) VALUES ('t', '1')");
    });
    expect(runs).toBe(1);
    expect(await getMeta('t')).toBe('1');
  });

  it('are never continued on another connection when the handle dies half-way (atomicity)', async () => {
    const db = await getDb();
    let runs = 0;
    await expect(
      db.withTransactionAsync(async () => {
        runs += 1;
        await db.runAsync("INSERT INTO schema_meta (key, value) VALUES ('a', '1')");
        mockHandles[0].dead = true;
        await db.runAsync("INSERT INTO schema_meta (key, value) VALUES ('b', '2')");
      }),
    ).rejects.toThrow(/NullPointerException/);
    expect(runs).toBe(1);
    expect(mockHandles).toHaveLength(1); // no silent switch to a connection outside the transaction
  });
});
