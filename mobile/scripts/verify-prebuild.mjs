#!/usr/bin/env node
/**
 * Usage: node scripts/verify-prebuild.mjs <code>
 * Runs `expo prebuild` for one app (language activated through with-language) and checks the generated
 * Android project against the app's variant. Refuses to run when mobile/android/ already exists and
 * removes the folder it created. Exit: 0 ok, 1 problems, 2 usage / refused.
 */
import { createRequire } from 'node:module';
import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { withLanguage } from './with-language.mjs';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const mobile = join(here, '..');
const { listVariants, loadVariant, buildExpoConfig } = require('./lib/variants.js');
const { checkPrebuild } = require('./lib/prebuildCheck.js');

const code = process.argv[2];
if (!code || !listVariants().includes(code)) {
  console.error(`Usage: node scripts/verify-prebuild.mjs <code>\nKnown apps: ${listVariants().join(', ')}`);
  process.exit(2);
}
const androidDir = join(mobile, 'android');
if (existsSync(androidDir)) {
  console.error('mobile/android/ already exists: delete it first; this script never deletes an existing android/.');
  process.exit(2);
}

const variant = loadVariant(code);
const others = listVariants().filter((c) => c !== code).map((c) => loadVariant(c));
const cfg = buildExpoConfig(variant, process.env);
let problems;
try {
  const { exitCode } = await withLanguage({
    code, root: join(here, 'wordbank'), src: join(mobile, 'src'),
    command: 'npx', args: ['expo', 'prebuild', '--platform', 'android', '--no-install'],
  });
  if (exitCode !== 0) {
    console.error(`expo prebuild failed (exit ${exitCode})`);
    process.exit(1);
  }
  problems = checkPrebuild(androidDir, variant, others, { versionCode: cfg.android.versionCode, versionName: cfg.version });
} finally {
  rmSync(androidDir, { recursive: true, force: true });
}
console.log(`prebuild check for ${variant.name} (${variant.androidPackage}, versionCode ${cfg.android.versionCode}):`);
if (problems.length === 0) console.log('  OK: package, version, name, backup rules, permissions, orientation, scheme, no other app.');
for (const p of problems) console.log(`  PROBLEM: ${p}`);
process.exit(problems.length ? 1 : 0);
