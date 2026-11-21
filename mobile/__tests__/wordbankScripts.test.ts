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

describe('draft languages and rule checks (TASK-044)', () => {
  const CHECKED = { ...LANG_JSON, ruleChecks: { SER_ESTAR: { mustContainAny: ['es', 'está'] } } };
  const withRule = (example: string, lang: object) =>
    fixture([row()], [row({ word: 'cansada', article: '-', pos: 'verb', ex: example, rule: 'SER_ESTAR' })], lang);
  const validateFixture = (f: { root: string; out: string }) => {
    expect(run('build-wordbank.mjs', ['--root', f.root, '--out', f.out]).status).toBe(0);
    return run('validate-wordbank.mjs', ['--root', f.root, '--out', f.out]);
  };

  it('build and validate skip a draft language even without its TSVs', () => {
    const root = mkdtempSync(join(tmpdir(), 'wb-draft-'));
    const out = mkdtempSync(join(tmpdir(), 'wb-draft-out-'));
    dirs.push(root, out);
    mkdirSync(join(root, 'xx'));
    writeFileSync(join(root, 'xx', 'language.json'), JSON.stringify({ ...LANG_JSON, draft: true }));
    const b = run('build-wordbank.mjs', ['--root', root, '--out', out]);
    expect(b.status).toBe(0);
    expect(b.stdout).toMatch(/skipped draft language xx/);
    expect(existsSync(join(out, 'xx'))).toBe(false);
    const v = run('validate-wordbank.mjs', ['--root', root, '--out', out]);
    expect(v.status).toBe(0);
    expect(v.stdout).toMatch(/skipped draft language xx/);
  });

  it('set-active-language refuses a draft language and writes nothing', () => {
    const root = mkdtempSync(join(tmpdir(), 'wb-draft-'));
    const src = mkdtempSync(join(tmpdir(), 'wb-src-'));
    dirs.push(root, src);
    mkdirSync(join(root, 'xx'));
    mkdirSync(join(src, 'languages'));
    writeFileSync(join(root, 'xx', 'language.json'), JSON.stringify({ ...LANG_JSON, draft: true }));
    writeFileSync(join(src, 'languages', 'xx.ts'), '');
    const r = run('set-active-language.mjs', ['xx', '--root', root, '--src', src]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/xx is a draft language/);
    expect(existsSync(join(src, 'languages', 'active.ts'))).toBe(false);
  });

  it('a rule check accepts an example with one of the forms', () => {
    expect(validateFixture(withRule('Mi madre está cansada.', CHECKED)).status).toBe(0);
  });

  it('a rule check rejects an example with none of them', () => {
    const r = validateFixture(withRule('Quiero comer.', CHECKED));
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/example for SER_ESTAR has none of its forms/);
  });

  it('matches whole words only, ignoring case', () => {
    expect(validateFixture(withRule('Está lloviendo.', CHECKED)).status).toBe(0);
    expect(validateFixture(withRule('Estás aquí, no es tarde.', { ...LANG_JSON, ruleChecks: { SER_ESTAR: { mustContainAny: ['está'] } } })).status).not.toBe(0);
  });
});

describe('partial draft languages and example rules (TASK-045)', () => {
  const DRAFT = { ...LANG_JSON, ruleCodes: [...LANG_JSON.ruleCodes, 'VERB_PRESENT_REGULAR'], draft: true, levels: ['A1', 'A2', 'B1'] };
  const RULES = {
    exampleRules: { minTokens: 4, maxTokens: 10, stemMinLength: 3, forbidden: ['\\bvale\\b'] },
  };
  const build = (f: { root: string; out: string }) => run('build-wordbank.mjs', ['--root', f.root, '--out', f.out]);
  const validate = (f: { root: string; out: string }) => run('validate-wordbank.mjs', ['--root', f.root, '--out', f.out]);
  /** A fixture whose A1 holds one given row (other levels absent). */
  const a1Only = (rows: string[], lang: object) => {
    const root = mkdtempSync(join(tmpdir(), 'wb-part-'));
    const out = mkdtempSync(join(tmpdir(), 'wb-part-out-'));
    dirs.push(root, out);
    mkdirSync(join(root, 'xx'));
    writeFileSync(join(root, 'xx', 'language.json'), JSON.stringify(lang));
    writeFileSync(join(root, 'xx', 'A1.tsv'), rows.join('\n') + '\n');
    return { root, out };
  };
  const ok = row({ word: 'comer', article: '-', pos: 'verb', ex: 'Yo como pan todos los días.', rule: 'VERB_PRESENT_REGULAR' });

  it('a draft language builds the levels it has and warns for the others', () => {
    const f = a1Only([row(), ok], DRAFT);
    const b = build(f);
    expect(b.status).toBe(0);
    expect(existsSync(join(f.out, 'xx', 'A1.json'))).toBe(true);
    expect(b.stdout + b.stderr).toMatch(/xx: no A2\.tsv \(draft\)/);
    expect(existsSync(join(f.out, 'xx', 'A2.json'))).toBe(false);
  });

  it('a draft language validates only the levels that exist', () => {
    const f = a1Only([row(), ok], DRAFT);
    build(f);
    expect(validate(f).status).toBe(0);
  });

  it('a draft language with a broken present level still fails', () => {
    const f = a1Only([row({ topic: 'nonsense' })], DRAFT);
    build(f);
    expect(validate(f).status).not.toBe(0);
  });

  it('a language that is not a draft still needs every level', () => {
    const f = a1Only([row(), ok], { ...DRAFT, draft: false });
    const b = build(f);
    expect(b.status).not.toBe(0);
    expect(b.stderr).toMatch(/A2\.tsv/);
  });

  describe('exampleRules', () => {
    const check = (example: string, over: Partial<Record<string, string>> = {}) => {
      const f = a1Only([row({ word: 'comer', article: '-', pos: 'verb', rule: 'VERB_PRESENT_REGULAR', ex: example, ...over })], { ...DRAFT, ...RULES });
      build(f);
      return validate(f);
    };
    const msg = (r: { stderr: string; stdout: string }) => r.stderr + r.stdout;

    it('accepts a good sentence', () => expect(check('Yo como pan todos los días.').status).toBe(0));
    it('accepts a conjugated form through the stem', () => expect(check('Nosotros comemos arroz hoy.').status).toBe(0));
    it('accepts the infinitive and a question with both marks', () => {
      expect(check('Quiero comer pan hoy.').status).toBe(0);
      expect(check('¿Dónde quieres comer hoy?').status).toBe(0);
    });
    it('rejects a sentence without the word or its stem', () => {
      const r = check('Yo bebo agua todos los días.');
      expect(r.status).not.toBe(0);
      expect(msg(r)).toMatch(/example must contain the word or its stem/);
    });
    it('rejects too few or too many tokens', () => {
      expect(msg(check('Yo como pan.'))).toMatch(/example has 3 tokens \(4–10\)/);
      expect(msg(check('Yo como pan todos los días con mucha mucha mucha leche.'))).toMatch(/tokens \(4–10\)/);
    });
    it('rejects a lower-case start or a missing end mark', () => {
      expect(msg(check('yo como pan todos los días.'))).toMatch(/must start upper-case and end with/);
      expect(msg(check('Yo como pan todos los días'))).toMatch(/must start upper-case and end with/);
    });
    it('rejects a forbidden form', () => {
      expect(msg(check('Vale, yo como pan hoy.'))).toMatch(/uses forbidden form/);
    });
    it('rejects an unpaired inverted question mark', () => {
      expect(msg(check('Dónde quieres comer hoy?'))).toMatch(/"¿" and "\?" must come together/);
      expect(msg(check('¿Dónde quieres comer hoy.'))).toMatch(/must start upper-case and end with|must come together/);
    });
    it('matches a noun as a whole word', () => {
      const r = check('La casita es muy bonita.', { word: 'casa', article: 'la', pos: 'noun', rule: 'NOUN_GENDER' });
      expect(msg(r)).toMatch(/example must contain the word or its stem/);
    });
    it('does not apply when the language has no exampleRules', () => {
      const f = a1Only([row({ word: 'comer', article: '-', pos: 'verb', rule: 'VERB_PRESENT_REGULAR', ex: 'vale.' })], DRAFT);
      build(f);
      expect(validate(f).status).toBe(0);
    });
  });
});

describe('level rules, cross-level uniqueness and exact-one checks (TASK-046)', () => {
  const LANG = {
    ...LANG_JSON,
    draft: false,
    ruleCodes: ['NOUN_GENDER', 'VERB_PRESENT_REGULAR', 'POR_PARA', 'PRETERITO_PERFECTO'],
    uniqueAcrossLevels: true,
    exampleRules: { minTokens: 4, maxTokens: 6, stemMinLength: 3, forbidden: [] },
    levelRules: {
      A1: { allowedCodes: ['NOUN_GENDER', 'VERB_PRESENT_REGULAR'] },
      A2: { maxTokens: 9, allowedCodes: ['NOUN_GENDER', 'VERB_PRESENT_REGULAR', 'POR_PARA', 'PRETERITO_PERFECTO'] },
    },
    ruleChecks: { POR_PARA: { mustContainAny: ['por', 'para'], exactlyOneOf: ['por', 'para'], forbiddenPhrases: ['por favor', 'por eso'] } },
  };
  const make = (a1: string[], a2: string[]) => {
    const f = fixture(a1, a2, LANG);
    expect(run('build-wordbank.mjs', ['--root', f.root, '--out', f.out]).status).toBe(0);
    const r = run('validate-wordbank.mjs', ['--root', f.root, '--out', f.out]);
    return { ...r, text: r.stderr + r.stdout };
  };
  const a1ok = row({ word: 'comer', article: '-', pos: 'verb', ex: 'Yo como pan hoy.', rule: 'VERB_PRESENT_REGULAR' });
  const a2 = (o: Record<string, string>) => row({ word: 'trabajar', article: '-', pos: 'verb', rule: 'VERB_PRESENT_REGULAR', ex: 'Quiero trabajar mañana por favor.', ...o });

  it('accepts a clean two-level bank', () => expect(make([a1ok], [a2({})]).status).toBe(0));

  it('lets a level raise the token limit', () => {
    const long = 'Quiero trabajar mañana muy temprano con mis amigos.'; // 8 tokens
    expect(make([a1ok], [a2({ ex: long })]).status).toBe(0);
    const f = make([row({ word: 'comer', article: '-', pos: 'verb', ex: 'Yo como pan hoy con mis amigos.', rule: 'VERB_PRESENT_REGULAR' })], [a2({})]);
    expect(f.status).not.toBe(0);
    expect(f.text).toMatch(/tokens \(4–6\)/);
  });

  it('rejects a code that is not allowed at the level', () => {
    const r = make([row({ word: 'comer', article: '-', pos: 'verb', ex: 'Yo como pan hoy.', rule: 'PRETERITO_PERFECTO' })], [a2({})]);
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/grammar_angle PRETERITO_PERFECTO is not allowed at A1/);
  });

  it('rejects a word that appears in two levels', () => {
    const r = make([a1ok], [a2({ word: 'Comer', ex: 'Quiero comer mañana contigo.' })]);
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/word "Comer" also appears in A1/);
  });

  it('does not require unique words across levels unless asked', () => {
    const f = fixture([a1ok], [a2({ word: 'comer', ex: 'Quiero comer mañana contigo.' })], { ...LANG, uniqueAcrossLevels: false });
    run('build-wordbank.mjs', ['--root', f.root, '--out', f.out]);
    expect(run('validate-wordbank.mjs', ['--root', f.root, '--out', f.out]).status).toBe(0);
  });

  describe('exactlyOneOf and forbiddenPhrases', () => {
    const por = (ex: string) => make([a1ok], [a2({ word: 'trabajar', rule: 'POR_PARA', ex })]);
    it('accepts exactly one of por/para', () => expect(por('Trabajo para mi familia cada día.').status).toBe(0));
    it('rejects both', () => {
      const r = por('Trabajo por mi familia para vivir.');
      expect(r.status).not.toBe(0);
      expect(r.text).toMatch(/example for POR_PARA must contain exactly one of por\/para/);
    });
    it('rejects a fixed phrase', () => {
      const r = por('Quiero trabajar mañana por favor.');
      expect(r.status).not.toBe(0);
      expect(r.text).toMatch(/example for POR_PARA uses a fixed phrase \(por favor\)/);
    });
  });
});

describe('export-review-sample (TASK-046)', () => {
  const sample = (seed: string) => {
    const bank = mkdtempSync(join(tmpdir(), 'rv-bank-'));
    const out = mkdtempSync(join(tmpdir(), 'rv-out-'));
    dirs.push(bank, out);
    const entries = Array.from({ length: 60 }, (_, i) => ({ word: `w${i}`, article: null, part_of_speech: 'verb', example: `Ejemplo número ${i} con | barra.`, example_it: 'x', cultural_note: 'n', grammar_angle: 'NOUN_GENDER' }));
    writeFileSync(join(bank, 'A1.json'), JSON.stringify(entries));
    const r = run('export-review-sample.mjs', ['--lang', 'xx', '--bank', bank, '--out', out, '--per', '40', '--seed', seed]);
    return { r, text: readFileSync(join(out, 'sample-A1.md'), 'utf8') };
  };
  it('writes 40 rows, escapes pipes and is deterministic for a seed', () => {
    const a = sample('3');
    expect(a.r.status).toBe(0);
    expect(a.text.split('\n').filter((l) => l.startsWith('| w') && !l.startsWith('| word'))).toHaveLength(40);
    expect(a.text).toContain('con \| barra');
    expect(sample('3').text).toBe(a.text);
    expect(sample('4').text).not.toBe(a.text);
  });
});
