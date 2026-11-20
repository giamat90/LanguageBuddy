#!/usr/bin/env node
// Usage: node scripts/check-16kb.js <file.aab|file.apk>   (npm run check:16kb -- <file>)
const { check } = require('./lib/elfAlign');

const file = process.argv[2];
if (!file) {
  console.error('usage: check-16kb <file.aab|file.apk>');
  process.exit(2);
}
let results;
try {
  results = check(file);
} catch (e) {
  console.error(`check-16kb: ${e.message}`);
  process.exit(2);
}
if (results.length === 0) {
  console.log('FAIL  no 64-bit native libraries found');
  process.exit(1);
}
for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'}  ${r.file}  align=${r.align}`);
}
const bad = results.filter((r) => !r.ok).length;
console.log(`${results.length - bad}/${results.length} libraries are 16 KB ready`);
process.exit(bad ? 1 : 0);
