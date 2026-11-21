/** TASK-048: the SpanishBuddy Play listing, in every UI language of the app. */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { es } from '../src/languages/es';
import { setActivePackForTests } from '../src/languages';
import { buildCloze } from '../src/lib/cloze';
import { buildReorder } from '../src/lib/exercises/reorder';
import { buildMatchingRound } from '../src/lib/exercises/matching';
import { buildMultipleChoice } from '../src/lib/exercises/distractors';
import type { ReviewCard } from '../src/services/reviewService';
/* eslint-disable @typescript-eslint/no-var-requires */
const store = require('../scripts/lib/store.js');

const repo = join(__dirname, '..', '..');
const listingDir = join(repo, 'store', 'es', 'listing');
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const bank = LEVELS.flatMap((lv) =>
  (JSON.parse(readFileSync(join(__dirname, '..', 'src', 'data', 'wordbank', 'es', `${lv}.json`), 'utf8')) as any[]).map((e) => ({ lv, e })));
const read = (ui: string) => JSON.parse(readFileSync(join(listingDir, `${ui}.json`), 'utf8'));
const UI: string[] = [...es.uiLanguages];

const values = store.tokenValues({
  variant: { name: 'SpanishBuddy', code: 'es', slug: 'spanishbuddy' },
  targetName: 'Spanish',
  support: store.loadSupport('es'),
  wordCount: bank.length,
  uiLangCount: es.uiLanguages.length,
});

beforeAll(() => setActivePackForTests(es));
afterAll(() => setActivePackForTests(null));

describe('listing files', () => {
  it('exist for exactly the UI languages of the Spanish pack', () => {
    expect(readdirSync(listingDir).map((f) => f.replace(/\.json$/, '')).sort()).toEqual([...UI].sort());
  });
  it.each(UI)('%s validates', (ui) => {
    expect(store.validateListing(read(ui), { lang: ui, values })).toEqual([]);
  });
  it('the English text uses no banned phrase', () => {
    const t = store.render(`${read('en').title}\n${read('en').short}\n${read('en').full}`, values, 'en');
    expect(t).not.toMatch(/\b(best|official|guarantee|fluent in|the only)\b|#1|number one/i);
  });
  it('the rendered English text carries the real word count and the app-language count', () => {
    const full = store.render(read('en').full, values, 'en');
    expect(full).toContain(String(bank.length));
    expect(full).toContain(String(es.uiLanguages.length));
    expect(full).toContain('https://giamat90.github.io/spanishbuddy-support/privacy-policy.html');
  });
});

describe('validateListing guards', () => {
  const ok = () => ({ ...read('en') });
  it('rejects a banned phrase', () => {
    expect(store.validateListing({ ...ok(), short: 'The best app to learn Spanish' }, { lang: 'en', values }).join()).toMatch(/banned|best/i);
  });
  it('rejects a 31-character title', () => {
    expect(store.validateListing({ ...ok(), title: 'SpanishBuddy: Learn Spanish now!' }, { lang: 'en', values }).join()).toMatch(/title/);
  });
  it('rejects a Cyrillic file whose short text is Latin', () => {
    expect(store.validateListing({ ...read('ru'), short: 'Learn Spanish offline every day' }, { lang: 'ru', values }).join()).toMatch(/script/);
  });
  it('rejects an unknown token and a missing privacy link', () => {
    expect(store.validateListing({ ...ok(), full: 'SpanishBuddy {{NOPE}}' }, { lang: 'en', values }).length).toBeGreaterThan(0);
    expect(store.validateListing({ ...ok(), full: 'SpanishBuddy only' }, { lang: 'en', values }).join()).toMatch(/privacy/i);
  });
  it('rejects title equal to short and a bad status', () => {
    expect(store.validateListing({ ...ok(), short: ok().title }, { lang: 'en', values }).join()).toMatch(/short/);
    expect(store.validateListing({ ...ok(), status: 'final' }, { lang: 'en', values }).join()).toMatch(/status/);
  });
});

describe('every format the English text names can be built for Spanish', () => {
  const card = (lv: string, e: any): ReviewCard => ({
    id: e.word, word: e.word, article: e.article, translationIt: e.meaning_it, translationEn: e.meaning_en,
    example: e.example, exampleIt: e.example_it, exampleEn: e.example_en, partOfSpeech: e.part_of_speech,
    cefrBand: lv, topicDomain: e.topic_domain, grammarAngle: e.grammar_angle, timesSeen: 3, retentionScore: 0.7,
  });
  const seeded = () => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
  const cards = bank.map(({ lv, e }) => card(lv, e));
  const pool = bank.map(({ lv, e }) => ({
    word: e.word, article: e.article, partOfSpeech: e.part_of_speech, cefrBand: lv, topicDomain: e.topic_domain,
    meaningIt: e.meaning_it, meaningEn: e.meaning_en,
  }));
  const claims: [RegExp, () => boolean][] = [
    [/fill-in-the-blank/i, () => cards.filter((c) => buildCloze(c.example, c.word)).length >= 100],
    [/tiles/i, () => cards.filter((c) => buildReorder(c, seeded())).length >= 100],
    [/multiple choice/i, () => cards.slice(0, 50).every((c) => buildMultipleChoice(c, pool, seeded())?.options.length === 4)],
    [/matching pairs/i, () => buildMatchingRound(cards.filter((c) => c.cefrBand === 'A1').slice(0, 20), seeded()) !== null],
    [/\bser or estar\b/i, () => es.choices!.ruleSets.SER_ESTAR.length > 0],
    [/\bpor or para\b/i, () => es.choices!.ruleSets.POR_PARA.length > 0],
    [/lo, la, los, las/i, () => es.choices!.ruleSets.DIRECT_OBJECT_PRONOUN.flat().length === 4],
    [/\(el or la\)/i, () => es.articles!.forms.join() === 'el,la'],
  ];
  const full = read('en').full as string;
  it('ties every named format to code', () => {
    let tied = 0;
    for (const [re, check] of claims) if (re.test(full)) { expect(check()).toBe(true); tied++; }
    expect(tied).toBeGreaterThanOrEqual(5);
  });
  it('names no format that has no check', () => {
    expect(full).not.toMatch(/find the mistake|spot the|case endings|dative|accusative|genitive/i);
  });
});

describe('build-store.mjs listing output', () => {
  it('writes title/short/full per language and a STATUS file', () => {
    const out = mkdtempSync(join(tmpdir(), 'store-listing-'));
    try {
      const r = spawnSync(process.execPath, [join(__dirname, '..', 'scripts', 'build-store.mjs'), 'es', '--out', out, '--allow-placeholder'], { encoding: 'utf8' });
      expect(r.status).toBe(0);
      expect(readdirSync(join(out, 'listing')).sort()).toEqual([...UI].sort());
      for (const ui of UI) expect(readdirSync(join(out, 'listing', ui)).sort()).toEqual(['full.txt', 'short.txt', 'title.txt']);
      const status = readFileSync(join(out, 'STATUS.txt'), 'utf8');
      for (const ui of UI) expect(status).toContain(`${ui}: draft`);
      expect(readFileSync(join(out, 'listing', 'en', 'title.txt'), 'utf8')).toContain('SpanishBuddy');
      expect(r.stdout).toMatch(/reviewed/);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
