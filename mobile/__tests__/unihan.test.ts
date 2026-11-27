/** TASK-077: the readings of the character table, checked against a Unihan file the owner downloads. */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { parseReadings, readingProblems } = require('../scripts/lib/unihan.js');

// Hand-written lines in the shape of Unihan_Readings.txt, one for each field the check reads.
const SAMPLE = [
  '# comment',
  'U+4E00\tkMandarin\tyī',
  'U+4E00\tkDefinition\tone; a, an',
  'U+597D\tkHanyuPinyin\t21028.010:hǎo,hào 21030.020:hǔ',
  'U+5409\tkHanyuPinlu\tjí(120)',
  'U+4E48\tkXHC1983\t0769.040:me 1337.010:yāo',
  'U+4E2D\tkTGHZ2013\t475.100:zhōng 476.010:zhòng',
  'U+20000\tkMandarin\thē',
  '',
].join('\n');

const row = (char: string, ...pinyin: string[]) => ({ char, pinyin });

describe('parseReadings', () => {
  const unihan: Map<string, Set<string>> = parseReadings(SAMPLE);

  it('reads every reading field, each in its own form', () => {
    expect([...unihan.get('一')!]).toEqual(['yī']);
    expect([...unihan.get('好')!].sort()).toEqual(['hào', 'hǎo', 'hǔ'].sort());
    expect([...unihan.get('吉')!]).toEqual(['jí']);
    expect([...unihan.get('么')!].sort()).toEqual(['me', 'yāo'].sort());
    expect([...unihan.get('中')!].sort()).toEqual(['zhòng', 'zhōng'].sort());
    expect([...unihan.get('\u{20000}')!]).toEqual(['hē']);
  });

  it('copes with Windows line ends', () => {
    expect([...parseReadings('U+4E00\tkMandarin\tyī\r\n').get('一')]).toEqual(['yī']);
  });
});

describe('readingProblems', () => {
  const unihan = parseReadings(SAMPLE);

  it('accepts the readings Unihan has', () => {
    expect(readingProblems([row('一', 'yī'), row('好', 'hǎo', 'hào')], unihan)).toEqual([]);
  });

  it('reports a reading Unihan does not have', () => {
    expect(readingProblems([row('一', 'yǐ')], unihan)).toEqual(['一: reading "yǐ" is not in Unihan (it has yī)']);
  });

  it('accepts the neutral tone of a syllable it has in any tone, and no other syllable', () => {
    expect(readingProblems([row('好', 'hao'), row('么', 'me')], unihan)).toEqual([]);
    expect(readingProblems([row('好', 'ba')], unihan)).toHaveLength(1);
  });

  it('reports a character Unihan does not know', () => {
    expect(readingProblems([row('书', 'shū')], unihan)).toEqual(['书: not in Unihan']);
  });
});

describe('check-unihan', () => {
  const script = join(__dirname, '..', 'scripts', 'check-unihan.mjs');
  const run = (file: string) => spawnSync(process.execPath, [script, file], { encoding: 'utf8' });
  let dir: string;
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'unihan-')); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('says where to put the file when it is missing', () => {
    const result = run(join(dir, 'nothing.txt'));
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('scripts/reference-lists/Unihan_Readings.txt');
  });

  it('fails and names the characters when a reading cannot be confirmed', () => {
    const file = join(dir, 'Unihan_Readings.txt');
    writeFileSync(file, 'U+4E00\tkMandarin\tyī\n');
    const result = run(file);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('我: not in Unihan');
  });
});
