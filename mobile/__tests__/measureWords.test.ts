/** TASK-076: the measure-word drill and mistake slot, and the Chinese choice rules. */
import { zh } from '../src/languages/zh';
import { de } from '../src/languages/de';
import { es } from '../src/languages/es';
import { fr } from '../src/languages/fr';
import { setActivePackForTests } from '../src/languages';
import { testPack } from '../test-support/testPack';
import { testPackCjk } from '../test-support/testPackCjk';
import { buildMeasureQuestion, buildChoiceQuestion, hasGrammarDrill, choiceRules } from '../src/lib/grammar';
import { buildFindMistake } from '../src/lib/exercises/mistake';
import { practiceFormats } from '../src/lib/exercises';
import { neutralCells } from '../src/lib/reading/ruby';
import type { ReviewCard } from '../src/services/reviewService';
import bank from '../src/data/wordbank/zh/A1.json';
import type { WordBankEntry } from '../src/data/wordbank';

const words = bank as unknown as WordBankEntry[];
const find = (w: string) => words.find((e) => e.word === w)!;
const seeded = (seed: number) => {
  // Spread the seeds: neighbouring ones would otherwise start with nearly the same number.
  let x = Math.imul(seed + 1, 2654435761) >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
};
const acceptable = (e: { measure?: string | null; measure_also?: string[] }) =>
  [e.measure, ...(e.measure_also ?? []), ...zh.classifiers!.never];

afterEach(() => setActivePackForTests(null));

describe('packs', () => {
  it('only Chinese has measure words and a primer', () => {
    expect(zh.classifiers!.rule).toBe('MEASURE_WORD');
    expect(zh.classifiers!.never).toEqual(['个']);
    expect(zh.primer).not.toBeNull();
    for (const p of [de, es, fr, testPack, testPackCjk]) {
      expect(p.classifiers).toBeNull();
      expect(p.primer).toBeNull();
    }
  });

  it('Chinese has the four choice rules, each form with its pinyin', () => {
    expect(choiceRules(zh)).toEqual(['SHI_ZAI_YOU', 'QUESTION_PARTICLE', 'ER_LIANG', 'BU_MEI']);
    for (const sets of Object.values(zh.choices!.ruleSets)) {
      for (const form of sets.flat()) expect(zh.choices!.readings![form]).toBeTruthy();
    }
  });

  it('has a grammar drill and the find-the-mistake format', () => {
    expect(hasGrammarDrill(zh)).toBe(true);
    expect(hasGrammarDrill({ ...zh, choices: null })).toBe(true);
    expect(hasGrammarDrill({ ...zh, choices: null, classifiers: null })).toBe(false);
    expect(practiceFormats(zh)).toContain('find_mistake');
    expect(practiceFormats({ ...zh, choices: null })).toContain('find_mistake');
  });
});

describe('the bank and the pack agree', () => {
  it('every measure word of the bank has its pinyin', () => {
    for (const e of words) {
      for (const m of [e.measure, ...(e.measure_also ?? [])]) {
        if (m && m !== 'none') expect([m, zh.classifiers!.readings[m]]).toEqual([m, expect.any(String)]);
      }
    }
  });
  it('every distractor has its pinyin and is not the general one', () => {
    for (const d of zh.classifiers!.distractors) {
      expect(zh.classifiers!.readings[d]).toBeTruthy();
      expect(zh.classifiers!.never).not.toContain(d);
    }
  });
});

describe('buildMeasureQuestion', () => {
  const book = find('书'); // 本, also 部

  it('asks for the measure word between 一 and the noun', () => {
    const q = buildMeasureQuestion(book, seeded(1), zh)!;
    expect([q.before, q.answer, q.after, q.ruleCode, q.word]).toEqual(['一', '本', '书', 'MEASURE_WORD', '书']);
    expect(q.translationIt).toBe(book.meaning_it);
    expect(q.options).toHaveLength(3);
    expect(q.options).toContain('本');
    for (const o of q.options.filter((x) => x !== '本')) expect(acceptable(book)).not.toContain(o);
    expect(q.blank).toBe(1);
    expect(q.cells!.map((c) => c.word)).toEqual(['一', '本', '书']);
    expect(q.cells!.map((c) => c.pinyin)).toEqual(['yī', 'běn', 'shū']);
    expect(q.optionReadings).toEqual(q.options.map((o) => zh.classifiers!.readings[o]));
  });

  it('writes 一 in its citation tone whatever the answer', () => {
    for (const w of ['书', '医生', '衣服']) expect(buildMeasureQuestion(find(w), seeded(2), zh)!.cells![0].pinyin).toBe('yī');
  });

  it('never offers a second right answer, over the whole bank', () => {
    let built = 0;
    for (const e of words) {
      for (let seed = 0; seed < 30; seed++) {
        const q = buildMeasureQuestion(e, seeded(seed), zh);
        if (!q) continue;
        built++;
        expect(new Set(q.options).size).toBe(3);
        for (const o of q.options.filter((x) => x !== q.answer)) expect(acceptable(e)).not.toContain(o);
      }
    }
    expect(built).toBeGreaterThan(300);
  });

  it('never offers the general word, even if a pack lists it as a distractor', () => {
    const careless = { ...zh, classifiers: { ...zh.classifiers!, distractors: ['个', '张', '条'] } };
    for (let seed = 0; seed < 10; seed++) expect(buildMeasureQuestion(book, seeded(seed), careless)!.options).not.toContain('个');
  });

  it('asks nothing without a usable measure word', () => {
    expect(buildMeasureQuestion(find('中国'), seeded(1), zh)).toBeNull(); // none
    expect(buildMeasureQuestion(find('吃'), seeded(1), zh)).toBeNull(); // not a noun
    expect(buildMeasureQuestion({ ...book, measure: '栋' }, seeded(1), zh)).toBeNull(); // unknown reading
    expect(buildMeasureQuestion(book, seeded(1), de)).toBeNull();
    const few = { ...zh, classifiers: { ...zh.classifiers!, distractors: ['本', '张'] } };
    expect(buildMeasureQuestion(book, seeded(1), few)).toBeNull();
  });
});

describe('choice questions in Chinese', () => {
  it('carries the sentence cells with the blank, and the options’ pinyin', () => {
    const entry = words.find((e) => e.grammar_angle === 'BU_MEI' && e.word === '不')!; // 爸爸不喜欢看书。
    const q = buildChoiceQuestion(entry, seeded(1), zh)!;
    expect(q.answer).toBe('不');
    expect(q.cells![q.blank!].word).toBe('不');
    expect([...q.options].sort()).toEqual(['不', '没']);
    expect(q.optionReadings).toEqual(q.options.map((o) => zh.choices!.readings![o]));
  });

  it('neutralises 一 or 不 right before the blank', () => {
    const entry = {
      word: '是', example: '我不是老师。', segments: ['我', '不', '是', '老师', '。'],
      example_pinyin: 'Wǒ bú shì lǎoshī', example_it: 'x', example_en: 'x', grammar_angle: 'SHI_ZAI_YOU',
    };
    const q = buildChoiceQuestion(entry, seeded(1), zh)!;
    expect(q.cells!.map((c) => c.pinyin)).toEqual(['Wǒ', 'bù', 'shì', 'lǎoshī']);
  });

  it('adds no cells for a language without a reading layer', () => {
    const entry = { word: 'ser', example: 'Yo soy alto.', example_it: 'x', example_en: 'x', grammar_angle: 'SER_ESTAR' };
    expect(buildChoiceQuestion(entry, seeded(1), testPack)?.cells).toBeUndefined();
  });
});

describe('neutralCells', () => {
  const cells = ['我', '一', '不', '去'].map((word, i) => ({ word, lead: '', trail: '', pinyin: ['wǒ', 'yí', 'bú', 'qù'][i] }));
  const cit = { 一: 'yī', 不: 'bù' };
  it('rewrites only the cell before a position', () => {
    expect(neutralCells(cells, cit, 3).map((c) => c.pinyin)).toEqual(['wǒ', 'yí', 'bù', 'qù']);
    expect(neutralCells(cells, cit, 0)).toEqual(cells);
  });
  it('rewrites every such cell without a position', () => {
    expect(neutralCells(cells, cit).map((c) => c.pinyin)).toEqual(['wǒ', 'yī', 'bù', 'qù']);
  });
  it('leaves the original alone', () => {
    neutralCells(cells, cit);
    expect(cells[1].pinyin).toBe('yí');
  });
});

describe('find the mistake: measure word slot', () => {
  const card = (over: Partial<ReviewCard> = {}): ReviewCard => ({
    id: '1', word: '书', article: null, translationIt: 'libro', translationEn: 'book',
    example: '他有一本书。', segments: ['他', '有', '一', '本', '书', '。'], exampleIt: 'x', exampleEn: 'x',
    partOfSpeech: 'noun', cefrBand: 'A1', grammarAngle: 'WORD_ORDER', timesSeen: 6, retentionScore: 0.9,
    measure: '本', measureAlso: ['部'], ...over,
  });

  it('replaces the measure word by one the noun never takes', () => {
    for (let seed = 0; seed < 30; seed++) {
      const model = buildFindMistake(card(), seeded(seed), zh)!;
      expect(model.mistakeKind).toBe('measure');
      expect(model.ruleCode).toBe('MEASURE_WORD');
      expect(model.wrongIndex).toBe(3);
      expect(model.correctToken).toBe('本');
      expect(['本', '部', '个']).not.toContain(model.tokens[3]);
      expect(model.options).toHaveLength(3);
      expect(model.options[model.correctOption]).toBe('本');
      for (const o of model.options.filter((x) => x !== '本')) expect(['部', '个']).not.toContain(o);
    }
  });

  it('also takes a listed second measure word, and 个', () => {
    const also = buildFindMistake(card({ example: '他有一部书。', segments: ['他', '有', '一', '部', '书', '。'] }), seeded(1), zh)!;
    expect(also.correctToken).toBe('部');
    expect(also.options[also.correctOption]).toBe('部');
    expect(also.options).not.toContain('本');
  });

  it.each([
    ['no number or demonstrative before it', { example: '他有本书。', segments: ['他', '有', '本', '书', '。'] }],
    ['a word between it and the noun', { example: '一本好书很大。', segments: ['一', '本', '好', '书', '很', '大', '。'] }],
    ['a noun without a measure word', { measure: 'none', measureAlso: [] }],
    ['a word that is not a noun', { partOfSpeech: 'verb' }],
    ['no measure data', { measure: undefined, measureAlso: undefined }],
  ])('builds nothing with %s', (_why, over) => {
    expect(buildFindMistake(card(over as Partial<ReviewCard>), seeded(1), zh)).toBeNull();
  });

  it('builds a choice slot for a tagged sentence', () => {
    const model = buildFindMistake(
      card({ word: '他', partOfSpeech: 'pron', measure: null, grammarAngle: 'SHI_ZAI_YOU', example: '他是我的老师。', segments: ['他', '是', '我', '的', '老师', '。'] }),
      seeded(1), zh,
    )!;
    expect(model.mistakeKind).toBe('choice');
    expect(['在', '有']).toContain(model.tokens[1]);
  });

  it('does nothing for German', () => {
    expect(buildFindMistake(card(), seeded(1), de)).toBeNull();
  });
});
