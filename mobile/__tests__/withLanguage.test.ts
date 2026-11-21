/** TASK-047: with-language.mjs activates a language for one command and always restores the seams. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(__dirname, '..', 'scripts', 'with-language.mjs');
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const SEAMS = ['src/languages/active.ts', 'src/data/wordbank/active.ts', 'src/i18n/wordContentLoaders.ts'];

function fixture(opts: { missingLevel?: boolean } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'withlang-'));
  dirs.push(base);
  const root = join(base, 'wordbank');
  const src = join(base, 'src');
  for (const code of ['de', 'es']) {
    mkdirSync(join(root, code), { recursive: true });
    writeFileSync(join(root, code, 'language.json'), JSON.stringify({ code, levels: LEVELS }));
    mkdirSync(join(src, 'languages'), { recursive: true });
    writeFileSync(join(src, 'languages', `${code}.ts`), `export const ${code} = {};\n`);
    mkdirSync(join(src, 'data', 'wordbank', code), { recursive: true });
    for (const l of LEVELS) {
      if (opts.missingLevel && code === 'es' && l === 'C2') continue;
      writeFileSync(join(src, 'data', 'wordbank', code, `${l}.json`), '[]');
    }
  }
  mkdirSync(join(src, 'i18n'), { recursive: true });
  writeFileSync(join(src, 'languages', 'active.ts'), "// GENERATED\nexport { de as activePack } from './de';\n");
  writeFileSync(join(src, 'data', 'wordbank', 'active.ts'), '// GENERATED\nexport const LEVEL_FILES = {};\n');
  writeFileSync(join(src, 'i18n', 'wordContentLoaders.ts'), '// GENERATED\nexport const WORD_CONTENT_LOADERS = {};\n');
  return { base, root, src, read: () => SEAMS.map((p) => readFileSync(join(base, p), 'utf8')) };
}

function run(f: ReturnType<typeof fixture>, code: string, cmdArgs: string[]) {
  return spawnSync(process.execPath, [script, code, '--root', f.root, '--src', f.src, '--', ...cmdArgs], { encoding: 'utf8' });
}

/** A command script that records what it saw. */
function probe(f: ReturnType<typeof fixture>, exit = 0) {
  const out = join(f.base, 'probe.json');
  const file = join(f.base, 'probe.js');
  writeFileSync(file, `require('fs').writeFileSync(${JSON.stringify(out)}, JSON.stringify({ lang: process.env.APP_LANG,
    seam: require('fs').readFileSync(${JSON.stringify(join(f.src, 'languages', 'active.ts'))}, 'utf8') })); process.exit(${exit});`);
  return { file, read: () => JSON.parse(readFileSync(out, 'utf8')), ran: () => existsSync(out) };
}

describe('with-language.mjs', () => {
  it('activates the language for the command and restores the seams afterwards', () => {
    const f = fixture();
    const before = f.read();
    const p = probe(f);
    const r = run(f, 'es', [process.execPath, p.file]);
    expect(r.status).toBe(0);
    expect(p.read().lang).toBe('es');
    expect(p.read().seam).toContain('es as activePack');
    expect(f.read()).toEqual(before);
  });

  it('returns the exit code of the command and still restores', () => {
    const f = fixture();
    const before = f.read();
    const r = run(f, 'es', [process.execPath, probe(f, 3).file]);
    expect(r.status).toBe(3);
    expect(f.read()).toEqual(before);
  });

  it('restores when the command cannot even start', () => {
    const f = fixture();
    const before = f.read();
    const r = run(f, 'es', ['definitely-not-a-real-binary-047']);
    expect(r.status).not.toBe(0);
    expect(f.read()).toEqual(before);
  });

  it('an unknown language runs nothing and changes nothing', () => {
    const f = fixture();
    const before = f.read();
    const p = probe(f);
    const r = run(f, 'zz', [process.execPath, p.file]);
    expect(r.status).not.toBe(0);
    expect(p.ran()).toBe(false);
    expect(f.read()).toEqual(before);
  });

  it('an incomplete language runs nothing and changes nothing', () => {
    const f = fixture({ missingLevel: true });
    const before = f.read();
    const p = probe(f);
    const r = run(f, 'es', [process.execPath, p.file]);
    expect(r.status).not.toBe(0);
    expect(p.ran()).toBe(false);
    expect(f.read()).toEqual(before);
  });

  it('asks for a command after --', () => {
    const f = fixture();
    const r = spawnSync(process.execPath, [script, 'es', '--root', f.root, '--src', f.src], { encoding: 'utf8' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/Usage/i);
  });
});
