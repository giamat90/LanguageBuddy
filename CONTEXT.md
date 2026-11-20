# CONTEXT.md — GermanBuddy Codebase State

**Updated by:** whoever pushes to `main` (Giacomo or Claude), **in the same push**
**Last updated:** 2026-11-21
**Current version:** 1.0.20 (versionCode 20) built locally on 2026-11-20 and waiting for a manual upload to Play (contains TASK-035 to TASK-040; see Known Issues). Last version on Play: 1.0.18 (versionCode 18) released to the **Google Play production track** on 2026-11-18 by the CI release workflow; it contains TASK-030 (fix: app stuck in error after a notification tap, self-healing database handle). 1.0.17 (TASK-029, statistics drill-down) preceded it. Play held versionCodes 1, 2, 4, 9, 11–17 before this upload (read with `npm run check:play-version`). `LOCAL_FALLBACK_VERSION_CODE` in `mobile/app.config.js` is 19 for the next local build.

> This file is the ground truth for what currently exists in the codebase.
> Tech Lead reads this before writing any task spec.
> Developer reads this before implementing any task.
> Never trust your memory — trust this file.
>
> **The architecture changed completely in September 2026.** GermanBuddy is now a fully
> standalone, offline React Native app. The Kotlin/Android client, the FastAPI backend, Supabase,
> Firebase, RevenueCat, the Lena chat and the nightly word job described in older versions of this
> file and in `CLAUDE.md` §1–12 **no longer exist**. They are kept only as history (see the end).

---

## Current Status

**Phase:** Feature-complete offline app, in release preparation on Google Play.
**Next milestone:** Roll out the internal-testing release, then promote it.

- `main` (default branch, GitHub `giamat90/GermanBuddy`) holds everything described below.
- Quality gate: `tsc --noEmit` clean; **910 tests in 77 suites** pass. GitHub CI runs the type check and the
  tests on every push and pull request (green on all recent pushes).
- Google Play: a draft internal-testing release with versionCode 11 (version name 1.0.11) was published by the CI
  release workflow on 2026-10-08 and rolled out to internal testing by the Product Owner. It was built **before TASK-022**
  (find the mistake) and the automatic backup. On 2026-10-16 the CI release workflow published versionCode 13 (version name 1.0.13) to the internal track as a completed rollout; it contains TASK-022, TASK-023, TASK-024 and TASK-025. Play then rejected versionCode 13 for **not supporting 16 KB memory pages** (fixed by TASK-026, below). The next release must pass 14 or more.

---

## What Exists

### Product
A free, offline German vocabulary and grammar app for Italian and English speakers. No account, no server, no
analytics. Everything lives on the phone.

- **Onboarding:** short level quiz, topic preferences, creates a local learner profile (CEFR level, native language).
- **Statistics (TASK-027):** a 📊 icon in the Vocabolario header (next to the settings gear) opens `/(app)/stats`: saved words split into New / Learning / Mastered (same `tierOf` rules as the exercise engine), streak, reviews done and accuracy, and per-topic and per-CEFR-level bars of saved words against the bank size. Pure engine in `src/lib/stats.ts`, I/O in `statsService.ts`.
- **Daily-word topics (TASK-027):** the topics chosen at onboarding now drive the daily word (before, they were stored and ignored) and can be changed in Settings (`components/ui/TopicPreferences.tsx`, saved at once, at least one must stay on, per-topic word counts at the learner's level). Active = preference >= 0.5; empty/garbage preferences mean all topics. If the chosen topics have no unused word at the level the word comes from another topic (C1/C2 have almost no food/shopping/home words). A change applies from the next new word, not to today's.
- **Word of the day:** drawn deterministically per install from the bundled word bank; never repeats within a level until it is exhausted. Word card with article, IPA, meaning, example, cultural note.
- **Vocabolario (home):** the saved-word list (dictionary style, review-date chips), word detail, buttons for today's word, Grammatica, Pratica, and Ripassa (when words are due).
- **Review ("Ripassa"):** spaced repetition (simplified SM-2, `src/data/srs.ts`) over due words, using the exercise engine (below), graded 0–1, with an in-session retry queue and a first-try summary.
- **Free practice ("Pratica"):** pick a format (Mixed, Match, Multiple choice, Reorder the sentence, Find the mistake, Type the word) and train on saved words any time. **Schedule rule: practice never pushes a review later; only a miss lowers a word's score and can make it due sooner.** Never touches the streak or the review log.
- **Grammar drill ("Grammatica"):** article picker (der/die/das) and case cloze (dativ/akkusativ/genitiv forms), weighted by per-rule mastery (`grammar_mastery` table).
- **Reminders:** local notifications for the daily word and for due reviews (no server, no push token).
- **Backup / restore:** export one JSON file via the share sheet; restore from Settings or from the welcome screen on first launch. Restore replaces all local data and only inserts columns the installed schema has.
- **Automatic backup (Android, TASK-023):** optional. The learner picks a folder once (a Storage Access Framework folder in phone storage or on an SD card, optionally one that another app such as Dropbox keeps in sync; Google Drive folders are NOT writable and are rejected, TASK-034); the app then writes a `germanbuddy-auto-YYYYMMDD-HHMMSS.json` copy shortly after the data changes (debounced 30 s, at most 5 min, immediately when the app goes to the background, unsaved changes retried at the next start), keeping the newest 10. Independent "Esegui backup ora" button. The file **never contains the AI key or provider settings**. No network code: a cloud app syncing the folder is what uploads it.
- **Optional AI ("Approfondisci" / Explore further):** extra examples, a usage note and an exercise for a saved word. Bring-your-own key: **Anthropic or any OpenAI-compatible service** (user-chosen base URL and model, https only). The key is stored on the device; it enters a backup only if the user opts in at export time.
- **Languages (TASK-024):** the app UI is available in 13 languages — Italian, English, French, Spanish, Portuguese (Brazil), Russian, Ukrainian, Polish, Turkish, Chinese (Simplified), Japanese, Hindi and Arabic (right-to-left). One registry (`src/i18n/language.ts`) drives the picker, date locales, the AI prompt and the layout direction; strings are `src/i18n/<code>.ts`. **Word content (meaning, example, cultural note) is translated into all 11 new languages (TASK-025)**; a missing entry falls back to English. The language is picked on the welcome screen (preselected from the phone's language when supported, English otherwise) and in Settings.

### Exercise engine (`mobile/src/lib/exercises/`, pure TypeScript, no I/O)
- **Tiers** (`tier.ts`): `new` (first sighting or retention < 0.6), `learning`, `strong` (retention ≥ 0.85 and seen ≥ 4 times). Review offers formats by tier; practice ignores tiers.
- **Formats** (registry in `registry.ts`): typed cloze (weight 2), sentence reorder (weight 1) and find the mistake (weight 1) for learning/strong words; multiple choice for new words; matching pairs (a *group* step of 4–5 new words); flip-card as the fallback.
- **Graded quality** (`quality.ts`): exact 1.0, close 0.7, hint cap 0.6; per-format ceilings (multiple choice 0.8, matching 0.7/0.4/0, reorder 0.9, reorder "my sentence is correct" 0.5, find the mistake 0.9 / 0.4 / 0 for fixed / found but not fixed / missed). Only the first attempt of a word is graded; retries are not.
- **Session** (`session.ts`): pure state machine; failed words come back 3 cards later, up to 2 retries; matching rounds are planned first.
- **Practice** (`practice.ts`): format parsing, per-format config, card selection (weaker words favoured), availability.
- **Distractors** (`distractors.ts`): same part of speech, drawn from the whole bank, never sharing a meaning word with the answer.
- **Find the mistake** (`mistake.ts`): the word's example sentence with one wrong determiner — either the article before the noun (replaced by a form never valid for its gender) or a case-fixing determiner (`dem einem einen des eines`, skipped after two-way prepositions). Two steps: tap the wrong word, pick the right form; the matching `grammar_rule_*` explanation follows. Neuter nouns ending in -er/-el/-en/-chen/-lein are never used (their plural can look identical) and masculine ones only get `das`. 542 of the 2,194 words qualify.

### Repository layout
```
GermanBuddy/
├── mobile/                    # the whole product (React Native + Expo SDK 53, RN 0.79, React 19, TypeScript)
│   ├── app/                   # expo-router routes: onboarding, quiz, topics, (app)/{index,today,review,practice,practice-session,grammar,word,settings}
│   ├── src/
│   │   ├── data/              # db.ts, schema.ts (idempotent migrations), srs.ts, backup.ts, dailyWord.ts, wordbank/*.json
│   │   ├── services/          # profile, word, vault, review (due + practice grading), grammar, restore
│   │   ├── lib/               # exercises/ (engine), ai/ (keys, llm transport, providers, wordInsight), autoBackup/ (helpers, scheduler, SAF writer), cloze, grammar, notifications
│   │   ├── screens/           # ExerciseSession (shared by Review and Practice), Vault, WordCard, WordDetail, Grammar, Settings, ...
│   │   ├── components/        # ui/ (design-system components), exercises/ (one view per format)
│   │   ├── store/ i18n/ theme/ types/ hooks/ navigation/
│   ├── scripts/               # build-wordbank.mjs, validate-wordbank.mjs, wordbank/*.tsv (source of the word bank)
│   ├── plugins/               # withReleaseSigning, withAndroidBackupRules (Expo config plugins)
│   ├── __tests__/ __mocks__/  # jest (jest-expo); expo-sqlite and MMKV are mocked in memory
│   └── app.config.js          # version, versionCode, plugins; the single source of truth for the Android version
├── tasks/                     # task specs (TASK-001 … TASK-021), TEMPLATE.md
├── .github/workflows/         # ci.yml (tsc + tests), release-android.yml (manual build and Play upload)
├── build_bundle_android_release.bat, deploy_local_release_android.bat, build_eas_production_android.bat, build_get_version.ps1
├── germanbuddy-support/       # SEPARATE git repo (giamat90/germanbuddy-support): privacy policy, terms, contact, delete-account pages
├── GoogleCloud/               # Play service-account key (gitignored, never commit)
├── Bundles/                   # locally built AABs (not for git)
└── CLAUDE.md, CONTEXT.md
```

### Data
- **On-device SQLite** (`expo-sqlite`): `learner_profile`, `daily_items`, `vocabulary_items` (SRS state), `review_log` (with `quality`), `grammar_mastery`, `ai_word_notes`, `schema_meta`. Additive changes go through `ensureColumn` in `src/data/schema.ts`.
- **MMKV** for small flags and the AI settings (store id `ai`: provider, one key per provider, OpenAI base URL and model) and the automatic-backup state (store id `auto-backup`: switch, folder URI, written file URIs, last run, error and unsaved flags; device-specific, never part of a backup file). The SQLite database is opened with `enableChangeListener: true` so the backup hears about every write.
- **Word bank:** 2,194 entries in `mobile/src/data/wordbank/{A1..C2}.json` (A1 369, A2–C2 365 each), generated from `mobile/scripts/wordbank/*.tsv` with `npm run build:wordbank`; `npm test` validates it first (`pretest`). One example sentence per word.

### Build, signing and release
- **Android:** package `com.giamat90.germanbuddy`; `minSdkVersion 24`, `targetSdkVersion`/`compileSdkVersion` 36.
- **Version:** `LOCAL_FALLBACK_VERSION_CODE` in `mobile/app.config.js` (bump before every local build); the version name is `1.0.<versionCode>`. CI passes its own code through `ANDROID_VERSION_CODE`.
- **Local AAB:** `build_bundle_android_release.bat` (runs `expo prebuild --clean`, verifies the baked versionCode, writes `Bundles/app-release-v<name>-<code>.aab`). **Local install on a phone:** `deploy_local_release_android.bat`.
- **Signing:** `mobile/release.keystore` and `mobile/release.properties` (gitignored — **back both up outside the repo; losing the keystore means no more updates**). The `withReleaseSigning` plugin wires them into the Gradle project on every prebuild.
- **Before any release, check Play:** `cd mobile && npm run check:play-version -- <code> --key ../GoogleCloud/<service-account>.json` lists every versionCode Play holds (all tracks and uploaded bundles) and exits 1 unless `<code>` is higher. Never trust this file for the number: 15 was rejected on 2026-11-13 because Play already had 14 and 15 (TASK-028). The workflow runs the same check first and fails in seconds.
- **Release tags (TASK-028):** after Play accepts an upload the workflow pushes an annotated tag `v<versionName>` (e.g. `v1.0.16`) on the built commit; the workflow also refuses a tag that already exists. Older releases (up to 1.0.13) are not tagged.
- **CI release:** `gh workflow run release-android.yml -f track=internal -f release_status=draft -f version_code=<n>`. The code must be **higher than any versionCode already uploaded to Play** (the default, the GitHub run number, is too low). Uses the runner's preinstalled Android SDK.
- **GitHub secrets** (repo `giamat90/GermanBuddy`): `ANDROID_RELEASE_KEYSTORE_BASE64`, `ANDROID_RELEASE_PROPERTIES`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (service account `play-publisher@germanbuddy-511017.iam.gserviceaccount.com`, Google Cloud project `germanbuddy-511017`, invited in Play Console with release permissions). Secrets cannot be read back: keep the originals.
- **Support site:** `germanbuddy-support` (separate repo) hosts the privacy policy, terms, contact and delete-account pages; updated 2026-11-20 for text-to-speech (earlier: 2026-11-19 Firebase component; 2026-10-08 for the multi-provider AI, the opt-in key backup and the optional automatic backup (privacy policy, terms, delete-account page)), and restyled the same day with the app's palette (`mobile/src/theme/colors.ts`) and fonts (Playfair Display, Inter) instead of GreenThumb's, and the header shows the real app icon (`icon.png`, 96 px copy of `mobile/assets/icon.png`); hosted on GitHub Pages at https://giamat90.github.io/germanbuddy-support/. Keep the Play listing's privacy policy URL and Data safety form consistent with it.

### Everyday commands (from `mobile/`)
```
npx tsc --noEmit        # type check
npm test                # validates the word bank, then runs jest
npm run build:wordbank  # regenerate the JSON word bank from the TSV sources
```
Windows tip: if `.bat` scripts report "not recognized", the shell has `NoDefaultCurrentDirectoryInExePath=1`; unset it for that process.

---

## Completed Tasks

All of these are on `main`. TASK-016 through the grammar drill were developed on `feature/standalone-offline` and brought into `main` together on 2026-10-08; dates below are the commit dates.

| Task | Description | Date |
|------|-------------|------|
| TASK-016 | Standalone offline conversion: removes the backend; on-device SQLite, bundled word bank, deterministic daily word, ported SRS/streak, local onboarding | 2026-09-04 |
| (word bank) | Word bank expanded to 365+ words per CEFR level | 2026-09-04 |
| (feature set) | App icon, dictionary-style home, word detail, backup/restore, opt-in AI | 2026-09-07 |
| (reminders) | Local notifications for the daily word and for reviews | 2026-09-11 |
| TASK-017 | English as a second native/UI language | 2026-09-12 |
| (cloze) | Typed cloze exercise in word review | 2026-09 |
| (grammar) | Grammar drill with article picker and case cloze | 2026-10-01 |
| (restore) | Restore a backup from the welcome screen on first launch | 2026-10-02 |
| TASK-018 | Multi-vendor AI (Anthropic + OpenAI-compatible), opt-in key in backups | 2026-10-08 |
| (CI) | `ci.yml` and the manual `release-android.yml` workflow; fixed to use the runner's SDK | 2026-10-08 |
| TASK-019 | Exercise engine: tiers, registry, graded quality, relearning queue, hint | 2026-10-08 |
| TASK-020 | Multiple choice, matching pairs, sentence reorder; per-format quality ceilings | 2026-10-08 |
| TASK-021 | Free practice (menu, sessions, miss-only schedule rule) | 2026-10-08 |
| TASK-022 | Find the mistake exercise (article/case corruption, tap then fix; review and practice) | 2026-10-08 |
| TASK-023 | Automatic backup to a user-chosen folder (ported from GymDiary) + Android cloud-backup allowlist (AI key store excluded). Implemented and unit-tested; on-device checklist still to do | 2026-10-08 |
| TASK-024 | App UI in 13 languages (it, en, fr, es, pt, ru, uk, pl, tr, zh, ja, hi, ar): language registry, 11 new string files, wrapping language picker, Arabic RTL (`withRtlSupport` plugin + `I18nManager`), input hardening of language codes, word-content lookup seam (content still it/en). Also fixes the UI reverting to Italian after a relaunch and the word detail always showing the Italian meaning. Implemented and unit-tested; not run on a phone | 2026-10-15 |
| TASK-025 | Word content (meaning, example, cultural note for all 2,194 words) in fr, es, pt, ru, uk, pl, tr, zh, ja, hi, ar: TSV sources in `scripts/wordbank/i18n/<lang>/`, build to `src/data/wordbank/i18n/<lang>.json` (about 5.8 MB in total, lazily required through a generated loader table), validator with collision/script/length checks, translated-language dedupe for multiple choice and matching. First-pass machine translations; not reviewed by native speakers | 2026-10-16 |
| TASK-026 | Upgrade Expo SDK 51 → 53 (RN 0.79, React 19, expo-router 5, expo-sqlite 15, MMKV 3.3, reanimated 3.17) so the native libraries are 16 KB-page aligned, as Play requires for apps targeting Android 15+. Notification triggers moved to the typed form (`DAILY` / `DATE` / `TIME_INTERVAL`); added `query-string`, `expo-splash-screen`, `expo-font`, `expo-asset` as explicit dependencies (SDK 53 no longer provides them transitively); the `expo-modules-core` patch was removed (no longer needed); two PrimaryButton snapshots updated (disabled buttons are `focusable={false}` in RN 0.79). New tool `npm run check:16kb -- <file.aab\|apk>` (`scripts/check-16kb.js`) checks the ELF alignment of the 64-bit libraries. Result on versionCode 14: **42/42 libraries 16 KB ready**; the old 1.0.10 bundle: 0/100. Not yet tested on a phone (see Known Issues) | 2026-11-07 |
| TASK-027 | Learning statistics screen and editable daily-word topics: `lib/topics.ts` (shared topic list, active/toggle rules), `lib/stats.ts`, `statsService.ts`, `StatsScreen`, `TopicPreferences` in Settings, `pickNextWord(level, installId, used, activeTopics?)` with fallback, `setTopicPreferences`; 21 new strings in 13 languages. No schema change. 46 new tests. Spec: `tasks/TASK-027.md` | 2026-11-13 |
| TASK-028 | Release guard and tags: `scripts/lib/playVersion.js` + `scripts/check-play-version.js` (`npm run check:play-version`) read the versionCodes Play holds through the Developer API (service account, Node built-ins only, throw-away edit always deleted); `release-android.yml` checks the code and the tag before building, then pushes tag `v<versionName>` after a successful publish (`permissions: contents: write`). 23 new tests. Spec: `tasks/TASK-028.md` | 2026-11-13 |
| TASK-029 | Statistics drill-down: tapping Saved / Mastered / Learning / New, a topic row or a level row opens `StatsWordsScreen` (`/(app)/stats-words`, params `kind`+`value`) listing those saved words. Pure whitelisted `parseWordFilter` + `selectStatRows` in `lib/stats.ts` share the bank lookup and tier rules with `computeStats` (list length always equals the count); `fetchStatWords` in `statsService`; zero counts are disabled; 3 new strings in 13 languages. No schema change. 24 new tests. Spec: `tasks/TASK-029.md` | 2026-11-18 |
| TASK-030 | Fix: "NativeDatabase.prepareAsync has been rejected / NullPointerException" after tapping the daily-word notification (Retry looped; the error stayed after reopening). `data/db.ts` rewritten: every open uses `useNewConnection: true` (never the module-cached native object another JS wrapper can release), a failed open is no longer cached, `getDb()` returns a stable facade that replaces a dead handle once and retries (never mid-transaction), `resetDbHandle()` closes the old connection. `VaultScreen` and `TopicsScreen` show the generic i18n error and log the cause instead of showing `e.message`. 15 new tests (incl. `dbDeadHandle.integration.test.tsx`: restore then dead handle, Today screen and "Riprova" with a dead handle; all fail on the old `db.ts`). Spec: `tasks/TASK-030.md` | 2026-11-18 |
| TASK-031 | Play warned that `android.hardware.screen.portrait` is a required feature (implied by `orientation: portrait`), hiding the app from landscape-only devices. New config plugin `plugins/withOptionalPortrait.js` adds `<uses-feature android:name="android.hardware.screen.portrait" android:required="false"/>`; the app stays portrait-locked. 5 new tests. Not tested on landscape-only hardware (runs in a portrait window). Needs a new versionCode (check Play first). Spec: `tasks/TASK-031.md` | 2026-11-19 |
| TASK-032 | Automatic backup to a Google Drive folder fails ("Backup non riuscito"). Cause not yet known: the write throws but every failure looked the same. `writeNow` now logs the failing step (build / create / write) with the error name and code, never the message; the banner text (`settings_autobackup_error`, 13 languages) no longer claims the folder was moved or deleted. 3 new tests. **The real fix waits for a phone log** (`adb logcat -s ReactNativeJS`, line `[autoBackup] step failed …`). Spec: `tasks/TASK-032.md` | 2026-11-19 |
| TASK-033 | Fix: restoring a backup on a fresh install said "couldn't restore" (`database is locked`) although the data was restored. `restoreBackup` closed the old SQLite connection in the background while the welcome screen opened a new one; `resetDbHandle()` now returns a promise that `restoreBackup` awaits, and opening a connection retries the WAL pragma and migrations while SQLite reports locked. 6 new tests, red before the fix. Found by reproducing on a phone. Spec: `tasks/TASK-033.md` | 2026-11-19 |
| TASK-034 | Automatic backup and Google Drive. Diagnosed on a phone with the TASK-032 log: a Drive folder fails at the `create` step (`Location … isn't writable`: Drive's document provider does not report its folders writable through the folder grant); a phone-storage folder works. `writeNow` now throws `FolderNotWritableError` when creating the file fails; Settings (switch, "Esegui backup ora", choosing a folder while the switch is on) then turns the switch off, forgets the folder and shows "Cartella non utilizzabile" pointing to phone storage; other failures keep "Backup non riuscito" and the banner. Hint text (13 languages) no longer promises Drive; privacy policy updated. 7 new/changed tests. "Esporta backup" keeps working with Drive because the Drive app uploads the shared file. Spec: `tasks/TASK-034.md` | 2026-11-19 |
| TASK-035 | Listen to a word's pronunciation. New dependency `expo-speech` (**native module: the next build needs a fresh `expo prebuild`, and a versionCode bump after checking Play**). `lib/speech.ts` (the only importer; `de-DE`, rate 0.9, one utterance at a time), `hooks/useSpeech.ts` (state per item id; a late `onStopped` of the old utterance cannot clear the new one; one generic alert per mount on engine error), `SpeakButton`. A speaker button on every vault row (the row is now a `View` holding the touchable and the button, so the tap does not open the word) and on the word detail beside the IPA; speech stops when leaving the screen. 4 new keys in 13 languages. 16 new tests. Not built: example sentences, today's card, speech settings. Spec: `tasks/TASK-035.md` | 2026-11-20 |
| TASK-036 | Word catalog. New screen `/(app)/catalog` ("Tutte le parole", 📖 in the Vault header and a link on the Statistics screen): the whole word bank by level (A1–C2) and topic with status chips and a legend. Four statuses with fixed colors (`theme/statusColors.ts`): mastered (navy), learning (gold), new (slate), "Da iniziare" (empty ring = not saved); the status is also written as text. The level and topic rows of the Statistics screen now open the same list with **every bank word of that bucket**, saved or not (and are tappable even with 0 saved words); tier tiles and "Parole salvate" still list saved words only. Pure logic `lib/catalog.ts` (`buildCatalog`), shared row/chips/legend `components/ui/CatalogRow.tsx`, `statsService.fetchSavedStates()`. A word in two levels is listed at both. Read-only: no write, no network. 9 new keys in 13 languages, 20 new/changed tests. Spec: `tasks/TASK-036.md` | 2026-11-20 |
| TASK-037 | Start learning from any word list. Tapping an unsaved ("Da iniziare") row in the catalog or in a Statistics level/topic list asks for confirmation (`useStartLearning`) and calls `wordService.startLearning(level, word)`: inserts into `vocabulary_items` like the daily save (retention 0.5, seen once, due in 1 day) with `source = 'catalog'`, values taken from the bank (the screen passes only level and word); the row becomes "Nuova" and the counts move. **Never touches the streak, `last_active_at`, `total_words_seen`, daily items or the review log.** Idempotent (case-insensitive existing check; starts run one at a time through a queue, so two taps insert once — plain INSERT, no `INSERT OR IGNORE`, because the in-memory SQLite mock does not support it); reminder refreshed after an add. Unsaved rows are buttons now (hint + "＋"); saved-only lists have no start action. 7 keys in 13 languages, 17 new/changed tests. Spec: `tasks/TASK-037.md` | 2026-11-20 |
| TASK-038 | Second filter inside the Statistics word lists: a topic list ("Per argomento") has level chips (Tutti i livelli, A1…C2) and a level list ("Per livello") has topic chips (Tutti gli argomenti + 8 topics), each with its word count (status ignored, so numbers stay stable); combines with the status chips; header "N parole / x di N" follows the narrowed list; tier and "saved" lists unchanged. `lib/catalog.ts` `scopeCounts`, `ChipRow` in `CatalogRow.tsx`. Found on the phone and fixed in the same push: the chip rows were clipped (a horizontal ScrollView defaults to `flexShrink: 1` and the tall list squeezed it; now `flexGrow: 0, flexShrink: 0`), and a word's own status is now singular ("Nuova", "Padroneggiata": keys `catalog_row_new`, `catalog_row_mastered`) while chips, legend and tiles keep the plural. 5 keys in 13 languages. Spec: `tasks/TASK-038.md` | 2026-11-20 |
| TASK-039 | Filters moved behind one icon (PO: the chip rows were too heavy). Bank lists (Statistics level/topic) and the catalog have a filter button (Material `filter-list` icon from `@expo/vector-icons`, already a dependency; an emoji slider looked like a "bar") in the header with a badge (number of active filters; the catalog's level is not counted) that opens a bottom sheet (`Modal`, `FilterSheet`): sections Livello / Argomento / Stato as radio rows with counts; a choice applies at once and the sheet stays open; "Azzera" clears (catalog: back to the learner's level), "Fatto"/backdrop/Android back close. A one-line summary (`A2 · Da iniziare`) sits under the title when a filter is active. The status rows carry the colored markers and replace the legend; the chip rows, `StatusChips`, `StatusLegend`, `ChipRow` and `Chip` were removed. Saved-only lists have no filter button. New `components/ui/FilterSheet.tsx`, `filterSections.ts`; 8 keys added, 2 unused keys removed in 13 languages. Spec: `tasks/TASK-039.md` | 2026-11-20 |
| TASK-040 | Listen to whole sentences (implemented and tested; committed; the phone check was skipped by the Product Owner's decision, so the first on-phone test is of the store build). Speaker button (`SpeakButton kind="sentence"`) next to the saved example in WordDetail and on today's WordCard, next to each AI example, and next to the AI exercise sentence once its answer is revealed (filled-in). In exercises (typed cloze, sentence reorder, find the mistake) the new `SentenceSpeaker` appears only after the answer and speaks the full sentence (the corrected one for find-the-mistake; the wrong form is never read). Settings > Pronuncia: switch "Leggi la frase dopo la risposta" (default off, own MMKV store `speech-settings`, not in backups) reads it automatically on reveal; WordDetail/WordCard never auto-play. The "voice unavailable" alert is now once per app session (module flag in `useSpeech`), so auto-play does not alert on every card. Pure helpers in `lib/sentenceSpeech.ts`. 5 new keys in 13 languages. Privacy policy wording widened to "word or sentence" locally in `germanbuddy-support/` (pushed 2026-11-20, support repo `ae35323`). Spec: `tasks/TASK-040.md` | 2026-11-20 |
| (fix) | "Approfondisci" showed the cached AI result in the wrong language after the app language changed (cache was one row per word, language-blind). `getWordInsight`/`saveWordInsight` now take the language, stored inside the payload; rows in another language or without one are ignored. Test: `wordInsightCache.test.ts` | 2026-11-08 |
| (docs) | `CONTEXT.md` and `CLAUDE.md` rewritten for the offline architecture; nested support repo, `Bundles/` and `GoogleCloud/` gitignored; support-site legal pages updated for multi-provider AI and, once published (commit `d2c6a3c` in `germanbuddy-support`), for the optional automatic backup and Android's own backup, with matching wording in the Terms | 2026-10-08 |

Superseded (kept for history; the code no longer exists): TASK-001 … TASK-015 and TASK-DS built the Kotlin/Android client, the FastAPI backend (word generation, chat SSE, recap, billing) and a first design system. TASK-DS's visual direction (warm editorial look, Playfair Display + Inter, colour tokens in `src/theme/colors.ts`) is still used.

---

## Active Branches

- `main` — the only branch. (`feature/standalone-offline` was merged and deleted on 2026-10-08.)

---

## Future tasks (Product Owner, noted 2026-11-20)

- [ ] Revoke the leaked Firebase Admin key in Google Cloud Console (see Known Issues). This repository (LanguageBuddy, public since 2026-11-21) was created with a fresh history, so the key is not in it; it still sits in the private GermanBuddy repo.
- [ ] Upload `Bundles/app-release-v1.0.20-20.aab` (supersedes 1.0.19, never uploaded) to the Play Console (or re-run `release-android.yml` after fixing GitHub billing).
- [ ] Check the Play Data safety form is consistent with the privacy policy (Firebase installation ID, text-to-speech).
- [ ] Fix GitHub billing / spending limit so CI and the release workflow run again.

## Multilingual family (LanguageBuddy, planned 2026-11-21)
Public monorepo `giamat90/LanguageBuddy` (Apache-2.0); one codebase builds one app bundle per target language (GermanBuddy now; SpanishBuddy, FrenchBuddy, ItalianBuddy later). Task numbering continues from GermanBuddy. Plan: TASK-041 `LanguagePack` (spec ready, `tasks/TASK-041.md`), 042 neutral bank schema and pack-driven bank, 043 templated UI strings, 044-046 Spanish pack/bank/content review, 047 app variants and build scripts, 048 store and legal, 049 QA. Decisions still open (Product Owner): Spanish variety (Spain or Latin America), audience languages, v1 scope (A1-B1 or all levels), app name. The German app keeps `com.giamat90.germanbuddy` until TASK-047.

## Known Issues / Tech Debt
- **Leaked Firebase Admin key in git history (found 2026-11-20, gitleaks + manual scan):** `germanbuddy-firebase-adminsdk-fbsvc-61cc8230ce.json` was committed in `2cac1f90` (2026-05-05) and removed from tracking in `fa980dfb`, but it is still readable in history. Firebase was removed in TASK-016, so the key should be revoked in Google Cloud Console (IAM & Admin, Service accounts, Keys) by the Product Owner. The repo is private; before ever making it public, rewrite the history (also drops the personal e-mail in the commit authors). The Play service-account key and the release keystore were never committed. gitleaks 8.30.1 is installed locally through winget (`gitleaks git . --log-opts=--all --redact`).
- **GitHub Actions blocked (2026-11-20):** every CI and release run fails at start with a billing/spending-limit message (private repo). Work continues locally: run `npx tsc --noEmit` and `npm test` from `mobile/` before each push; build releases with the local scripts and upload the `.aab` by hand.
- **Release 1.0.20 not on Play yet (2026-11-20; supersedes the 1.0.19 bundle, which was never uploaded and lacks TASK-040):** Play's highest versionCode is 18 (checked with `check:play-version`; 19 is valid). The CI release run (`gh workflow run release-android.yml -f track=production -f release_status=completed -f version_code=19`, run 44737231858, tried with 19) did not start: GitHub refused the job ("recent account payments have failed or your spending limit needs to be increased" — Billing & plans). The signed bundle was built locally instead: `Bundles/app-release-v1.0.20-20.aab` (versionCode 20, contains TASK-035 to TASK-040). It still has to be uploaded by hand in the Play Console (or the workflow re-run once billing is fixed; the workflow also pushes the `v1.0.20` tag). The support-site privacy policy now discloses text-to-speech (done 2026-11-20, `germanbuddy-support` `efb68a7`). Nothing needs declaring in the Data safety form for it (the app itself collects and shares nothing; PO to confirm the form). Note: `build_bundle_android_release.bat` failed to find `gradlew.bat` when launched from PowerShell via `cmd /c` (current-folder lookup); running `.\gradlew.bat bundleRelease` in `mobilendroid` after its prebuild step works.
- **Automatic backup cannot use Google Drive folders (understood 2026-11-19, TASK-034):** the app now says so and asks for a phone-storage folder. A real Drive upload would need the Drive API (accounts, network code) and is out of scope.
- **Play rejected versionCode 18 (2026-11-19) for an undisclosed "Device or other IDs" data type.** Likely cause: `expo-notifications` bundles `firebase-messaging` (Firebase installation ID). Fixed by the Product Owner in the Play Data safety form (declared as collected, app functionality); the privacy policy in `germanbuddy-support/` now mentions it (section 4, added 2026-11-19).

- **TASK-030 root cause is verified in the library source, not reproduced on a phone (Product Owner):** `expo-sqlite` 15.2.14 gives the same native `NativeDatabase` a second JS wrapper when a database is opened twice in one process (the old restore flow did that); when the first wrapper is garbage-collected the shared native handle is released and every later call throws a bare `NullPointerException`. Check on a phone: restore a backup, leave the app in the background, tap the word notification, use vault/today/review. A phone already in the bad state is fixed by force-stopping the app. Still open and not fixed here: `SettingsScreen` backup alerts and `AppErrorBoundary` still print raw error text.
- **TASK-027 needs a phone test (Product Owner):** open Statistiche with an empty and a populated vault; in Settings switch topics off/on (the last one must refuse), then check the next day's word follows them; check RTL (Arabic) and long translations on the stats rows and topic chips.
- **Streak shown as stored:** the streak (word card and statistics) is the stored value and only resets when a word is next saved, so it can read high after missed days. Pre-existing behaviour; not changed by TASK-027.
- **TASK-026 needs a phone test before upload (Product Owner):** install the new build (versionCode 14) over a populated 1.0.13 and check that the profile, vault, streak, AI key and notification settings survive (MMKV 2 → 3), that reminders still fire (daily word, review, test notification), and a pass through today's word, review, practice, grammar, settings (including Arabic RTL) and backup export/restore. The New Architecture is now on by default (SDK 53).
- **Edge-to-edge:** with targetSdk 36 Android 16 no longer lets an app opt out of edge-to-edge; `edgeToEdgeEnabled` is not set in `app.config.js`. Check the screens' top and bottom insets on a phone.
- **Build on Windows:** `build_bundle_android_release.bat` needs the `NoDefaultCurrentDirectoryInExePath` environment variable cleared in the shell that runs it, otherwise `cmd` cannot find `gradlew.bat`. The build is memory-hungry (about 7 minutes).
- **Android 6 (API 23) is not supported**: `minSdkVersion` is 24 because Play's automatic protection requires it. Play warned that 1,164 device models are no longer supported by that release; accepted on 2026-10-08.
- **One example sentence per word** in the word bank, so users can memorise the sentence instead of the word. More sentences per word would improve cloze and reorder.
- **Deferred features** (need an LLM or the user's own API key): Lena chat, grammar-error classification, session recap. The bring-your-own-key AI plumbing now makes them possible as opt-in features.
- **Repo housekeeping** still open: the root `assets/` folder (store marketing images, not used by the build) is untracked and undecided; a stray `mobile/%ProgramData%/` folder and a leftover (untracked) `android_legacy/` build folder exist on disk. (`germanbuddy-support/`, `Bundles/` and `GoogleCloud/` are gitignored.)
- **CI warnings (not failing):** the Play upload action wants `tracks` instead of `track`; GitHub is retiring Node 20 for the actions in use (`checkout`, `setup-node`, `setup-java`, `upload-artifact`).
- **The word-bank C1/C2 vocabulary** was never spot-checked by the Product Owner.
- **Release workflow** works end to end (versionCode 11 draft on 2026-10-08; versionCode 13 completed on 2026-10-16, after a rejected attempt with 12 because that code was already on Play). Always check Play's highest code before dispatching; the workflow's default (run number) can also be too low.
- **Compound-noun exercise deferred (not written; TASK-023 is now the automatic backup):** only 46 bank words are compounds whose parts are also in the bank (2 %). It needs content first — a generator script (the 46 are the seed list) and a curated list reviewed by the Product Owner.
- **Automatic backup phone check (2026-11-19):** verified on a moto g 5G: a phone-storage folder works, Google Drive folders do not (TASK-034). Not yet checked: an SD card, a revoked/deleted folder, install-over and reinstall.
- **Behaviour change to know about:** Android's own cloud backup / device transfer no longer includes the AI key, notification ids or the backup-folder setting (`withAndroidBackupRules`), so after a reinstall or on a new phone the AI key is entered again.
- **New UI languages are first-pass machine translations (TASK-024):** all 11 string files need review by a native speaker before the Play listing mentions them. Arabic RTL, CJK/Devanagari/Arabic glyph fallback (Playfair Display and Inter do not cover them, Android falls back to the system font) and the wrapping language picker at small widths have **not** been seen on a phone.
- **Translated word content (TASK-025) is machine-written and unreviewed:** 11 languages x 2,194 entries. Known weak spots flagged by the translators: near-synonym families (Futterneid, Sprachgewalt, Redegewandtheit …) are told apart only by short qualifiers; Konjunktiv forms (würde, hätte, heiße) have descriptive glosses; vulgar German slang was toned down; Arabic/Hindi/Japanese/Turkish/Chinese glosses for German cultural terms (Realschule, Gymnasium, Krankenkasse …) are approximations. A native reviewer per language is needed before the store listing mentions them. Edit the TSVs in `scripts/wordbank/i18n/<lang>/`, never the JSON; run `npm run build:wordbank`.
- **Arabic layout change needs a restart:** Android applies `forceRTL` on the next launch; the app says so with an alert. 
- **Outward-facing follow-ups for the Product Owner:** the public privacy policy/terms and the Play listing/Data-safety text may still say "Italian and English"; the policy's list of what is sent to the AI provider (word, level, native language) is unchanged and still correct.
- **Find the mistake is conservative but unproven:** it was spot-checked on generated samples, not by a native speaker; if a corrupted sentence is still acceptable German, add a guard for that pattern.

---

## Key Decisions Made During Development
- **A second way into the vault (TASK-037, 2026-11-20):** words can be started from the lists, with a confirmation; the streak still counts only the word of the day, so a streak cannot be inflated by bulk-adding. Watch after release: a large batch of added words makes a large review queue the next day; if it shows up, consider a daily cap on new reviews (separate task).
- **Text-to-speech is in scope (TASK-035, 2026-11-20):** on-device only, through the phone's own Android TTS engine (`expo-speech`). The app sends nothing; the OS engine may use its own network voices, which is not ours to declare. Speech-to-text and bundled recordings stay out. Privacy policy in `germanbuddy-support/` updated and pushed 2026-11-20 (section 2 paragraph + third-party table row, `efb68a7`).

*Log any decisions that deviate from CLAUDE.md here, with rationale.*

| Date | Decision | Reason |
|------|----------|--------|
| 2026-09-04 | TASK-016: the app is fully standalone/offline — no backend, no accounts, no analytics. Lena chat, grammar-error tracking and session recap are cut from scope. | Product Owner requirement: the app must run entirely on the device. |
| 2026-09-12 | TASK-017: Italian and English are both first-class (UI and meanings). | Reach beyond Italian speakers; supersedes the earlier "Italian-only i18n for v1.0". |
| 2026-10-08 | TASK-018: AI is bring-your-own-key with two provider types: Anthropic and "OpenAI-compatible" (user-supplied https base URL and model). One key per provider. The key may be included in a backup only if the user opts in; a restored backup's base URL is applied only together with that backup's own key. | Lets users choose a vendor without any server of ours; stops a crafted backup from redirecting a stored key to a hostile host. |
| 2026-10-08 | Backup restore only inserts columns that exist in the installed schema. | Column names from the file were interpolated into SQL: a crafted file could inject SQL, and a backup from a newer app failed on an older one. |
| 2026-10-08 | TASK-019: reviews are graded 0–1 (typo, hint, retry earn less); only the first attempt of a word is graded, retries are practice only. | A re-ask must not launder a miss into a pass or double-penalise it. |
| 2026-10-08 | TASK-020: each format has a quality ceiling, and formats are gated by tier (easy recognition for fragile words, production for stronger ones). Sentence reorder offers a "my sentence is also correct" override (0.5). | Recognition is weaker evidence than typing; German word order is flexible and cannot be judged reliably offline. |
| 2026-10-08 | Review reminders are refreshed one at a time. | A matching round grades several cards together; overlapping refreshes scheduled duplicate notifications. |
| 2026-10-08 | TASK-021: free practice never pushes a word's next review later. A miss lowers its score and may move the review earlier (tomorrow at the earliest); a pass changes nothing. Practice does not touch the streak or the review log. | A right answer straight after practising says little about next week; rewarding it would let easy repetition push words weeks ahead. |
| 2026-10-08 | TASK-022: "find the mistake" corrupts only what is certainly wrong: an article never valid for the noun's gender, or a case-fixing determiner outside two-way prepositions; nouns whose plural can look like the singular are skipped (neuter) or limited to `das` (masculine). The compound-noun builder was split off into a content-first task. | A correct sentence marked wrong is worse than no exercise; the data (46 compounds) did not justify the compound builder yet. |
| 2026-10-15 | TASK-024: the app language is one registry (13 languages); Italian stays the data default (`learner_profile.native_language` default); unknown codes from any external source are coerced, never trusted; missing translations fall back to English, not Italian; Portuguese is Brazilian; Arabic uses `ar-AE` (Latin digits, Gregorian calendar); the phone's language preselects the welcome picker. | Product Owner asked for French, Spanish and every major language. A registry makes the next language one entry plus one file. |
| 2026-10-16 | TASK-025: translated word content is authored as TSV per language and level, validated for completeness, script, length and same-part-of-speech meaning collisions (the same word listed in two levels is exempt), then built to JSON; only languages with a complete directory ship. Translations were produced by parallel agents per language and level-half, then re-validated across levels. | Cross-level collisions are only visible once a language is whole, so each language is validated again after merging. |
| 2026-10-15 | TASK-024: translated word content is a bundled, bank-keyed lookup (`src/i18n/wordContent.ts`), not new DB columns. | The bank is immutable per version; columns would need a migration of every saved word and 11x3 fields, and a lookup makes a new language a data-only change. |
| 2026-11-08 | The cached AI word insight is keyed by word, with its language stored in the payload (no schema change); one language cached per word. | A new column or key would need a migration; regenerating after a language switch is cheap and rare. Pre-fix rows have no language, so they are ignored once. |
| 2026-10-08 | `CONTEXT.md` is updated in the same push as every change that lands on `main`, by whoever pushes. | It is the ground truth other sessions read first; Product Owner rule. |
| 2026-10-08 | TASK-023: automatic backup writes through Android's folder picker (SAF) to a folder the user chooses, driven by database change events (debounced, flushed on background, retried at start); the file never contains AI keys or provider settings; newest 10 files kept, rotated from our own list of URIs; no network or cloud SDK. | Ported from GymDiary's design, proven on a device. Protects against a lost phone without any server of ours. |
| 2026-10-08 | TASK-023 Part B: Android's cloud backup / device transfer uses an allowlist (database and user MMKV stores) that excludes the MMKV stores `ai`, `notifications-store` and `auto-backup`. | The app had `allowBackup=true` with no rules, so API keys could be copied to the user's Google account. Trade-off: the AI key is not restored after a reinstall. |
| 2026-10-08 | `minSdkVersion` raised from 23 to 24. | Play's automatic protection rejects bundles with minSdk 23. |
| 2026-11-13 | Topic preferences reuse `learner_profile.topic_preferences` (0.8 selected / 0.3 not, active >= 0.5) instead of a new column; stats group words by looking them up in the bundled bank rather than storing topic/level on `vocabulary_items`. | No migration, backups and restores keep working; the 4 words present at two levels resolve to the lowest level. Existing installs see the onboarding topics start to count from the next new word. |
| 2026-11-13 | The release workflow, not the developer, owns the versionCode check and the release tag. | A wrong code cost a full build twice (12, 15); the docs were wrong about what Play held. Asking Play is the only reliable source. |
| 2026-11-07 | Expo SDK 53 chosen over 54 for the 16 KB fix. | Still supports the legacy `expo-file-system` API (SAF backup code) and the legacy architecture escape hatch; 54 would be a second migration. |
| 2026-11-07 | Verification tool is CommonJS (`.js`), not `.mjs`. | Jest cannot import `.mjs` without experimental flags. |
| 2026-10-08 | Release signing material lives in GitHub secrets for CI and in gitignored local files; the Play service account is a dedicated one (`play-publisher`), not the Firebase Admin key of another app. | Least privilege and separate revocation. |
| 2026-05-15 | TASK-DS: warm, editorial visual direction — Playfair Display for German words and examples, Inter for UI, 20 colour tokens, shared `components/ui/` components. | Design decision from the product spec. Still in use. |
| 2026-11-18 | TASK-030: `getDb()` now returns a facade (`AppDb`, the five methods the app uses) instead of the raw `SQLiteDatabase`, and every connection is opened with `useNewConnection: true`. | A dead native handle used to be cached for the life of the process; the facade lets every call site self-heal without changes. A private connection per open avoids the library's shared-object release bug. Retrying inside a transaction is refused to keep writes atomic. |

---

## How to Update This File

**Every push to `main` includes an up-to-date `CONTEXT.md`, in the same push.** Whoever pushes (Giacomo or Claude) does it, even for a small change.

Before pushing:
1. Update "Current Status" (test count, release state) and the "What Exists" sections that changed
2. Add finished work to "Completed Tasks" with its date
3. Update "Active Branches"
4. Add new issues to "Known Issues / Tech Debt" and remove fixed ones
5. Log any decision that deviates from `CLAUDE.md` in "Key Decisions"
6. Update "Last updated" (and "Current version" if it changed) at the top

Commit it together with, or just before, the change it describes, then push.
