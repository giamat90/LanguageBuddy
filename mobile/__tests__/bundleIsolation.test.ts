/** TASK-047: a build contains one language only; the generated seams are the only way a bank or pack gets in. */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { listVariants } = require('../scripts/lib/variants.js');

const root = join(__dirname, '..');
const SEAMS = ['src/languages/active.ts', 'src/data/wordbank/active.ts', 'src/i18n/wordContentLoaders.ts'];
const codes: string[] = listVariants();
const text = (p: string) => readFileSync(join(root, p), 'utf8');
const active = /export \{ (\w+) as activePack \}/.exec(text(SEAMS[0]))![1];
const others = codes.filter((c) => c !== active);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe('one language per bundle', () => {
  it('the generated seams mention only the active language', () => {
    expect(codes).toContain(active);
    for (const s of SEAMS) {
      const t = text(s);
      for (const o of others) {
        expect(t).not.toMatch(new RegExp(`wordbank/${o}/|'\\./${o}/|from '\\./${o}'`));
      }
    }
    expect(text(SEAMS[1])).toContain(`./${active}/A1.json`);
    const loaders = text(SEAMS[2]);
    for (const m of loaders.matchAll(/require\('([^']+)'\)/g)) expect(m[1]).toContain(`wordbank/${active}/i18n/`);
  });

  it('nothing else imports a bank folder or a pack file', () => {
    const skip = new Set(SEAMS.map((s) => join(root, s)));
    const files = [...walk(join(root, 'src')), ...walk(join(root, 'app'))].filter((f) => {
      if (skip.has(f)) return false;
      const rel = relative(root, f).split(sep).join('/');
      return !codes.some((c) => rel === `src/languages/${c}.ts` || rel.startsWith(`src/languages/${c}/`));
    });
    expect(files.length).toBeGreaterThan(50);
    const offenders: string[] = [];
    for (const f of files) {
      const t = readFileSync(f, 'utf8');
      for (const c of codes) {
        if (new RegExp(`wordbank/${c}/|languages/${c}['"/]`).test(t)) offenders.push(`${relative(root, f)} -> ${c}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
