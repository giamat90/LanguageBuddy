import { _resetDbForTests, getDb } from '../src/data/db';
import { submitOnboarding, fetchProfile } from '../src/services/profileService';
import { fetchTodayWord, saveWord } from '../src/services/wordService';
import { fetchDueReviews, fetchVaultCards, gradePractice } from '../src/services/reviewService';
import { updateRetentionScore } from '../src/data/srs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require('expo-sqlite');

const PREFS = { food: 0.8, travel: 0.8, work: 0.3, culture: 0.3, home: 0.3, leisure: 0.3, health: 0.3, shopping: 0.3 };
const DAY = 24 * 60 * 60 * 1000;
const inDays = (d: number) => new Date(Date.now() + d * DAY).toISOString();

interface VocabRow {
  id: string;
  retention_score: number;
  times_seen: number;
  times_used: number;
  next_review_at: string;
}

let id: string;

beforeEach(async () => {
  sqlite.__reset();
  _resetDbForTests();
  await submitOnboarding({ cefr_level: 'A1', topic_preferences: PREFS });
  await fetchTodayWord();
  await saveWord();
  const [card] = await fetchVaultCards();
  id = card.id;
});

async function row(rowId = id): Promise<VocabRow> {
  const db = await getDb();
  return (await db.getFirstAsync<VocabRow>('SELECT * FROM vocabulary_items WHERE id = ?', [rowId]))!;
}
async function setRow(retention: number, nextReviewAt: string, timesSeen = 3) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE vocabulary_items SET retention_score = ?, next_review_at = ?, times_seen = ? WHERE id = ?',
    [retention, nextReviewAt, timesSeen, id],
  );
}
async function logRows() {
  const db = await getDb();
  return db.getAllAsync('SELECT * FROM review_log');
}

describe('fetchVaultCards', () => {
  it('returns every saved word, due or not, enriched from the word bank', async () => {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO vocabulary_items (id, word, article, translation_en, translation_it, part_of_speech, source,
         times_seen, times_used, retention_score, first_seen_at, next_review_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['v2', 'Brot', 'das', 'bread', 'pane', 'noun', 'word_of_the_day', 4, 2, 0.9, inDays(-3), inDays(20)],
    );

    expect(await fetchDueReviews(new Date())).toHaveLength(0); // nothing is due today
    const cards = await fetchVaultCards();
    expect(cards).toHaveLength(2);
    const brot = cards.find((c) => c.id === 'v2')!;
    expect(brot).toMatchObject({
      id: 'v2', timesSeen: 4, retentionScore: 0.9, partOfSpeech: 'noun', cefrBand: 'A1',
    });
    expect(typeof brot.exampleDe).toBe('string');
  });
});

describe('gradePractice — only misses count', () => {
  it.each([1, 0.5, true] as (number | boolean)[])('a pass (%s) changes nothing at all', async (outcome) => {
    await setRow(0.8, inDays(7), 5);
    const before = await row();
    await gradePractice(id, outcome);
    expect(await row()).toEqual(before);
    expect(await logRows()).toHaveLength(0);
  });

  it('a miss lowers retention and moves the next review earlier, leaving the counters alone', async () => {
    await setRow(0.95, inDays(20), 4);
    const before = await row();
    await gradePractice(id, 0);

    const after = await row();
    expect(after.retention_score).toBe(updateRetentionScore(0.95, 0, 4));
    expect(after.retention_score).toBeLessThan(before.retention_score);
    expect(after.next_review_at < before.next_review_at).toBe(true);
    expect(after.times_seen).toBe(before.times_seen);
    expect(after.times_used).toBe(before.times_used);
    expect(await logRows()).toHaveLength(0);
  });

  it('a partial fail (below the pass mark) counts as a miss', async () => {
    await setRow(0.9, inDays(21), 4);
    await gradePractice(id, 0.4);
    expect((await row()).retention_score).toBe(updateRetentionScore(0.9, 0.4, 4));
  });

  it('never moves a word that is already due to a later date', async () => {
    const due = inDays(-1);
    await setRow(0.9, due, 4);
    await gradePractice(id, 0);
    const after = await row();
    expect(after.next_review_at).toBe(due);
    expect(after.retention_score).toBeLessThan(0.9);
  });

  it('keeps an earlier stored date when the recomputed one would be later', async () => {
    const soon = inDays(0.5);
    await setRow(0.3, soon, 4);
    await gradePractice(id, 0);
    expect((await row()).next_review_at).toBe(soon);
  });

  it('treats false as a miss', async () => {
    await setRow(0.95, inDays(20), 4);
    await gradePractice(id, false);
    expect((await row()).retention_score).toBeLessThan(0.95);
  });

  it('ignores an unknown id', async () => {
    await expect(gradePractice('nope', 0)).resolves.toBeUndefined();
  });

  it('does not touch the streak or last activity', async () => {
    const db = await getDb();
    const read = () =>
      db.getFirstAsync<{ streak_days: number; last_active_at: string | null }>(
        'SELECT streak_days, last_active_at FROM learner_profile',
      );
    const before = await read();
    await gradePractice(id, 0);
    expect(await read()).toEqual(before);
    expect((await fetchProfile())?.cefrLevel).toBe('A1');
  });
});
