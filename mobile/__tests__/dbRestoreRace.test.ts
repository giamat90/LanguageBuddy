/**
 * Restore on a fresh install reported "couldn't restore the backup" although the data was
 * restored: restoreBackup() closed the old connection in the background, the welcome screen
 * immediately opened a new one, and `PRAGMA journal_mode = WAL` on it was answered with
 * "database is locked" while the old connection was still closing (TASK-033).
 */
const mockState = {
  lockedPragmas: 0,
  closeDelayMs: 0,
  closed: [] as number[],
  opened: 0,
  pragmaCalls: 0,
  openError: null as Error | null,
};

jest.mock('expo-sqlite', () => {
  const actual = jest.requireActual('../__mocks__/expo-sqlite');
  return {
    ...actual,
    openDatabaseAsync: async (name: string, options: Record<string, unknown>) => {
      if (mockState.openError) {
        const e = mockState.openError;
        mockState.openError = null;
        throw e;
      }
      const real = await actual.openDatabaseAsync(name, options);
      const id = ++mockState.opened;
      return {
        execAsync: async (sql: string) => {
          if (/journal_mode/i.test(sql)) {
            mockState.pragmaCalls += 1;
            if (mockState.lockedPragmas > 0) {
              mockState.lockedPragmas -= 1;
              throw new Error(
                "Call to function 'NativeDatabase.execAsync' has been rejected.\n→ Caused by: database is locked",
              );
            }
          }
          return real.execAsync(sql);
        },
        runAsync: (...a: unknown[]) => real.runAsync(...a),
        getFirstAsync: (...a: unknown[]) => real.getFirstAsync(...a),
        getAllAsync: (...a: unknown[]) => real.getAllAsync(...a),
        withTransactionAsync: (fn: () => Promise<void>) => real.withTransactionAsync(fn),
        closeAsync: async () => {
          await new Promise((r) => setTimeout(r, mockState.closeDelayMs));
          mockState.closed.push(id);
        },
      };
    },
  };
});

import { getDb, resetDbHandle } from '../src/data/db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require('expo-sqlite');

beforeEach(async () => {
  sqlite.__reset();
  await resetDbHandle();
  Object.assign(mockState, { lockedPragmas: 0, closeDelayMs: 0, closed: [], opened: 0, pragmaCalls: 0, openError: null });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('opening while another connection is busy', () => {
  it('retries when the database is locked and then succeeds', async () => {
    mockState.lockedPragmas = 2;
    await expect(getDb()).resolves.toBeDefined();
    expect(mockState.pragmaCalls).toBe(3);
  });

  it('gives up with the original error when it stays locked', async () => {
    mockState.lockedPragmas = 99;
    await expect(getDb()).rejects.toThrow(/database is locked/);
    // and a failed open is not cached
    mockState.lockedPragmas = 0;
    await expect(getDb()).resolves.toBeDefined();
  });

  it('does not retry other errors', async () => {
    mockState.lockedPragmas = 0;
    await resetDbHandle();
    mockState.openError = new Error('disk I/O error');
    await expect(getDb()).rejects.toThrow('disk I/O error');
  });
});

describe('resetDbHandle', () => {
  it('resolves only after the old connection is closed', async () => {
    await getDb();
    mockState.closeDelayMs = 50;
    await resetDbHandle();
    expect(mockState.closed).toEqual([1]);
  });

  it('resolves even when nothing is open or the close fails', async () => {
    await expect(resetDbHandle()).resolves.toBeUndefined();
  });
});
