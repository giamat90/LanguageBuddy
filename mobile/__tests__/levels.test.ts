/** TASK-071: a pack with fewer than six levels never sends the app to a level it has no words for. */
jest.mock('../src/data/wordbank/active', () => {
  const a1 = jest.requireActual('../src/data/wordbank/de/A1.json');
  return { LEVEL_FILES: { A1: a1, A2: [], B1: [], B2: [], C1: [], C2: [] } };
});

import { _resetDbForTests, getDb } from '../src/data/db';
import { CEFR_ORDER, WORD_BANK } from '../src/data/wordbank';
import { setActivePackForTests, type LanguagePack } from '../src/languages';
import { de } from '../src/languages/de';
import { es } from '../src/languages/es';
import { fr } from '../src/languages/fr';
import { coerceLevel } from '../src/lib/levels';
import { fetchProfile } from '../src/services/profileService';
import { fetchTodayWord } from '../src/services/wordService';
import { testPack } from '../test-support/testPack';
import { testPackCjk } from '../test-support/testPackCjk';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require('expo-sqlite');

beforeEach(() => {
  sqlite.__reset();
  _resetDbForTests();
});
afterEach(() => setActivePackForTests(null));

describe('coerceLevel', () => {
  it.each([
    ['A1', 'A1'], ['B1', 'B1'], ['C2', 'C2'],
    ['b1', 'A1'], ['x', 'A1'], ['', 'A1'], [null, 'A1'], [undefined, 'A1'], [5, 'A1'], ['__proto__', 'A1'],
  ])('six levels: %p -> %s', (input, expected) => {
    expect(coerceLevel(input, de)).toBe(expected);
  });

  it.each([['A1', 'A1'], ['A2', 'A1'], ['C2', 'A1'], ['x', 'A1'], [null, 'A1']])('one level: %p -> %s', (input, expected) => {
    expect(coerceLevel(input, testPackCjk)).toBe(expected);
  });

  it('a level above the pack becomes its highest, an unknown value its first', () => {
    const two: LanguagePack = { ...testPackCjk, levels: ['A1', 'A2'] };
    expect(coerceLevel('C2', two)).toBe('A2');
    expect(coerceLevel('B1', two)).toBe('A2');
    expect(coerceLevel('A1', two)).toBe('A1');
    expect(coerceLevel('x', two)).toBe('A1');
  });

  it('reads the active pack when none is given', () => {
    expect(coerceLevel('C1')).toBe('C1');
    setActivePackForTests(testPackCjk);
    expect(coerceLevel('C1')).toBe('A1');
  });
});

describe('pack rules', () => {
  const packs: [string, LanguagePack][] = [['de', de], ['es', es], ['fr', fr], ['testPack', testPack], ['testPackCjk', testPackCjk]];

  it.each(packs)('%s: its levels are a non-empty prefix of A1..C2', (_name, pack) => {
    expect(pack.levels.length).toBeGreaterThan(0);
    expect([...pack.levels]).toEqual(CEFR_ORDER.slice(0, pack.levels.length));
  });

  it.each(packs)('%s: it has no placement quiz exactly when it has one level', (_name, pack) => {
    expect(pack.quiz.length === 0).toBe(pack.levels.length === 1);
  });

  it('the published apps keep six levels and spaced sentences', () => {
    for (const pack of [de, es, fr]) {
      expect([...pack.levels]).toEqual(CEFR_ORDER);
      expect(pack.sentences).toBe('spaced');
    }
  });
});

describe('a profile that holds a level the app does not have', () => {
  const seed = async (level: string) => {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO learner_profile (id, cefr_level, topic_preferences, created_at, streak_days, total_words_seen, native_language)
       VALUES ('p1', ?, '{}', '2026-09-01', 0, 0, 'it')`,
      [level],
    );
  };

  beforeEach(() => setActivePackForTests(testPackCjk));

  it('reads as a level the app has, without rewriting the stored row', async () => {
    await seed('B1');
    expect((await fetchProfile())!.cefrLevel).toBe('A1');
    const db = await getDb();
    expect((await db.getFirstAsync<{ cefr_level: string }>('SELECT * FROM learner_profile LIMIT 1'))!.cefr_level).toBe('B1');
  });

  it('gets a word of the day instead of crashing on the empty level', async () => {
    await seed('B1');
    const today = await fetchTodayWord();
    expect(WORD_BANK.A1.map((e) => e.word)).toContain(today!.word);
  });
});
