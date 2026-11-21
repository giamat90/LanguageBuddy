#!/usr/bin/env node
/**
 * Usage: node scripts/test-app.mjs <code> [--print-command] [jest args...]
 * Runs the language-neutral suite (__tests__/activeApp) with <code> activated through with-language
 * (the seams are restored afterwards). It never runs the other tests: they assert German content.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { withLanguage } from './with-language.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { listVariants } = createRequire(import.meta.url)('./lib/variants.js');
const argv = process.argv.slice(2);
const code = argv[0] && !argv[0].startsWith('--') ? argv[0] : undefined;
const rest = argv.slice(1);
const print = rest.includes('--print-command');
const jestArgs = rest.filter((a) => a !== '--print-command');

if (!code || !listVariants().includes(code)) {
  console.error(`Usage: node scripts/test-app.mjs <code> [jest args]\nKnown apps: ${listVariants().join(', ')}`);
  process.exit(2);
}
const command = 'npx';
const args = ['jest', '--watchAll=false', '__tests__/activeApp', ...jestArgs];
if (print) {
  console.log([command, ...args].join(' '));
  process.exit(0);
}
const { exitCode } = await withLanguage({
  code, root: join(here, 'wordbank'), src: join(here, '..', 'src'), command, args,
});
process.exit(exitCode);
