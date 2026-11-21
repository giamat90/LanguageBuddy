#!/usr/bin/env node
/** Usage: node scripts/set-active-language.mjs <code> [--root <dir> --src <dir>]   (default: de). Regenerates the active-language seams. */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setActiveLanguage } from './lib/active-language.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const lib = createRequire(import.meta.url)('./wordbank-i18n-lib.cjs');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const code = args[0] && !args[0].startsWith('--') ? args[0] : 'de';
const { problems } = setActiveLanguage(code, {
  root: opt('--root') ?? join(here, 'wordbank'),
  src: opt('--src') ?? join(here, '..', 'src'),
  nativeCodes: lib.LANGS,
});
if (problems.length) {
  console.error(`✗ Cannot activate "${code}":`);
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log(`✓ Active language: ${code}`);
