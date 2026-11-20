/**
 * Round-trip test for on-device backup / restore (src/data/backup.ts).
 */

const files: Record<string, string> = {};

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn(async (uri: string, contents: string) => {
    files[uri] = contents;
  }),
  readAsStringAsync: jest.fn(async (uri: string) => {
    if (!(uri in files)) throw new Error('not found');
    return files[uri];
  }),
}));

const pickedUri = 'file:///cache/picked-backup.json';
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: pickedUri, name: 'backup.json' }],
  })),
}));

import * as Sharing from 'expo-sharing';
import { getDb, resetDbHandle } from '../src/data/db';
import { buildBackup, exportBackup, pickBackup, restoreBackup, RESTART_REQUIRED } from '../src/data/backup';

import { getStoredKey, setKey, setProvider, getProvider, setOpenAiBaseUrl, setOpenAiModel, getOpenAiBaseUrl, getOpenAiModel } from '../src/lib/ai/keys';

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
  await db.runAsync(
    `INSERT INTO vocabulary_items (id, word, article, translation_en, translation_it, part_of_speech, source, times_seen, times_used, retention_score, first_seen_at, next_review_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['v1', 'Haus', 'das', 'house', 'casa', 'noun', 'word_of_the_day', 3, 1, 0.75, '2026-09-01T00:00:00.000Z', '2026-09-10T00:00:00.000Z'],
  );
  await db.runAsync(
    `INSERT INTO daily_items (id, date, word, article, saved_at) VALUES (?, ?, ?, ?, ?)`,
    ['d1', '2026-09-07', 'Haus', 'das', '2026-09-07T08:00:00.000Z'],
  );
  const mmkvUser = new MMKV({ id: 'user-store' });
  mmkvUser.set('hasProfile', true);
  mmkvUser.set('cefrLevel', 'B1');
  new MMKV({ id: 'word-store' }).set('streakDays', 5);
  new MMKV({ id: 'app-meta' }).set('installId', 'inst_abc');
}

test('buildBackup captures db rows and kv values', async () => {
  await seed();
  const backup = await buildBackup();

  expect(backup.app).toBe('GermanBuddy');
  expect(backup.format).toBe(1);
  expect(backup.counts).toEqual({ vocab: 1, daysLearned: 1 });
  expect(backup.db.vocabulary_items).toHaveLength(1);
  expect(backup.db.learner_profile[0].cefr_level).toBe('B1');
  expect(backup.kv).toEqual({
    installId: 'inst_abc',
    hasProfile: true,
    cefrLevel: 'B1',
    streakDays: 5,
  });
});

test('exportBackup writes a file and hands it to the share sheet', async () => {
  await seed();
  await exportBackup();
  expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
  const uri = (Sharing.shareAsync as jest.Mock).mock.calls[0][0];
  expect(JSON.parse(files[uri]).app).toBe('GermanBuddy');
});

test('restore replaces all local data with the backup contents', async () => {
  // Device A: create a backup.
  await seed();
  const backup = await buildBackup();
  files[pickedUri] = JSON.stringify(backup);

  // Device B: different starting state.
  __reset();
  resetDbHandle();
  new MMKV().clearAll();
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO vocabulary_items (id, word, source, times_seen, times_used, retention_score, first_seen_at, next_review_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['old', 'Katze', 'word_of_the_day', 1, 0, 0.5, '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z'],
  );

  const preview = await pickBackup();
  expect(preview).not.toBeNull();
  expect(preview!.compatible).toBe(true);

  await expect(restoreBackup(preview!)).rejects.toThrow(RESTART_REQUIRED);

  const db2 = await getDb();
  const vocab = await db2.getAllAsync<{ word: string }>('SELECT * FROM vocabulary_items');
  expect(vocab.map((v) => v.word)).toEqual(['Haus']);

  const profile = await db2.getFirstAsync<{ cefr_level: string }>('SELECT * FROM learner_profile');
  expect(profile?.cefr_level).toBe('B1');

  expect(new MMKV({ id: 'user-store' }).getString('cefrLevel')).toBe('B1');
  expect(new MMKV({ id: 'word-store' }).getNumber('streakDays')).toBe(5);
});

test('the AI key is left out of the backup unless opted in', async () => {
  await seed();
  setKey('anthropic', 'sk-ant-secret');
  expect((await buildBackup()).kv.anthropicApiKey).toBeUndefined();
  expect(JSON.stringify(await buildBackup())).not.toContain('sk-ant-secret');
  expect((await buildBackup({ includeAiKey: true })).kv.anthropicApiKey).toBe('sk-ant-secret');
});

test('restore brings back the AI key when included, and keeps the existing one otherwise', async () => {
  await seed();
  setKey('anthropic', 'sk-ant-secret');
  files[pickedUri] = JSON.stringify(await buildBackup({ includeAiKey: true }));

  setKey('anthropic', null);
  let preview = await pickBackup();
  await expect(restoreBackup(preview!)).rejects.toThrow(RESTART_REQUIRED);
  expect(getStoredKey('anthropic')).toBe('sk-ant-secret');

  files[pickedUri] = JSON.stringify(await buildBackup());
  setKey('anthropic', 'sk-ant-other');
  preview = await pickBackup();
  await expect(restoreBackup(preview!)).rejects.toThrow(RESTART_REQUIRED);
  expect(getStoredKey('anthropic')).toBe('sk-ant-other');
});

function configureOpenAi() {
  setKey('anthropic', 'sk-ant-secret');
  setKey('openai', 'sk-oa-secret');
  setProvider('openai');
  setOpenAiBaseUrl('https://api.groq.com/openai/v1');
  setOpenAiModel('llama-3.3-70b');
}

test('no AI data at all without opt-in, even with openai configured', async () => {
  await seed();
  configureOpenAi();
  const json = JSON.stringify(await buildBackup());
  expect(json).not.toContain('sk-oa-secret');
  expect(json).not.toContain('sk-ant-secret');
  expect(json).not.toContain('groq');
  expect(json).not.toContain('llama');
});

test('opt-in roundtrip restores provider, both keys, base URL and model', async () => {
  await seed();
  configureOpenAi();
  files[pickedUri] = JSON.stringify(await buildBackup({ includeAiKey: true }));

  new MMKV({ id: 'ai' }).clearAll();
  const preview = await pickBackup();
  await expect(restoreBackup(preview!)).rejects.toThrow(RESTART_REQUIRED);

  expect(getProvider()).toBe('openai');
  expect(getStoredKey('anthropic')).toBe('sk-ant-secret');
  expect(getStoredKey('openai')).toBe('sk-oa-secret');
  expect(getOpenAiBaseUrl()).toBe('https://api.groq.com/openai/v1');
  expect(getOpenAiModel()).toBe('llama-3.3-70b');
});

test('a backup without AI data leaves existing AI settings untouched', async () => {
  await seed();
  files[pickedUri] = JSON.stringify(await buildBackup());
  configureOpenAi();

  const preview = await pickBackup();
  await expect(restoreBackup(preview!)).rejects.toThrow(RESTART_REQUIRED);

  expect(getProvider()).toBe('openai');
  expect(getStoredKey('openai')).toBe('sk-oa-secret');
  expect(getOpenAiModel()).toBe('llama-3.3-70b');
});

test('a legacy backup with only anthropicApiKey still restores', async () => {
  await seed();
  const legacy = await buildBackup();
  legacy.kv.anthropicApiKey = 'sk-ant-legacy';
  files[pickedUri] = JSON.stringify(legacy);

  const preview = await pickBackup();
  await expect(restoreBackup(preview!)).rejects.toThrow(RESTART_REQUIRED);
  expect(getStoredKey('anthropic')).toBe('sk-ant-legacy');
  expect(getProvider()).toBe('anthropic');
});

test('an invalid base URL inside a backup is skipped, not fatal', async () => {
  await seed();
  const b = await buildBackup();
  b.kv.openaiApiKey = 'sk-oa-x';
  b.kv.openaiBaseUrl = 'http://evil.example';
  files[pickedUri] = JSON.stringify(b);

  const preview = await pickBackup();
  await expect(restoreBackup(preview!)).rejects.toThrow(RESTART_REQUIRED);
  expect(getStoredKey('openai')).toBe('sk-oa-x');
  expect(getOpenAiBaseUrl()).toBe('https://api.openai.com/v1');
});

test('a backup base URL without its own key is ignored (cannot redirect the existing key)', async () => {
  await seed();
  setKey('openai', 'sk-oa-mine');
  const b = await buildBackup();
  b.kv.openaiBaseUrl = 'https://evil.example/v1';
  files[pickedUri] = JSON.stringify(b);

  const preview = await pickBackup();
  await expect(restoreBackup(preview!)).rejects.toThrow(RESTART_REQUIRED);
  expect(getOpenAiBaseUrl()).toBe('https://api.openai.com/v1');
  expect(getStoredKey('openai')).toBe('sk-oa-mine');
});

async function reviewLogRows(): Promise<{ id: string; was_correct: number; quality: number | null }[]> {
  const db = await getDb();
  return db.getAllAsync('SELECT * FROM review_log');
}

async function seedReviewLog(quality: number | null) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO review_log (id, vocab_item_id, reviewed_at, was_correct, quality) VALUES (?, ?, ?, ?, ?)`,
    ['r1', 'v1', '2026-09-08T00:00:00.000Z', 1, quality],
  );
}

test('review_log.quality round-trips through a backup', async () => {
  await seed();
  await seedReviewLog(0.7);
  const backup = await buildBackup();
  expect(backup.db.review_log[0].quality).toBe(0.7);
  files[pickedUri] = JSON.stringify(backup);

  __reset();
  resetDbHandle();
  new MMKV().clearAll();
  await getDb();

  const preview = await pickBackup();
  await expect(restoreBackup(preview!)).rejects.toThrow(RESTART_REQUIRED);
  expect(await reviewLogRows()).toEqual([
    expect.objectContaining({ id: 'r1', was_correct: 1, quality: 0.7 }),
  ]);

  // The mock DB is schema-less, so also assert the real schema has the column a
  // restored row needs (real SQLite would reject the INSERT otherwise).
  const db = await getDb();
  const cols = (await db.getAllAsync<{ name: string }>('PRAGMA table_info(review_log)')).map((c) => c.name);
  expect(cols).toContain('quality');
});

test('a legacy backup whose review_log rows have no quality still restores', async () => {
  await seed();
  await seedReviewLog(0.7);
  const backup = await buildBackup();
  for (const row of backup.db.review_log) delete row.quality;
  files[pickedUri] = JSON.stringify(backup);

  __reset();
  resetDbHandle();
  new MMKV().clearAll();
  await getDb();

  const preview = await pickBackup();
  await expect(restoreBackup(preview!)).rejects.toThrow(RESTART_REQUIRED);
  const rows = await reviewLogRows();
  expect(rows).toHaveLength(1);
  expect(rows[0].quality ?? null).toBeNull();
});

test('restore ignores columns the installed schema does not have (older app / crafted file)', async () => {
  await seed();
  await seedReviewLog(0.7);
  const backup = await buildBackup();
  const evil = 'id) VALUES (1); DROP TABLE vocabulary_items; --';
  backup.db.review_log[0].future_col = 'from a newer app';
  backup.db.review_log[0][evil] = 'x';
  backup.db.vocabulary_items[0].another_future_col = 1;
  files[pickedUri] = JSON.stringify(backup);

  __reset();
  resetDbHandle();
  new MMKV().clearAll();
  await getDb();

  const preview = await pickBackup();
  await expect(restoreBackup(preview!)).rejects.toThrow(RESTART_REQUIRED);

  const [row] = await reviewLogRows();
  expect(row.quality).toBe(0.7);
  expect(Object.keys(row)).not.toContain('future_col');
  expect(Object.keys(row)).not.toContain(evil);

  const db = await getDb();
  const [vocab] = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM vocabulary_items');
  expect(vocab.word).toBe('Haus');
  expect(Object.keys(vocab)).not.toContain('another_future_col');
});

test('pickBackup rejects a non-GermanBuddy file', async () => {
  files[pickedUri] = JSON.stringify({ app: 'SomethingElse', format: 1, db: {} });
  await expect(pickBackup()).rejects.toThrow(/non è un backup di GermanBuddy/);
});

test('an incompatible newer format is flagged, not thrown', async () => {
  await seed();
  const backup = await buildBackup();
  files[pickedUri] = JSON.stringify({ ...backup, format: 99 });
  const preview = await pickBackup();
  expect(preview!.compatible).toBe(false);
  await expect(restoreBackup(preview!)).rejects.not.toThrow(RESTART_REQUIRED);
});

test('restore waits for the old connection to close before it reports RESTART_REQUIRED (TASK-033)', async () => {
  await seed();
  const backup = await buildBackup();
  files[pickedUri] = JSON.stringify(backup);
  const preview = await pickBackup();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dbModule = require('../src/data/db');
  let closed = false;
  const spy = jest.spyOn(dbModule, 'resetDbHandle').mockImplementation(
    () => new Promise<void>((r) => setTimeout(() => { closed = true; r(); }, 30)),
  );
  try {
    await expect(restoreBackup(preview!)).rejects.toThrow(RESTART_REQUIRED);
    expect(closed).toBe(true);
  } finally {
    spy.mockRestore();
  }
});
