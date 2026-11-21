# TASK-049 — QA of the language apps: one suite for every app, a prebuild check, a phone checklist

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-048 (pushed, `0d77e6d`)

## Context
Everything up to now was tested with the **German** seams active; Spanish was exercised through temp copies and per-pack unit tests. Nothing yet runs the *app code* (services, backup, notifications, speech, exercises, catalog) with the Spanish pack, bank and content really active, and nothing checks what `expo prebuild` produces for the Spanish package. This task closes that gap with automation wherever a phone is not needed, and turns the rest into a checklist the Product Owner can run on a phone. Its output is also the release gate for the next language (French, Italian…): adding a language must mean adding one row to a table and getting the same suite green.

## Scope
### In
1. **`__tests__/activeApp/`**: a suite that is written once and runs for whichever app is active (language-neutral assertions plus a per-app expectations table). It runs in the normal `npm test` (German) and, through a new `npm run test:app -- es`, with Spanish activated.
2. **`scripts/test-app.mjs <code>`** (`npm run test:app`): `with-language` + Jest on `__tests__/activeApp` only; and a CI step that runs it for `es`.
3. **`scripts/verify-prebuild.mjs <code>`** + pure `scripts/lib/prebuildCheck.js`: runs `expo prebuild` for an app and checks the generated native project against its variant.
4. **Fix the German-collation leak** in `lib/catalog.ts` (found while scoping this task, below) and any other German assumption the new suite exposes.
5. **`store/es/qa-checklist.md`**: the phone QA, with a result column for the Product Owner.
6. `CONTEXT.md`, spec status.

### Out
Running anything on a phone (Product Owner), uploading to Play, native review of Spanish words and translations, new features, screenshots, changing exercise or SRS behaviour for German.

## Known finding (fix it, with a failing test first)
`src/lib/catalog.ts:76` sorts the word lists with `localeCompare(…, 'de', …)`. Under Spanish this puts *ñ* with *n*; Spanish collation sorts it after *n* (and ignores nothing else). The sort locale must come from the active pack. Do it without touching the pack type's meaning: **add `collation: string` to `LanguagePack`** (`'de'`, `'es'`; BCP-47 tag used only for sorting), set it in both packs and the test pack (`test-support/testPack.ts`), read it in `catalog.ts`. Test: a Spanish pack catalog lists *nube* before *ñu* before *oso* and a German one is unchanged (use the real `buildCatalog` with a small fake bank, as the existing catalog tests do). If the suite below finds any further hard-coded German assumption, the rule is the same: failing test, smallest fix, listed in the report. If a fix would be larger than ~30 lines or changes German behaviour, **stop and report instead**.

## Acceptance Criteria
- [ ] `npm test` (German active) runs the `activeApp` suite and is green; `npm run test:app -- es` runs it with Spanish active and is green; the seam files are byte-identical afterwards (`git status` clean).
- [ ] The suite contains the checks below (A–H); each has a one-line comment saying which failure it prevents.
- [ ] A guard check per group: temporarily break the code it covers (e.g. a hard-coded `'de-DE'`, a backup tag check removed) and see the suite go red.
- [ ] `node scripts/verify-prebuild.mjs es` and `… de` were run once and **their output is in the report**; they leave no `android/` behind unless one existed before (never deleted when it pre-existed: the script stops and says so).
- [ ] The `catalog.ts` collation fix is in, with its test; nothing else in `src/` changed except fixes the suite required (each listed).
- [ ] `ci.yml` has a step running `npm run test:app -- es` after the normal tests.
- [ ] `store/es/qa-checklist.md` exists and is complete (below).
- [ ] `npx tsc --noEmit` clean, `npm test` green; `CONTEXT.md` updated; status `done`.

## Technical Spec

### Files to create
```
mobile/__tests__/activeApp/expectations.ts
mobile/__tests__/activeApp/identity.test.ts
mobile/__tests__/activeApp/content.test.ts
mobile/__tests__/activeApp/flows.test.ts
mobile/__tests__/activeApp/backup.test.ts
mobile/__tests__/activeApp/platform.test.ts
mobile/__tests__/prebuildCheck.test.ts
mobile/scripts/test-app.mjs
mobile/scripts/verify-prebuild.mjs
mobile/scripts/lib/prebuildCheck.js
store/es/qa-checklist.md
```
### Files to modify
```
mobile/src/languages/types.ts, de.ts, es.ts, mobile/test-support/testPack.ts   collation
mobile/src/lib/catalog.ts                                                      use pack.collation
mobile/package.json                                                            "test:app": "node scripts/test-app.mjs"
.github/workflows/ci.yml                                                       one step
mobile/__tests__/ (a catalog test)                                             the collation test
CONTEXT.md, tasks/TASK-049.md (status)
```

### The `activeApp` suite
`expectations.ts` exports `EXPECT: Record<'de' | 'es', {…}>` and `current = EXPECT[getActivePack().code]`; the suite **fails with a clear message when the active code has no row** (that is the gate for a new language). Fields: `appName`, `dbFile`, `backupTag`, `packageName`, `speechLocale`, `wordsPerLevel` (the real counts: de 369/365/365/365/365/365, es 304/293/286/287/288/281), `uiLanguages` (13 / 12 codes), `translatedLanguages` (the languages whose `getWordContent` must be non-null for every word: de 11, es 10), `articleForms`, `choiceRules` (`[]` for de, `['SER_ESTAR','POR_PARA','DIRECT_OBJECT_PRONOUN']` for es), `hasCases` (true/false), `sampleWord` per level, `aiLanguageName`, `collationSample` (an ordered triple of words of the row's own bank that the pack's collation sorts in a way plain code-point order would not: es `['nube','ñu','oso']` if the three exist in the bank, otherwise three real bank words found by the Developer and pinned here; de: a triple with an umlaut word, pinned the same way).

**A. Identity** (`identity.test.ts`): pack code/name/app tag/db file equal the row; the variant file of the same code (`variants/<code>.json`) has the same name, package equals `packageName`, slug equals the lowercase backup tag; `app.config.js` resolved for the active code has that package (read it with `APP_LANG_CHECK_SEAM` irrelevant: the seams are active); no UI string of the app languages the pack offers contains the other app's name (scan `pack.strings` and the shared i18n files for `GermanBuddy`/`SpanishBuddy` vs the active name via `%{app}`: the rendered string for a sample of 20 keys contains the active name and never the other).

**B. Content** (`content.test.ts`): per level, the real bank size equals the row; every entry has the fields the app reads (non-empty `word`, `meaning_it`, `meaning_en`, `example`, `example_it`, `example_en`, `cultural_note*`); nouns have an article from `pack.articles.forms`; `getWordContent(lang, word, level)` returns three non-empty strings for **every** word of **every** translated language of the row (and `null` for a language that is not translated); `localizedText` falls back to English for a UI language with no table; `coerceNativeLanguage('es')` under the Spanish app does not return `es` (a native Spanish speaker is not offered Spanish); the daily-word picker returns a bank word for each level and each topic combination for 30 simulated days without repeating a word (use `pickNextWord`, the existing pure function, with a fixed install id).

**C. Flows with the in-memory SQLite mock** (`flows.test.ts`; reuse the setup of the existing service tests): create profile at each level; save today's word (streak 1, retention 0.5, due in 1 day); start learning from the catalog (no streak change); grade a review pass and a miss and check the SRS intervals of CLAUDE.md §7; practice miss only lowers the schedule; build a 25-card session from real bank cards and play it with a scripted answerer through the pure `session` state machine: every card yields a model, every model kind is allowed for the card's tier, matching rounds have 4–5 pairs without duplicate meanings in the learner's language, a missed word returns ≤ 2 times; typed answers: the word typed exactly is `exact`, without accents `close` or `exact` per the pack's fold, never `wrong`; the grammar drill builds an article question for 20 nouns and, when `choiceRules` is not empty, a choice question for 20 sentences per rule with the answer among the options; when `hasCases` is false the case drill is not offered (assert the practice-menu availability the app computes, not a mock).

**D. Backup** (`backup.test.ts`): export → restore round-trips the profile, vault and review log; the exported file carries the pack's `backupTag`; **restoring a file with the other app's tag is rejected with the `BackupError` code the screens map to a message** (build the foreign file by changing the tag in a real export), and a file with no tag is rejected the same way; the AI key is absent unless opted in; the automatic-backup file name starts with the lowercase tag (`autoBackupFileName`).

**E. Platform glue** (`platform.test.ts`, with `expo-speech` and `expo-notifications` mocked): `speak` is called with the row's `speechLocale` and rate; `speechText` of a noun contains the article for the active language; the daily reminder and the review reminder schedule content whose text contains the app name and is in the learner's UI language; no notification title or body contains the other app's name; the AI request body (provider transport mocked) names the row's `aiLanguageName`, and contains only the word, level and native language (compare with the German prompt in the existing test so the privacy rule of CLAUDE.md §6 is enforced for every pack).

**F. Screens render** (RNTL, services mocked as in the existing screen tests): Vault with 5 saved words, WordCard, Grammar menu, Practice menu, WordDetail and Settings render without throwing, show the active app name where the UI shows it, and the language picker lists exactly `uiLanguages` of the row.

**G. Layout and text**: for the sample words of each level, `ArticleBadge` and `TypedClozeView` render words containing `ñ`, `á`, `¿` (es) / `ä`, `ß` (de) without throwing; `buildCloze` and the typed-answer fold keep `ñ` distinct from `n` for Spanish.

**H. Gate for a new language**: `activeApp` fails with "no expectations for <code>" if the row is missing, and the test names the other places a new language needs (variant file, store files); this is the checklist a future task starts from.

### `scripts/test-app.mjs`
`node scripts/test-app.mjs <code> [jest args…]` = `with-language <code> -- npx jest --watchAll=false __tests__/activeApp [args]`. Exit code is Jest's. Unknown code → usage, exit 2. It must not run the other tests (they assert German content).

### `scripts/verify-prebuild.mjs` and `lib/prebuildCheck.js`
`verify-prebuild.mjs <code>`: refuses to run when `mobile/android/` exists (message: "delete it first; this script never deletes an existing android/"); runs `with-language <code> -- npx expo prebuild --platform android --no-install`; calls `checkPrebuild(androidDir, variant)`; removes the `android/` it created; prints each check and exits 1 on any failure.
`checkPrebuild(dir, variant)` (pure, reads files) returns `string[]` problems. Checks: `applicationId` and `namespace` in `app/build.gradle` equal `androidPackage`; `versionCode`/`versionName` equal what `buildExpoConfig` gives; `res/values/strings.xml` `app_name` equals `variant.name`; the manifest `<application>` has `allowBackup="true"` and `dataExtractionRules`/`fullBackupContent` pointing at `@xml/<slug>_backup_rules` and `_legacy`, and both xml files exist with the AI/notification/auto-backup exclusions; the manifest declares exactly the three permissions of `app.config.js` (no extras such as `RECORD_AUDIO`, `READ_EXTERNAL_STORAGE`); `android:screenOrientation="portrait"` and the `screen.portrait required="false"` feature; the scheme in the manifest intent filter equals `variant.scheme`; no mention of the *other* variant's package or name anywhere under `app/src/main`.
`prebuildCheck.test.ts` builds fixture folders (a good one, then one mutation per check) and asserts each mutation produces a problem naming it.

### `ci.yml`
After "Test": `- name: Spanish app suite` → `run: npm run test:app -- es`.

### `store/es/qa-checklist.md`
Header: build with `build_bundle_android_release.bat es` (or a debug build with `deploy_local_debug_android.bat es`), phone model/Android version/TTS engine written at the top, result column `OK / Bug / n.a.` and a notes column. Sections and rows (each row one line, concrete steps, expected result):
1. **Install and identity**: installs next to GermanBuddy (two icons, different names, different data); launcher name; first start; no German word anywhere in the first screens.
2. **Onboarding**: the 5-question level quiz (Spanish questions, one correct answer each), topics, welcome-screen restore of a Spanish backup, rejection of a **German** backup (clear message, nothing imported).
3. **Today and vault**: daily word at the chosen level; article colour and badge (el / la); IPA; the cultural note; save, streak 1; speaker button reads *Spanish* (es-US voice) with correct accent, then try with **only es-ES installed** and with **no Spanish voice** (the app must not crash or loop alerts); vault chips; word detail.
4. **Review and practice**: every exercise format at least once (typed fill-in with an accent-less answer, reorder with `¿ ¡`, multiple choice both directions, matching, flashcard); a miss returns later; practice never moves a due date later; grammar drill: article, `ser/estar`, `por/para`, object pronouns; **no case drill, no case wording anywhere**.
5. **Catalog and statistics**: word list order around *ñ*; start learning an unsaved word; counts.
6. **Languages**: switch the UI language through all 12 offered ones (Spanish is not offered); Arabic right-to-left after restart; CJK/Devanagari/Arabic glyphs render; translated word content shows in each language and is machine-written (note anything wrong; those rows go to the translation review, not to a bug list); the 13-language German app is unaffected.
7. **Notifications**: permission prompt text; daily word and review reminders show **SpanishBuddy** and arrive in the chosen language; tap opens the right screen; reboot keeps reminders.
8. **Backup**: export (file name contains the app tag), import on a second phone/clean install, automatic backup to a phone-storage folder (file name `spanishbuddy-auto-…`), Drive folder message.
9. **AI (optional)**: with a test key, "Approfondisci"-style note is about the Spanish word and in the learner's language; the request contains no other data (check with a proxy or the provider's log).
10. **Stress and edges**: a vault of 300+ words (use the catalog's start-learning), scrolling, session of 30 cards, airplane mode (everything works offline), rotate/background/kill during a session, low-memory kill, system font size at maximum.
11. **Store readiness**: the rendered pages open in a mobile browser (fonts, links, contact form with the real Formspree id sends and arrives), `delete-account` steps match the phone's actual menus, listing text proof-read in each language by a reader (note languages with no reader).
12. **Sign-off**: tick-box list of what blocks the first upload (any Bug in sections 1–4, 7, 8) versus what can follow (translation wording, section 10 edge cases).

## Tests (write first, see them red)
- `activeApp/*` as above (red first = the files do not exist / the collation test fails / `collation` missing from the packs).
- `prebuildCheck.test.ts` (fixtures and one mutation per check).
- The catalog collation test.
- `scriptsTestApp.test.ts` (small): `test-app.mjs zz` exits 2; its command line contains `__tests__/activeApp` and nothing broader (assert on a `--print-command` flag that you add for this purpose, no spawn of Jest inside Jest).

## Definition of Done
- [ ] Criteria checked; red before green; guard checks per group done
- [ ] `npx tsc --noEmit`, `npm test`, `npm run test:app -- es` green; `git status` clean afterwards
- [ ] Report: output of both `verify-prebuild` runs; the list of leaks found and fixed (at least the catalog collation) with the failing test of each; anything left unfixed because it was larger than the rule above
- [ ] If the Android toolchain and keystore are present on this machine, also run `build_bundle_android_release.bat es` once and report the output file name and size (do not install or upload it); if not present, say so
- [ ] Diff review: German behaviour unchanged; no seam change; nothing outside the files above except required fixes
- [ ] `CONTEXT.md` updated (049 done, how to run `test:app`, what is still manual: the phone checklist, translation review, store steps); conventional commit `feat(TASK-049): QA suite for every language app`

## Notes for Tech Lead (remove before handing over)
- The suite is deliberately one set of assertions plus a table: a third language is "add a row and a variant and go green", which is also how the French/Italian apps will be gated.
- Risk: the in-memory SQLite mock is schema-less; assert real schema where it matters (CLAUDE.md §13). Another: tests that read the bank at import time are fine because the seams are active before Jest starts.
- Rejected: running the whole existing suite under Spanish (it asserts German content by design); screenshots-based QA (needs a phone); a Gradle build in CI for `es` (billing is blocked and the prebuild check catches the identity mistakes).
- After this task the remaining blockers for a Spanish release are owner-side: Spanish reader review, support repo + Formspree, Play app and forms, screenshots and icon, the phone QA itself.
