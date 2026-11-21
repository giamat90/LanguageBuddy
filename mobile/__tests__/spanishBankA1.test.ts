import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { es } from '../src/languages/es';
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
const root = join(__dirname, '..');
const bank: Entry[] = JSON.parse(readFileSync(join(root, 'src', 'data', 'wordbank', 'es', 'A1.json'), 'utf8'));
const tsv = readFileSync(join(root, 'scripts', 'wordbank', 'es', 'A1.tsv'), 'utf8').split('\n').filter(Boolean);
const lang = JSON.parse(readFileSync(join(root, 'scripts', 'wordbank', 'es', 'language.json'), 'utf8'));

const share = (n: number) => n / bank.length;
const seeded = (): (() => number) => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

beforeAll(() => setActivePackForTests(es));
afterAll(() => setActivePackForTests(null));

describe('the Spanish A1 bank', () => {
  it('has 280–320 rows of 14 columns and no duplicates', () => {
    expect(bank.length).toBeGreaterThanOrEqual(280);
    expect(bank.length).toBeLessThanOrEqual(320);
    expect(tsv.every((l) => l.split('\t').length === 14)).toBe(true);
    expect(new Set(bank.map((e) => e.word.toLowerCase())).size).toBe(bank.length);
  });

  it('balances topics (≥ 8 % each) and nouns (40–50 %)', () => {
    const topics = ['food', 'travel', 'work', 'culture', 'home', 'leisure', 'health', 'shopping'];
    for (const t of topics) expect(share(bank.filter((e) => e.topic_domain === t).length)).toBeGreaterThanOrEqual(0.08);
    const nouns = share(bank.filter((e) => e.part_of_speech === 'noun').length);
    expect(nouns).toBeGreaterThanOrEqual(0.4);
    expect(nouns).toBeLessThanOrEqual(0.5);
  });

  it('has no empty text and keeps only A1 or earlier-level tags where it matters', () => {
    for (const e of bank) {
      for (const f of ['ipa', 'meaning_en', 'meaning_it', 'example_it', 'example_en', 'cultural_note', 'cultural_note_en'] as const) {
        expect(`${e.word}:${f}:${e[f].trim() !== ''}`).toBe(`${e.word}:${f}:true`);
      }
      expect(e.cefr_band).toBe('A1');
      expect(lang.ruleCodes).toContain(e.grammar_angle);
    }
  });

  it('uses no Spain-only form in an example', () => {
    const re = new RegExp(lang.exampleRules.forbidden.join('|'), 'iu');
    expect(bank.filter((e) => re.test(e.example)).map((e) => e.word)).toEqual([]);
  });

  it('has at most 20 SER_ESTAR sentences, each with exactly one verb form of one pair and never both', () => {
    const sets = es.choices!.ruleSets.SER_ESTAR;
    const tagged = bank.filter((e) => e.grammar_angle === 'SER_ESTAR');
    expect(tagged.length).toBeGreaterThan(0);
    expect(tagged.length).toBeLessThanOrEqual(20);
    for (const e of tagged) {
      const words = e.example.toLowerCase().split(/[^\p{L}]+/u);
      for (const pair of sets) {
        const hits = pair.filter((f) => words.includes(f));
        expect(`${e.word}:${hits.length <= 1}`).toBe(`${e.word}:true`);
      }
      expect(`${e.word}:${sets.some((p) => p.some((f) => words.includes(f)))}`).toBe(`${e.word}:true`);
      expect(words).not.toContain('fue');
    }
  });

  it('keeps POR_PARA and DIRECT_OBJECT_PRONOUN for A2', () => {
    expect(bank.filter((e) => ['POR_PARA', 'DIRECT_OBJECT_PRONOUN'].includes(e.grammar_angle))).toEqual([]);
  });
});

describe('the Spanish A1 bank works with the pack', () => {
  it('gives an article question for every noun, with the answer among the options', () => {
    for (const e of bank.filter((x) => x.part_of_speech === 'noun')) {
      const q = buildArticleQuestion(e, seeded(), es)!;
      expect(q).not.toBeNull();
      expect(q.options).toContain(q.answer);
      expect(['el', 'la']).toContain(q.answer);
    }
  });

  it('builds at least 100 exercise models and every choice question has its answer among the options', () => {
    let built = 0;
    for (const e of bank) {
      const card: ReviewCard = {
        id: e.word, word: e.word, article: e.article, translationIt: e.meaning_it, translationEn: e.meaning_en,
        example: e.example, exampleIt: e.example_it, exampleEn: e.example_en, partOfSpeech: e.part_of_speech,
        cefrBand: 'A1', topicDomain: e.topic_domain, grammarAngle: e.grammar_angle, timesSeen: 3, retentionScore: 0.7,
      };
      const cloze = buildCloze(e.example, e.word);
      const mistake = buildFindMistake(card, seeded(), es);
      const reorder = buildReorder(card, seeded());
      if (cloze || mistake || reorder) built++;
      if (mistake) {
        expect(mistake.options).toContain(mistake.tokens[mistake.wrongIndex] === mistake.correctToken ? mistake.correctToken : mistake.options[mistake.correctOption]);
        expect(mistake.tokens[mistake.wrongIndex]).not.toBe(mistake.correctToken);
      }
      if (choiceRules(es).includes(e.grammar_angle)) {
        const q = buildChoiceQuestion(e, seeded(), es)!;
        expect(q).not.toBeNull();
        expect(q.options).toContain(q.answer);
      }
    }
    expect(built).toBeGreaterThanOrEqual(100);
  });

  it('grades every word of the bank as exact when typed back and close without accents', () => {
    for (const e of bank) {
      expect(gradeTypedAnswer(e.word, e.word)).toBe('exact');
      expect(gradeTypedAnswer(es.fold(e.word), e.word)).not.toBe('wrong');
    }
  });
});
