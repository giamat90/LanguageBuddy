# TASK-047 — App variants: one codebase, one app per language

**Status:** `ready`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-046b (pushed, `013c26b`)

## Context
TASK-041–046b made the code, the Spanish pack and the Spanish word bank language-neutral: one language is "active" per build, selected by three generated seams (`src/languages/active.ts`, `src/data/wordbank/active.ts`, `src/i18n/wordContentLoaders.ts`, written by `scripts/set-active-language.mjs`). What is still German-only is everything *around* the code: `app.config.js` (name, slug, scheme, package, icons, version), the three Windows build scripts, the release workflow (`packageName: com.giamat90.germanbuddy`, tag `v<version>`), the Android backup plugin's resource names and the auto-backup file name. This task makes the build choose the app: `APP_LANG=es` produces SpanishBuddy (`com.giamat90.spanishbuddy`) from the same tree, `de` stays byte-for-byte what it is today. Store text, real icons and legal pages are TASK-048; the phone QA is TASK-049.

## Scope
### In
1. **Variant files** `mobile/variants/<code>.json` (de, es): the only place that differs per app (name, slug, scheme, packages, icons, version fields, EAS block).
2. **`scripts/lib/variants.js`** (plain CommonJS, used by `app.config.js`, scripts and Jest): `loadVariant`, `listVariants`, `validateVariant`, `resolveAppLang`, `assertSeamMatches`, `buildExpoConfig`.
3. **`app.config.js`** becomes a thin wrapper over it.
4. **`scripts/with-language.mjs`**: activates a language, runs a command with `APP_LANG` set, and **always restores the previous seams** (the repo stays German; a build must never leave generated files dirty).
5. `withAndroidBackupRules` takes the resource slug as an option; `autoBackupFileName` uses the pack's backup tag.
6. Build scripts (`build_bundle_android_release.bat`, `deploy_local_release_android.bat`, `deploy_local_debug_android.bat`) take an optional language argument; `build_get_version.ps1` reads the right app.
7. `release-android.yml` gets an `app` input; the release tag becomes per app.
8. Tests (below), `.gitignore`, `CONTEXT.md`, README line, spec status.

### Out
Real Spanish icon and store graphics, store listing, privacy-policy/terms pages (TASK-048); phone QA, TTS check on a real device, first Play upload (TASK-049); iOS; EAS builds for Spanish (only `de` keeps its `extra.eas`); renaming the npm package or any German user-visible behaviour; DB column renames; changing the word bank, packs or validator.

## Decisions (made here, do not revisit)
- **No Metro alias.** The generated seams already make the bundle static: a build imports only the active language's bank, translated tables and pack. An alias would add a second mechanism for no gain. Instead a test pins the property (below).
- **Which app builds?** `APP_LANG` if set; otherwise the language the committed seam files currently activate (so a plain `npm test`/`expo start` on the German repo is `de`, no env needed). If `APP_LANG` is set and the seams activate a different language, `app.config.js` **throws** with the fix in the message (a Spanish package with German content must be impossible). `build_get_version.ps1` only reads version numbers and sets `APP_LANG_CHECK_SEAM=0` to skip that check; nothing else does.
- **Per-app versioning.** Play versionCodes are per package, so each variant has its own `localFallbackVersionCode` (bumped by hand before a local release, as today, but in `variants/<code>.json`). `ANDROID_VERSION_CODE` (CI) still overrides. Version name stays `MAJOR.MINOR.versionCode`. de starts at 1.0.20 (current), es at **1.0.1**.
- **Release tags.** de keeps `v<version>` (history, `releaseTag(version)` unchanged); other apps use `<code>-v<version>` (e.g. `es-v1.0.1`) so two apps never collide.
- **Icons.** es reuses the German art for now (`./assets/icon.png`, `./assets/adaptive-icon.png`) but has a different adaptive-icon background (`#8a1c1c`) so the two apps can be told apart on one test phone. Real art arrives in TASK-048.
- **Clean prebuild every time** in the build/deploy scripts: `android/` is generated and gitignored, and switching app means a different package, so a stale `android/` would silently build the wrong app.
- Backup/restore files keep their existing format; the automatic-backup file name becomes `<backupTag lowercased>-auto-<date>-<time>` (identical to today for German).

## Acceptance Criteria
- [ ] `mobile/variants/de.json` and `es.json` exist; every value the German app has today (name, slug, scheme, android package, ios bundle id, owner, EAS project id, icons, adaptive background, version 1.0 + fallback 20) is in `de.json` and `app.config.js` produces an **identical** `expo` object for `de` (tests pin it field by field, including the plugin list).
- [ ] `APP_LANG=es` (with the seams on es) gives name `SpanishBuddy`, slug/scheme `spanishbuddy`, package `com.giamat90.spanishbuddy`, no `extra.eas` / `owner`, version `1.0.<code>`, same SDK levels and the same plugins as German.
- [ ] `APP_LANG=es` with German seams throws a message naming `npm run set:language -- es` and `scripts/with-language.mjs`; an unknown `APP_LANG` throws and lists the known variants.
- [ ] `node scripts/with-language.mjs es -- <cmd>` runs `<cmd>` with `APP_LANG=es` and the Spanish seams, returns the command's exit code, and leaves the three seam files exactly as they were — also when the command fails. An unknown language exits non-zero, runs nothing and changes nothing.
- [ ] The Android backup rules resources are named `<slug>_backup_rules` / `<slug>_backup_rules_legacy`; German still gets `germanbuddy_backup_rules*` (existing tests untouched).
- [ ] `autoBackupFileName` is `germanbuddy-auto-…` for German and `spanishbuddy-auto-…` under the Spanish pack.
- [ ] A test proves a build contains one language only: the three generated seams mention only the active code, and no file under `src/` or `app/` outside those seams imports another language's bank folder or pack file.
- [ ] `release-android.yml` has an `app` choice input (de default), no hard-coded package name, derives the package from the variant, runs the language activation before prebuild and bundling, and tags `v…` (de) or `<code>-v…`; a test reads the workflow text for those properties.
- [ ] The three `.bat` files accept `de`/`es` (default `de`), do a clean prebuild inside `with-language`, and name the bundle `app-release-v<ver>-<code>.aab` for de (unchanged) and `app-release-es-v<ver>-<code>.aab` for es.
- [ ] `npx tsc --noEmit` clean, `npm test` green, German tests unchanged and green. No change to generated seams, word banks or `src/` behaviour for German.
- [ ] `CONTEXT.md` updated; spec status `done`.

## Technical Spec

### Files to create
```
mobile/variants/de.json
mobile/variants/es.json
mobile/scripts/lib/variants.js
mobile/scripts/with-language.mjs
mobile/__tests__/variants.test.ts
mobile/__tests__/withLanguage.test.ts
mobile/__tests__/bundleIsolation.test.ts
mobile/__tests__/releaseWorkflow.test.ts
```
### Files to modify
```
mobile/app.config.js                          thin wrapper (below)
mobile/plugins/withAndroidBackupRules.js      slug option, default 'germanbuddy'
mobile/src/lib/autoBackup/helpers.ts          file name from the active pack
mobile/scripts/lib/playVersion.js             releaseTag(version, code?)
mobile/package.json                           scripts: "with:language": "node scripts/with-language.mjs"
build_bundle_android_release.bat, deploy_local_release_android.bat, deploy_local_debug_android.bat, build_get_version.ps1
.github/workflows/release-android.yml
.gitignore                                    + mobile/spanishbuddy.db
mobile/__tests__/appConfig.test.ts            keep; add nothing that breaks for de
mobile/__tests__/backupRulesPlugin.test.ts, autoBackupHelpers.test.ts, playVersion.test.ts   new cases
README.md (one line: how to build another language), CONTEXT.md, tasks/TASK-047.md (status)
```

### `variants/<code>.json`
```json
{
  "code": "de",
  "name": "GermanBuddy",
  "slug": "germanbuddy",
  "scheme": "germanbuddy",
  "androidPackage": "com.giamat90.germanbuddy",
  "iosBundleId": "com.germanbuddy",
  "icon": "./assets/icon.png",
  "adaptiveIcon": { "foreground": "./assets/adaptive-icon.png", "background": "#0f2d44" },
  "versionMajor": 1,
  "versionMinor": 0,
  "localFallbackVersionCode": 20,
  "owner": "giamat",
  "easProjectId": "8eb48752-1c1a-4169-a031-9e916c8b33da"
}
```
`es.json`: code `es`, name `SpanishBuddy`, slug and scheme `spanishbuddy`, `androidPackage` `com.giamat90.spanishbuddy`, `iosBundleId` `com.spanishbuddy`, same icon files, adaptive background `#8a1c1c`, 1 / 0 / **1**, `owner` and `easProjectId` **omitted** (optional fields).

### `scripts/lib/variants.js` (CommonJS, no dependencies)
```js
loadVariant(code, { dir? })        // reads variants/<code>.json; throws `Unknown app "xx". Known: de, es` / validation errors
listVariants({ dir? })             // sorted codes from the folder
validateVariant(v, { root? })      // returns string[] of problems (empty = valid)
resolveAppLang(env, { srcDir? })   // env.APP_LANG ?? seamLanguage(srcDir); throws on an unknown code
seamLanguage(srcDir)               // parses src/languages/active.ts: /export \{ (\w+) as activePack \}/ -> code
assertSeamMatches(code, { srcDir? })   // throws if seamLanguage !== code; skipped by the caller when env.APP_LANG_CHECK_SEAM === '0'
buildExpoConfig(variant, env)      // the whole `expo` object (see below)
```
`validateVariant` rules: `code` is two letters and equals the file name; `name` non-empty; `slug` and `scheme` match `^[a-z][a-z0-9]*$`; `androidPackage` matches `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$`; `iosBundleId` is a non-empty string; `icon` and `adaptiveIcon.foreground` exist on disk relative to `mobile/`; `adaptiveIcon.background` matches `^#[0-9a-fA-F]{6}$`; `versionMajor`, `versionMinor` integers ≥ 0; `localFallbackVersionCode` an integer ≥ 1; `easProjectId` and `owner` either both present or both absent.

`buildExpoConfig(variant, env)` returns exactly today's `expo` object with these substitutions: `name`, `slug`, `scheme`, `icon`, `android.package`, `android.adaptiveIcon`, `ios.bundleIdentifier`, `version` (`${major}.${minor}.${code}`), `android.versionCode` (`env.ANDROID_VERSION_CODE` parsed as in today's code, else `localFallbackVersionCode`); `owner` and `extra.eas` only when the variant has them; `extra.router` always; the plugin list identical to today's, except `./plugins/withAndroidBackupRules` becomes `['./plugins/withAndroidBackupRules', { slug: variant.slug }]`. Keep the explanatory comments about versionCode that live in `app.config.js` today (move them to `variants.js`; shorten, do not lose the "bump before every local release" rule — it now says "in `variants/<code>.json`").

### `app.config.js`
```js
const { loadVariant, resolveAppLang, assertSeamMatches, buildExpoConfig } = require('./scripts/lib/variants');
const code = resolveAppLang(process.env);
if (process.env.APP_LANG && process.env.APP_LANG_CHECK_SEAM !== '0') assertSeamMatches(code);
module.exports = { expo: buildExpoConfig(loadVariant(code), process.env) };
```
(When `APP_LANG` is unset the code *is* the seam language, so the check is only needed when it is set.)

### `scripts/with-language.mjs`
`node scripts/with-language.mjs <code> [--root <dir> --src <dir>] -- <command> [args…]`
1. Read the three seam files' current text (`src/languages/active.ts`, `src/data/wordbank/active.ts`, `src/i18n/wordContentLoaders.ts`; `--src` overrides `src`).
2. `setActiveLanguage(code, { root, src, nativeCodes })` exactly as `set-active-language.mjs` does; on problems print them and exit 1 **without running anything** (nothing was written, so nothing to restore).
3. Spawn the command with `stdio: 'inherit'`, `shell: true` (Windows `.cmd` shims), env `{ ...process.env, APP_LANG: code }`.
4. In a `finally` (and on `SIGINT`/`SIGTERM`) write the three saved texts back verbatim; exit with the child's exit code (1 if it was killed by a signal). A missing `--` or command → usage message, exit 2.
Implement it as a small exported function `withLanguage({ code, root, src, command, args, env })` returning `{ exitCode }` plus the CLI wrapper, so the test can call it directly.

### Backup plugin and auto-backup name
- `withAndroidBackupRules(config, options = {})`: `const slug = options.slug ?? 'germanbuddy'`; `RULES_RES_NAME = \`${slug}_backup_rules\``, legacy likewise. Make the two constants per-call (move them into the function). Everything else unchanged.
- `autoBackupFileName(now)`: prefix `${getActivePack().app.backupTag.toLowerCase()}-auto-`. Import `getActivePack` from `src/languages` (read it at call time, not at import time). The pruning logic and everything else stay as is.

### `releaseTag`
`releaseTag(version, code = 'de')` → `v${version}` for `de`, `${code}-v${version}` otherwise (`code` must match `^[a-z]{2,3}$`, else throw). The existing validation of `version` stays.

### Build scripts (Windows)
Common pattern for the three `.bat` files:
```
set APP_LANG=%~1
if "%APP_LANG%"=="" set APP_LANG=de
if /I "%~2"=="--inner" goto :inner
cd /d "%~dp0mobile" || exit /b 1
call node scripts\with-language.mjs %APP_LANG% -- cmd /c ""%~f0" %APP_LANG% --inner"
exit /b %errorlevel%
:inner
… the existing body …
```
- `build_bundle_android_release.bat` (inner): the prebuild is already clean; read `VERSION_NAME VERSION_CODE` through `build_get_version.ps1` (which now runs with `APP_LANG` in the environment and `APP_LANG_CHECK_SEAM=0` set inside the ps1 before it requires the config); name the output `app-release%SUFFIX%-v%VERSION_NAME%-%VERSION_CODE%.aab` with `SUFFIX=` empty for `de` and `-%APP_LANG%` otherwise.
- `deploy_local_release_android.bat` and `deploy_local_debug_android.bat`: inner body = `npx expo prebuild --platform android --clean` then the existing `expo run:android …` line. (Read the debug script first and keep its flags.) A debug run keeps Metro alive, so the Spanish seams stay active until it exits; say so in a `::` comment.
- `build_get_version.ps1`: `$env:APP_LANG_CHECK_SEAM = '0'` before the `node -e` call; it already inherits `APP_LANG`.

### `release-android.yml`
- New first input `app` (`choice`, options `de`, `es`, default `de`).
- Right after checkout: step `Select app` (id `app`): `echo "APP_LANG=${{ inputs.app }}" >> "$GITHUB_ENV"`; `npm ci` is done later, so run the activation **after** "Install dependencies": step `Activate language` → `node scripts/set-active-language.mjs "$APP_LANG"` (no restore needed on a throw-away runner), then a step `Resolve package` (id `pkg`) writing `package=$(node -p "require('./app.config.js').expo.android.package")` to `$GITHUB_OUTPUT`.
- The versionCode guard step runs after those (it already reads the package from `app.config.js`, so it now checks the right app); the tag becomes `node -p "require('./scripts/lib/playVersion').releaseTag(require('./app.config.js').expo.version, process.env.APP_LANG)"`.
- `packageName: ${{ steps.pkg.outputs.package }}`; artifact name `app-release-${{ inputs.app }}-v<code>`.
- Order matters: install → activate → resolve package → guard → signing files → prebuild → bundle → …

## Tests (write first, see them red)

### `variants.test.ts`
- de: `buildExpoConfig(loadVariant('de'), {})` has name `GermanBuddy`, slug/scheme `germanbuddy`, package `com.giamat90.germanbuddy`, ios `com.germanbuddy`, owner `giamat`, EAS project id above, version `1.0.20`, versionCode 20, adaptive background `#0f2d44`, `minSdkVersion` 24 / `targetSdkVersion` 36, plugin names equal to today's list (`expo-router`, `expo-notifications`, `expo-build-properties`, the five local plugins) with the backup plugin carrying `{ slug: 'germanbuddy' }`.
- `ANDROID_VERSION_CODE=57` gives versionCode 57 and version `1.0.57` for both apps.
- es: package `com.giamat90.spanishbuddy`, slug/scheme `spanishbuddy`, name `SpanishBuddy`, version `1.0.1`, no `owner`, no `extra.eas`, `extra.router` present, backup plugin `{ slug: 'spanishbuddy' }`, adaptive background `#8a1c1c`, otherwise the same plugin list and SDK levels as de.
- Every variant file validates with no problems; packages, slugs and schemes are unique across variants; `variant.code === pack.code` and `variant.name === pack.app.name` for the packs in `src/languages` (de, es); the lowercased `pack.app.backupTag` equals `variant.slug`.
- `validateVariant` rejects, one case each: a bad package (`Com.Foo`), a missing icon file, a bad colour, `versionCode` 0, `owner` without `easProjectId`, a code that differs from the file name (use temp dirs).
- `loadVariant('xx')` throws and the message lists `de` and `es`.
- `resolveAppLang`: env wins; unset → the seam language of a temp `src/languages/active.ts`; an unknown env value throws. `assertSeamMatches('es')` against a German seam throws a message containing `set:language` and `with-language`; against matching seams it returns.
- Requiring the real `app.config.js` (use `jest.isolateModules`, restore env after): no env → de config; `APP_LANG=de` → de; `APP_LANG=es` → throws (the repo seams are German); `APP_LANG=es` with `APP_LANG_CHECK_SEAM=0` → the es config.

### `withLanguage.test.ts` (temp folders with minimal fixtures: `wordbank/<code>/language.json`, `src/languages/<code>.ts` stubs, `src/data/wordbank/<code>/A1..C2.json` = `[]`, and the three German-looking seam files)
- success: seams read es inside the command (the command is `node -e` printing the content of `src/languages/active.ts` and `process.env.APP_LANG`), exit code 0, seams identical to before afterwards (compare bytes).
- the command exits 3 → `withLanguage` returns 3 and the seams are restored.
- the command throws/spawn fails (non-existent binary) → restored, non-zero.
- unknown language → non-zero, the command never ran (a marker file does not exist), seams unchanged.
- draft/incomplete language (missing level file) → non-zero, seams unchanged.
- guard check: remove the `finally` restore once and confirm the "restored" tests go red.

### `bundleIsolation.test.ts`
- The three generated seam files contain no language code other than the active one (`wordbank/de/` and `languages/de'` only, or only `es`, depending on the active seam — read it from the file, so the test holds for either) and `wordContentLoaders.ts` only references `wordbank/<active>/i18n/`.
- Walk `src/` and `app/` (`.ts`, `.tsx`; skip `src/languages/<code>.ts` and `src/languages/<code>/` themselves, the three seams, and `__tests__`): no file imports `wordbank/<code>/` or `languages/<code>` for any code in `listVariants()` — the only way a bank or pack reaches the bundle is through the seams. (If a legitimate file shows up, stop and report it; do not widen the allow-list silently.)

### `releaseWorkflow.test.ts` (text checks on the YAML)
- contains an `app:` input with `de` and `es`; contains no literal `com.giamat90`; `packageName:` uses `steps.pkg.outputs.package`; the step that runs `set-active-language.mjs` comes after `npm ci` and before the first `check-play-version`/`expo prebuild`; the tag command passes the language to `releaseTag`.

### Existing test files, new cases
- `backupRulesPlugin.test.ts`: slug `spanishbuddy` yields `spanishbuddy_backup_rules` and `spanishbuddy_backup_rules_legacy` in both the written resource files and the manifest attributes; no options still yields the `germanbuddy_*` names.
- `autoBackupHelpers.test.ts`: under `setActivePackForTests(es)` the name is `spanishbuddy-auto-20261008-153045` (restore in `afterEach`); German cases untouched.
- `playVersion.test.ts`: `releaseTag('1.0.20')` is `v1.0.20`; `releaseTag('1.0.1', 'es')` is `es-v1.0.1`; a bad code (`'ES'`, `'e'`, `'../x'`) throws.

## Definition of Done
- [ ] Criteria checked; tests written first and seen red; guard checks done where named
- [ ] `npx tsc --noEmit`, `npm test` green
- [ ] **Smoke by hand, reported with the output**: `node scripts/with-language.mjs es -- node -e "console.log(require('./app.config.js').expo.android.package)"` prints `com.giamat90.spanishbuddy` and `git status` is clean afterwards; the same without the wrapper (`APP_LANG=es node -e …`) fails with the seam message. (An actual `.bat` build is not run here: it needs the Android toolchain; the Product Owner runs `build_bundle_android_release.bat es` in TASK-049. Say so.)
- [ ] Diff review: German output unchanged, no seam/bank change, only the files above
- [ ] `CONTEXT.md` updated (047 done, how to build Spanish, the per-app version fields moved to `variants/`, 048 next), README line, status `done`
- [ ] Conventional commit `feat(TASK-047): app variants and per-language build`

## Notes for Tech Lead (remove before handing over)
- The only subtle bit is the bundle: Gradle runs Metro, so the seams must be on `es` for the whole `prebuild` + `gradlew bundleRelease` — hence the `cmd /c "%~f0" … --inner` self-call inside `with-language`. If the Developer finds `cmd /c` quoting hard, a simpler equivalent is two `.bat` files (`…_inner.bat`); either is acceptable, the behaviour is what is tested by hand.
- Rejected: committing both languages' seams per app folder (`apps/de`, `apps/es`) — duplicates `app/` and breaks the "one tree" goal; a Metro `resolver.alias` — second mechanism, no benefit (see Decisions); environment-only selection without a seam guard — a Spanish package with German content is the failure we most want to make impossible.
- Watch in TASK-048/049: per-app `extra.eas` is omitted for es, so `build_eas_production_android.bat` is German-only on purpose; `GoogleCloud/` service account must be granted access to the new Play app; the Play Data-safety form and policy URLs are per app.
