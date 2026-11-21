#!/usr/bin/env node
/**
 * Usage: node scripts/with-language.mjs <code> [--root <dir> --src <dir>] -- <command> [args...]
 * Activates a language, runs the command with APP_LANG=<code>, and always puts the generated seam
 * files back exactly as they were (the repository stays German; a build never leaves them dirty).
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setActiveLanguage } from './lib/active-language.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const lib = createRequire(import.meta.url)('./wordbank-i18n-lib.cjs');
const SEAMS = ['languages/active.ts', 'data/wordbank/active.ts', 'i18n/wordContentLoaders.ts'];

/** Quotes one argument for the shell (paths such as C:\Program Files\nodejs\node.exe contain spaces). */
const quote = (a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

/** Runs the command with the language active; returns { exitCode }. */
export async function withLanguage({ code, root, src, command, args = [], env = process.env }) {
  const saved = SEAMS.map((s) => [join(src, s), readFileSync(join(src, s), 'utf8')]);
  const restore = () => saved.forEach(([p, text]) => writeFileSync(p, text));
  const { problems } = setActiveLanguage(code, { root, src, nativeCodes: lib.LANGS });
  if (problems.length) {
    console.error(`✗ Cannot activate "${code}":`);
    problems.forEach((p) => console.error('  - ' + p));
    return { exitCode: 1 };
  }
  const onSignal = () => { restore(); process.exit(1); };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  try {
    return await new Promise((resolve) => {
      const line = [command, ...args].map(quote).join(' ');
      const child = spawn(line, { stdio: 'inherit', shell: true, env: { ...env, APP_LANG: code } });
      child.on('error', (e) => { console.error(`with-language: ${e.message}`); resolve({ exitCode: 1 }); });
      child.on('exit', (status) => resolve({ exitCode: status ?? 1 }));
    });
  } finally {
    restore();
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  const dash = argv.indexOf('--');
  const head = dash >= 0 ? argv.slice(0, dash) : argv;
  const cmd = dash >= 0 ? argv.slice(dash + 1) : [];
  const opt = (name) => { const i = head.indexOf(name); return i >= 0 ? head[i + 1] : undefined; };
  const code = head[0] && !head[0].startsWith('--') ? head[0] : undefined;
  if (!code || cmd.length === 0) {
    console.error('Usage: node scripts/with-language.mjs <code> [--root <dir> --src <dir>] -- <command> [args...]');
    process.exit(2);
  }
  const { exitCode } = await withLanguage({
    code,
    root: opt('--root') ?? join(here, 'wordbank'),
    src: opt('--src') ?? join(here, '..', 'src'),
    command: cmd[0],
    args: cmd.slice(1),
  });
  process.exit(exitCode);
}
