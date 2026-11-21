/** Backup problems are codes; the UI turns them into translated text (TASK-043). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const files: Record<string, string> = {};
let mockPicked = 'file:///cache/mockPicked.json';
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn(async (uri: string, c: string) => { files[uri] = c; }),
  readAsStringAsync: jest.fn(async (uri: string) => { if (!(uri in files)) throw new Error('nf'); return files[uri]; }),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: mockPicked, name: 'b.json' }] })),
}));

import * as Sharing from 'expo-sharing';
import { resetDbHandle } from '../src/data/db';
import { buildBackup, exportBackup, pickBackup, restoreBackup, BackupError, backupErrorText } from '../src/data/backup';
import { setAppLocale } from '../src/i18n';
import { setActivePackForTests } from '../src/languages';
import { testPack } from '../test-support/testPack';

const sqlite = require('expo-sqlite');
const { MMKV } = require('react-native-mmkv');

beforeEach(() => {
  sqlite.__reset(); resetDbHandle(); new MMKV().clearAll();
  for (const k of Object.keys(files)) delete files[k];
  mockPicked = 'file:///cache/mockPicked.json';
  setAppLocale('en');
  jest.clearAllMocks();
});
afterEach(() => setActivePackForTests(null));

const codeOf = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return e instanceof BackupError ? e.code : `other:${(e as Error).message}`; }
  return 'none';
};

describe('pickBackup throws BackupError codes', () => {
  it('unreadable', async () => { mockPicked = 'file:///nope'; expect(await codeOf(pickBackup())).toBe('unreadable'); });
  it('corrupt (not JSON)', async () => { files[mockPicked] = '{nope'; expect(await codeOf(pickBackup())).toBe('corrupt'); });
  it('invalid (not an object)', async () => { files[mockPicked] = 'null'; expect(await codeOf(pickBackup())).toBe('invalid'); });
  it('not_this_app', async () => {
    files[mockPicked] = JSON.stringify({ ...(await buildBackup()), app: 'OtherBuddy' });
    expect(await codeOf(pickBackup())).toBe('not_this_app');
  });
  it('incomplete (a table is missing)', async () => {
    const b = await buildBackup();
    delete (b.db as any).vocabulary_items;
    files[mockPicked] = JSON.stringify(b);
    expect(await codeOf(pickBackup())).toBe('incomplete');
  });
  it('sharing_unavailable when the system cannot share', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
    expect(await codeOf(exportBackup({}))).toBe('sharing_unavailable');
    expect(backupErrorText(new BackupError('sharing_unavailable'))).toBe('Sharing is not available on this device.');
  });

  it('newer format is a preview with a reason code, and restoring it throws cannot_restore', async () => {
    files[mockPicked] = JSON.stringify({ ...(await buildBackup()), format: 99 });
    const p = (await pickBackup())!;
    expect(p.compatible).toBe(false);
    expect(p.reasonCode).toBe('newer');
    expect(await codeOf(restoreBackup(p))).toBe('newer');
  });
});

describe('texts', () => {
  it('backupErrorText translates a BackupError with the app name', () => {
    expect(backupErrorText(new BackupError('not_this_app'))).toContain('GermanBuddy');
    setActivePackForTests(testPack);
    expect(backupErrorText(new BackupError('newer'))).toContain('SpanishBuddy');
    setAppLocale('it');
    expect(backupErrorText(new BackupError('corrupt'))).toBe('Il file di backup è danneggiato.');
  });

  it('never shows the message of an unknown error', () => {
    const text = backupErrorText(new Error('SQLITE_CORRUPT secret'));
    expect(text).not.toContain('SQLITE');
    expect(text.length).toBeGreaterThan(0);
  });

  it('the share dialog is titled with the app name in the UI language', async () => {
    await exportBackup({});
    expect((Sharing.shareAsync as jest.Mock).mock.calls[0][1].dialogTitle).toContain('GermanBuddy');
  });

  it('backup.ts keeps no Italian literal', () => {
    const src = readFileSync(join(__dirname, '..', 'src', 'data', 'backup.ts'), 'utf8');
    expect(src).not.toMatch(/[àèéìòù]/);
    expect(src).not.toMatch(/Questo|Impossibile|Il file|Salva/);
  });
});
