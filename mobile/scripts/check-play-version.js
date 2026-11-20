#!/usr/bin/env node
// Usage: node scripts/check-play-version.js [requestedCode] [--used 12,13] [--key service-account.json]
//   npm run check:play-version -- 16
// Credentials: env GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (the JSON text) or --key <file>.
// Exit: 0 ok, 1 requested code not higher than what Play holds, 2 usage / auth / API error.
const fs = require('fs');
const { fetchPlayVersionCodes, assertNewVersionCode } = require('./lib/playVersion');

function fail(code, message) {
  console.error(`check-play-version: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const out = { requested: undefined, used: undefined, key: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--used') out.used = argv[++i];
    else if (argv[i] === '--key') out.key = argv[++i];
    else if (out.requested === undefined) out.requested = argv[i];
    else fail(2, `unexpected argument "${argv[i]}"`);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.requested !== undefined && !/^\d+$/.test(args.requested)) {
    fail(2, `versionCode must be a positive integer, got "${args.requested}"`);
  }

  let used;
  if (args.used !== undefined) {
    used = args.used.split(',').filter(Boolean).map(Number);
    if (used.some((n) => !Number.isInteger(n) || n <= 0)) fail(2, '--used must be a comma-separated list of integers');
  } else {
    let raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '';
    if (args.key) {
      try { raw = fs.readFileSync(args.key, 'utf8'); } catch { fail(2, `cannot read key file ${args.key}`); }
    }
    if (!raw.trim()) fail(2, 'no credentials: set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON or pass --key <file>');
    let serviceAccount;
    try { serviceAccount = JSON.parse(raw); } catch { fail(2, 'the service account JSON is not valid JSON'); }
    const packageName = require('../app.config.js').expo.android.package;
    try {
      used = await fetchPlayVersionCodes({ serviceAccount, packageName });
    } catch (e) {
      fail(2, e.message);
    }
  }

  const highest = used.length ? Math.max(...used) : 0;
  console.log(`Google Play versionCodes in use: ${used.length ? used.join(', ') : '(none)'}`);
  console.log(`Highest on Google Play: ${highest}`);
  if (args.requested === undefined) return;

  try {
    assertNewVersionCode(args.requested, used);
  } catch (e) {
    fail(1, e.message);
  }
  console.log(`OK: versionCode ${args.requested} is higher than ${highest}`);
}

main().catch((e) => fail(2, e.message));
