import { _resetDbForTests } from '../src/data/db';
import { submitOnboarding, fetchProfile } from '../src/services/profileService';
import { fetchTodayWord, saveWord } from '../src/services/wordService';
import { fetchVault } from '../src/services/vaultService';
import { dueCount, fetchDueReviews, gradeReview } from '../src/services/reviewService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require('expo-sqlite');

const PREFS = { food: 0.8, travel: 0.8, work: 0.3, culture: 0.3, home: 0.3, leisure: 0.3, health: 0.3, shopping: 0.3 };

beforeEach(() => {
  sqlite.__reset();
  _resetDbForTests();
});

describe('standalone word flow', () => {
  it('creates a local profile from onboarding', async () => {
    expect(await fetchProfile()).toBeNull();
    await submitOnboarding({ cefr_level: 'A2', topic_preferences: PREFS });
    const p = await fetchProfile();
    expect(p?.cefrLevel).toBe('A2');
    expect(p?.topicPreferences.food).toBe(0.8);
  });

  it('returns a word for today at the profile level and is stable within the day', async () => {
    await submitOnboarding({ cefr_level: 'A1', topic_preferences: PREFS });
    const first = await fetchTodayWord();
    expect(first?.cefrBand).toBe('A1');
    const again = await fetchTodayWord();
    expect(again?.word).toBe(first?.word);
  });

  it('carries example_en/cultural_note_en through from the word bank to the mapped DailyWord', async () => {
    await submitOnboarding({ cefr_level: 'A1', topic_preferences: PREFS });
    const word = await fetchTodayWord();
    expect(typeof word?.exampleEn).toBe('string');
    expect(word?.exampleEn?.length).toBeGreaterThan(0);
    expect(typeof word?.culturalNoteEn).toBe('string');
    expect(word?.culturalNoteEn?.length).toBeGreaterThan(0);
  });

  it('saving the word adds it to the vault and sets the streak to 1', async () => {
    await submitOnboarding({ cefr_level: 'A1', topic_preferences: PREFS });
    await fetchTodayWord();
    const res = await saveWord();
    expect(res.already_saved).toBe(false);
    expect(res.streak_days).toBe(1);

    const vault = await fetchVault(1);
    expect(vault.total).toBe(1);
    expect(vault.items[0].word).toBe((await fetchTodayWord())?.word);

    const second = await saveWord();
    expect(second.already_saved).toBe(true);
  });

  it('a saved word becomes due for review and can be graded', async () => {
    await submitOnboarding({ cefr_level: 'A1', topic_preferences: PREFS });
    await fetchTodayWord();
    await saveWord();

    // next_review_at was set ~1 day out; check against a far-future "now"
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    expect(await dueCount(future)).toBe(1);

    const due = await fetchDueReviews(future);
    await gradeReview(due[0].id, true);

    expect(await dueCount(future)).toBe(0); // pushed further out after a correct grade
  });
});
