import { getDb, _resetDbForTests } from '../src/data/db';
import { submitOnboarding } from '../src/services/profileService';
import { fetchTodayWord, saveWord } from '../src/services/wordService';
import { fetchVault, fetchVaultWord } from '../src/services/vaultService';
import { allEntries } from '../src/data/wordbank';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require('expo-sqlite');

const PREFS = { food: 0.8, travel: 0.8, work: 0.3, culture: 0.3, home: 0.3, leisure: 0.3, health: 0.3, shopping: 0.3 };

beforeEach(() => {
  sqlite.__reset();
  _resetDbForTests();
});

describe('fetchVaultWord', () => {
  it('returns the full card for a saved word, with example + SRS data', async () => {
    await submitOnboarding({ cefr_level: 'A1', topic_preferences: PREFS });
    const today = await fetchTodayWord();
    await saveWord();

    const { items } = await fetchVault(1);
    const detail = await fetchVaultWord(items[0].id);

    expect(detail).not.toBeNull();
    expect(detail!.word).toBe(today!.word);
    expect(detail!.example).toBe(today!.example);
    expect(detail!.culturalNote).toBe(today!.culturalNote);
    expect(detail!.retentionScore).toBe(0.5);
    expect(typeof detail!.nextReviewAt).toBe('string');
  });

  it('returns null for an unknown id', async () => {
    await submitOnboarding({ cefr_level: 'A1', topic_preferences: PREFS });
    expect(await fetchVaultWord('nope')).toBeNull();
  });

  it('falls back to the word bank English content for a row saved before the migration (AC4)', async () => {
    await submitOnboarding({ cefr_level: 'A1', topic_preferences: PREFS });
    await fetchTodayWord();
    await saveWord();

    const { items } = await fetchVault(1);
    const word = items[0].word;
    const bankEntry = allEntries().find((e) => e.entry.word === word)!.entry;

    // Simulate a pre-migration daily_items row: null out example_en/cultural_note_en.
    const db = await getDb();
    await db.runAsync(
      'UPDATE daily_items SET example_en = NULL, cultural_note_en = NULL WHERE word = ?',
      [word],
    );

    const detail = await fetchVaultWord(items[0].id);
    expect(detail).not.toBeNull();
    expect(detail!.exampleEn).toBe(bankEntry.example_en);
    expect(detail!.culturalNoteEn).toBe(bankEntry.cultural_note_en);
  });
});
