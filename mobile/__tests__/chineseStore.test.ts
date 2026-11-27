/** TASK-078: ChineseBuddy's public pages and Play listing, an app with one level and two UI languages. */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zh } from '../src/languages/zh';
import { setActivePackForTests } from '../src/languages';
import { buildCloze } from '../src/lib/cloze';
import { buildChoiceCloze, buildMeasureQuestion } from '../src/lib/grammar';
import { buildReorder } from '../src/lib/exercises/reorder';
import { practiceFormats } from '../src/lib/exercises';
import type { WordBankEntry } from '../src/data/wordbank';
import type { ReviewCard } from '../src/services/reviewService';
/* eslint-disable @typescript-eslint/no-var-requires */
const store = require('../scripts/lib/store.js');

const repo = join(__dirname, '..', '..');
const listingDir = join(repo, 'store', 'zh', 'listing');
const PAGES = ['privacy-policy.html', 'terms-of-service.html', 'contact.html', 'delete-account.html'];
const bank: WordBankEntry[] = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'data', 'wordbank', 'zh', 'A1.json'), 'utf8'));
const read = (ui: string) => JSON.parse(readFileSync(join(listingDir, `${ui}.json`), 'utf8'));
const dirs: string[] = [];

function build(code: string) {
  const out = mkdtempSync(join(tmpdir(), 'store-zh-'));
  dirs.push(out);
  const r = spawnSync(process.execPath, [join(__dirname, '..', 'scripts', 'build-store.mjs'), code, '--out', out], { encoding: 'utf8' });
  return { ...r, out };
}
const page = (out: string, name: string) => readFileSync(join(out, 'support', name), 'utf8');

beforeAll(() => setActivePackForTests(zh));
afterAll(() => {
  setActivePackForTests(null);
  dirs.forEach((d) => rmSync(d, { recursive: true, force: true }));
});

describe('levelRange', () => {
  it('writes one level alone and several as first to last', () => {
    expect(store.levelRange(['A1'])).toBe('A1');
    expect(store.levelRange(['A1', 'A2', 'B1'])).toBe('A1–B1');
  });
});

describe('the Chinese public pages', () => {
  let r: ReturnType<typeof build>;
  beforeAll(() => { r = build('zh'); });

  it('are built, with the listings and the app icon', () => {
    expect([r.status, r.stderr]).toEqual([0, '']);
    expect(readdirSync(join(r.out, 'support')).sort()).toEqual([...PAGES, 'icon.png'].sort());
    expect(readdirSync(join(r.out, 'listing')).sort()).toEqual(['en', 'it']);
    expect(existsSync(join(r.out, 'STATUS.txt'))).toBe(true);
    expect(readFileSync(join(r.out, 'support', 'icon.png')).equals(readFileSync(join(__dirname, '..', 'assets', 'icon-zh.png')))).toBe(true);
  });

  it('name this app and its language only, in its colours', () => {
    for (const f of PAGES) {
      const html = page(r.out, f);
      expect(html).not.toContain('{{');
      expect(html).toContain('ChineseBuddy');
      expect(html).not.toMatch(/german|spanish|french/i);
      expect(html).toContain('--primary: #0F6B50');
    }
  });

  it('say the app has level A1 only; the other apps still say A1–C2', () => {
    expect(page(r.out, 'privacy-policy.html')).toContain('your CEFR level (A1) and');
    expect(page(r.out, 'privacy-policy.html')).not.toContain('C2');
    expect(page(build('es').out, 'privacy-policy.html')).toContain('your CEFR level (A1–C2) and');
  });
});

describe('the Chinese listing', () => {
  const values = () => store.tokenValues({
    variant: { name: 'ChineseBuddy', code: 'zh', slug: 'chinesebuddy' }, targetName: 'Chinese',
    support: store.loadSupport('zh'), wordCount: bank.length, uiLangCount: zh.uiLanguages.length, levels: ['A1'],
  });
  const text = (ui: string) => {
    const l = read(ui);
    return store.render(`${l.title}\n${l.short}\n${l.full}`, values(), ui) as string;
  };

  it('exists for exactly the UI languages of the pack, as a draft', () => {
    expect(readdirSync(listingDir).map((f) => f.replace(/\.json$/, '')).sort()).toEqual([...zh.uiLanguages].sort());
    for (const ui of zh.uiLanguages) expect(read(ui).status).toBe('draft');
  });

  it.each(['it', 'en'])('%s validates and takes the word count from the bank', (ui) => {
    expect(store.validateListing(read(ui), { lang: ui, values: values() })).toEqual([]);
    expect(read(ui).full).toContain('{{WORDS}}');
    expect(text(ui)).toContain(String(bank.length));
  });

  // No level beyond A1, no exam (the word choice follows a syllabus, which is no link with it), no review that never happened.
  it.each(['it', 'en'])('%s claims no other level, exam or review', (ui) => {
    expect(text(ui)).not.toMatch(/\b(A2|B1|B2|C1|C2|HSK)\b/);
    expect(text(ui)).not.toMatch(/native|madrelingua|certif|official|ufficial|exams?|esam[ei]/i);
  });

  const card = (e: WordBankEntry): ReviewCard => ({
    id: e.word, word: e.word, article: null, translationIt: e.meaning_it, translationEn: e.meaning_en,
    example: e.example, segments: e.segments, exampleIt: e.example_it, exampleEn: e.example_en, partOfSpeech: e.part_of_speech,
    cefrBand: 'A1', topicDomain: e.topic_domain, grammarAngle: e.grammar_angle, timesSeen: 3, retentionScore: 0.7,
  });
  const claims: [RegExp, () => boolean][] = [
    [/fill-in-the-blank/i, () => bank.filter((e) => buildCloze(e.example, e.word, zh, e.segments)).length >= 200],
    [/tiles/i, () => bank.filter((e) => buildReorder(card(e), () => 0.4)).length >= 200],
    [/measure word/i, () => bank.filter((e) => buildMeasureQuestion(e, () => 0.4, zh)).length >= 40],
    [/是, 在 (or|and) 有/, () => bank.some((e) => e.grammar_angle === 'SHI_ZAI_YOU' && buildChoiceCloze(e.example, e.grammar_angle, zh, e.segments))],
    [/吗 (or|and) 呢/, () => zh.choices!.ruleSets.QUESTION_PARTICLE.length > 0],
    [/二 (or|and) 两/, () => zh.choices!.ruleSets.ER_LIANG.length > 0],
    [/不 (or|and) 没/, () => zh.choices!.ruleSets.BU_MEI.length > 0],
    [/tone/i, () => practiceFormats(zh).includes('tone_choice')],
    [/find the mistake/i, () => practiceFormats(zh).includes('find_mistake')],
    [/pronunciation guide/i, () => zh.primer !== null],
    [/pinyin/i, () => zh.pronunciation === 'pinyin'],
  ];
  it('ties every named format and drill to the app', () => {
    const en = text('en');
    let tied = 0;
    for (const [re, check] of claims) if (re.test(en)) { expect([String(re), check()]).toEqual([String(re), true]); tied++; }
    expect(tied).toBeGreaterThanOrEqual(8);
  });
  it('names no German or Spanish feature', () => {
    expect(text('en')).not.toMatch(/\barticle\b|case endings|dative|accusative|conjugat/i);
  });
});
