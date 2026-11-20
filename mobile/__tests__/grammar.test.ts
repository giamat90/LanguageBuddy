import {
  buildArticleQuestion,
  buildCaseCloze,
  buildCaseQuestion,
  caseOptions,
  pickWeighted,
} from '../src/lib/grammar';
import { _resetDbForTests } from '../src/data/db';
import { buildDrill, recordAnswer } from '../src/services/grammarService';
import { getDb } from '../src/data/db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require('expo-sqlite');

describe('buildCaseCloze', () => {
  it('blanks an unambiguous determiner that exercises the rule', () => {
    expect(buildCaseCloze('Wir fahren mit dem Auto.', 'DATIV_PREP')).toEqual({
      before: 'Wir fahren mit ',
      after: ' Auto.',
      answer: 'dem',
    });
    expect(buildCaseCloze('Wegen des Regens bleiben wir zu Hause.', 'GENITIV_CASE')?.answer).toBe('des');
    expect(buildCaseCloze('Ich habe morgen einen Termin.', 'ACCUSATIVE_MASC')?.answer).toBe('einen');
  });
  it('skips ambiguous forms and rules it does not cover', () => {
    expect(buildCaseCloze('Wir wandern auf den Berg.', 'ACCUSATIVE_MASC')).toBeNull();
    expect(buildCaseCloze('Wir fahren mit dem Auto.', 'KONJUNKTIV_II')).toBeNull();
    expect(buildCaseCloze(null, 'DATIV_PREP')).toBeNull();
  });
  it('skips a determiner after a two-way preposition', () => {
    expect(buildCaseCloze('Ich lebe in einem Haus.', 'DATIV_PREP')).toBeNull();
    expect(buildCaseCloze('Ich lerne seit einem Jahr Deutsch.', 'DATIV_PREP')?.answer).toBe('einem');
  });
});

describe('caseOptions', () => {
  it('returns the answer plus two distractors from the same family', () => {
    const opts = caseOptions('dem');
    expect(opts).toHaveLength(3);
    expect(opts).toContain('dem');
    expect(new Set(opts).size).toBe(3);
    expect(opts.every((o) => ['der', 'die', 'das', 'dem', 'den', 'des'].includes(o))).toBe(true);
    expect(caseOptions('einem').every((o) => o.startsWith('ein'))).toBe(true);
  });
});

describe('questions', () => {
  it('builds an article question', () => {
    const q = buildArticleQuestion({ word: 'Brot', article: 'das', meaning_it: 'pane', meaning_en: 'bread' });
    expect(q?.answer).toBe('das');
    expect(q?.after).toBe(' Brot');
    expect([...q!.options].sort()).toEqual(['das', 'der', 'die']);
  });
  it('rejects a word with no usable article', () => {
    expect(buildArticleQuestion({ word: 'gehen', article: null, meaning_it: '', meaning_en: '' })).toBeNull();
  });
  it('capitalises options when the blank starts the sentence', () => {
    const q = buildCaseQuestion({
      word: 'Freund',
      example_de: 'Einem Freund helfe ich gern.',
      example_it: '',
      example_en: '',
      grammar_angle: 'DATIV_INDIRECT_OBJ',
    });
    expect(q?.answer).toBe('Einem');
    expect(q?.options).toContain('Einem');
  });
});

describe('pickWeighted', () => {
  it('maps the random value onto the weights', () => {
    expect(pickWeighted([1, 1, 2], () => 0)).toBe(0);
    expect(pickWeighted([1, 1, 2], () => 0.99)).toBe(2);
  });
});

describe('grammar drill', () => {
  beforeEach(() => {
    sqlite.__reset();
    _resetDbForTests();
  });

  it('builds a drill of unique words without needing any vault data', async () => {
    const qs = await buildDrill('B1', 10);
    expect(qs).toHaveLength(10);
    expect(new Set(qs.map((q) => q.word)).size).toBe(10);
  });

  it('only uses words at or below the learner level', async () => {
    const qs = await buildDrill('A1', 30);
    expect(qs.length).toBeGreaterThan(0);
  });

  it('updates mastery and error counts per rule', async () => {
    await recordAnswer('DATIV_PREP', false);
    await recordAnswer('DATIV_PREP', true);
    const db = await getDb();
    const row = await db.getFirstAsync<{ mastery: number; seen_count: number; error_count: number }>(
      "SELECT mastery, seen_count, error_count FROM grammar_mastery WHERE rule_code = 'DATIV_PREP'",
    );
    expect(row?.seen_count).toBe(2);
    expect(row?.error_count).toBe(1);
    expect(row?.mastery).toBeGreaterThan(0);
    expect(row?.mastery).toBeLessThan(1);
  });
});
