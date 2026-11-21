#!/usr/bin/env node
/** Usage: node scripts/set-active-language.mjs <code>   (default: de). Regenerates the active-language seams. */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setActiveLanguage } from './lib/active-language.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const lib = createRequire(import.meta.url)('./wordbank-i18n-lib.cjs');
const code = process.argv[2] ?? 'de';
const { problems } = setActiveLanguage(code, {
  root: join(here, 'wordbank'),
  src: join(here, '..', 'src'),
  nativeCodes: lib.LANGS,
});
if (problems.length) {
  console.error(`✗ Cannot activate "${code}":`);
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log(`✓ Active language: ${code}`);
