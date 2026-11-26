'use strict';
/**
 * Pure checks of a generated Android project (the output of `expo prebuild`) against its app variant.
 * `checkPrebuild(androidDir, variant, other)` returns a list of problems (empty = fine); it only reads files.
 * `other` = the variants of the other apps, so a leftover package/name of another app is caught.
 */
const fs = require('fs');
const path = require('path');

/** What app.config.js asks for. */
const DECLARED_PERMISSIONS = [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.VIBRATE',
];
/**
 * The one permission beyond the declared ones: INTERNET, for the optional AI call. A new permission
 * (e.g. RECORD_AUDIO) fails the check and needs a conscious decision.
 */
const KNOWN_EXTRA_PERMISSIONS = ['android.permission.INTERNET'];
/**
 * Blocked on purpose (TASK-050): the apps use no external storage and no overlay. They must appear only as
 * `<uses-permission ... tools:node="remove"/>`, which is how Expo writes `android.blockedPermissions`.
 */
const FORBIDDEN_PERMISSIONS = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.SYSTEM_ALERT_WINDOW',
];

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function checkPrebuild(androidDir, variant, others = [], expected = {}) {
  const problems = [];
  const main = path.join(androidDir, 'app', 'src', 'main');
  const gradle = read(path.join(androidDir, 'app', 'build.gradle'));
  const manifest = read(path.join(main, 'AndroidManifest.xml'));
  const strings = read(path.join(main, 'res', 'values', 'strings.xml'));
  if (!gradle) problems.push('app/build.gradle is missing');
  if (!manifest) problems.push('AndroidManifest.xml is missing');
  if (!gradle || !manifest) return problems;

  const grab = (re) => (gradle.match(re) || [])[1];
  if (grab(/applicationId\s+['"]([^'"]+)['"]/) !== variant.androidPackage) problems.push(`applicationId is not ${variant.androidPackage}`);
  if (grab(/namespace\s+['"]([^'"]+)['"]/) !== variant.androidPackage) problems.push(`namespace is not ${variant.androidPackage}`);
  if (expected.versionCode !== undefined && Number(grab(/versionCode\s+(\d+)/)) !== expected.versionCode) {
    problems.push(`versionCode is not ${expected.versionCode}`);
  }
  if (expected.versionName !== undefined && grab(/versionName\s+['"]([^'"]+)['"]/) !== expected.versionName) {
    problems.push(`versionName is not ${expected.versionName}`);
  }

  const appName = strings && (strings.match(/<string name="app_name">([^<]*)<\/string>/) || [])[1];
  if (appName !== variant.name) problems.push(`app_name is "${appName}", expected "${variant.name}"`);

  // TASK-068: Gradle must refuse to bundle another language into this project.
  if (!gradle.includes(`export { ${variant.code} as activePack }`)) problems.push(`language guard for "${variant.code}" is missing`);

  // Backup rules: names follow the slug, both files exist, and the secrets stay out.
  const m = manifest.match(/<application\b[^>]*>/);
  const app = m ? m[0] : '';
  if (!/android:allowBackup="true"/.test(app)) problems.push('allowBackup is not "true"');
  const rules = `@xml/${variant.slug}_backup_rules`;
  if (!app.includes(`android:dataExtractionRules="${rules}"`)) problems.push(`dataExtractionRules does not point at ${rules}`);
  if (!app.includes(`android:fullBackupContent="${rules}_legacy"`)) problems.push(`fullBackupContent does not point at ${rules}_legacy`);
  for (const f of [`${variant.slug}_backup_rules.xml`, `${variant.slug}_backup_rules_legacy.xml`]) {
    const xml = read(path.join(main, 'res', 'xml', f));
    if (!xml) { problems.push(`res/xml/${f} is missing`); continue; }
    for (const secret of ['mmkv/ai', 'mmkv/notifications-store', 'mmkv/auto-backup']) {
      if (!xml.includes(`<exclude domain="file" path="${secret}"`)) problems.push(`${f} does not exclude ${secret}`);
    }
  }

  // Permissions: the declared three, INTERNET, and nothing else. A `tools:node="remove"` entry is a block, not a declaration.
  const perms = [];
  const removed = [];
  for (const el of manifest.matchAll(/<uses-permission\b[^>]*>/g)) {
    const name = (el[0].match(/android:name="([^"]+)"/) || [])[1];
    if (!name) continue;
    (/tools:node="remove"/.test(el[0]) ? removed : perms).push(name);
  }
  for (const p of DECLARED_PERMISSIONS) if (!perms.includes(p)) problems.push(`permission ${p} is missing`);
  for (const p of perms) {
    if (FORBIDDEN_PERMISSIONS.includes(p)) problems.push(`forbidden permission ${p} is declared (block it with tools:node="remove")`);
    else if (!DECLARED_PERMISSIONS.includes(p) && !KNOWN_EXTRA_PERMISSIONS.includes(p)) problems.push(`unexpected permission ${p}`);
  }
  for (const p of FORBIDDEN_PERMISSIONS) if (!removed.includes(p)) problems.push(`permission ${p} is not blocked`);

  if (!/android:screenOrientation="portrait"/.test(manifest)) problems.push('the activity is not portrait');
  if (!/<uses-feature android:name="android.hardware.screen.portrait" android:required="false"\/>/.test(manifest)) {
    problems.push('screen.portrait feature is missing or required');
  }
  if (!manifest.includes(`<data android:scheme="${variant.scheme}"/>`)) problems.push(`URL scheme ${variant.scheme} is missing`);

  // Nothing of another app may remain anywhere under app/src/main or in the gradle file.
  const files = [...walk(main), path.join(androidDir, 'app', 'build.gradle')].filter((f) => /\.(xml|gradle|java|kt|json)$/.test(f));
  for (const o of others) {
    for (const f of files) {
      const text = read(f) || '';
      if (text.includes(o.androidPackage) || text.includes(o.name)) {
        problems.push(`${path.relative(androidDir, f)} mentions the other app ${o.name}`);
      }
    }
  }
  return problems;
}

module.exports = { checkPrebuild, DECLARED_PERMISSIONS, KNOWN_EXTRA_PERMISSIONS, FORBIDDEN_PERMISSIONS };
