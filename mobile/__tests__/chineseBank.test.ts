/** TASK-073 and TASK-077: the Chinese A1 bank and its character table. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { zh } from '../src/languages/zh';
import { buildCloze } from '../src/lib/cloze';
import { buildChoiceCloze, buildMeasureQuestion } from '../src/lib/grammar';
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

describe('the Chinese A1 bank', () => {
  beforeAll(() => setActivePackForTests(zh));
  afterAll(() => setActivePackForTests(null));

  it('is no longer a draft', () => expect(cfg.draft).toBeUndefined());

  it('has 300 different words, in every topic, with at least 40 in every stage', () => {
    const all = bank();
    expect(all).toHaveLength(300);
    expect(new Set(all.map((e) => e.word)).size).toBe(300);
    expect([...new Set(all.map((e) => e.topic_domain))].sort()).toEqual([...TOPIC_KEYS].sort());
    expect([...new Set(all.map((e) => e.stage))].sort()).toEqual([1, 2, 3, 4]);
    for (const stage of [1, 2, 3, 4]) {
      expect([stage, all.filter((e) => e.stage === stage).length >= 40]).toEqual([stage, true]);
    }
    for (const topic of TOPIC_KEYS) {
      expect([topic, all.filter((e) => e.topic_domain === topic).length >= 10]).toEqual([topic, true]);
    }
  });

  // Saved words are keyed by the word itself: a renamed pilot word would orphan a learner's vault entry.
  it('keeps every pilot word', () => {
    const pilot = ('我 你 他 是 有 在 人 好 很 不 吗 什么 两 去 吃 喝 看 喜欢 想 买 学习 工作 睡觉 朋友 老师 学生 妈妈 爸爸 家 书 '
      + '水 茶 米饭 苹果 学校 商店 医院 医生 电脑 电话 电影 中国 钱 衣服 今天 大 小 多 高兴 热').split(' ');
    const words = new Set(bank().map((e) => e.word));
    expect(pilot.filter((w) => !words.has(w))).toEqual([]);
  });

  it('gives every word its own sentence', () => {
    const examples = bank().map((e) => e.example);
    expect(examples.filter((x, i) => examples.indexOf(x) !== i)).toEqual([]);
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
    const caps: Record<string, number> = { SHI_ZAI_YOU: 20, QUESTION_PARTICLE: 12, ER_LIANG: 8, BU_MEI: 15 };
    for (const [rule, cap] of Object.entries(caps)) {
      const n = tagged.filter((e) => e.grammar_angle === rule).length;
      expect([rule, n >= 4 && n <= cap, n]).toEqual([rule, true, n]);
    }
    for (const e of tagged) expect([e.word, buildChoiceCloze(e.example, e.grammar_angle, pack, e.segments) !== null]).toEqual([e.word, true]);
  });

  it('gives every listed measure word its pinyin in the app', () => {
    for (const m of cfg.measureWords) expect([m, zh.classifiers!.readings[m]]).toEqual([m, expect.any(String)]);
  });

  // 些 is the plural "some" and goes with any noun, so it is not a noun's measure word.
  it('lists for each noun every measure word the bank itself puts before it', () => {
    const all = bank();
    const nouns = new Map(all.filter((e) => e.part_of_speech === 'noun').map((e) => [e.word, e]));
    const measures = new Set<string>(cfg.measureWords.filter((m: string) => m !== '些'));
    const unlisted: string[] = [];
    for (const e of all) {
      const s = e.segments!;
      // A number or demonstrative makes it a measure word (门外 is "outside the door"), and a noun followed
      // by another noun only describes it (一本中文书 counts the book).
      for (let i = 1; i + 1 < s.length; i++) {
        const noun = nouns.get(s[i + 1]);
        if (!noun || !measures.has(s[i]) || !zh.classifiers!.determiners.includes(s[i - 1]) || nouns.has(s[i + 2])) continue;
        if (![noun.measure, ...(noun.measure_also ?? [])].includes(s[i])) unlisted.push(`${s[i]}${noun.word} in ${e.word}`);
      }
    }
    expect(unlisted).toEqual([]);
  });

  // The drill offers other measure words as wrong answers, so none of these may be missing.
  it.each([
    ['书', '本 部'], ['车', '辆 台'], ['出租车', '辆 台'], ['火车', '列 辆'], ['电视', '台 部'], ['电脑', '台'], ['手机', '部 台 只'],
    ['狗', '只 条'], ['猫', '只'], ['椅子', '把 张'], ['杯子', '个 只'], ['鸡蛋', '个 只'], ['苹果', '个 只'], ['衣服', '件 套'],
    ['老师', '位 个 名'], ['医生', '位 个 名'], ['朋友', '个 位'], ['面条儿', '碗 根'], ['商店', '家 个 间'], ['歌', '首 支'],
  ])('knows the measure words of %s', (word, expected) => {
    const e = bank().find((x) => x.word === word)!;
    const listed = [e?.measure, ...(e?.measure_also ?? [])];
    expect(expected.split(' ').filter((m) => !listed.includes(m))).toEqual([]);
  });

  it('can ask the measure word of at least 40 nouns', () => {
    const questions = bank().filter((e) => buildMeasureQuestion(e, () => 0.4, zh) !== null);
    expect(questions.length).toBeGreaterThanOrEqual(40);
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
