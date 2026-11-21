/** TASK-059: a learner may have saved a word that a later word bank no longer contains (removed, renamed). It must keep working. */
import { _resetDbForTests, getDb } from '../src/data/db';
import { submitOnboarding } from '../src/services/profileService';
import { fetchDueReviews, fetchVaultCards, gradeReview, gradePractice } from '../src/services/reviewService';
import { pickExercise } from '../src/lib/exercises/registry';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require('expo-sqlite');
const PREFS = { food: 0.8, travel: 0.8, work: 0.3, culture: 0.3, home: 0.3, leisure: 0.3, health: 0.3, shopping: 0.3 };
const GONE = 'Verklärungsmomentum'; // removed from the bank by TASK-059
const LATER = () => new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

beforeEach(async () => {
  sqlite.__reset();
  _resetDbForTests();
  await submitOnboarding({ cefr_level: 'A1', topic_preferences: PREFS });
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO vocabulary_items (id, word, article, translation_en, translation_it, part_of_speech, source, times_seen, times_used, retention_score, first_seen_at, next_review_at)
     VALUES ('gone-1', ?, NULL, 'a made-up word', 'una parola inventata', 'noun', 'word_of_the_day', 1, 0, 0.5, ?, ?)`,
    [GONE, new Date().toISOString(), new Date().toISOString()],
  );
});

describe('a saved word that is no longer in the word bank', () => {
  it('is still due and comes back as a card without an example', async () => {
    const [card] = await fetchDueReviews(LATER());
    expect(card).toMatchObject({ word: GONE, translationIt: 'una parola inventata', example: null, cefrBand: null, grammarAngle: null });
  });

  it('is in the vault list and can be practised', async () => {
    const cards = await fetchVaultCards();
    expect(cards.map((c) => c.word)).toContain(GONE);
    await expect(gradePractice('gone-1', 0)).resolves.toBeUndefined();
  });

  it('can be graded in a review', async () => {
    await gradeReview('gone-1', 0.7);
    const db = await getDb();
    const row = await db.getFirstAsync<{ times_seen: number }>('SELECT times_seen FROM vocabulary_items WHERE id = ?', ['gone-1']);
    expect(row!.times_seen).toBe(2);
  });

  it('still gets an exercise: a flip-card once the word is known (every other format needs the bank example)', async () => {
    const db = await getDb();
    await db.runAsync("UPDATE vocabulary_items SET times_seen = 6, retention_score = 0.9 WHERE id = 'gone-1'");
    const [card] = await fetchDueReviews(LATER());
    expect(pickExercise(card, undefined, () => 0.5).kind).toBe('flashcard');
  });

  it('a brand-new saved word gets some exercise without throwing', async () => {
    const [card] = await fetchDueReviews(LATER());
    expect(() => pickExercise(card, undefined, () => 0.5)).not.toThrow();
  });
});
