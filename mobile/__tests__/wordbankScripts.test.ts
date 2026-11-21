/** The word-bank scripts work per language (TASK-042). They run as Node child processes on temp fixtures. */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scripts = join(__dirname, '..', 'scripts');
const run = (script: string, args: string[]) =>
  spawnSync(process.execPath, [join(scripts, script), ...args], { encoding: 'utf8' });

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const LANG_JSON = {
  code: 'xx',
  levels: ['A1', 'A2'],
  ruleCodes: ['NOUN_GENDER', 'SER_ESTAR'],
  partsOfSpeech: ['noun', 'verb'],
  articles: ['el', 'la'],
};

/** word, article, pos, ipa, meaning_en, meaning_it, example, example_it, note, rule, topic, scenario, example_en, note_en */
const row = (o: Partial<Record<string, string>> = {}) => {
  const d = {
    word: 'casa', article: 'la', pos: 'noun', ipa: 'ˈkasa', en: 'house', it: 'casa',
    ex: 'La casa es grande.', exIt: 'La casa è grande.', note: 'nota', rule: 'NOUN_GENDER', topic: 'home',
    scenario: 'at home', exEn: 'The house is big.', noteEn: 'note', ...o,
  };
  return [d.word, d.article, d.pos, d.ipa, d.en, d.it, d.ex, d.exIt, d.note, d.rule, d.topic, d.scenario, d.exEn, d.noteEn].join('\t');
};

function fixture(a1: string[], a2: string[], lang: object = LANG_JSON) {
  const root = mkdtempSync(join(tmpdir(), 'wb-root-'));
  const out = mkdtempSync(join(tmpdir(), 'wb-out-'));
  dirs.push(root, out);
  mkdirSync(join(root, 'xx'));
  writeFileSync(join(root, 'xx', 'language.json'), JSON.stringify(lang));
  writeFileSync(join(root, 'xx', 'A1.tsv'), a1.join('\n') + '\n');
  writeFileSync(join(root, 'xx', 'A2.tsv'), a2.join('\n') + '\n');
  return { root, out };
}
const good = () => fixture([row(), row({ word: 'perro', article: 'el', en: 'dog', it: 'cane', ex: 'El perro corre.' })],
  [row({ word: 'comer', article: '-', pos: 'verb', en: 'to eat', it: 'mangiare', ex: 'Quiero comer.', rule: 'SER_ESTAR' })]);

describe('build-wordbank --root --out', () => {
  it('builds the JSON of a fixture language with the neutral `example` key, and is idempotent', () => {
    const { root, out } = good();
    const r = run('build-wordbank.mjs', ['--root', root, '--out', out]);
    expect(r.status).toBe(0);
    const a1 = JSON.parse(readFileSync(join(out, 'xx', 'A1.json'), 'utf8'));
    expect(a1).toHaveLength(2);
    expect(a1[0].example).toBe('La casa es grande.');
    expect('example_de' in a1[0]).toBe(false);
    const before = readFileSync(join(out, 'xx', 'A2.json'), 'utf8');
    expect(run('build-wordbank.mjs', ['--root', root, '--out', out]).status).toBe(0);
    expect(readFileSync(join(out, 'xx', 'A2.json'), 'utf8')).toBe(before);
  });

  it('does not touch the repo seams when a custom root is given', () => {
    const seam = join(__dirname, '..', 'src', 'languages', 'active.ts');
    const before = readFileSync(seam, 'utf8');
    const { root, out } = good();
    run('build-wordbank.mjs', ['--root', root, '--out', out]);
    expect(readFileSync(seam, 'utf8')).toBe(before);
  });

  it('refuses a language folder without language.json', () => {
    const { root, out } = good();
    rmSync(join(root, 'xx', 'language.json'));
    const r = run('build-wordbank.mjs', ['--root', root, '--out', out]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/language\.json/);
  });

  it('refuses a missing level file', () => {
    const { root, out } = good();
    rmSync(join(root, 'xx', 'A2.tsv'));
    const r = run('build-wordbank.mjs', ['--root', root, '--out', out]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/A2\.tsv/);
  });
});

describe('validate-wordbank --root --out', () => {
  const validate = (a1: string[], a2: string[]) => {
    const { root, out } = fixture(a1, a2);
    expect(run('build-wordbank.mjs', ['--root', root, '--out', out]).status).toBe(0);
    return run('validate-wordbank.mjs', ['--root', root, '--out', out]);
  };
  const okRows = [row(), row({ word: 'perro', article: 'el', ex: 'El perro corre.' })];
  const okA2 = [row({ word: 'comer', article: '-', pos: 'verb', ex: 'Quiero comer.', rule: 'SER_ESTAR' })];

  it('accepts a fixture with its own codes', () => {
    const r = validate(okRows, okA2);
    expect(r.status).toBe(0);
  });

  it('rejects a grammar_angle that is not in that language', () => {
    const r = validate([row({ rule: 'DATIV_PREP' })], okA2);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/grammar_angle/);
  });

  it('rejects a noun whose article is not allowed in that language', () => {
    const r = validate([row({ article: 'der' })], okA2);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/article/);
  });

  it('rejects an article on a non-noun and a noun without one', () => {
    expect(validate(okRows, [row({ word: 'comer', pos: 'verb', article: 'el', ex: 'Quiero comer.' })]).status).not.toBe(0);
    expect(validate([row({ article: '-' })], okA2).status).not.toBe(0);
  });

  it('rejects a part of speech that is not in that language', () => {
    expect(validate([row({ pos: 'adj', article: '-' })], okA2).status).not.toBe(0);
  });
});

describe('set-active-language', () => {
  const seams = ['src/data/wordbank/active.ts', 'src/i18n/wordContentLoaders.ts', 'src/languages/active.ts']
    .map((p) => join(__dirname, '..', p));

  it('fails clearly for an unknown language', () => {
    const r = run('set-active-language.mjs', ['zz']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/zz/);
  });

  it('regenerates the committed German seams byte for byte', () => {
    const before = seams.map((p) => readFileSync(p, 'utf8'));
    const r = run('set-active-language.mjs', ['de']);
    expect(r.status).toBe(0);
    expect(seams.map((p) => readFileSync(p, 'utf8'))).toEqual(before);
    expect(before[0]).toContain('./de/A1.json');
    expect(before[2]).toContain("export { de as activePack } from './de';");
    expect(before.every((s) => s.includes('GENERATED'))).toBe(true);
  });
});

describe('the repository layout', () => {
  const here = join(__dirname, '..');
  it('keeps German sources and generated data under a language folder', () => {
    for (const l of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
      expect(existsSync(join(here, 'scripts', 'wordbank', 'de', `${l}.tsv`))).toBe(true);
      expect(existsSync(join(here, 'src', 'data', 'wordbank', 'de', `${l}.json`))).toBe(true);
      expect(existsSync(join(here, 'src', 'data', 'wordbank', `${l}.json`))).toBe(false);
    }
    expect(existsSync(join(here, 'scripts', 'wordbank', 'de', 'language.json'))).toBe(true);
    expect(readdirSync(join(here, 'scripts', 'wordbank', 'de', 'i18n')).sort())
      .toEqual(['ar', 'es', 'fr', 'hi', 'ja', 'pl', 'pt', 'ru', 'tr', 'uk', 'zh']);
  });
});
