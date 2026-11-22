import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fr } from '../src/languages/fr';
import { setActivePackForTests } from '../src/languages';
import { buildArticleQuestion, buildChoiceQuestion, choiceRules } from '../src/lib/grammar';
import { buildCloze, gradeTypedAnswer } from '../src/lib/cloze';
import { buildFindMistake } from '../src/lib/exercises/mistake';
import { buildReorder } from '../src/lib/exercises/reorder';
import type { ReviewCard } from '../src/services/reviewService';

interface Entry {
  word: string; article: string | null; part_of_speech: string; ipa: string; meaning_en: string; meaning_it: string;
  example: string; example_it: string; example_en: string; cultural_note: string; cultural_note_en: string;
  grammar_angle: string; topic_domain: string; cefr_band: string;
}
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const TOPICS = ['food', 'travel', 'work', 'culture', 'home', 'leisure', 'health', 'shopping'];
const root = join(__dirname, '..');
const lang = JSON.parse(readFileSync(join(root, 'scripts', 'wordbank', 'fr', 'language.json'), 'utf8'));
const banks: Record<string, Entry[]> = {};
const tsvs: Record<string, string[]> = {};
for (const lv of LEVELS) {
  banks[lv] = JSON.parse(readFileSync(join(root, 'src', 'data', 'wordbank', 'fr', `${lv}.json`), 'utf8'));
  tsvs[lv] = readFileSync(join(root, 'scripts', 'wordbank', 'fr', `${lv}.tsv`), 'utf8').split('\n').filter(Boolean);
}
const all: Entry[] = LEVELS.flatMap((lv) => banks[lv]);

const seeded = (): (() => number) => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
const count = (bank: Entry[], rule: string) => bank.filter((e) => e.grammar_angle === rule).length;
const capAux: Record<string, number> = { A1: 0, A2: 20, B1: 20, B2: 10, C1: 10, C2: 10 };
const capDop: Record<string, number> = { A1: 0, A2: 15, B1: 15, B2: 0, C1: 0, C2: 0 };
const capRel: Record<string, number> = { A1: 0, A2: 0, B1: 15, B2: 15, C1: 0, C2: 0 };
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').toLowerCase();

beforeAll(() => setActivePackForTests(fr));
afterAll(() => setActivePackForTests(null));

describe('language.json of French', () => {
  it('has all six levels', () => {
    expect(lang.levels).toEqual([...LEVELS]);
  });
});

describe.each(LEVELS)('the French %s bank', (lv) => {
  const bank = banks[lv];
  const share = (n: number) => n / bank.length;

  it('has 270–340 rows of 14 columns, one CEFR band and no duplicates', () => {
    expect(bank.length).toBeGreaterThanOrEqual(270);
    expect(bank.length).toBeLessThanOrEqual(340);
    expect(tsvs[lv].every((l) => l.split('\t').length === 14)).toBe(true);
    expect(new Set(bank.map((e) => e.word.toLowerCase())).size).toBe(bank.length);
    expect(bank.every((e) => e.cefr_band === lv)).toBe(true);
  });

  it('balances topics (≥ 7 % each) and nouns (35–50 %)', () => {
    for (const t of TOPICS) expect(share(bank.filter((e) => e.topic_domain === t).length)).toBeGreaterThanOrEqual(0.07);
    const nouns = share(bank.filter((e) => e.part_of_speech === 'noun').length);
    expect(nouns).toBeGreaterThanOrEqual(0.35);
    expect(nouns).toBeLessThanOrEqual(0.5);
  });

  it('has no empty or placeholder text, no curly apostrophe and the no-break space before ? ! : ;', () => {
    for (const e of bank) {
      for (const f of ['ipa', 'meaning_en', 'meaning_it', 'example', 'example_it', 'example_en', 'cultural_note', 'cultural_note_en'] as const) {
        expect(`${e.word}:${f}:${e[f].trim() !== ''}`).toBe(`${e.word}:${f}:true`);
        expect(/TODO|XXX|\?\?\?|<NB>/.test(e[f])).toBe(false);
        expect(e[f].includes('’')).toBe(false);
      }
      expect(e.ipa).not.toMatch(/[\\/]/);
      expect(e.ipa.includes('ʀ')).toBe(false); // the uvular trill is written ʁ
      expect(/[^ ][?!:;]/.test(e.example.replace(/[?!:;]$/, ''))).toBe(false);
    }
  });

  it('only tags a rule that this level allows', () => {
    const allowed: string[] = lang.levelRules[lv].allowedCodes;
    expect(bank.filter((e) => !allowed.includes(e.grammar_angle)).map((e) => `${e.word}:${e.grammar_angle}`)).toEqual([]);
  });

  it('keeps the choice-drill rules within their caps', () => {
    expect(count(bank, 'AUXILIARY_AVOIR_ETRE')).toBeLessThanOrEqual(capAux[lv]);
    expect(count(bank, 'DIRECT_OBJECT_PRONOUN')).toBeLessThanOrEqual(capDop[lv]);
    expect(count(bank, 'RELATIVE_QUI_QUE')).toBeLessThanOrEqual(capRel[lv]);
  });

  it('gives an article question for every noun, with the answer among the options', () => {
    for (const e of bank.filter((x) => x.part_of_speech === 'noun')) {
      const q = buildArticleQuestion(e, seeded(), fr)!;
      expect(q).not.toBeNull();
      expect(q.options).toContain(q.answer);
      expect(['le', 'la']).toContain(q.answer);
    }
  });

  it('builds at least 100 exercise models and every choice question has its answer among the options', () => {
    let built = 0;
    for (const e of bank) {
      const card: ReviewCard = {
        id: e.word, word: e.word, article: e.article, translationIt: e.meaning_it, translationEn: e.meaning_en,
        example: e.example, exampleIt: e.example_it, exampleEn: e.example_en, partOfSpeech: e.part_of_speech,
        cefrBand: lv, topicDomain: e.topic_domain, grammarAngle: e.grammar_angle, timesSeen: 3, retentionScore: 0.7,
      };
      const cloze = buildCloze(e.example, e.word);
      const mistake = buildFindMistake(card, seeded(), fr);
      const reorder = buildReorder(card, seeded());
      if (cloze || mistake || reorder) built++;
      if (mistake) expect(mistake.tokens[mistake.wrongIndex]).not.toBe(mistake.correctToken);
      if (choiceRules(fr).includes(e.grammar_angle)) {
        const q = buildChoiceQuestion(e, seeded(), fr)!;
        expect(q).not.toBeNull();
        expect(q.options).toContain(q.answer);
      }
    }
    expect(built).toBeGreaterThanOrEqual(100);
  });

  it('grades every word as exact when typed back and not wrong without accents', () => {
    for (const e of bank) {
      expect(gradeTypedAnswer(e.word, e.word)).toBe('exact');
      expect(gradeTypedAnswer(fr.fold(e.word), e.word)).not.toBe('wrong');
    }
  });
});

describe('the whole French bank', () => {
  it('has about 1,800+ words and no word in two levels, even when only the accents differ', () => {
    expect(all.length).toBeGreaterThanOrEqual(1800);
    expect(new Set(all.map((e) => e.word.toLowerCase())).size).toBe(all.length);
    expect(new Set(all.map((e) => fold(e.word))).size).toBe(all.length);
  });

  it('keeps A1 free of the later choice rules', () => {
    expect(banks.A1.filter((e) => ['AUXILIARY_AVOIR_ETRE', 'DIRECT_OBJECT_PRONOUN', 'RELATIVE_QUI_QUE'].includes(e.grammar_angle))).toEqual([]);
  });
});
