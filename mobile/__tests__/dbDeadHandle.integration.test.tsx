/**
 * Integration: real services, real screen and the real src/data/db.ts over the in-memory
 * expo-sqlite mock, with database handles that can be killed on cue (the phone's
 * "NativeDatabase.prepareAsync … NullPointerException"). See tasks/TASK-030.md.
 *
 * What this cannot prove: that the native library really releases a shared handle when a
 * JS wrapper is garbage-collected. That needs a phone; here the *symptom* is injected.
 */
const mockFiles: Record<string, string> = {};

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn(async (uri: string, c: string) => { mockFiles[uri] = c; }),
  readAsStringAsync: jest.fn(async (uri: string) => {
    if (!(uri in mockFiles)) throw new Error('not found');
    return mockFiles[uri];
  }),
}));
const mockPickedUri = 'file:///cache/picked-backup.json';
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: mockPickedUri, name: 'backup.json' }] })),
}));
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

interface MockHandle {
  options: Record<string, unknown>;
  dead: boolean;
  fault: { match: RegExp; times: number } | null;
  closeAsync: jest.Mock;
  [method: string]: unknown;
}
const mockHandles: MockHandle[] = [];
/** Applied to the next handle that gets opened (e.g. a replacement that misbehaves once). */
let mockNextHandleFault: { match: RegExp; times: number } | null = null;

jest.mock('expo-sqlite', () => {
  const actual = jest.requireActual('../__mocks__/expo-sqlite');
  return {
    ...actual,
    openDatabaseAsync: async (name: string, options: Record<string, unknown>) => {
      const real = await actual.openDatabaseAsync(name, options);
      const h: MockHandle = {
        options, dead: false, fault: mockNextHandleFault, closeAsync: jest.fn(async () => {}),
      };
      mockNextHandleFault = null;
      const npe = () => new Error(
        "Call to function 'NativeDatabase.prepareAsync' has been rejected.\n→ Caused by: java.lang.NullPointerException: java.lang.NullPointerException",
      );
      for (const m of ['execAsync', 'runAsync', 'getFirstAsync', 'getAllAsync']) {
        h[m] = async (sql: string, ...rest: unknown[]) => {
          if (h.dead) throw npe();
          if (h.fault && h.fault.times > 0 && h.fault.match.test(String(sql))) { h.fault.times -= 1; throw npe(); }
          return real[m](sql, ...rest);
        };
      }
      h.withTransactionAsync = async (fn: () => Promise<void>) => { if (h.dead) throw npe(); await fn(); };
      mockHandles.push(h);
      return h;
    },
  };
});

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import WordCardScreen from '../src/screens/WordCardScreen';
import { getDb, resetDbHandle } from '../src/data/db';
import { buildBackup, pickBackup, restoreBackup, RESTART_REQUIRED } from '../src/data/backup';
import { submitOnboarding } from '../src/services/profileService';
import { fetchStats } from '../src/services/statsService';
import { fetchTodayWord } from '../src/services/wordService';
import { useWordStore } from '../src/store/useWordStore';
import { buildTopicPreferences, TOPIC_KEYS } from '../src/lib/topics';
import { t } from '../src/i18n';

const { __reset } = require('expo-sqlite');
const { MMKV } = require('react-native-mmkv');

const lastHandle = () => mockHandles[mockHandles.length - 1];

beforeEach(async () => {
  __reset();
  resetDbHandle();
  await new Promise((r) => setImmediate(r));
  new MMKV().clearAll();
  for (const k of Object.keys(mockFiles)) delete mockFiles[k];
  mockHandles.length = 0;
  mockNextHandleFault = null;
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  useWordStore.setState({ word: null, saveState: 'idle', isLoading: false, error: null, streakDays: 0 });
});

describe('after restoring a backup (the flow that re-opens the database in the same process)', () => {
  it('keeps working when the handle dies later, and shows the restored data', async () => {
    // Device A: a profile and one saved word, exported.
    const a = await getDb();
    await a.runAsync(
      `INSERT INTO learner_profile (id, cefr_level, topic_preferences, created_at, streak_days, last_active_at, total_words_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['prof_1', 'B1', '{"food":0.7}', '2026-09-01T00:00:00.000Z', 5, '2026-09-07T00:00:00.000Z', 12],
    );
    await a.runAsync(
      `INSERT INTO vocabulary_items (id, word, article, translation_en, translation_it, part_of_speech, source, times_seen, times_used, retention_score, first_seen_at, next_review_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['v1', 'Haus', 'das', 'house', 'casa', 'noun', 'word_of_the_day', 3, 1, 0.75, '2026-09-01T00:00:00.000Z', '2026-09-10T00:00:00.000Z'],
    );
    mockFiles[mockPickedUri] = JSON.stringify(await buildBackup());

    // Device B: other data, then restore (which re-opens the database without restarting).
    __reset();
    resetDbHandle();
    new MMKV().clearAll();
    const b = await getDb();
    await b.runAsync(
      `INSERT INTO vocabulary_items (id, word, source, times_seen, times_used, retention_score, first_seen_at, next_review_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['old', 'Katze', 'word_of_the_day', 1, 0, 0.5, '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z'],
    );
    const preview = await pickBackup();
    await expect(restoreBackup(preview!)).rejects.toThrow(RESTART_REQUIRED);

    expect((await fetchStats()).saved.total).toBe(1);
    const opened = mockHandles.length;

    // The handle the app is now using dies, as it did on the phone.
    lastHandle().dead = true;

    const stats = await fetchStats();
    expect(stats.saved.total).toBe(1); // restored data, not Device B's "Katze"
    expect((await fetchTodayWord())?.cefrBand).toBe('B1');
    expect(mockHandles.length).toBe(opened + 1); // replaced once, not once per query
    expect(mockHandles.every((h) => h.options.useNewConnection === true)).toBe(true);
  });
});

describe('Today screen when the handle is dead (the notification tap)', () => {
  beforeEach(async () => {
    await submitOnboarding({ cefr_level: 'A1', topic_preferences: buildTopicPreferences(TOPIC_KEYS, ['food', 'home']) });
  });

  it('shows the word without any error screen: the dead handle is replaced transparently', async () => {
    lastHandle().dead = true;
    const { queryByText } = render(<WordCardScreen />);
    await waitFor(() => expect(useWordStore.getState().word).not.toBeNull());
    expect(queryByText(t('word_card_error'))).toBeNull();
    expect(mockHandles).toHaveLength(2);
  });

  it('"Riprova" recovers instead of looping when the replacement also fails once', async () => {
    lastHandle().dead = true;
    mockNextHandleFault = { match: /daily_items/, times: 1 }; // the replacement misbehaves on the first try
    const { findByText, queryByText } = render(<WordCardScreen />);

    fireEvent.press(await findByText(t('word_card_retry')));

    await waitFor(() => expect(useWordStore.getState().word).not.toBeNull());
    expect(queryByText(t('word_card_error'))).toBeNull();
    expect(console.error).toHaveBeenCalled(); // the cause is logged, never shown
  });
});
