/**
 * An unknown language code (a tampered or future backup, an MMKV value, a route
 * parameter) must never reach the UI: it is coerced to the default.
 */

const files: Record<string, string> = {};

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn(async (uri: string, contents: string) => {
    files[uri] = contents;
  }),
  readAsStringAsync: jest.fn(async (uri: string) => files[uri]),
}));
const pickedUri = 'file:///cache/picked-backup.json';
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: pickedUri, name: 'b.json' }] })),
}));

import { getDb, resetDbHandle } from '../src/data/db';
import { buildBackup, pickBackup, restoreBackup, RESTART_REQUIRED } from '../src/data/backup';
import { fetchProfile, submitOnboarding } from '../src/services/profileService';

const { __reset } = require('expo-sqlite');
const { MMKV } = require('react-native-mmkv');

beforeEach(() => {
  __reset();
  resetDbHandle();
  new MMKV().clearAll();
  for (const k of Object.keys(files)) delete files[k];
});

async function seedProfile(lang: string) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO learner_profile (id, cefr_level, topic_preferences, created_at, streak_days, total_words_seen, native_language)
     VALUES ('p1', 'B1', '{}', '2026-09-01', 1, 1, ?)`,
    [lang],
  );
}

test('fetchProfile coerces an unknown stored language', async () => {
  await seedProfile('xx');
  expect((await fetchProfile())?.nativeLanguage).toBe('it');
});

test('fetchProfile returns every supported language unchanged', async () => {
  await seedProfile('ja');
  expect((await fetchProfile())?.nativeLanguage).toBe('ja');
});

test('submitOnboarding never stores an unknown language', async () => {
  const profile = await submitOnboarding({
    cefr_level: 'A1',
    topic_preferences: {},
    native_language: 'xx' as never,
  });
  expect(profile.nativeLanguage).toBe('it');
  const db = await getDb();
  const row = await db.getFirstAsync<{ native_language: string }>('SELECT native_language FROM learner_profile');
  expect(row?.native_language).toBe('it');
});

test('restoring a backup with an unknown language leaves valid values everywhere', async () => {
  await seedProfile('fr');
  new MMKV({ id: 'user-store' }).set('nativeLanguage', 'fr');
  const backup = await buildBackup();
  backup.kv.nativeLanguage = 'xx' as never;
  backup.db.learner_profile[0].native_language = 'xx';
  files[pickedUri] = JSON.stringify(backup);

  __reset();
  resetDbHandle();
  new MMKV().clearAll();

  const preview = await pickBackup();
  await expect(restoreBackup(preview!)).rejects.toThrow(RESTART_REQUIRED);

  // The unknown code is dropped rather than stored; a missing value reads as the default.
  expect(new MMKV({ id: 'user-store' }).getString('nativeLanguage')).toBeUndefined();
  const db = await getDb();
  const row = await db.getFirstAsync<{ native_language: string }>('SELECT native_language FROM learner_profile');
  expect(row?.native_language).toBe('it');
});

test('restoring a backup with a new language keeps it', async () => {
  await seedProfile('ar');
  new MMKV({ id: 'user-store' }).set('nativeLanguage', 'ar');
  files[pickedUri] = JSON.stringify(await buildBackup());
  __reset();
  resetDbHandle();
  new MMKV().clearAll();
  await expect(restoreBackup((await pickBackup())!)).rejects.toThrow(RESTART_REQUIRED);
  expect(new MMKV({ id: 'user-store' }).getString('nativeLanguage')).toBe('ar');
});
