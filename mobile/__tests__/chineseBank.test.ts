/** TASK-073: the Chinese pilot bank (50 A1 words) and its character table. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { zh } from '../src/languages/zh';
import { buildCloze } from '../src/lib/cloze';
import { buildChoiceCloze } from '../src/lib/grammar';
import { setActivePackForTests } from '../src/languages';
import { buildReorder } from '../src/lib/exercises/reorder';
import { sentenceTokens, joinTokens } from '../src/lib/sentence';
import { TOPIC_KEYS } from '../src/lib/topics';
import type { WordBankEntry } from '../src/data/wordbank';
import type { ReviewCard } from '../src/services/reviewService';

const root = join(__dirname, '..');
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const cfg = read('scripts/wordbank/zh/language.json');
const bank = (): WordBankEntry[] => read('src/data/wordbank/zh/A1.json');
const characters = (): { char: string; meaning_en: string; meaning_it: string }[] => read('src/data/wordbank/zh/characters.json');
const HAN = /^[㐀-鿿]+$/;
const words = (e: WordBankEntry) => e.segments!.filter((s) => HAN.test(s));

const card = (e: WordBankEntry): ReviewCard => ({
  id: e.word, word: e.word, article: null, translationIt: e.meaning_it, translationEn: e.meaning_en,
  example: e.example, segments: e.segments, exampleIt: e.example_it, exampleEn: e.example_en, partOfSpeech: e.part_of_speech,
  cefrBand: 'A1', topicDomain: e.topic_domain, grammarAngle: e.grammar_angle, timesSeen: 3, retentionScore: 0.7,
});

describe('the Chinese pilot', () => {
  beforeAll(() => setActivePackForTests(zh));
  afterAll(() => setActivePackForTests(null));

  it('is no longer a draft', () => expect(cfg.draft).toBeUndefined());

  it('has 50 different words, in every topic and every stage', () => {
    const all = bank();
    expect(all).toHaveLength(50);
    expect(new Set(all.map((e) => e.word)).size).toBe(50);
    expect([...new Set(all.map((e) => e.topic_domain))].sort()).toEqual([...TOPIC_KEYS].sort());
    expect([...new Set(all.map((e) => e.stage))].sort()).toEqual([1, 2, 3, 4]);
    expect(all.filter((e) => e.topic_domain === 'food').length).toBeGreaterThanOrEqual(3);
  });

  it('gives every word a sentence that can be reordered and filled in', () => {
    for (const e of bank()) {
      expect([e.word, sentenceTokens(e.example, e.segments, zh).length > 0]).toEqual([e.word, true]);
      expect(joinTokens(sentenceTokens(e.example, e.segments, zh), zh)).toBe(e.example);
      const cloze = buildCloze(e.example, e.word, zh, e.segments);
      expect([e.word, cloze && cloze.before + e.word + cloze.after]).toEqual([e.word, e.example]);
      expect([e.word, buildReorder(card(e), () => 0.4) !== null]).toEqual([e.word, true]);
    }
  });

  it('uses every word it allows besides its headwords', () => {
    const used = new Set(bank().flatMap(words));
    const heads = new Set(bank().map((e) => e.word));
    expect(cfg.segmented.allow.filter((w: string) => !used.has(w))).toEqual([]);
    expect(cfg.segmented.allow.filter((w: string) => heads.has(w))).toEqual([]);
  });

  it('tags choice rules only where a blank can be made', () => {
    const sets = Object.fromEntries(Object.entries(cfg.ruleChecks).map(([k, v]: [string, any]) => [k, [v.exactlyOneOf]]));
    const pack = { ...zh, choices: { ruleSets: sets } };
    const tagged = bank().filter((e) => e.grammar_angle in sets);
    expect(tagged.length).toBeGreaterThanOrEqual(8);
    for (const e of tagged) expect([e.word, buildChoiceCloze(e.example, e.grammar_angle, pack, e.segments) !== null]).toEqual([e.word, true]);
  });

  it('writes pinyin with tone marks, never digits, and keeps punctuation Chinese', () => {
    for (const e of bank()) {
      expect([e.word, /[0-9]/.test(e.ipa + e.example_pinyin)]).toEqual([e.word, false]);
      expect([e.word, /[.?!,]/.test(e.example)]).toEqual([e.word, false]);
    }
  });

  it('has one row for each character it uses, and no other', () => {
    const used = new Set<string>();
    for (const e of bank()) {
      const measures = [e.measure, ...(e.measure_also ?? [])].filter((m): m is string => !!m && m !== 'none');
      for (const c of [e.word, ...words(e), ...measures].join('')) used.add(c);
    }
    expect(characters().map((c) => c.char).sort()).toEqual([...used].sort());
  });

  it('has Italian and English meanings that differ from the characters', () => {
    for (const c of characters()) expect([c.char, c.meaning_en.length > 0 && c.meaning_it.length > 0]).toEqual([c.char, true]);
    for (const e of bank()) {
      for (const f of ['meaning_it', 'meaning_en', 'example_it', 'example_en', 'cultural_note', 'cultural_note_en'] as const) {
        expect([e.word, f, e[f].trim().length > 0]).toEqual([e.word, f, true]);
      }
      expect([e.word, e.cultural_note !== e.cultural_note_en]).toEqual([e.word, true]);
    }
  });
});
