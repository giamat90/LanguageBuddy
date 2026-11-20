import { _resetDbForTests, getDb } from '../src/data/db';
import { submitOnboarding } from '../src/services/profileService';
import { fetchTodayWord, saveWord } from '../src/services/wordService';
import { fetchDueReviews, gradeReview } from '../src/services/reviewService';
import { updateRetentionScore } from '../src/data/srs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require('expo-sqlite');

const PREFS = { food: 0.8, travel: 0.8, work: 0.3, culture: 0.3, home: 0.3, leisure: 0.3, health: 0.3, shopping: 0.3 };
const FUTURE = () => new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

interface LogRow { vocab_item_id: string; was_correct: number; quality: number | null }
interface VocabRow { retention_score: number; times_seen: number; times_used: number }

beforeEach(async () => {
  sqlite.__reset();
  _resetDbForTests();
  await submitOnboarding({ cefr_level: 'A1', topic_preferences: PREFS });
  await fetchTodayWord();
  await saveWord();
});

async function dueId(): Promise<string> {
  const [card] = await fetchDueReviews(FUTURE());
  return card.id;
}
async function vocab(id: string): Promise<VocabRow> {
  const db = await getDb();
  return (await db.getFirstAsync<VocabRow>('SELECT * FROM vocabulary_items WHERE id = ?', [id]))!;
}
async function log(): Promise<LogRow[]> {
  const db = await getDb();
  return db.getAllAsync<LogRow>('SELECT * FROM review_log');
}

describe('gradeReview with a graded outcome', () => {
  it('a partial pass is stored, counted as used, and moves retention by that amount', async () => {
    const id = await dueId();
    const before = await vocab(id);
    await gradeReview(id, 0.7);

    const after = await vocab(id);
    expect(after.retention_score).toBe(updateRetentionScore(before.retention_score, 0.7, before.times_seen));
    expect(after.times_seen).toBe(before.times_seen + 1);
    expect(after.times_used).toBe(before.times_used + 1);

    const rows = await log();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ vocab_item_id: id, was_correct: 1, quality: 0.7 });
  });

  it('a sub-pass quality is logged as incorrect and does not count as used', async () => {
    const id = await dueId();
    const before = await vocab(id);
    await gradeReview(id, 0.3);

    expect((await vocab(id)).times_used).toBe(before.times_used);
    expect((await log())[0]).toMatchObject({ was_correct: 0, quality: 0.3 });
  });

  it('still accepts booleans (existing callers)', async () => {
    const id = await dueId();
    await gradeReview(id, true);
    await gradeReview(id, false);
    const rows = await log();
    expect(rows.map((r) => [r.was_correct, r.quality])).toEqual([[1, 1], [0, 0]]);
  });

  it('clamps nonsense quality values', async () => {
    const id = await dueId();
    await gradeReview(id, 9);
    await gradeReview(id, NaN);
    expect((await log()).map((r) => r.quality)).toEqual([1, 0]);
  });

  it('ignores an unknown card id', async () => {
    await expect(gradeReview('nope', 1)).resolves.toBeUndefined();
    expect(await log()).toHaveLength(0);
  });
});

describe('fetchDueReviews', () => {
  it('carries part of speech, band and topic from the word bank', async () => {
    const [card] = await fetchDueReviews(FUTURE());
    expect(typeof card.partOfSpeech).toBe('string');
    expect(card.cefrBand).toBe('A1');
    expect(typeof card.topicDomain).toBe('string');
  });
});
