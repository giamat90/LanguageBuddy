/** The grammar drill and the daily-word order of the active app, over its real bank (TASK-076). */
import { _resetDbForTests } from '../../src/data/db';
import { allEntries, WORD_BANK } from '../../src/data/wordbank';
import { orderedBankForLevel } from '../../src/data/dailyWord';
import { getActivePack } from '../../src/languages';
import { buildMeasureQuestion, hasGrammarDrill } from '../../src/lib/grammar';
import { buildDrill } from '../../src/services/grammarService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require('expo-sqlite');
const seeded = (): (() => number) => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

beforeEach(() => { sqlite.__reset(); _resetDbForTests(); });

const pack = getActivePack();
const top = pack.levels[pack.levels.length - 1];

describe('grammar drill', () => {
  (hasGrammarDrill() ? it : it.skip)('asks questions, each explained in every app language', async () => {
    const rng = seeded();
    const rules = new Set<string>();
    for (let round = 0; round < 20; round++) {
      const questions = await buildDrill(top, 10, rng);
      expect(questions.length).toBeGreaterThan(0);
      for (const q of questions) {
        rules.add(q.ruleCode);
        expect(q.options).toContain(q.answer);
        expect(new Set(q.options).size).toBe(q.options.length);
        if (pack.reading && q.cells) {
          expect(q.optionReadings!.every(Boolean)).toBe(true);
          expect(q.cells.every((c) => c.pinyin)).toBe(true);
        }
      }
    }
    for (const rule of rules) {
      for (const ui of pack.uiLanguages) expect([ui, rule, Boolean(pack.strings[ui]![`grammar_rule_${rule}`])]).toEqual([ui, rule, true]);
    }
    const expected = [...Object.keys(pack.choices?.ruleSets ?? {}), ...(pack.classifiers ? [pack.classifiers.rule] : [])];
    for (const rule of expected) expect([...rules]).toContain(rule);
  });

  (pack.classifiers ? it : it.skip)('has a measure question for every noun that takes a measure word', () => {
    const nouns = allEntries().filter(({ entry }) => entry.part_of_speech === 'noun' && entry.measure !== 'none');
    expect(nouns.length).toBeGreaterThan(0);
    for (const { entry } of nouns) {
      expect([entry.word, buildMeasureQuestion(entry, seeded()) !== null]).toEqual([entry.word, true]);
    }
  });
});

describe('daily word order', () => {
  it('never goes back a stage', () => {
    for (const level of pack.levels) {
      const stages = orderedBankForLevel(level, 'install-9').map((e) => e.stage ?? 0);
      expect(stages).toHaveLength(WORD_BANK[level].length);
      expect(stages).toEqual([...stages].sort((a, b) => a - b));
    }
  });
});
