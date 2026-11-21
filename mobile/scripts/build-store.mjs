#!/usr/bin/env node
/**
 * Usage: node scripts/build-store.mjs <code> [--out <dir>] [--allow-placeholder] [--form-id <id>]
 * Renders the public support pages (and the Play listing texts, when the app has them) of one app
 * from store/support-template and store/<code>/ into <out> (default store/<code>/dist, gitignored).
 * Exit: 0 ok, 1 validation / contact-form problem, 2 usage.
 */
import { createRequire } from 'node:module';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobile = join(here, '..');
const repo = join(mobile, '..');
const require = createRequire(import.meta.url);
const store = require('./lib/store.js');
const { loadVariant, listVariants } = require('./lib/variants.js');

const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const code = argv[0] && !argv[0].startsWith('--') ? argv[0] : undefined;
const usage = (msg) => { console.error(`${msg}\nUsage: node scripts/build-store.mjs <code> [--out <dir>] [--allow-placeholder] [--form-id <id>]`); process.exit(2); };
if (!code) usage('missing app code');
if (!listVariants().includes(code)) usage(`unknown app "${code}". Known: ${listVariants().join(', ')}`);

const variant = loadVariant(code);
const cfg = store.languageConfig(code);
const support = store.loadSupport(code);
const allowPlaceholder = argv.includes('--allow-placeholder');
const formId = opt('--form-id') ?? support.contactFormId ?? undefined;
const problems = [];
const warnings = [];

let effectiveFormId = formId;
if (!effectiveFormId) {
  if (allowPlaceholder) {
    effectiveFormId = `REPLACE_WITH_${variant.slug.toUpperCase()}_FORMSPREE_ID`;
    warnings.push(`contact form: using the placeholder ${effectiveFormId} (set "contactFormId" in store/${code}/support.json before publishing)`);
  } else {
    problems.push(`store/${code}/support.json: "contactFormId" is null. Create a Formspree form and put its id there (or pass --allow-placeholder for a draft build).`);
  }
}

let wordCount = 0;
for (const lv of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
  wordCount += JSON.parse(readFileSync(join(mobile, 'src', 'data', 'wordbank', code, `${lv}.json`), 'utf8')).length;
}
const values = store.tokenValues({
  variant, targetName: cfg.name, support, wordCount, uiLangCount: store.uiLangCount(cfg), formId: effectiveFormId,
});

// Render everything in memory first: nothing is written when anything is wrong.
const files = new Map();
const tplDir = join(repo, 'store', 'support-template');
if (!problems.length) {
  for (const f of readdirSync(tplDir).filter((n) => n.endsWith('.html')).sort()) {
    try {
      files.set(join('support', f), store.render(readFileSync(join(tplDir, f), 'utf8'), values, f));
    } catch (e) {
      problems.push(e.message);
    }
  }
}
const listingDir = join(repo, 'store', code, 'listing');
const status = [];
if (!problems.length && existsSync(listingDir)) {
  for (const f of readdirSync(listingDir).filter((n) => n.endsWith('.json')).sort()) {
    const ui = f.replace(/\.json$/, '');
    const listing = JSON.parse(readFileSync(join(listingDir, f), 'utf8'));
    const lp = store.validateListing(listing, { lang: ui, values });
    if (lp.length) { lp.forEach((m) => problems.push(`listing ${ui}: ${m}`)); continue; }
    for (const field of ['title', 'short', 'full']) files.set(join('listing', ui, `${field}.txt`), store.render(listing[field], values, `${ui}.${field}`) + '\n');
    status.push(`${ui}: ${listing.status}`);
  }
  files.set('STATUS.txt', status.join('\n') + '\n');
}

if (problems.length) {
  console.error(`✗ Store build for "${code}" has ${problems.length} problem(s):`);
  problems.forEach((m) => console.error('  - ' + m));
  process.exit(1);
}

const out = opt('--out') ?? join(repo, 'store', code, 'dist');
for (const [rel, text] of files) {
  mkdirSync(dirname(join(out, rel)), { recursive: true });
  writeFileSync(join(out, rel), text);
}
copyFileSync(join(mobile, 'assets', 'icon.png'), join(out, 'support', 'icon.png'));
warnings.forEach((m) => console.error(`warning: ${m}`));
console.log(`✓ ${code}: support pages -> ${join(out, 'support')}`);
if (existsSync(listingDir)) {
  console.log(`✓ ${code}: listing in ${status.length} language(s) -> ${join(out, 'listing')}`);
  console.log('  Publish only languages whose status is "reviewed"; "draft" texts are machine-written and unread by a native speaker.');
} else {
  console.log(`  (no listing for ${code}: store/${code}/listing does not exist)`);
}
