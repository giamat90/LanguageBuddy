# TASK-026 — Support 16 KB memory pages (Expo SDK 51 → 53 upgrade)

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-025 (done)

---

## Context

Google Play rejects versionCode 13 with "La tua app non supporta le dimensioni delle pagine di memoria di 16 kB". Since 1 Nov 2025 every
app that targets Android 15+ (ours targets 36) must ship native libraries aligned for 16 KB pages. The libraries that come with
React Native 0.74 / Expo SDK 51 (Hermes, `libreactnativejni`, fbjni, `react-native-mmkv` 2.x, reanimated, screens, …) are built for 4 KB pages, and no
config flag fixes that. React Native 0.77 was the first release built 16 KB-aligned; **Expo SDK 53 (React Native 0.79, React 19)** is the target.
SDK 53 was chosen over 54 because SDK 54 changes `expo-file-system` (the default import becomes the new API) and drops the legacy architecture, which is a second migration we do not need now.

CLAUDE.md §3 (Tech Stack) must be updated when this lands.

---

## Scope

### In scope
- Upgrade the dependency set to Expo SDK 53 and fix whatever that breaks (types, mocks, config, Jest).
- Move `react-native-mmkv` to the 3.x line (SDK 53 enables the New Architecture, which MMKV 3 requires) **without losing existing stored data**.
- Remove or regenerate the `expo-modules-core` patch.
- A small, tested verification script that proves the built bundle's native libraries are 16 KB-ready (so the next Play rejection cannot be a surprise).
- Bump the version, build a bundle, verify it, update `CONTEXT.md` and `CLAUDE.md` §3.

### Out of scope
- SDK 54 or later, any new feature, any UI change, any change to the data schema.
- Publishing to Play (the Product Owner uploads).
- Enabling/disabling the New Architecture beyond what SDK 53 does by default.

---

## Acceptance Criteria

- [ ] AC1: `package.json` is on SDK 53 versions as resolved by `npx expo install --fix` (expo ~53, react-native 0.79.x, react 19.0.x, jest-expo ~53, and every `expo-*` and native library at the version SDK 53 pins).
- [ ] AC2: `react-native-mmkv` is 3.x (latest 3.x that passes AC6). All 7 call sites keep `new MMKV({ id })` unchanged.
- [ ] AC3: `npx tsc --noEmit` is clean and `npm test` is green. No test is deleted or weakened to make it pass; the test count does not go down.
- [ ] AC4: `npx expo-doctor` reports no errors.
- [ ] AC5: `npm run check:16kb -- <path>` exits 0 for the new release bundle and non-zero for the old 1.0.13 bundle (Developer runs both and records the output in CONTEXT.md).
- [ ] AC6: On a phone, with the **1.0.13 build installed and populated** (profile, vault words, AI key, notification settings), installing the new build over it keeps all data: onboarding is not shown again, vault and streak are intact, the AI key is still present, reminders still fire. Product Owner confirms; Developer lists these as manual steps in CONTEXT.md.
- [ ] AC7: All 4 plugins (`withReleaseSigning`, `withAndroidBackupRules`, `withRtlSupport`, `expo-build-properties`) still apply: the generated manifest still has `supportsRtl="true"`, the backup rules, and release signing (existing plugin tests stay green).
- [ ] AC8: versionCode is higher than every code on Play (internal has 13): set `LOCAL_FALLBACK_VERSION_CODE` to 14, or higher if Play has used more.

---

## Technical Spec

### Files to create
```
mobile/scripts/check-16kb.mjs        — CLI: node scripts/check-16kb.mjs <file.aab|file.apk|file.so>
mobile/scripts/lib/elfAlign.mjs      — pure functions (exported, no I/O except where noted)
mobile/__tests__/elfAlign.test.ts    — tests for the above (builds synthetic ELF buffers)
```

### Files to modify
```
mobile/package.json                  — dependency versions, script "check:16kb"
mobile/package-lock.json             — regenerated
mobile/app.config.js                 — LOCAL_FALLBACK_VERSION_CODE; only touch other fields if expo-doctor demands it
mobile/patches/expo-modules-core+1.12.26.patch — delete (see step 4)
mobile/__mocks__/*.js                — only if an SDK 53 API change breaks them
mobile/jest config in package.json   — transformIgnorePatterns / moduleNameMapper if needed
CLAUDE.md §3 and §2, CONTEXT.md      — new stack versions, status, test count, decision log
```

### Implementation notes

**Step 0 — baseline.** On a clean tree run `npx tsc --noEmit` and `npm test`; write down the test count. Work on `main` (no branches).
Optionally keep a copy of the current 1.0.13 `.aab` outside the repo: it is the negative case for AC5 and the starting point for AC6.

**Step 1 — write the verification tool first (red).** `elfAlign.mjs` exports:
```js
// ELF64 little-endian only (arm64-v8a, x86_64). Returns the minimum p_align over all PT_LOAD program headers.
export function minLoadAlign(elf /* Buffer */): number          // throws Error('not an ELF file') / ('unsupported ELF class')
export function isSixteenKbReady(elf /* Buffer */): boolean     // minLoadAlign(elf) >= 16384
// Lists lib/<abi>/*.so entries of a zip (.aab: base/lib/<abi>/*.so; .apk: lib/<abi>/*.so), 64-bit ABIs only.
export function check(path /* string */): { file: string; abi: string; ok: boolean; align: number }[]
```
Rules: only the 64-bit ABIs (`arm64-v8a`, `x86_64`) are checked, 32-bit libraries are exempt from the Play rule. For `.apk` also verify
uncompressed `.so` entries start at a 16384-byte offset (zip local-header data offset % 16384 === 0); for `.aab` skip the zip check (Play re-packages).
Use the `fflate` or `adm-zip` package as a **devDependency** only, or write a minimal central-directory reader; Developer picks the smaller option and notes it.
`check-16kb.mjs` prints one line per library (`OK  arm64-v8a/libhermes.so  align=16384`), a summary, and exits 1 if any library fails or none were found.

**Step 2 — tests for the tool (see Tests), watch them fail, implement, green.**

**Step 3 — upgrade.**
```
cd mobile
npx expo install expo@^53.0.0
npx expo install --fix
npm install react-native-mmkv@^3        # then pin the highest 3.x that passes AC5; 3.2.0 is the first line with 16 KB support, re-check with the tool
npx expo-doctor
```
Then, in this order, run `npx tsc --noEmit` and `npm test` and fix what breaks. Known areas to expect (verify, do not assume):
- React 19: `@types/react` to ~19, `@testing-library/react-native` to a version that supports React 19 (>= 13.2); `react-test-renderer` to match. Fix type errors in components; do not change behaviour.
- `expo-router` 5: check `app/_layout` files and any typed-route usage; routes and screens stay the same.
- `expo-sqlite` 15: we already use the async API (`openDatabaseAsync`, `getFirstAsync`, `runAsync`, `execAsync`) and `addDatabaseChangeListener`; confirm those names and the `enableChangeListener` option still exist. `__mocks__/expo-sqlite.js` mirrors them.
- `expo-file-system` stays on the legacy API in SDK 53 (`import * as FileSystem` in `backup.ts` and `autoBackup/index.ts`, including the SAF calls); do not migrate it.
- `expo-notifications`: the trigger types changed in recent versions (`type: SchedulableTriggerInputTypes.DAILY` etc.). Update `lib/notifications.ts` and `__mocks__/expo-notifications.js`; the observable behaviour (reminder time, ids stored in MMKV `notifications-store`) must not change.
- `react-native-reanimated` and `react-native-gesture-handler`: keep `react-native-reanimated/plugin` as the last babel plugin (SDK 53 may want `react-native-worklets`-free setup; follow what `expo-doctor` and the installed reanimated version require).
- `react-native-mmkv` 3: same constructor and methods (`getString`, `set`, `delete`, `getAllKeys`, `clearAll`). The Jest mock `__mocks__/react-native-mmkv.js` already maps the module; keep the mapping.
- Anything that fails because of a removed React Native API: fix it minimally and list it in CONTEXT.md.

**Step 4 — the patch.** `patches/expo-modules-core+1.12.26.patch` fixes a nullable `requestedPermissions` in the old `expo-modules-core`. After the upgrade the version no
longer matches. Check whether the installed `expo-modules-core` source already has `requestedPermissions?.contains(permission) == true`; if yes delete the patch file. If not,
regenerate it with `npx patch-package expo-modules-core` after applying the same one-line change. `postinstall: patch-package` must exit 0 on a fresh `npm ci`.

**Step 5 — build and verify.**
1. Set `LOCAL_FALLBACK_VERSION_CODE` (AC8).
2. `build_bundle_android_release.bat` (it runs `expo prebuild --clean`, which regenerates `android/`). Confirm in the generated `android/` that the NDK is r28 or newer
   (SDK 53's default NDK is 27, which is enough for React Native's own libraries; if `check:16kb` reports failures in third-party libraries, set `ndkVersion` to r28 through a small `expo-build-properties`/config-plugin change and re-run).
3. `npm run check:16kb -- ../Bundles/app-release-v1.0.<code>-<code>.aab` must pass (AC5). Run it against the old bundle too, to prove it can fail.
4. If a specific third-party library still fails, report its name and the version that fixes it; do not hide it.

**Step 6 — docs.** Update `CONTEXT.md` (status, test count, the SDK change, the manual AC6 checklist, a decision-log row: "SDK 53 chosen over 54: legacy expo-file-system API and legacy architecture are still available"), `CLAUDE.md` §3 table (Framework, Navigation, flags), and `CLAUDE.md` §2 if the patch folder disappears. Remove Known Issues made obsolete.

---

## Database Changes

None. The SQLite file and MMKV files are not migrated or renamed. (MMKV 3 reads the files MMKV 2 wrote, same ids; AC6 proves it on a device.)

---

## Tests

Write first and watch fail. Files: `__tests__/elfAlign.test.ts` (import the `.mjs`; if Jest cannot import it add the file to the transform or provide a `.ts` re-export, whichever is smaller).

### Pure logic (`elfAlign`)
- `minLoadAlign_reads_16k_alignment` — synthetic ELF64 LE with two PT_LOAD headers, p_align 0x4000 each → 16384.
- `minLoadAlign_returns_smallest_of_several_PT_LOAD` — aligns 0x4000 and 0x1000 → 4096.
- `minLoadAlign_ignores_non_load_headers` — a PT_NOTE with p_align 8 does not lower the result.
- `isSixteenKbReady_true_for_16k_and_64k` — 0x4000 and 0x10000 → true; 0x1000 → false.
- `rejects_non_elf_buffer` — random bytes throw "not an ELF file".
- `rejects_elf32` — class byte 1 throws "unsupported ELF class".
- `check_skips_32bit_abis` — a zip with `lib/armeabi-v7a/libx.so` (4 KB) and `lib/arm64-v8a/liby.so` (16 KB) → only arm64 reported, all ok.
- `check_reports_failing_library` — arm64 `.so` aligned 4 KB → entry `ok: false`.
- `check_apk_flags_misaligned_stored_so` — uncompressed `.so` entry at offset not divisible by 16384 → `ok: false` (APK only).
- `cli_exits_nonzero_when_no_libraries_found` — empty zip.

### Regression (existing suites)
- The whole existing suite stays green, including `uiStringsParity`, backup/restore, auto-backup, notifications and exercise tests. Report the before/after test counts.
- Add `appConfig.test.ts` only if it does not exist: asserts `minSdkVersion` is 24, `targetSdkVersion` is 36 and that the plugin list still contains the three local plugins (guards against an upgrade silently dropping them).

### Manual (Product Owner, listed in CONTEXT.md)
- Upgrade-over-install test of AC6 on a real phone, plus one full pass: today's word, save, review, practice, grammar, settings (language incl. Arabic RTL), backup export/restore, and the optional AI "Approfondisci" if a key is set.

---

## Definition of Done

- [ ] All acceptance criteria checked (AC6 by the Product Owner)
- [ ] All specified tests written, seen red, and green; `npx tsc --noEmit` clean; `npm test` green
- [ ] `check:16kb` output for the new and the old bundle pasted into CONTEXT.md
- [ ] No keystore, `Bundles/`, `android/` or secrets in the diff (`git status` checked)
- [ ] Review checklist from CLAUDE.md §13 done (notably: stored data survives the upgrade, notification scheduling unchanged, no new network code)
- [ ] CONTEXT.md and CLAUDE.md §3 updated in the same commit
- [ ] Conventional commit: `feat(TASK-026): upgrade to Expo SDK 53 for 16 KB page-size support`
- [ ] TASK status updated to `done`; stop, do not push unless asked

---

## Notes for Tech Lead

- Exact SDK 53 package versions are deliberately not written here: `expo install --fix` is the source of truth and the Developer must not hand-pick them.
- Risk is concentrated in (1) React 19 typing/test-library changes, (2) MMKV 3 and the New Architecture, (3) the notification trigger API. If MMKV 3 fails on a device in AC6, stop and report; do not write a data-migration shim without a new spec.
- Play's Data safety form and the privacy policy are unaffected (no new data leaves the device).
- After release, delete the stale draft releases for versionCodes 11 and 13 if they are still around in Play Console.
