/** TASK-048: the public pages of each app are rendered from one set of templates. */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { de } from '../src/languages/de';
import { es } from '../src/languages/es';
/* eslint-disable @typescript-eslint/no-var-requires */
const store = require('../scripts/lib/store.js');

const repo = join(__dirname, '..', '..');
const tplDir = join(repo, 'store', 'support-template');
const PAGES = ['privacy-policy.html', 'terms-of-service.html', 'contact.html', 'delete-account.html'];
const script = join(__dirname, '..', 'scripts', 'build-store.mjs');
const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

function build(code: string, extra: string[] = []) {
  const out = mkdtempSync(join(tmpdir(), 'store-'));
  dirs.push(out);
  const r = spawnSync(process.execPath, [script, code, '--out', out, ...extra], { encoding: 'utf8' });
  return { ...r, out };
}
const page = (out: string, name: string) => readFileSync(join(out, 'support', name), 'utf8');
const headings = (html: string) => [...html.matchAll(/<h[23][^>]*>(.*?)<\/h[23]>/g)].map((m) => m[1]);

describe('the templates', () => {
  it('name no app and no language outside a token', () => {
    for (const f of PAGES) {
      const text = readFileSync(join(tplDir, f), 'utf8').replace(/\{\{[A-Z_]+\}\}/g, '');
      expect(text).not.toMatch(/german|spanish/i);
    }
  });
  it('use only known tokens', () => {
    for (const f of PAGES) {
      const used = [...readFileSync(join(tplDir, f), 'utf8').matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]);
      expect(used.length).toBeGreaterThan(0);
      for (const t of used) expect(store.TOKENS).toContain(t);
    }
  });
});

describe('render', () => {
  const values = { APP: 'XBuddy' };
  it('replaces known tokens', () => expect(store.render('hi {{APP}}', values, 't')).toBe('hi XBuddy'));
  it('throws on an unknown token', () => expect(() => store.render('{{NOPE}}', values, 't')).toThrow(/unknown token \{\{NOPE\}\} in t/));
  it('throws on a known token without a value', () => expect(() => store.render('{{TARGET}}', values, 't')).toThrow(/unresolved/));
});

describe('loadSupport', () => {
  it('rejects a missing field', () => {
    const root = mkdtempSync(join(tmpdir(), 'store-root-'));
    dirs.push(root);
    mkdirSync(join(root, 'store', 'xx'), { recursive: true });
    writeFileSync(join(root, 'store', 'xx', 'support.json'), JSON.stringify({ developer: 'D', year: '2026' }));
    expect(() => store.loadSupport('xx', { root })).toThrow(/lastUpdated|supportUrl/);
  });
  it('reads the real files', () => {
    for (const c of ['de', 'es', 'fr']) expect(store.loadSupport(c).supportUrl).toMatch(/^https:\/\/.+\/$/);
  });
});

describe('language facts without importing TypeScript', () => {
  it('names and UI-language counts equal the packs', () => {
    for (const [code, pack] of [['de', de], ['es', es]] as const) {
      const cfg = store.languageConfig(code);
      expect(cfg.name).toBe(pack.name);
      expect(store.uiLangCount(cfg)).toBe(pack.uiLanguages.length);
    }
  });
});

describe('build-store.mjs', () => {
  it('renders the Spanish site: names, headings, links, icon', () => {
    const r = build('es');
    expect(r.status).toBe(0);
    expect(readdirSync(join(r.out, 'support')).sort()).toEqual([...PAGES, 'icon.png'].sort());
    for (const f of PAGES) {
      const html = page(r.out, f);
      expect(html).not.toContain('{{');
      expect(html).toContain('SpanishBuddy');
      expect(html).not.toMatch(/german/i);
      for (const m of html.matchAll(/href="([a-z-]+\.html)"/g)) expect(PAGES).toContain(m[1]);
    }
    const contact = page(r.out, 'contact.html');
    expect(contact).toContain(`mailto:${store.loadSupport('es').supportEmail}`);
    expect(contact).not.toMatch(/formspree|REPLACE_WITH|<form|fetch\(/i);
  });

  it('renders German with the same structure', () => {
    const g = build('de');
    const s = build('es');
    expect(g.status).toBe(0);
    expect(g.stdout).toMatch(/no listing/i);
    expect(existsSync(join(g.out, 'listing'))).toBe(false);
    for (const f of PAGES) {
      expect(page(g.out, f)).toContain('GermanBuddy');
      expect(page(g.out, f)).not.toMatch(/spanish/i);
      expect(headings(page(g.out, f)).map((h) => h.replace(/German|Spanish/g, 'X'))).toEqual(
        headings(page(s.out, f)).map((h) => h.replace(/German|Spanish/g, 'X')),
      );
    }
  });

  it('gives each app its own colours and icon, from the app palette', () => {
    const g = build('de');
    const s = build('es');
    for (const f of PAGES) {
      expect(page(s.out, f)).toContain('--primary: #AA151B');
      expect(page(s.out, f)).not.toContain('#1E4A67');
      expect(page(g.out, f)).toContain('--primary: #1E4A67');
      expect(page(g.out, f)).not.toContain('#AA151B');
    }
    // the Spanish site shows the Spanish icon, not GermanBuddy's
    expect(readFileSync(join(s.out, 'support', 'icon.png')).equals(readFileSync(join(__dirname, '..', 'assets', 'icon-es.png')))).toBe(true);
    expect(readFileSync(join(g.out, 'support', 'icon.png')).equals(readFileSync(join(__dirname, '..', 'assets', 'icon.png')))).toBe(true);
  });

  it('keeps the page colours of every language equal to the app palette', () => {
    const pal = readFileSync(join(__dirname, '..', 'src', 'theme', 'palettes.ts'), 'utf8');
    const codes = [...pal.matchAll(/\n  ([a-z]{2}): \{/g)].map((m) => m[1]);
    expect(codes.length).toBeGreaterThanOrEqual(3);
    for (const code of codes) {
      expect(Object.keys(store.SUPPORT_COLORS)).toContain(code); // a new app needs its page colours
      const block = pal.match(new RegExp(`\n  ${code}: \{([^}]*)\}`))![1];
      const hex = (k: string) => block.match(new RegExp(`${k}: '(#[0-9A-Fa-f]{6})'`))![1].toLowerCase();
      const c = store.SUPPORT_COLORS[code];
      expect(c.C_PRIMARY.toLowerCase()).toBe(hex('primary'));
      expect(c.C_PRIMARY_LIGHT.toLowerCase()).toBe(hex('primaryLight'));
      expect(c.C_CREAM.toLowerCase()).toBe(hex('cream'));
      expect(c.C_GOLD.toLowerCase()).toBe(hex('gold'));
      expect(c.C_TEXT.toLowerCase()).toBe(hex('ink'));
      expect(c.C_PRIMARY_DARK.toLowerCase()).toBe(hex('ink'));
      const rgb = hex('ink').slice(1).match(/../g)!.map((h) => parseInt(h, 16)).join(', ');
      expect(c.C_INK_RGB).toBe(rgb);
    }
  });

  it('keeps the substance of the policy', () => {
    const html = page(build('es').out, 'privacy-policy.html');
    for (const phrase of ['no account', 'Firebase Cloud Messaging', 'text-to-speech', 'Spanish word', 'Delete', 'fonts.googleapis.com']) {
      expect(html).toContain(phrase);
    }
    expect(html).toContain(`Last updated: ${store.loadSupport('es').lastUpdated}`);
    expect(html).not.toMatch(/formspree/i); // the contact page is a mailto link, no form processor receives data
  });

  // TASK-081: the request holds the word's meaning (lib/ai/wordInsight.ts), so every text about it says so.
  it('names the meaning among the data sent to the AI provider', () => {
    const html = page(build('es').out, 'privacy-policy.html');
    const item = html.match(/<li>Only the word[^\n]*<\/li>/)![0];
    expect(item).toContain('its meaning');
    expect(html).toContain('<td>A single word, its meaning, CEFR level, and native language — no other app data</td>');
    expect(html).not.toContain('nothing else');
  });

  it('says the same in the project rules and every checklist', () => {
    const read = (...p: string[]) => readFileSync(join(repo, ...p), 'utf8');
    expect(read('CLAUDE.md').split('\n').find((l) => l.startsWith('- **Privacy rules'))).toContain('its meaning');
    for (const c of readdirSync(join(repo, 'store'))) {
      for (const [file, row] of [['play-checklist.md', /^\| Optional AI feature .*$/m], ['qa-checklist.md', /^\| [\d.]+ \| Inspect the request .*$/m]] as const) {
        if (!existsSync(join(repo, 'store', c, file))) continue;
        const found = read('store', c, file).match(row)?.[0];
        if (file === 'play-checklist.md' || found) expect([c, file, found]).toEqual([c, file, expect.stringContaining('meaning')]);
      }
    }
  });

  it('every app has a support email, and a missing or malformed one fails loading', () => {
    for (const c of ['de', 'es', 'fr']) expect(store.loadSupport(c).supportEmail).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
    const root = mkdtempSync(join(tmpdir(), 'store-root-'));
    dirs.push(root);
    mkdirSync(join(root, 'store', 'xx'), { recursive: true });
    const base = { developer: 'D', year: '2026', lastUpdated: 'x', supportUrl: 'https://a.b/c/' };
    for (const bad of [undefined, '', 'not-an-email']) {
      writeFileSync(join(root, 'store', 'xx', 'support.json'), JSON.stringify({ ...base, supportEmail: bad }));
      expect(() => store.loadSupport('xx', { root })).toThrow(/supportEmail/);
    }
  });

  it('an unknown app is a usage error', () => {
    expect(spawnSync(process.execPath, [script, 'zz'], { encoding: 'utf8' }).status).toBe(2);
    expect(spawnSync(process.execPath, [script], { encoding: 'utf8' }).status).toBe(2);
  });
});
