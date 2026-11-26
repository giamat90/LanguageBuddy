/** TASK-072: build and checks of a language that writes sentences without spaces. Scripts run on temp fixtures. */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scripts = join(__dirname, '..', 'scripts');
const run = (script: string, args: string[]) =>
  spawnSync(process.execPath, [join(scripts, script), ...args], { encoding: 'utf8' });

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const LANG = {
  code: 'xx',
  levels: ['A1'],
  i18nLanguages: [],
  ruleCodes: ['WORD_ORDER', 'QUESTION_PARTICLE'],
  partsOfSpeech: ['noun', 'verb', 'pron', 'adv', 'num', 'adj'],
  articles: [],
  segmented: {
    separator: '|', punctuation: '。？！，、“”', end: '。？！', minWords: 4, maxWords: 8,
    allow: ['他', '你', '也', '很', '看', '本', '一', '吗', '呢'],
  },
  extraColumns: ['example_pinyin', 'measure', 'measure_also', 'stage'],
  characters: true,
  pinyin: { alternatives: { 一: ['yí', 'yì'], 不: ['bú'] }, erhua: '儿' },
  measureWords: ['本', '个'],
  stages: [1, 2],
  ruleChecks: { QUESTION_PARTICLE: { mustContainAny: ['吗', '呢'], exactlyOneOf: ['吗', '呢'] } },
};

interface Row {
  word: string; pos: string; ipa: string; ex: string; py: string; article?: string; rule?: string;
  measure?: string; also?: string; stage?: string;
}
const tsv = (r: Row) => [
  r.word, r.article ?? '-', r.pos, r.ipa, 'meaning', 'significato', r.ex, 'frase', 'nota', r.rule ?? 'WORD_ORDER', 'home',
  'at home', 'sentence', 'note', r.py, r.measure ?? (r.pos === 'noun' ? '本' : '-'), r.also ?? '-', r.stage ?? '1',
].join('\t');

const WO: Row = { word: '我', pos: 'pron', ipa: 'wǒ', ex: '我|有|一|本|书|。', py: 'wǒ yǒu yì běn shū' };
const SHU: Row = { word: '书', pos: 'noun', ipa: 'shū', ex: '你|也|有|书|吗|？', py: 'nǐ yě yǒu shū ma', rule: 'QUESTION_PARTICLE' };
const YOU: Row = { word: '有', pos: 'verb', ipa: 'yǒu', ex: '他|有|一|本|书|。', py: 'Tā yǒu yì běn shū' };
const BU: Row = { word: '不', pos: 'adv', ipa: 'bù', ex: '我|不|看|书|。', py: 'wǒ bú kàn shū' };
const DIAN: Row = { word: '一点儿', pos: 'num', ipa: 'yìdiǎnr', ex: '我|有|一点儿|书|。', py: 'wǒ yǒu yìdiǎnr shū', stage: '2' };
const HAO: Row = { word: '好', pos: 'adj', ipa: 'hǎo', ex: '“|书|，|很|好|看|。|”', py: 'shū hěn hǎo kàn' };
const BASE = [WO, SHU, YOU, BU, DIAN, HAO];

/** char, pinyin, en, it, parts, parts_en, parts_it, lookalikes, trick_en, trick_it */
const ch = (char: string, pinyin: string, rest: string[] = ['-', '-', '-', '-', '-', '-']) =>
  [char, pinyin, `en ${char}`, `it ${char}`, ...rest].join('\t');
const CHARS = [
  ch('我', 'wǒ'), ch('书', 'shū'), ch('有', 'yǒu'), ch('一', 'yī'), ch('本', 'běn'), ch('也', 'yě'),
  ch('他', 'tā', ['亻 也', 'person; also', 'persona; anche', '她 地', 'a person too', 'anche una persona']),
  ch('不', 'bù'), ch('看', 'kàn'), ch('点', 'diǎn'), ch('儿', 'ér'), ch('你', 'nǐ'), ch('吗', 'ma'), ch('呢', 'ne'),
  ch('很', 'hěn'), ch('好', 'hǎo hào'), ch('个', 'gè'),
];

function fixture(rows: string[], chars: string[] | null = CHARS, lang: object = LANG) {
  const root = mkdtempSync(join(tmpdir(), 'wb-seg-'));
  const out = mkdtempSync(join(tmpdir(), 'wb-seg-out-'));
  dirs.push(root, out);
  mkdirSync(join(root, 'xx'));
  writeFileSync(join(root, 'xx', 'language.json'), JSON.stringify(lang));
  writeFileSync(join(root, 'xx', 'A1.tsv'), rows.join('\n') + '\n');
  if (chars) writeFileSync(join(root, 'xx', 'characters.tsv'), '# characters\n' + chars.join('\n') + '\n');
  const args = ['--root', root, '--out', out];
  return {
    build: () => run('build-wordbank.mjs', args),
    validate: () => run('validate-wordbank.mjs', args),
    json: (name: string) => JSON.parse(readFileSync(join(out, 'xx', name), 'utf8')),
  };
}

describe('building a segmented bank', () => {
  it('joins the example, keeps the segments and writes the extra columns', () => {
    const f = fixture(BASE.map(tsv));
    expect(f.build().status).toBe(0);
    const a1 = f.json('A1.json');
    expect(a1[0]).toMatchObject({
      word: '我', article: null, example: '我有一本书。', segments: ['我', '有', '一', '本', '书', '。'],
      example_pinyin: 'wǒ yǒu yì běn shū', measure: null, measure_also: [], stage: 1,
    });
    expect(a1[1]).toMatchObject({ word: '书', measure: '本', measure_also: [] });
    expect(a1[4].stage).toBe(2);
  });

  it('keeps "none" as an explicit measure word and splits measure_also', () => {
    const f = fixture([
      tsv({ ...SHU, measure: 'none' }),
      tsv({ ...SHU, word: '本', ipa: 'běn', ex: '我|有|一|本|书|。', py: 'wǒ yǒu yì běn shū', also: '个 本' }),
    ]);
    expect(f.build().status).toBe(0);
    expect(f.json('A1.json')[0].measure).toBe('none');
    expect(f.json('A1.json')[1].measure_also).toEqual(['个', '本']);
  });

  it('writes the character table', () => {
    const f = fixture(BASE.map(tsv));
    expect(f.build().status).toBe(0);
    const chars = f.json('characters.json');
    expect(chars).toHaveLength(CHARS.length);
    expect(chars.find((c: any) => c.char === '他')).toEqual({
      char: '他', pinyin: ['tā'], meaning_en: 'en 他', meaning_it: 'it 他',
      parts: [{ char: '亻', en: 'person', it: 'persona' }, { char: '也', en: 'also', it: 'anche' }],
      lookalikes: ['她', '地'], trick_en: 'a person too', trick_it: 'anche una persona',
    });
    expect(chars.find((c: any) => c.char === '好')).toMatchObject({
      pinyin: ['hǎo', 'hào'], parts: [], lookalikes: [], trick_en: null, trick_it: null,
    });
  });

  it('refuses a row without the extra columns', () => {
    const r = fixture([tsv(WO).split('\t').slice(0, 14).join('\t')]).build();
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/14 columns, expected 18/);
  });

  it('refuses an unknown extra column', () => {
    const r = fixture(BASE.map(tsv), CHARS, { ...LANG, extraColumns: ['example_pinyin', 'colour'] }).build();
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/colour/);
  });

  it('refuses a missing character table, or a character row with the wrong number of columns', () => {
    const missing = fixture(BASE.map(tsv), null).build();
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toMatch(/characters\.tsv/);
    const short = fixture(BASE.map(tsv), [...CHARS, '们\tmen']).build();
    expect(short.status).not.toBe(0);
    expect(short.stderr).toMatch(/characters\.tsv:\d+ has 2 columns, expected 10/);
  });
});

/** Builds (must succeed) then validates. */
const check = (rows: Row[], chars: string[] = CHARS, lang: object = LANG) => {
  const f = fixture(rows.map(tsv), chars, lang);
  const b = f.build();
  if (b.status !== 0) throw new Error(b.stderr);
  return f.validate();
};
const swap = (row: Row, over: Partial<Row>) => BASE.map((r) => (r === row ? { ...r, ...over } : r));
const rejects = (r: ReturnType<typeof check>, why: RegExp) => {
  expect(r.stderr).toMatch(why);
  expect(r.status).toBe(1);
};

describe('checking a segmented bank', () => {
  it('accepts the base fixture: neutral tone, yì / bú, erhua, capitals and quotes', () => {
    const r = check([...BASE]);
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
  });

  it('accepts "none" and a listed alternative measure word', () => {
    expect(check(swap(SHU, { measure: 'none' })).status).toBe(0);
    expect(check(swap(SHU, { measure: '本', also: '个' })).status).toBe(0);
  });

  describe('sentences', () => {
    it.each([['3'], ['ok'], [' '], ['~']])('refuses the segment "%s"', (bad) => {
      rejects(check(swap(WO, { ex: `我|有|${bad}|本|书|。` })), /segment/);
    });
    it('refuses a missing end mark', () => rejects(check(swap(WO, { ex: '我|有|一|本|书' })), /end/));
    it('refuses too few words', () => rejects(check(swap(WO, { ex: '我|看|书|。', py: 'wǒ kàn shū' })), /3 words/));
    it('refuses too many words', () => {
      rejects(check(swap(WO, { ex: '我|也|很|好|看|一|本|书|看|。', py: 'wǒ yě hěn hǎo kàn yì běn shū kàn' })), /9 words/);
    });
    it('refuses a sentence without the headword', () => {
      rejects(check(swap(WO, { ex: '他|有|一|本|书|。', py: 'tā yǒu yì běn shū' })), /exactly once/);
    });
    it('refuses a headword used twice', () => {
      rejects(check(swap(WO, { ex: '我|看|我|书|。', py: 'wǒ kàn wǒ shū' })), /exactly once/);
    });
    it('refuses a word that is neither a headword nor allowed', () => {
      rejects(check(swap(WO, { ex: '我|有|一|个|书|。', py: 'wǒ yǒu yí gè shū' })), /"个".*not a headword/);
    });
    it('refuses a character without a row', () => {
      rejects(check([...BASE], CHARS.filter((c) => !c.startsWith('看'))), /no character row for 看/);
    });
  });

  describe('pinyin', () => {
    it('refuses word pinyin that does not spell the word', () => rejects(check(swap(YOU, { ipa: 'yòu' })), /pinyin "yòu"/));
    it('refuses the wrong number of words', () => rejects(check(swap(WO, { py: 'wǒ yǒu yìběn shū' })), /4 pinyin words for 5/));
    it('refuses a syllable that is no reading of its character', () => {
      rejects(check(swap(WO, { py: 'wǒ yǒu yì běn shú' })), /"shú".*书/);
    });
    it('refuses a headword read differently from its entry', () => {
      rejects(check(swap(HAO, { py: 'shū hěn hào kàn' })), /headword/);
    });
  });

  describe('measure words and stage', () => {
    it('refuses a noun without one', () => rejects(check(swap(SHU, { measure: '-' })), /measure word/));
    it('refuses an unlisted one', () => rejects(check(swap(SHU, { measure: '张' })), /measure word "张"/));
    it('refuses one on a non-noun', () => rejects(check(swap(YOU, { measure: '本' })), /only nouns/));
    it('refuses measure_also on a non-noun', () => rejects(check(swap(YOU, { also: '本' })), /only nouns/));
    it('refuses an unlisted alternative', () => rejects(check(swap(SHU, { also: '张' })), /measure_also/));
    it('refuses an alternative that repeats the main one', () => rejects(check(swap(SHU, { also: '本' })), /measure_also/));
    it.each([['3'], ['x']])('refuses the stage %s', (stage) => rejects(check(swap(WO, { stage })), /stage/));
  });

  describe('rule checks read the words', () => {
    it('refuses a tagged sentence without a member', () => {
      rejects(check(swap(SHU, { ex: '你|也|有|书|。', py: 'nǐ yě yǒu shū' })), /none of its forms/);
    });
    it('refuses two members', () => {
      rejects(check(swap(SHU, { ex: '你|呢|有|书|吗|？', py: 'nǐ ne yǒu shū ma' })), /exactly one/);
    });
  });

  describe('character rows', () => {
    const bad = (row: string) => check([...BASE], [...CHARS, row]);
    const six = (o: Partial<Record<number, string>>) => ['-', '-', '-', '-', '-', '-'].map((v, i) => o[i] ?? v);
    it('refuses two characters in one row', () => rejects(bad(ch('朋友', 'péng')), /one Chinese character/));
    it('refuses a malformed reading', () => rejects(bad(ch('们', 'menn')), /reading "menn"/));
    it('refuses parts without matching glosses', () => {
      rejects(bad(ch('们', 'men', six({ 0: '亻 门', 1: 'person', 2: 'persona; porta' }))), /parts/);
    });
    it('refuses itself as a look-alike', () => rejects(bad(ch('们', 'men', six({ 3: '们' }))), /look-alike/));
    it('refuses a trick in one language only', () => rejects(bad(ch('们', 'men', six({ 4: 'a trick' }))), /trick/));
    it('refuses a duplicate', () => rejects(bad(ch('我', 'wǒ')), /duplicate/));
  });
});

describe('the Chinese language file', () => {
  const cfg = JSON.parse(readFileSync(join(scripts, 'wordbank', 'zh', 'language.json'), 'utf8'));
  it('declares the formats and rules of TASK-070', () => {
    expect(cfg.levels).toEqual(['A1']);
    expect(cfg.articles).toEqual([]);
    expect(cfg.i18nLanguages).toEqual([]);
    expect(cfg.ruleCodes).toEqual([
      'SHI_ZAI_YOU', 'QUESTION_PARTICLE', 'ER_LIANG', 'BU_MEI', 'MEASURE_WORD', 'QUESTION_WORDS', 'DE_POSSESSIVE', 'ADJ_HEN',
      'LE_COMPLETION', 'MODAL_VERBS', 'PROGRESSIVE_ZAI', 'NUMBERS_TIME', 'WORD_ORDER',
    ]);
    expect(cfg.segmented).toMatchObject({ separator: '|', end: '。？！', minWords: 4, maxWords: 10 });
    expect(cfg.extraColumns).toEqual(['example_pinyin', 'measure', 'measure_also', 'stage']);
    expect(cfg.characters).toBe(true);
    expect(cfg.pinyin).toEqual({ alternatives: { 一: ['yí', 'yì'], 不: ['bú'] }, erhua: '儿' });
    expect(Object.keys(cfg.ruleChecks)).toEqual(['SHI_ZAI_YOU', 'QUESTION_PARTICLE', 'ER_LIANG', 'BU_MEI']);
    for (const check of Object.values(cfg.ruleChecks) as any[]) expect(check.exactlyOneOf).toEqual(check.mustContainAny);
    expect(new Set(cfg.measureWords).size).toBe(cfg.measureWords.length);
  });
});
