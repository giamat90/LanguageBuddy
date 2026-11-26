# TASK-068 — A bundle can never carry another language's content; FrenchBuddy 1.0.2

**Status:** `done`
**Assigned to:** Developer
**Written by:** Tech Lead
**Depends on:** none

## Context
`app-release-fr-v1.0.1-1.aab`, uploaded to Play, has the FrenchBuddy package but German JavaScript (`germanbuddy.db`, German `app.config`).
`build_bundle_android_release.bat fr` stopped at `call gradlew.bat` (with `NoDefaultCurrentDirectoryInExePath` set, `cmd` does not run a
program from the current folder). Gradle was then run directly in `mobile/android`, after `with-language` had restored the German seams.
Metro bundles whatever the seams activate, and nothing compared them with the generated native project.

## Scope
### In scope
- The build script calls Gradle by path.
- A config plugin makes the Gradle JS-bundle task fail when the seams activate another language than the one prebuild generated.
- `verify-prebuild` checks that the guard is there.
- FrenchBuddy version 1.0.2 (versionCode 2) and its bundle, with the bundle's content checked.

### Out of scope
Uploading to Play, committing, pushing.

## Technical Spec
- `mobile/plugins/withLanguageGuard.js`: plugin `(config, { code })`; exports `addLanguageGuard(gradleText, code): string` (pure, idempotent,
  replaces an earlier guard block, throws on a code that is not two lowercase letters). The block hooks `tasks.configureEach` for tasks named
  `createBundle*JsAndAssets` and, in `doFirst`, throws a `GradleException` naming `with-language` unless `<mobile>/src/languages/active.ts`
  contains `export { <code> as activePack }`.
- `scripts/lib/variants.js`: add `['./plugins/withLanguageGuard', { code: variant.code }]` to the plugins.
- `scripts/lib/prebuildCheck.js`: problem `language guard for "<code>" is missing` when `app/build.gradle` lacks it.
- `build_bundle_android_release.bat`: `call .\gradlew.bat bundleRelease`.
- `variants/fr.json`: `localFallbackVersionCode` 2.

## Acceptance Criteria
- [x] Tests first (red): `languageGuardPlugin.test.ts`, `variants.test.ts`, `prebuildCheck.test.ts`
- [x] `tsc --noEmit`, `npm test`, `npm run test:app -- fr` pass
- [x] `build_bundle_android_release.bat fr` produces `app-release-fr-v1.0.2-2.aab` in one run
- [x] That bundle holds `frenchbuddy.db`, package `com.giamat90.frenchbuddy`, versionCode 2, the release signature, and no other app's database name
- [x] Gradle run outside `with-language` on the French project fails with the guard message
- [x] Seams are German afterwards
