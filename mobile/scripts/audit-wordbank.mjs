#!/usr/bin/env node
/**
 * TASK-058: compares a language's word bank with a public frequency list and prints a report.
 * It only reads: no word, tag or translation is changed, and nothing is fetched from the network.
 *
 * Usage: node scripts/audit-wordbank.mjs <code> [--reference <file>] [--out <file>] [--full]
 *        (also `--lang <code>`). The frequency list (lines "word count", most frequent first) is
 *        downloaded by hand into scripts/reference-lists/<code>.txt and is never committed.
 * Exit: 0 report produced; 2 missing reference file / unknown language.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const A = require('./lib/wordbankAudit.js');
const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const code = opt('--lang') ?? args.find((a, i) => !a.startsWith('--') && !['--reference', '--out', '--lang'].includes(args[i - 1]));
const fail = (msg) => { console.error(msg); process.exit(2); };

if (!code) fail('Usage: node scripts/audit-wordbank.mjs <code> [--reference <file>] [--out <file>] [--full]');
const srcDir = join(here, 'wordbank', code);
const cfgPath = join(srcDir, 'language.json');
if (!existsSync(cfgPath)) fail(`Unknown language "${code}": ${cfgPath} does not exist.`);
const lang = JSON.parse(readFileSync(cfgPath, 'utf8'));

const refPath = opt('--reference') ?? join(here, 'reference-lists', `${code}.txt`);
if (!existsSync(refPath)) {
  fail(`No frequency list at ${refPath}.\nDownload one by hand (lines "word count", most frequent first), e.g. hermitdave/FrequencyWords content/2018/${code}/${code}_50k.txt, and save it there.\nIt is gitignored and must never be committed.`);
}
const auditCfgPath = join(srcDir, 'audit.json');
const cfg = existsSync(auditCfgPath) ? JSON.parse(readFileSync(auditCfgPath, 'utf8')) : {};
const minShare = cfg.minTopicShare ?? A.DEFAULTS.minTopicShare;

const entries = [];
for (const level of lang.levels ?? A.LEVELS) {
  const f = join(here, '..', 'src', 'data', 'wordbank', code, `${level}.json`);
  if (existsSync(f)) entries.push(...JSON.parse(readFileSync(f, 'utf8')));
}
if (!entries.length) fail(`No built word bank for ${code}; run npm run build:wordbank first.`);

const rankMap = A.parseFrequencyList(readFileSync(refPath, 'utf8'));
const out = [];
const short = [];
const say = (s = '') => { out.push(s); short.push(s); };
const full = (s = '') => out.push(s);
const pct = (x) => `${Math.round(x * 100)}%`;

say(`# Word-bank audit: ${code} (${entries.length} words) against ${rankMap.size} listed words`);
say('Reference lists built from subtitles favour everyday speech; C1/C2 flags are weaker evidence than A1/A2 ones. Verbs are lemmas and rank lower than conjugated forms.');
say();

const stats = A.levelStats(entries, rankMap, code);
say('## 1. Level medians');
say('level  words  found  median  top1000  top3000  top10000');
for (const s of stats) say(`${s.level.padEnd(5)}  ${String(s.count).padStart(5)}  ${String(s.found).padStart(5)}  ${String(s.median ?? '-').padStart(6)}  ${pct(s.top1000).padStart(7)}  ${pct(s.top3000).padStart(7)}  ${pct(s.top10000).padStart(8)}`);
say(A.isMonotone(stats) ? 'Medians rise with the level: OK' : 'Medians do NOT rise with the level: NOT MONOTONE');
say();

const mis = A.misplaced(entries, rankMap, code, cfg);
const perLevel = Object.fromEntries(stats.map((s) => [s.level, s.count]));
const flaggedShare = (rows) => Object.entries(rows.reduce((g, r) => ({ ...g, [r.level]: (g[r.level] || 0) + 1 }), {})).filter(([l, n]) => n / perLevel[l] > 0.25).map(([l]) => l);
say('## 2. Words that look misplaced');
for (const [title, rows] of [['too rare for their level', mis.tooRare], ['very common for their level', mis.tooCommon]]) {
  say(`${title}: ${rows.length}`);
  const bad = flaggedShare(rows);
  if (bad.length) say(`  thresholds are probably wrong for this list (over 25% of ${bad.join(', ')} flagged)`);
  const fmt = (r) => `  ${r.level} ${r.word} (rank ${r.rank}, ${r.topic}) — ${r.example}`;
  rows.slice(0, 25).forEach((r) => say(fmt(r)));
  rows.slice(25).forEach((r) => full(fmt(r)));
  if (rows.length > 25) say(`  … ${rows.length - 25} more (see --out)`);
}
say();

const nf = A.notFound(entries, rankMap, code).byLevel;
say('## 3. Not found in the list');
for (const l of A.LEVELS) if (nf[l]) { say(`${l}: ${nf[l].length}`); (nf[l].length > 40 ? full : say)(`  ${nf[l].join(', ')}`); }
say();

const gaps = A.coverageGaps(rankMap, entries.map((e) => e.word), code, cfg);
say(`## 4. Frequent words missing from the bank (${gaps.candidates.length} candidates, ${gaps.skipped} tokens skipped as stop words, numbers or single letters)`);
say('Many are inflected forms of a word the bank has; these are candidates only.');
say(gaps.candidates.slice(0, 100).map((c) => `${c.word} (${c.rank})`).join(', '));
if (gaps.candidates.length > 100) full(gaps.candidates.slice(100).map((c) => `${c.word} (${c.rank})`).join(', '));
say();

const tb = A.topicBalance(entries, minShare);
const topics = [...new Set(entries.map((e) => e.topic_domain))].sort();
say(`## 5. Topic balance (topics under ${pct(minShare)} of a level are thin)`);
say(`level  ${topics.map((t) => t.padStart(9)).join(' ')}`);
for (const l of Object.keys(tb.table)) say(`${l.padEnd(5)}  ${topics.map((t) => String(tb.table[l][t] || 0).padStart(9)).join(' ')}`);
for (const l of Object.keys(tb.thin)) if (tb.thin[l].length) say(`thin at ${l}: ${tb.thin[l].join(', ')}`);

console.log(short.join('\n'));
const outFile = opt('--out');
if (outFile) writeFileSync(outFile, out.join('\n') + '\n');
