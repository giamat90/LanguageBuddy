/** The backup tag and the database file come from the language pack (TASK-042). */
const files: Record<string, string> = {};
const mockOpened: string[] = [];

jest.mock('expo-sqlite', () => {
  const real = jest.requireActual('../__mocks__/expo-sqlite.js');
  return { ...real, openDatabaseAsync: async (n: string, o: unknown) => { mockOpened.push(n); return real.openDatabaseAsync(n, o); } };
});

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn(async (uri: string, c: string) => { files[uri] = c; }),
  readAsStringAsync: jest.fn(async (uri: string) => { if (!(uri in files)) throw new Error('nf'); return files[uri]; }),
}));
const pickedUri = 'file:///cache/picked.json';
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: pickedUri, name: 'b.json' }] })),
}));

import { getDb, resetDbHandle } from '../src/data/db';
import { buildBackup, pickBackup } from '../src/data/backup';
import { setActivePackForTests } from '../src/languages';
import { testPack } from '../test-support/testPack';

const sqlite = require('expo-sqlite');
const { MMKV } = require('react-native-mmkv');

beforeEach(() => {
  sqlite.__reset();
  resetDbHandle();
  new MMKV().clearAll();
  for (const k of Object.keys(files)) delete files[k];
  mockOpened.length = 0;
});
afterEach(() => { setActivePackForTests(null); });

describe('German identity is unchanged', () => {
  it('writes app GermanBuddy and opens germanbuddy.db', async () => {
    await getDb();
    expect(mockOpened).toEqual(['germanbuddy.db']);
    expect((await buildBackup()).app).toBe('GermanBuddy');
  });

  it('refuses a backup of another app', async () => {
    files[pickedUri] = JSON.stringify({ ...(await buildBackup()), app: 'OtherBuddy' });
    await expect(pickBackup()).rejects.toThrow();
  });
});

describe('another language pack', () => {
  it('uses its own tag and database file, and refuses a GermanBuddy backup', async () => {
    const german = await buildBackup();
    resetDbHandle();
    sqlite.__reset();
    setActivePackForTests(testPack);
    mockOpened.length = 0;
    await getDb();
    expect(mockOpened).toEqual(['spanishbuddy.db']);
    expect((await buildBackup()).app).toBe('SpanishBuddy');
    files[pickedUri] = JSON.stringify(german);
    await expect(pickBackup()).rejects.toThrow();
    files[pickedUri] = JSON.stringify(await buildBackup());
    expect((await pickBackup())!.compatible).toBe(true);
  });
});
