/**
 * App variants (TASK-047): one codebase, one app per target language. Everything that differs per
 * app lives in mobile/variants/<code>.json; app.config.js, the build scripts and the tests read it
 * through here. Plain CommonJS so app.config.js, node scripts and Jest can all require it.
 */
const fs = require('fs');
const path = require('path');

const MOBILE = path.join(__dirname, '..', '..');
const DEFAULT_DIR = path.join(MOBILE, 'variants');
const DEFAULT_SRC = path.join(MOBILE, 'src');

function listVariants({ dir = DEFAULT_DIR } = {}) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
}

/** Returns a list of human-readable problems (empty = valid). `fileCode` is the name of the file it came from. */
function validateVariant(v, { root = MOBILE, fileCode } = {}) {
  const p = [];
  const str = (x) => typeof x === 'string' && x.trim() !== '';
  const int = (x, min) => Number.isInteger(x) && x >= min;
  if (!v || typeof v !== 'object') return ['variant is not an object'];
  if (!/^[a-z]{2}$/.test(v.code ?? '')) p.push('code must be two lowercase letters');
  if (fileCode !== undefined && v.code !== fileCode) p.push(`code "${v.code}" differs from the file name "${fileCode}"`);
  if (!str(v.name)) p.push('name is empty');
  if (!/^[a-z][a-z0-9]*$/.test(v.slug ?? '')) p.push('slug must match ^[a-z][a-z0-9]*$');
  if (!/^[a-z][a-z0-9]*$/.test(v.scheme ?? '')) p.push('scheme must match ^[a-z][a-z0-9]*$');
  if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/.test(v.androidPackage ?? '')) p.push(`androidPackage "${v.androidPackage}" is not a valid package name`);
  if (!str(v.iosBundleId)) p.push('iosBundleId is empty');
  const exists = (rel) => str(rel) && fs.existsSync(path.join(root, rel));
  if (!exists(v.icon)) p.push(`icon file not found: ${v.icon}`);
  if (!exists(v.adaptiveIcon?.foreground)) p.push(`adaptiveIcon.foreground file not found: ${v.adaptiveIcon?.foreground}`);
  if (!/^#[0-9a-fA-F]{6}$/.test(v.adaptiveIcon?.background ?? '')) p.push('adaptiveIcon.background must be #rrggbb');
  if (!int(v.versionMajor, 0)) p.push('versionMajor must be an integer >= 0');
  if (!int(v.versionMinor, 0)) p.push('versionMinor must be an integer >= 0');
  if (!int(v.localFallbackVersionCode, 1)) p.push('localFallbackVersionCode must be an integer >= 1');
  if ((v.owner === undefined) !== (v.easProjectId === undefined)) p.push('owner and easProjectId must both be present or both absent');
  return p;
}

function loadVariant(code, { dir = DEFAULT_DIR, root = MOBILE } = {}) {
  const file = path.join(dir, `${code}.json`);
  if (!/^[a-z]{2}$/.test(String(code)) || !fs.existsSync(file)) {
    throw new Error(`Unknown app "${code}". Known: ${listVariants({ dir }).join(', ')}`);
  }
  const v = JSON.parse(fs.readFileSync(file, 'utf8'));
  const problems = validateVariant(v, { root, fileCode: code });
  if (problems.length) throw new Error(`Invalid variant ${code}.json:\n  - ${problems.join('\n  - ')}`);
  return v;
}

/** The language the committed (or generated) seams activate: src/languages/active.ts. */
function seamLanguage(srcDir = DEFAULT_SRC) {
  const text = fs.readFileSync(path.join(srcDir, 'languages', 'active.ts'), 'utf8');
  const m = /export \{ (\w+) as activePack \}/.exec(text);
  if (!m) throw new Error('src/languages/active.ts does not activate a language (run npm run set:language)');
  return m[1];
}

/** APP_LANG if set, otherwise the seam language. Throws for an unknown code. */
function resolveAppLang(env, { srcDir = DEFAULT_SRC, dir = DEFAULT_DIR } = {}) {
  const code = env.APP_LANG || seamLanguage(srcDir);
  if (!listVariants({ dir }).includes(code)) throw new Error(`Unknown app "${code}". Known: ${listVariants({ dir }).join(', ')}`);
  return code;
}

function assertSeamMatches(code, { srcDir = DEFAULT_SRC } = {}) {
  const active = seamLanguage(srcDir);
  if (active !== code) {
    throw new Error(
      `APP_LANG is "${code}" but src/languages/active.ts activates "${active}". ` +
        `Run "npm run set:language -- ${code}" first, or run the command through "node scripts/with-language.mjs ${code} -- <command>".`,
    );
  }
}

/**
 * The whole `expo` object for one app. Play needs a strictly increasing versionCode per package:
 * CI sets ANDROID_VERSION_CODE; local builds use localFallbackVersionCode, which you bump by hand in
 * variants/<code>.json before every local release build/upload. The version name is always
 * MAJOR.MINOR.versionCode so it can never drift from the code.
 */
function buildExpoConfig(variant, env) {
  const versionCode = env.ANDROID_VERSION_CODE ? parseInt(env.ANDROID_VERSION_CODE, 10) : variant.localFallbackVersionCode;
  const expo = {
    name: variant.name,
    slug: variant.slug,
    version: `${variant.versionMajor}.${variant.versionMinor}.${versionCode}`,
    orientation: 'portrait',
    scheme: variant.scheme,
    icon: variant.icon,
    platforms: ['ios', 'android'],
    android: {
      package: variant.androidPackage,
      versionCode,
      adaptiveIcon: { foregroundImage: variant.adaptiveIcon.foreground, backgroundColor: variant.adaptiveIcon.background },
      permissions: [
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.VIBRATE',
      ],
      // The apps never touch external storage (export = cache + share sheet, import = document picker,
      // automatic backup = Storage Access Framework) and the overlay permission is a dev-only leftover.
      // expo-file-system's own manifest would otherwise merge the two storage ones back in (TASK-050).
      blockedPermissions: [
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ],
    },
    ios: { bundleIdentifier: variant.iosBundleId },
    plugins: [
      'expo-router',
      'expo-notifications',
      [
        'expo-build-properties',
        {
          android: {
            // Play's automatic protection requires minSdkVersion 24 or higher.
            minSdkVersion: 24,
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            buildToolsVersion: '36.0.0',
          },
        },
      ],
      './plugins/withReleaseSigning',
      ['./plugins/withAndroidBackupRules', { slug: variant.slug }],
      './plugins/withRtlSupport',
      './plugins/withOptionalPortrait',
    ],
    extra: { router: { origin: false } },
  };
  if (variant.easProjectId) {
    expo.extra.eas = { projectId: variant.easProjectId };
    expo.owner = variant.owner;
  }
  return expo;
}

module.exports = { listVariants, validateVariant, loadVariant, seamLanguage, resolveAppLang, assertSeamMatches, buildExpoConfig };
