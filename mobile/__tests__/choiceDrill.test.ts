import { es } from '../src/languages/es';
import { de } from '../src/languages/de';
import { setActivePackForTests } from '../src/languages';
import { buildChoiceCloze, buildChoiceQuestion, choiceOptions, choiceRules } from '../src/lib/grammar';

const sqlite = require('expo-sqlite');
const { _resetDbForTests } = require('../src/data/db');

afterEach(() => setActivePackForTests(null));
const seq = (...v: number[]): (() => number) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

describe('buildChoiceCloze', () => {
  it.each([
    ['Mi madre está cansada.', 'SER_ESTAR', 'está', 'Mi madre ', ' cansada.'],
    ['Somos amigos desde niños.', 'SER_ESTAR', 'somos', '', ' amigos desde niños.'],
    ['Trabajo para mi familia.', 'POR_PARA', 'para', 'Trabajo ', ' mi familia.'],
    ['Lo veo todos los días.', 'DIRECT_OBJECT_PRONOUN', 'lo', '', ' veo todos los días.'],
  ])('%s (%s)', (sentence, rule, answer, before, after) => {
    const c = buildChoiceCloze(sentence, rule, es)!;
    expect(c.answer).toBe(answer);
    expect(c.before).toBe(before);
    expect(c.after).toBe(after);
    expect(c.set).toContain(answer);
  });

  it('is null without a member, for an unknown rule and for a language without choices', () => {
    expect(buildChoiceCloze('Corro por el parque.', 'SER_ESTAR', es)).toBeNull();
    expect(buildChoiceCloze('Mi madre está cansada.', 'NEGATION_NO', es)).toBeNull();
    expect(buildChoiceCloze('Mi madre está cansada.', 'SER_ESTAR', de)).toBeNull();
    expect(buildChoiceCloze(null, 'SER_ESTAR', es)).toBeNull();
  });
});

describe('choiceOptions', () => {
  it('keeps a pair as it is', () => {
    expect([...choiceOptions('para', ['por', 'para'], () => 0.5)].sort()).toEqual(['para', 'por']);
  });
  it('trims a big set to the answer plus two others', () => {
    const o = choiceOptions('la', ['lo', 'la', 'los', 'las'], () => 0.1);
    expect(o).toHaveLength(3);
    expect(o).toContain('la');
    expect(new Set(o).size).toBe(3);
  });
  it('is deterministic for a seeded rng', () => {
    expect(choiceOptions('la', ['lo', 'la', 'los', 'las'], seq(0.2, 0.7, 0.4, 0.9))).toEqual(choiceOptions('la', ['lo', 'la', 'los', 'las'], seq(0.2, 0.7, 0.4, 0.9)));
  });
});

describe('buildChoiceQuestion', () => {
  const entry = { word: 'cansada', example: 'Mi madre está cansada.', example_it: 'Mia madre è stanca.', example_en: 'My mother is tired.', grammar_angle: 'SER_ESTAR', cefr_band: 'A1' };
  it('has the shape of a case question', () => {
    const q = buildChoiceQuestion(entry, () => 0.3, es)!;
    expect(q.id).toBe('choice:cansada');
    expect(q.ruleCode).toBe('SER_ESTAR');
    expect(q.answer).toBe('está');
    expect([...q.options].sort()).toEqual(['es', 'está']);
    expect(q.before).toBe('Mi madre ');
    expect(q.translationIt).toBe('Mia madre è stanca.');
    expect(q.cefrBand).toBe('A1');
  });
  it('capitalises a sentence-initial answer and its options', () => {
    const q = buildChoiceQuestion({ ...entry, word: 'x', example: 'Estoy en casa ahora.' }, () => 0.3, es)!;
    expect(q.answer).toBe('Estoy');
    expect(q.options).toContain('Soy');
  });
  it('is null for a language without choices or a rule it does not have', () => {
    expect(buildChoiceQuestion(entry, Math.random, de)).toBeNull();
    expect(buildChoiceQuestion({ ...entry, grammar_angle: 'DATIV_PREP' }, Math.random, es)).toBeNull();
  });
  it('choiceRules lists the rules of the pack', () => {
    expect(choiceRules(es).sort()).toEqual(['DIRECT_OBJECT_PRONOUN', 'POR_PARA', 'SER_ESTAR']);
    expect(choiceRules(de)).toEqual([]);
  });
});

describe('buildDrill follows the pack', () => {
  jest.isolateModules(() => {});
  it('under es yields only article and choice questions from a small bank', async () => {
    jest.resetModules();
    jest.doMock('../src/data/wordbank', () => ({
      CEFR_ORDER: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      WORD_BANK: {
        A1: [
          { word: 'casa', article: 'la', part_of_speech: 'noun', meaning_it: 'casa', meaning_en: 'house', example: 'La casa es grande.', example_it: 'La casa è grande.', example_en: 'The house is big.', grammar_angle: 'NOUN_GENDER', cefr_band: 'A1' },
          { word: 'cansada', article: null, part_of_speech: 'adj', meaning_it: 'stanca', meaning_en: 'tired', example: 'Mi madre está cansada.', example_it: 'x', example_en: 'y', grammar_angle: 'SER_ESTAR', cefr_band: 'A1' },
          { word: 'correr', article: null, part_of_speech: 'verb', meaning_it: 'correre', meaning_en: 'run', example: 'Corro por el parque.', example_it: 'x', example_en: 'y', grammar_angle: 'VERB_PRESENT_REGULAR', cefr_band: 'A1' },
        ],
        A2: [], B1: [], B2: [], C1: [], C2: [],
      },
      allEntries: () => [],
    }));
    const sqlite2 = require('expo-sqlite');
    const { _resetDbForTests: reset } = require('../src/data/db');
    const langs = require('../src/languages');
    const pack = require('../src/languages/es').es;
    const { buildDrill } = require('../src/services/grammarService');
    sqlite2.__reset(); reset();
    langs.setActivePackForTests(pack);
    const qs = await buildDrill('A1', 10);
    expect(qs.map((q: any) => q.ruleCode).sort()).toEqual(['NOUN_GENDER', 'SER_ESTAR']);
    langs.setActivePackForTests(null);
    jest.dontMock('../src/data/wordbank');
  });
});
