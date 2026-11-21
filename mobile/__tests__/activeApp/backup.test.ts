/** Backup and restore of the active app: round trip, foreign files refused, keys never leak. */
const files: Record<string, string> = {};
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

import * as Sharing from 'expo-sharing';
import { getDb, resetDbHandle } from '../../src/data/db';
import { buildBackup, exportBackup, pickBackup, restoreBackup, BackupError, RESTART_REQUIRED } from '../../src/data/backup';
import { setKey } from '../../src/lib/ai/keys';
import { autoBackupFileName } from '../../src/lib/autoBackup/helpers';
import { current } from '../../test-support/appExpectations';

const { __reset } = require('expo-sqlite');
const { MMKV } = require('react-native-mmkv');

beforeEach(() => {
  __reset();
  resetDbHandle();
  new MMKV().clearAll();
  for (const k of Object.keys(files)) delete files[k];
});

async function seed() {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO learner_profile (id, cefr_level, topic_preferences, created_at, streak_days, last_active_at, total_words_seen)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['prof_1', 'B1', '{"food":0.7}', '2026-09-01T00:00:00.000Z', 5, '2026-09-07T00:00:00.000Z', 12],
  );
  const word = current().sampleWord.A1;
  await db.runAsync(
    `INSERT INTO vocabulary_items (id, word, article, translation_en, translation_it, part_of_speech, source, times_seen, times_used, retention_score, first_seen_at, next_review_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['v1', word, null, 'x', 'y', 'noun', 'word_of_the_day', 3, 1, 0.75, '2026-09-01T00:00:00.000Z', '2026-09-10T00:00:00.000Z'],
  );
  await db.runAsync(
    `INSERT INTO review_log (id, vocab_item_id, reviewed_at, was_correct, quality) VALUES (?, ?, ?, ?, ?)`,
    ['r1', 'v1', '2026-09-08T00:00:00.000Z', 1, 0.7],
  );
}

test('the backup carries this app\'s tag and is named after it', async () => {
  await seed();
  expect((await buildBackup()).app).toBe(current().backupTag);
  await exportBackup();
  const uri = (Sharing.shareAsync as jest.Mock).mock.calls[0][0] as string;
  expect(uri).toContain(`${current().backupTag}-backup-`);
});

test('export then restore round-trips profile, vault and review log (non-ASCII words survive)', async () => {
  await seed();
  files[pickedUri] = JSON.stringify(await buildBackup());
  __reset(); resetDbHandle(); new MMKV().clearAll();
  const preview = (await pickBackup())!;
  expect(preview.compatible).toBe(true);
  await expect(restoreBackup(preview)).rejects.toThrow(RESTART_REQUIRED);
  resetDbHandle();
  const db = await getDb();
  expect((await db.getAllAsync<any>('SELECT * FROM learner_profile'))[0].streak_days).toBe(5);
  expect((await db.getAllAsync<any>('SELECT word FROM vocabulary_items'))[0].word).toBe(current().sampleWord.A1);
  expect(await db.getAllAsync<any>('SELECT * FROM review_log')).toHaveLength(1);
});

test('a backup of another app, or with no tag, is refused as "not this app" (prevents cross-app data loss)', async () => {
  await seed();
  const good = await buildBackup();
  for (const app of ['SomeOtherBuddy', undefined]) {
    files[pickedUri] = JSON.stringify({ ...good, app });
    await expect(pickBackup()).rejects.toMatchObject({ code: 'not_this_app' });
  }
  for (const other of ['GermanBuddy', 'SpanishBuddy'].filter((n) => n !== current().backupTag)) {
    files[pickedUri] = JSON.stringify({ ...good, app: other });
    await expect(pickBackup()).rejects.toBeInstanceOf(BackupError);
  }
});

test('the AI key is absent unless the learner opts in', async () => {
  setKey('anthropic', 'sk-ant-secret');
  expect(JSON.stringify(await buildBackup())).not.toContain('sk-ant-secret');
  expect(JSON.stringify(await buildBackup({ includeAiKey: true }))).toContain('sk-ant-secret');
});

test('the automatic backup file name starts with the lowercase tag', () => {
  expect(autoBackupFileName(new Date('2026-11-21T10:00:00Z'))).toMatch(new RegExp(`^${current().backupTag.toLowerCase()}-auto-`));
});
