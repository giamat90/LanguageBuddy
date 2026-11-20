#!/usr/bin/env node
/**
 * Validates one language's translated word content while it is being written.
 *
 *   node scripts/validate-i18n.mjs <lang> [--dir <path>] [--levels A1,A2]
 *
 * Reads <dir>/<LEVEL>.tsv (default: scripts/wordbank/i18n-wip/<lang>) and checks the
 * levels given (default: all) against the bundled word bank. Exit code 1 on any problem.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const lib = require('./wordbank-i18n-lib.cjs');
const here = dirname(fileURLToPath(import.meta.url));
const bankDir = join(here, '..', 'src', 'data', 'wordbank');

const args = process.argv.slice(2);
const lang = args[0];
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!lang || !lib.LANGS.includes(lang)) {
  console.error(`usage: validate-i18n.mjs <${lib.LANGS.join('|')}> [--dir path] [--levels A1,A2]`);
  process.exit(2);
}
const dir = resolve(opt('--dir') ?? join(here, 'wordbank', 'i18n-wip', lang));
const levels = (opt('--levels') ?? lib.LEVELS.join(',')).split(',');

const bank = {};
for (const l of lib.LEVELS) bank[l] = JSON.parse(readFileSync(join(bankDir, `${l}.json`), 'utf8'));

const problems = [];
const rows = [];
for (const level of levels) {
  const file = join(dir, `${level}.tsv`);
  if (!existsSync(file)) {
    problems.push(`${level}.tsv missing in ${dir}`);
    continue;
  }
  const parsed = lib.parseTsv(readFileSync(file, 'utf8'), level);
  problems.push(...parsed.problems.map((p) => `${lang}/${p}`));
  rows.push(...parsed.rows);
}
problems.push(...lib.validateLanguage({ lang, rows, bank, levels }));

if (problems.length) {
  console.error(`✗ ${lang}: ${problems.length} problem(s) in ${levels.join(', ')}`);
  for (const p of problems.slice(0, 60)) console.error('  - ' + p);
  if (problems.length > 60) console.error(`  … and ${problems.length - 60} more`);
  process.exit(1);
}
console.log(`✓ ${lang}: ${rows.length} entries valid in ${levels.join(', ')}`);
