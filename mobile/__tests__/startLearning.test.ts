import { _resetDbForTests, getDb } from '../src/data/db';
import { submitOnboarding, fetchProfile } from '../src/services/profileService';
import { startLearning, saveWord, fetchTodayWord } from '../src/services/wordService';
import { fetchVault } from '../src/services/vaultService';
import { fetchSavedStates } from '../src/services/statsService';
import { refreshReviewReminder } from '../src/services/reviewService';
import { pickNextWord } from '../src/data/dailyWord';
import { WORD_BANK } from '../src/data/wordbank';

jest.mock('../src/services/reviewService', () => ({
  ...jest.requireActual('../src/services/reviewService'),
  refreshReviewReminder: jest.fn().mockResolvedValue(undefined),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require('expo-sqlite');
const PREFS = { food: 0.8, travel: 0.8, work: 0.3, culture: 0.3, home: 0.3, leisure: 0.3, health: 0.3, shopping: 0.3 };
const DAY = 24 * 60 * 60 * 1000;
const apfel = WORD_BANK.A1.find((e) => e.word === 'Apfel')!;

async function vocabRows() {
  const db = await getDb();
  return db.getAllAsync<any>('SELECT * FROM vocabulary_items');
}

beforeEach(async () => {
  sqlite.__reset();
  _resetDbForTests();
  jest.clearAllMocks();
  (refreshReviewReminder as jest.Mock).mockResolvedValue(undefined);
  await submitOnboarding({ cefr_level: 'A1', topic_preferences: PREFS });
});

describe('startLearning', () => {
  it('adds a bank word to the vault like the daily save does', async () => {
    const before = Date.now();
    const res = await startLearning('A1', 'Apfel');
    expect(res.added).toBe(true);
    const rows = await vocabRows();
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r).toMatchObject({
      id: res.id, word: 'Apfel', article: apfel.article, translation_en: apfel.meaning_en,
      translation_it: apfel.meaning_it, part_of_speech: apfel.part_of_speech, source: 'catalog',
      times_seen: 1, times_used: 0, retention_score: 0.5,
    });
    const due = new Date(r.next_review_at).getTime();
    expect(due).toBeGreaterThanOrEqual(before + DAY - 1000);
    expect(due).toBeLessThanOrEqual(Date.now() + DAY + 1000);
    expect((await fetchVault(1)).total).toBe(1);
  });

  it('never touches the streak, last activity, words seen, daily items or the review log', async () => {
    const db = await getDb();
    const profile = (await fetchProfile())!;
    await db.runAsync(
      'UPDATE learner_profile SET streak_days = 5, last_active_at = ?, total_words_seen = 9 WHERE id = ?',
      ['2026-11-01T10:00:00.000Z', profile.id],
    );
    const before = await db.getAllAsync<any>('SELECT * FROM learner_profile');
    await startLearning('A1', 'Apfel');
    expect(await db.getAllAsync<any>('SELECT * FROM learner_profile')).toEqual(before);
    expect(await db.getAllAsync<any>('SELECT * FROM daily_items')).toEqual([]);
    expect(await db.getAllAsync<any>('SELECT * FROM review_log')).toEqual([]);
  });

  it('is idempotent, also across letter case and a second level', async () => {
    expect((await startLearning('A1', 'Apfel')).added).toBe(true);
    const again = await startLearning('A1', 'Apfel');
    expect(again.added).toBe(false);
    expect(again.id).not.toBeNull();
    await getDb().then((db) => db.runAsync("UPDATE vocabulary_items SET word = 'APFEL' WHERE word = 'Apfel'"));
    expect((await startLearning('A1', 'Apfel')).added).toBe(false);
    expect(await vocabRows()).toHaveLength(1);
  });

  it('two parallel calls for one word insert once', async () => {
    const [a, b] = await Promise.all([startLearning('A1', 'Apfel'), startLearning('A1', 'Apfel')]);
    expect([a.added, b.added].sort()).toEqual([false, true]);
    expect(await vocabRows()).toHaveLength(1);
  });

  it('throws for a word that is not in that level of the bank', async () => {
    await expect(startLearning('A1', 'Nichtvorhandenwort')).rejects.toThrow();
    expect(await vocabRows()).toHaveLength(0);
  });

  it('refreshes the reminder after an add only, and survives a failing refresh', async () => {
    await startLearning('A1', 'Apfel');
    expect(refreshReviewReminder).toHaveBeenCalledTimes(1);
    await startLearning('A1', 'Apfel');
    expect(refreshReviewReminder).toHaveBeenCalledTimes(1);
    (refreshReviewReminder as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const word = WORD_BANK.A1.find((e) => e.word !== 'Apfel')!.word;
    await expect(startLearning('A1', word)).resolves.toMatchObject({ added: true });
    await Promise.resolve();
    warn.mockRestore();
  });

  it('the word shows up as saved for the catalog and is never picked as the daily word', async () => {
    await startLearning('A1', 'Apfel');
    expect((await fetchSavedStates()).get('apfel')).toMatchObject({ retentionScore: 0.5, timesSeen: 1 });
    const used = new Set((await vocabRows()).map((r: any) => r.word.toLowerCase()));
    const topics = Object.keys(PREFS);
    const picks = new Set<string>();
    for (let i = 0; i < 20; i++) picks.add(pickNextWord('A1', `install-${i}`, used, topics).entry.word);
    expect(picks.has('Apfel')).toBe(false);
  });

  it('a word started here and later saved as the daily word is not duplicated', async () => {
    const today = (await fetchTodayWord())!;
    await startLearning('A1', today.word);
    expect((await saveWord()).already_saved).toBe(false);
    const rows = await vocabRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].times_seen).toBe(2);
    expect(rows[0].source).toBe('catalog');
  });
});
