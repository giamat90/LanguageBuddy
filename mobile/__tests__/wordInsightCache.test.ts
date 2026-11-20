import { getDb, _resetDbForTests } from '../src/data/db';
import { getWordInsight, saveWordInsight } from '../src/services/vaultService';
import type { WordInsightResult } from '../src/lib/ai/wordInsight';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require('expo-sqlite');

const RESULT: WordInsightResult = {
  examples: [{ de: 'Der Strom ist teuer.', native: 'The electricity is expensive.' }],
  note: 'A note.',
  exercise: null,
};

beforeEach(() => {
  sqlite.__reset();
  _resetDbForTests();
});

describe('AI word insight cache is per language', () => {
  it('returns the cached insight for the language it was generated in', async () => {
    await saveWordInsight('Strom', RESULT, 'en');
    expect(await getWordInsight('Strom', 'en')).toEqual(RESULT);
  });

  it('does not return an English insight once the app language is Russian', async () => {
    await saveWordInsight('Strom', RESULT, 'en');
    expect(await getWordInsight('Strom', 'ru')).toBeNull();
  });

  it('ignores legacy rows that carry no language', async () => {
    const db = await getDb();
    await db.runAsync('INSERT INTO ai_word_notes (word, payload, created_at) VALUES (?, ?, ?)', [
      'Strom', JSON.stringify(RESULT), 'now',
    ]);
    expect(await getWordInsight('Strom', 'en')).toBeNull();
  });

  it('regenerating in another language replaces the cached one', async () => {
    await saveWordInsight('Strom', RESULT, 'en');
    const ru = { ...RESULT, note: 'Заметка.' };
    await saveWordInsight('Strom', ru, 'ru');
    expect(await getWordInsight('Strom', 'ru')).toEqual(ru);
    expect(await getWordInsight('Strom', 'en')).toBeNull();
  });
});
