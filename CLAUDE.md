# CLAUDE.md — LanguageBuddy

This file is the authoritative reference for Claude Code working on this project.
Read it fully before writing any code, suggesting any architecture, or making any decisions.

**How the docs fit together**

| File | Answers | Updated by |
|------|---------|------------|
| `CLAUDE.md` (this file) | *How do we work here?* Architecture, rules, conventions, business logic. | Tech Lead / Product Owner when a rule changes |
| `CONTEXT.md` | *What exists right now?* Status, completed tasks, known issues, release setup, decisions log. | **Whoever pushes, in the same push** |
| `tasks/TASK-xxx.md` | *What exactly are we building next?* | Tech Lead |
| `store/<code>/` | *What do we publish for this app?* Play checklist, listing texts, QA checklist, graphics brief | Tech Lead / Product Owner |

When this file and `CONTEXT.md` disagree about the current state of the code, trust `CONTEXT.md`.
(`CONTEXT.md` still carries its GermanBuddy-era history; its status lines are kept current, its older sections are history.)

> **Architecture in one sentence:** LanguageBuddy is **one offline React Native (Expo) codebase that builds one standalone Android app per language**
> (GermanBuddy, SpanishBuddy, later FrenchBuddy, ItalianBuddy, …). Each app has no backend, no account, no analytics and no network call unless the
> learner turns on the optional AI feature with their own API key. Earlier versions of GermanBuddy had a Kotlin client, a FastAPI backend, Supabase,
> Firebase, RevenueCat and an AI chat (Lena); all of that was removed in September 2026 (TASK-016) and is **not** described here.

---

## 0. Development Pattern — READ THIS FIRST

This project uses a **two-instance Claude Code pattern**. Your role is determined by which instance you are. Read your role and stay in it — never cross boundaries.

### Roles

| Role | Model | Mode | Responsibility |
|------|-------|------|----------------|
| **Tech Lead** | Claude Opus | Plan mode | Reads codebase + CONTEXT.md, writes detailed task specs to `tasks/TASK-xxx.md`. **Never writes production code.** |
| **Developer** | Claude Sonnet | Execution mode | Reads task spec, implements exactly what is specified, commits to `main`. **Never redesigns the spec.** |
| **Product Owner** | Human (Giacomo) | — | Reviews output, runs the apps on a phone, decides what ships and when to push. |

When the Product Owner explicitly asks one instance to do the whole cycle (spec, tests, implementation, review, fixes),
do it in that order and keep the roles distinct in the output: the spec is written first and then treated as the contract.
Small look-and-feel changes the Product Owner asks for directly (an icon, a colour) need no spec: do them, test them, try them on the phone.

### How to identify your role
- Started with instructions to **plan and spec**: you are Tech Lead. Your only output is a `tasks/TASK-xxx.md` file. Stop there.
- Started with instructions to **implement TASK-xxx**: you are Developer. Read the spec, implement it, commit, done.

### The handoff contract
```
tasks/TASK-xxx.md  ←  Tech Lead writes this
       ↓
Developer reads and implements (tests first)
       ↓
Review → fixes (each finding gets a failing test first)
       ↓
CONTEXT.md updated and committed with the change, then pushed (when asked)
       ↓
Product Owner tests on a phone (a bug found there becomes a fix task, failing test first)
```

### Task specs
All specs live in `tasks/` (`TASK-001.md`, `TASK-002.md`, …; format in `tasks/TEMPLATE.md`). A spec fixes the design so the
Developer makes no architectural decisions: files to create and modify, exact signatures, acceptance criteria, the tests to write first, and rationale notes.
Status lines are `ready` → `in-progress` → `done`. Work that only the Product Owner can do (Play Console, store graphics, a native-speaker review, a phone check)
is also a task, marked as owner-side. Task numbers continue from the GermanBuddy era; do not reuse a number.

### Permissions
Both instances run with `--dangerously-skip-permissions` (`run_claude.bat`). This is intentional — the task spec is the safety boundary, not the permission system.
Even so: **commit only when asked, and push only when asked.** Anything outward-facing (pushing, publishing, deleting a remote branch, uploading
secrets, editing a public support site, uploading to Play) needs a clear request from the Product Owner. A release or upload is never part of a code task.

### What Tech Lead does when starting a session
1. Read `CLAUDE.md` (this file) fully
2. Read `CONTEXT.md` for current codebase state
3. Read existing `tasks/` files to understand what is already specced
4. Identify the next logical task
5. Write `tasks/TASK-xxx.md` using `tasks/TEMPLATE.md`
6. Stop — do not implement anything

### What Developer does when starting a session
1. Read `CLAUDE.md` (this file) fully
2. Read the assigned `tasks/TASK-xxx.md` completely
3. Read `CONTEXT.md` for current codebase state
4. **Write the tests the spec lists first and watch them fail** (red). For content tasks, plan the native-agent check (§14) from the start
5. Implement exactly what the spec says — no more, no less (green)
6. Review the diff critically (see "Review checklist" in §15); fix every real finding, each with a regression test
7. Run the checks of §15 from `mobile/`: `npx tsc --noEmit`, `npm test`, and `npm run test:app -- es` when anything language-related changed
8. Update `CONTEXT.md` (see §15 Git), then commit directly to `main` with a conventional message that references the task. Stop — do not pick up the next task.

---

## 1. Project Overview

**LanguageBuddy** is a family of free Android apps for learning a language's vocabulary and key grammar, offline, built around a daily word.
Each app teaches one language; all share the code, the exercise engine and the design.

| App | Studied language | Package | Status |
|-----|------------------|---------|--------|
| **GermanBuddy** | German | `com.giamat90.germanbuddy` | on Google Play |
| **SpanishBuddy** | Spanish | `com.giamat90.spanishbuddy` | built and phone-tested; word content machine-drafted, Play listing not created |
| FrenchBuddy, ItalianBuddy | French, Italian | — | planned; follow §3 "Adding a language" |

What every app does:
- Every day the learner gets one word at their CEFR level (article where the language has one, IPA, meaning, example, cultural note).
- Saved words go into a **vault** and come back through **spaced repetition**, practised with several exercise formats.
- The learner can also **practise any time** in a format of their choice, and drill **grammar** (what the language pack supports: articles, cases, choice rules).
- An optional, bring-your-own-key AI feature adds extra examples and a usage note for a word.

**Target user:** intellectually curious adult learners who want to genuinely understand the language, primarily Italian speakers. The interface (UI language) is available in
13 languages — Italian, English, French, Spanish, Portuguese, Russian, Ukrainian, Polish, Turkish, Chinese, Japanese, Hindi, Arabic. A native speaker of the studied
language is not offered that UI language (SpanishBuddy has 12). The studied language is fixed per app and never changes at runtime.

**Platform:** Android (minSdkVersion 24). The code is React Native, so iOS is possible later but is not a goal today.

---

## 2. Repository Structure

```
LanguageBuddy/
├── mobile/                          # the whole product
│   ├── app/                         # expo-router routes
│   │   ├── onboarding.tsx, quiz.tsx, topics.tsx
│   │   └── (app)/                   # index (vault), today, review, practice, practice-session, grammar, word, catalog, stats, settings
│   ├── src/
│   │   ├── languages/               # LanguagePack: types.ts, index.ts (getActivePack), de.ts + de/strings/, es.ts + es/strings/, active.ts (GENERATED seam)
│   │   ├── data/                    # db.ts, schema.ts, srs.ts, backup.ts, dailyWord.ts, bootstrap.ts, wordbank/<lang>/*.json (+ active.ts, GENERATED seam)
│   │   ├── services/                # profile, word, vault, review (due + practice grading), grammar, restore
│   │   ├── lib/
│   │   │   ├── exercises/           # the exercise engine — pure TypeScript, no I/O (see §9)
│   │   │   ├── ai/                  # keys.ts, llm.ts (transport), providers/, wordInsight.ts
│   │   │   ├── autoBackup/          # helpers (pure), scheduler (pure), index (SAF writer, change tracking)
│   │   │   └── cloze.ts, grammar.ts, catalog.ts, speech.ts, notifications.ts, errorHandling.ts
│   │   ├── screens/                 # ExerciseSession (shared by Review and Practice), Vault, WordCard, WordDetail, Grammar, Settings, …
│   │   ├── components/ui/           # design-system components
│   │   ├── components/exercises/    # one view per exercise format
│   │   └── store/, i18n/ (it.ts is the key source; wordContentLoaders.ts is a GENERATED seam), theme/ (colors.ts, palettes.ts), types/, hooks/
│   ├── variants/                    # one JSON per app: name, slug, scheme, packages, icons, version fields (de.json, es.json)
│   ├── scripts/                     # build-wordbank, validate-wordbank, set-active-language, with-language, test-app, verify-prebuild,
│   │                                #   build-store, export-review-sample, export-i18n-source, check-play-version; wordbank/<lang>/ (TSV sources); lib/
│   ├── plugins/                     # withReleaseSigning.js, withAndroidBackupRules.js (Expo config plugins)
│   ├── test-support/                # testPack.ts (a Spanish-like second pack for tests), appExpectations.ts (per-app expectations table)
│   ├── assets/                      # icon.png / adaptive-icon.png (German), icon-es.png / adaptive-icon-es.png (Spanish), fonts, splash
│   ├── __tests__/ (incl. activeApp/), __mocks__/   # jest-expo; expo-sqlite and react-native-mmkv are mocked in memory
│   └── app.config.js                # thin: buildExpoConfig(variant) from scripts/lib/variants.js
├── store/                           # <code>/ (support.json, listing/<ui>.json, play-checklist, qa-checklist, screenshots, graphics-brief) and support-template/ (the four public pages)
├── tasks/                           # specs (TEMPLATE.md + TASK-001 … )
├── .github/workflows/               # ci.yml (type check + tests + Spanish app suite), release-android.yml (manual build and Play upload, `app` input)
├── build_*.bat, deploy_*.bat        # local build/install scripts (Windows); take the language code (`de`, `es`)
├── CLAUDE.md, CONTEXT.md, README.md, LICENSE (Apache-2.0), NOTICE
```
Not in this repo: the German public site (`germanbuddy-support`, separate repo, gitignored if cloned here), Play service-account keys (`GoogleCloud/`), keystores, `Bundles/`.
`mobile/android/` is **generated by `expo prebuild` and gitignored**.

---

## 3. The language family

### One codebase, one language per build
- **`LanguagePack`** (`src/languages/types.ts`) holds everything specific to the studied language: app identity (`app.name`, backup tag, database file name), word letters and
  folding, typo rules, collation locale, speech locale, AI language name, and the grammar parts a language has — `articles`, `gender`, `cases`, `choices` (each may be `null`; the
  features built on a missing part switch off instead of failing) — plus the placement quiz, the UI languages it offers and its overlay strings.
  Code reads it through **`getActivePack()`**, at use time, never at import time.
- **Seams:** one language is active per build. `npm run set:language -- <code>` (default `de`) regenerates three files:
  `src/languages/active.ts`, `src/data/wordbank/active.ts`, `src/i18n/wordContentLoaders.ts`. **The repository always holds the German seams** (a diff in them is a bug).
  `node scripts/with-language.mjs <code> -- <command>` activates a language for one command and always restores the seams afterwards.
- **Variants:** `mobile/variants/<code>.json` describes one app (name, slug, scheme, Android package, icon, adaptive-icon background, version fields). `buildExpoConfig` in
  `scripts/lib/variants.js` turns it into the Expo config. `APP_LANG` picks the variant (default: the language the seams activate); `app.config.js` **throws if they disagree**,
  so a Spanish package can never carry German content. Blocked permissions, backup-rules resource names and the release tag format also come from here.
- **Isolation:** a bundle holds one language only (`bundleIsolation.test.ts`). Never import `de` or `es` directly from shared code; go through `getActivePack()`.
- **Theme:** `src/theme/palettes.ts` has one palette per language (paper, ink, primary, …) and `theme/colors.ts` picks it from the active pack. **An app's primary colour is
  the colour of its icon**: GermanBuddy navy `#1E4A67`; SpanishBuddy the Spanish flag red `#AA151B` (also its adaptive-icon background). Article-gender colours and the error
  red are shared. A new language gets its own icon and palette, in the same style (word card on its brand colour, no national flag in the icon).

### Rules that keep the languages apart
- **Never write German (or any one language) into shared code or shared strings.** The app name is `%{app}` (filled by `t()` from the pack); text about the studied language
  goes in the pack's overlay `src/languages/<code>/strings/<ui>.ts` (one file per UI language, parity-tested in `targetStrings.test.ts`).
- Anything that used to be German-specific is a pack property or a pack capability (`collation`, `letters`, `fold`, `speech.locale`, …). When a test or a screen needs a new
  one, add it to `LanguagePack`, to `de.ts`, to `es.ts` **and** to `test-support/testPack.ts`.
- Per-app facts are pinned in **one table**, `test-support/appExpectations.ts` (app name, database file, backup tag, package, speech locale, word counts per level, UI languages,
  articles, choice rules, sample words, collation sample, special characters). **A language with no row fails every `activeApp` test**: that is the gate for a new language.

### Adding a language (checklist; each step is a task)
1. `LanguagePack` for the language (`src/languages/<code>.ts`, `<code>/strings/<ui>.ts` × 13 or 12).
2. Word bank: `scripts/wordbank/<code>/language.json` (levels, rule codes, parts of speech, articles, per-level rules) + `<LEVEL>.tsv` + `i18n/<UI>/` translations. A `language.json` with `"draft": true` is skipped by build/validate and cannot be activated.
3. `variants/<code>.json`, icon, palette, `store/<code>/` (support.json, listing in every UI language, checklists).
4. A row in `appExpectations.ts`; a CI step `npm run test:app -- <code>`; `node scripts/verify-prebuild.mjs <code>` passes.
5. Phone QA with `store/<code>/qa-checklist.md`; a native reader reviews the machine-drafted word content, listing and strings before the Play release.

---

## 4. Tech Stack

| Component | Choice | Notes |
|-----------|--------|-------|
| Language | TypeScript (`strict`) | no linter or formatter is configured: match the surrounding code |
| Framework | React Native 0.79 + Expo SDK 53 (React 19) | built with `expo prebuild`; `mobile/android/` is **generated and gitignored** |
| Navigation | expo-router 5 | file-based routes under `mobile/app/` |
| State | Zustand | small stores in `src/store/` |
| Data | `expo-sqlite` | on-device relational data (§5) |
| Flags / settings | `react-native-mmkv` | install id, onboarding flag, notification ids, AI settings |
| Notifications | `expo-notifications` | local only; no push token |
| Speech | `expo-speech` | on-device Android TTS to read a word aloud (locale from the pack); imported only in `lib/speech.ts` |
| i18n | `i18n-js` | 13 app languages, `src/i18n/<code>.ts`, registry in `language.ts`; `it.ts` is the key source and every file must have the same keys and `%{}` placeholders |
| Tests | Jest (`jest-expo`) + React Native Testing Library | §15 |
| CI | GitHub Actions | `ci.yml` on push/PR; `release-android.yml` is manual |
| AI (optional) | user's own key | Anthropic, or any OpenAI-compatible endpoint (§7) |

No server, database service, auth provider, billing library or analytics SDK is used. Do not add one without a task that says so.

---

## 5. Data

Source of truth: `mobile/src/data/schema.ts`. **Migrations are additive and idempotent:** `CREATE TABLE IF NOT EXISTS` in `STATEMENTS`
for new tables, and `ensureColumn(...)` in `runMigrations` for new columns on existing tables. Never edit an existing `STATEMENTS` entry to add a column
(tests simulate a pre-migration database from the base statements), and never drop data. Column names keep their legacy form (`example_de`); the data layer maps them to `example`.
The database file name comes from the pack (`pack.app.dbFile`), so two apps on one phone never share data.

| Table | Purpose |
|-------|---------|
| `learner_profile` | CEFR level, topic preferences, streak, last activity, total words seen, `native_language` |
| `daily_items` | one row per day: the word of the day (copied from the bank) and `saved_at` |
| `vocabulary_items` | saved words and SRS state: `retention_score`, `times_seen`, `times_used`, `next_review_at` |
| `review_log` | one row per scheduled review: `was_correct` and `quality` (0–1) |
| `grammar_mastery` | per grammar-rule mastery used by the grammar drill |
| `ai_word_notes` | cached AI output, one row per word |
| `schema_meta` | local bookkeeping (e.g. word-bank version) |

**Word bank:** one folder per language: `mobile/src/data/wordbank/<lang>/{A1…C2}.json` (German 2,194 entries; Spanish 1,739; one example sentence each, field `example`),
generated by `npm run build:wordbank` from the TSVs in `mobile/scripts/wordbank/<lang>/` (plus `language.json` with the rule codes, parts of speech, articles and per-level rules the
validator accepts). The word's meaning in the other UI languages lives in `scripts/wordbank/<lang>/i18n/<UI>/<LEVEL>.tsv` → `src/data/wordbank/<lang>/i18n/<UI>.json`.
**Edit the TSVs, never the JSON.** `npm test` validates the bank first (`pretest`). Bump `WORDBANK_VERSION` in `wordbank/index.ts` whenever the bundled data changes.
**Audit:** `npm run audit:wordbank -- <code>` compares a bank with a public frequency list the owner downloads by hand into the gitignored `mobile/scripts/reference-lists/<code>.txt` (never committed; lines `word count`, e.g. hermitdave/FrequencyWords) and prints level medians, words that look misplaced, words not found, frequent words missing and topic balance (thresholds and stop words in `scripts/wordbank/<code>/audit.json`). It reads the built JSON, changes nothing, and its flags are questions for a human (subtitle lists rank compounds, infinitives and formal words low).
Machine-drafted content (all Spanish content today) is marked as such in `CONTEXT.md` until a native reader has reviewed it; a fix to a Spanish row means re-translating
that row in the ten translated languages.

**Backups** (`src/data/backup.ts`): a single JSON file (`format` 1) holding every user table plus a few MMKV values, tagged with the app (`pack.app.backupTag`).
**A backup of one app is refused by another** (tested). Restore replaces **all** local data in a transaction and inserts only columns that exist in the installed schema
(column names from a file are never trusted). The AI key and provider settings are **excluded unless the user opts in** when exporting; a restored base URL is applied only
together with the same backup's own key.
**Automatic backup** (`src/lib/autoBackup/`, Android only): an optional copy written through the Storage Access Framework to a folder the user picked, shortly after backed-up
tables change (database change listener, debounced). It **never** contains AI keys or provider settings, keeps the newest 10 files from its own URI list, and has no network code.
Android's own cloud backup is restricted by the `withAndroidBackupRules` plugin (allowlist; the `ai`, `notifications-store` and `auto-backup` MMKV stores are excluded; resource names follow the app slug).

### Grammar rule codes
Each language lists its own in `scripts/wordbank/<lang>/language.json` (`ruleCodes`, and per level `levelRules.<L>.allowedCodes`, cumulative). Every word-bank entry carries one in `grammar_angle`.

**German:**
```
A1: VERB_CONJ_REGULAR, NOUN_GENDER, WORD_ORDER_V2, NEGATION_NICHT_KEIN
A2: VERB_CONJ_IRREGULAR, ACCUSATIVE_MASC, ACCUSATIVE_PREP, SEPARABLE_VERB
B1: DATIV_PREP, DATIV_INDIRECT_OBJ, MODAL_VERB, PERF_SEIN_HABEN, SUBORD_VERB_FINAL
B2: KONJUNKTIV_II, GENITIV_CASE, PASSIVE_VOICE
C1: KONJUNKTIV_I, EXTENDED_ATTR
```
The drill covers `NOUN_GENDER` (article picker der/die/das) and the case rules `ACCUSATIVE_MASC`, `ACCUSATIVE_PREP`, `DATIV_PREP`, `DATIV_INDIRECT_OBJ`, `GENITIV_CASE` (case cloze).

**Spanish:**
```
A1: NOUN_GENDER, ADJ_AGREEMENT, VERB_PRESENT_REGULAR, SER_ESTAR, NEGATION_NO, VERB_PRESENT_IRREGULAR
A2: REFLEXIVE_VERBS, POR_PARA, PRETERITO_PERFECTO, PRETERITO_INDEFINIDO, DIRECT_OBJECT_PRONOUN
B1: PRETERITO_IMPERFECTO, FUTURO_SIMPLE, CONDICIONAL, IMPERATIVO, INDIRECT_OBJECT_PRONOUN, GUSTAR_VERBS
B2: SUBJUNTIVO_PRESENTE, SUBJUNTIVO_IMPERFECTO, PERIFRASIS_VERBAL, PASIVA_REFLEJA, RELATIVOS
C1: SUBJUNTIVO_COMPUESTO, ORACIONES_CONDICIONALES, SER_ESTAR_ADJETIVOS
C2: CONCORDANCIA_TEMPORAL, REGISTRO_FORMAL
```
The drill covers `NOUN_GENDER` (el/la) and the *choice* rules `SER_ESTAR`, `POR_PARA`, `DIRECT_OBJECT_PRONOUN` (`pack.choices`: sets of mutually exclusive forms; only sentences an author
tagged with the rule are used). The other codes are metadata for now. Caps keep the choice sentences clean: `SER_ESTAR` ≤ 20 at A1–B1 then ≤ 10; `POR_PARA` none at A1, ≤ 20 at A2–B1,
then ≤ 10; `DIRECT_OBJECT_PRONOUN` only at A2–B1 (≤ 15). A1 irregular verbs use the infinitive in the example (the stem check cannot see irregular forms).

---

## 6. Screens and Routes

| Route | Screen | What it does |
|-------|--------|--------------|
| `/onboarding`, `/quiz`, `/topics` | Welcome / Quiz / Topics | level quiz (sentences from the pack), topic preferences, creates the local profile; the welcome screen can restore a backup |
| `/(app)` | Vault | saved words with review-date chips; buttons for today's word, grammar, practice, review (when words are due) |
| `/(app)/today` | WordCard | today's word, save to vault |
| `/(app)/catalog`, `/(app)/stats-words` | Catalog / word lists | the whole word bank by level and topic with status colours; tap an unsaved word to start learning it (TASK-036/037) |
| `/(app)/stats` | Statistics | New / Learning / Mastered, streak, accuracy, per-topic and per-level bars |
| `/(app)/word` | WordDetail | one saved word; the optional AI "Explore further" |
| `/(app)/review` | Review | scheduled review of due words (graded into the SRS) |
| `/(app)/practice`, `/practice-session` | Practice menu / session | free practice by format (§8) |
| `/(app)/grammar` | Grammar | the drills the pack supports (articles, cases, choice rules) |
| `/(app)/settings` | Settings | language, notifications, backup/restore, AI provider and key |

---

## 7. Optional AI feature

- **Off by default.** The apps ship with no key. The learner chooses a provider in Settings and pastes their own key.
- **Providers:** `anthropic` (fixed endpoint, model `claude-haiku-4-5`) and `openai` — any OpenAI-compatible service, with a user-set **https** base URL
  (default `https://api.openai.com/v1`) and model (default `gpt-4o-mini`). One key per provider.
- **Code:** `src/lib/ai/keys.ts` (MMKV store id `ai`), `llm.ts` (`callLLM`, retry on network/429/5xx, no retry on other 4xx), `providers/anthropic.ts` and `providers/openai.ts`,
  `wordInsight.ts` (the one feature today; the studied language's English name comes from `pack.ai.languageName`).
- **Privacy rules (each app's public privacy policy depends on them):** only the word, its CEFR level and the native language are sent; never the word list, profile or any
  other app data. Requests go straight to the provider, never through a server of ours. Keys stay on the device and are exported in a backup only on explicit opt-in;
  **automatic backups never contain them**, and Android's cloud backup excludes their store. INTERNET is the only network permission and exists for this call alone.
- Anything new that sends data off the device needs a task, an update of the privacy policy and terms (the template in `store/support-template/` and the German site in
  `germanbuddy-support/`), and Play's Data safety form for every app.
- **Deferred (not built):** Lena chat, grammar-error classification from free text, session recap. They need an LLM; the bring-your-own-key plumbing makes them possible as opt-in features.

---

## 8. Key Business Logic

All of this is covered by unit tests; keep the behaviour unless a task changes it. It is the same for every language.

### Spaced repetition (`src/data/srs.ts`, ported from the old backend)
```ts
// weight = 1 / (1 + 0.1 * timesSeen); outcome is a boolean or a quality in [0, 1]
updateRetentionScore(current, outcome, timesSeen) = round3(current * (1 - weight) + outcome * weight)
// next review interval from the NEW retention score
retention >= 0.9 -> 21 days;  >= 0.75 -> 7;  >= 0.6 -> 3;  otherwise 1 day
```
A newly saved word starts at retention 0.5 and is due after 1 day. `MASTERY_WEAK_THRESHOLD = 0.6` marks weak grammar rules. Grammar mastery uses the same update (`updateMastery`).

### Streak (`updateStreak`)
Saving today's word on consecutive calendar days increments the streak; saving twice in a day does nothing; a gap restarts it at 1. **Only saving the word of the day touches the streak** — reviews and practice never do.
Starting a word from a word list (`startLearning`, TASK-037) adds it to the vault like the daily save (retention 0.5, first review in 1 day, `source = 'catalog'`) but **never touches the streak**.

### Graded outcomes (`src/lib/exercises/quality.ts`)
A review result is a quality in [0, 1], not pass/fail. `PASS_QUALITY = 0.5`. Typed answers: exact 1.0, close (a letter slip the pack's `fold` forgives — umlaut/ß in German, accents in Spanish — or one typo
on a word of `pack.typoMinLength`+ letters) 0.7, wrong 0; using the hint caps the quality at 0.6 (the hint counts letters with `letterCount`, from the pack's letters). Format ceilings: multiple choice 0.8; matching 0.7 / 0.4 / 0
for 0 / 1 / 2+ mistakes; sentence reorder 0.9, or 0.5 when the learner confirms "my sentence is also correct". **Only the first attempt of a word in a session is graded**; relearning retries are practice only.

### Free practice (`gradePractice` in `reviewService.ts`)
Practice **never pushes a review later**. A pass changes nothing. A miss (quality < `PASS_QUALITY`) lowers the retention score and sets
`next_review_at = min(existing, date for the new score)`. Practice does not change `times_seen`, `times_used`, the review log or the streak.

### Not implemented (old design, dropped with the chat)
The session "difficulty dial" and the "CEFR promotion check every 10 sessions" no longer exist. The learner's level is chosen at onboarding.

---

## 9. Exercise Engine (`mobile/src/lib/exercises/`)

Pure TypeScript: no I/O, no React, injectable `rng` — which is what makes it testable. UI lives in `components/exercises/` and `screens/ExerciseSession.tsx`.

- **Tiers** (`tier.ts`): `new` (seen once, or retention < 0.6), `strong` (retention ≥ 0.85 and seen ≥ 4 times), otherwise `learning`.
- **Formats** (`registry.ts`): typed cloze (weight 2), sentence reorder (weight 1) and find the mistake (weight 1) for learning/strong words; multiple choice for new words; matching pairs
  (a *group* step of 4–5 new words); flip-card as the fallback. A format that cannot be built for a word returns `null` and the next candidate is tried. Find the mistake builds its slot
  from what the pack has (gender article, case determiner, or a choice set); a pack without those has no such slot.
- **Session** (`session.ts`): a pure state machine. A missed word returns 3 cards later, at most 2 retries; matching rounds are planned first; progress counts first attempts.
- **Practice** (`practice.ts`): per-format config that ignores tiers, card selection (weaker words favoured), availability for the menu.
- **Adding a format:** add a definition to the registry (`tiers`, `weight`, `build`), a model type, a view in `components/exercises/`, a case in `ExerciseSession`'s switch, strings in all UI languages,
  a per-format quality ceiling in `quality.ts` chosen so a clean answer never hurts the schedule, and tests (builder, registry gating, screen) — run them against the German pack **and** `testPack`.

---

## 10. Mobile Architecture

```
Screens / components  →  stores (Zustand) and services  →  data layer (SQLite, MMKV, word bank)
                                      ↘ lib/ (pure logic: exercises, cloze, grammar, ai)        ↘ languages/ (the active LanguagePack)
```

- Screens render and handle input; **business rules live in `lib/` and `data/`**, not in components.
- Services are thin async functions over the data layer (`fetchDueReviews`, `gradeReview`, `gradePractice`, …).
- `ExerciseSession` is the single session UI; `ReviewScreen` and `PracticeSessionScreen` only decide which cards to load and how results are persisted.
- Anything that fires several database writes together (a matching round) must not run read-modify-write sequences that overlap: see `refreshReviewReminder`, which queues its runs.
- Do not use network APIs outside `lib/ai/`.

---

## 11. Monetization

All apps are **free**. No paywall, no billing library, no ads. Monetization may be revisited after launch, but nothing is committed.

---

## 12. Configuration, Build and Release

There are **no runtime environment variables**: the apps have no backend. Build-time selection is by language code (`APP_LANG`, `with-language`).

| What | Where | Rule |
|------|-------|------|
| App identity and version | `mobile/variants/<code>.json` (`versionMajor`, `versionMinor`, `localFallbackVersionCode`; CI sets `ANDROID_VERSION_CODE`) | bump before every local build and every upload; Play needs a strictly higher code per app each time |
| Release signing | `mobile/release.keystore`, `mobile/release.properties` | gitignored; back up outside the repo (losing the keystore means no more updates); without it a local build is debug-signed, which is fine for a phone test but never for Play |
| CI secrets | GitHub: `ANDROID_RELEASE_KEYSTORE_BASE64`, `ANDROID_RELEASE_PROPERTIES`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | never printed or committed |
| Play service-account key | `GoogleCloud/` | gitignored |

**Never commit:** keystores, `release.properties`, service-account or any API keys, `.env` files, built bundles (`Bundles/`). Check `git status` before every commit.

### Build and try an app
- **Bundle for Play:** `build_bundle_android_release.bat <code>` (clean prebuild, verifies the baked versionCode, writes `Bundles/…aab`). **Install on a phone:** `deploy_local_release_android.bat <code>`.
- **By hand (what a phone test uses):** from `mobile/`, with JDK 17 on `JAVA_HOME`: `node scripts/with-language.mjs <code> -- <build command>` where the build command runs
  `npx expo prebuild --platform android --clean` and then `gradlew.bat assembleRelease` in `android/` (8–12 minutes); install with `adb install -r android/app/build/outputs/apk/release/app-release.apk`.
  Afterwards confirm the seams are German again (`git diff --quiet src/languages/active.ts`). Do not run tests while such a build is running: the seams are switched.
- **Release tags:** `<code>-v<versionName>` for every app, German included (`de-v1.0.21`, `es-v1.0.1`). The `release-android.yml` workflow takes an `app` input and refuses an existing tag.
- **Before any release, check Play:** `npm run check:play-version -- <code> --key <service-account>.json` lists every versionCode Play holds; never trust `CONTEXT.md` for it.
- **Store material:** `npm run build:store -- <code>` renders the public pages and listing texts into the gitignored `store/<code>/dist/` and refuses to build without the app's `contactFormId`.
  The German public pages stay hand-maintained in `germanbuddy-support`.
- **Android permissions:** an app declares `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE` and, for the optional AI call, `INTERNET`. Storage and overlay permissions are **blocked**
  (`blockedPermissions` in `variants.js`); `verify-prebuild` fails on any new one. Adding a permission needs a task and an update of every app's Play forms.
- Release details (scripts, CI inputs, Play setup, open owner steps) are in `CONTEXT.md` and `tasks/`.

---

## 13. Scope

### In scope
Daily word, vault, streak, onboarding (level quiz + topics), spaced-repetition review with the exercise formats of §9, free practice, grammar drill, local reminders,
backup/restore, 13 UI languages, optional bring-your-own-key AI, on-device speech of a word or sentence (`expo-speech`), one app per language on Google Play.

### Out of scope for now
Lena chat and session recap (deferred, see §7), speech-to-text and bundled audio, multiple tutor personas, progress charts, social features, iOS and web releases, any server, accounts,
billing, analytics, switching the studied language inside one app.

---

## 14. Conventions that are about the family

- A feature that only one language needs is a **pack capability** that other languages leave `null`, never an `if (code === 'de')`.
- Content that a machine drafted is labelled as such in `CONTEXT.md` and in the owner-side review task until a native reader has checked it; it is not described as reviewed.
- Every language gets its own icon, palette, listing and support pages. Do not reuse another app's name, logo or colours in a listing.
- The studied language is never offered as a UI language to its own native speakers.
- **Every content task includes a native-agent quality check.** Whenever word lists, examples, translations, grammar tags, notes or store texts are audited, written or changed, the Developer starts read-only subagents briefed as native speakers of that language (per language, and per level group when the material is large), hands them the material as text, and reports their structured findings (`level` / `word` / `example` / `tag` / `note` / `gap`, with a verdict) in the hand-off. Agents never edit files. Their review is a filter, **not** a replacement for the human native reader (the owner-side review tasks); the hand-off says so.

---

## 15. Coding Conventions

### TypeScript / React Native
- `strict` TypeScript; no `any` unless a type genuinely cannot be named. `npx tsc --noEmit` must be clean.
- Match the surrounding style (there is no formatter). Comments explain *why*, not *what*.
- Logic that can be pure **is** pure and takes an injectable `rng`/clock, so tests stay deterministic.
- **No hard-coded UI strings:** every string goes in **all** `src/i18n/<code>.ts` files (`it.ts` is the key source); the key sets and `%{}` placeholders must be identical (`uiStringsParity.test.ts` enforces it).
  Never write the app name or the studied language into a shared string (§3). Anything that comes from outside (backup, route param, DB row) goes through `coerceNativeLanguage`.
- **Colours** come from `theme/colors.ts`, never as hex in a component or a hook.
- **Accessibility:** every touchable has `accessibilityRole` and an `accessibilityLabel`. Add a `testID` when tests need to find an element that has no unique text.
- **Errors:** log with `console.error(...)` at the point of failure; the UI shows a **generic i18n string**, never `e.message`, a stack trace or provider text.
- Never log secrets or learner content (typed answers, keys).
- UI components avoid timers unless a task needs one; keep them state-driven so tests need no fake timers.
- Database changes are additive (§5). Any SQL built from external input must whitelist identifiers.
- In JSON, a regex with `\b` or `\n` must be written `\\b` / `\\n`; a lost backslash silently becomes a control character (it broke a word-bank rule once).

### Testing
- Tests live in `mobile/__tests__/`. Run from `mobile/`: `npx tsc --noEmit` and `npm test` (validates the word banks, then Jest, with the German seams).
- **`npm run test:app -- <code>`** runs the language-neutral `__tests__/activeApp/` suite (identity, content, flows over the in-memory DB, backup incl. cross-app rejection, speech/notifications/AI prompt,
  screens, special characters) against another app. CI runs it for Spanish. Run it whenever the pack, the word bank, the theme or a variant changes.
- **`node scripts/verify-prebuild.mjs <code>`** runs a real `expo prebuild` and checks package, version, app name, backup-rules names, permissions, portrait, scheme and that no other app's name is left
  (it refuses to run if `mobile/android/` exists and removes what it created).
- **Write the tests listed in the spec first and see them fail.** A review finding gets a failing test before the fix; for a guard, remove it once and confirm the test goes red.
- Pure logic: unit tests with seeded or constant rngs. Services: the in-memory `expo-sqlite` mock (it is schema-less, so also assert the real schema where it matters, e.g. `PRAGMA table_info`).
  Screens: React Native Testing Library with `jest.mock` for services and `expo-router`.
- Property-style tests over the real word banks are encouraged for data-dependent code (they caught real problems).
- A change that could differ per language is tested against the German pack, `testPack` **and**, through `activeApp`, the real Spanish pack.

### Review checklist (before declaring a task done)
Untrusted input (backup files, URLs, keys) · concurrency (several writes or notifications at once) · double taps and stale state · performance on a vault of hundreds of words ·
schedule side effects (does a correct answer ever make things worse?) · what each app's public privacy policy says · **does anything now assume one language** (German letters, `der/die/das`, a German collation, a hard-coded app name) ·
unneeded files in the diff.

### Git
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `ci:`; reference the task: `feat(TASK-xxx): …`.
- **Commit directly to `main`.** No feature branches.
- **Every push updates `CONTEXT.md` in the same push** (status and test count, completed tasks, known issues, decisions, last-updated date) — see "How to Update This File" in `CONTEXT.md`. A push without it is incomplete.
- Commit only when asked; push only when asked. Never `--force`, never `--no-verify`. This repository is **public**: before a push, scan the diff for keys and secrets (`gitleaks` if installed, otherwise a grep of the staged diff).
- Never commit anything listed in §12. The generated seams must be German in every commit.

---

## 16. Success Metrics (90 days after an app's launch)

The apps have no analytics by design, so these come from the **Google Play Console** (installs, retention, vitals) and from the learners themselves. Measured per app.

| Metric | Target | Meaning |
|--------|--------|---------|
| Daily open rate | > 40% | The word streak is working |
| 30-day retention | > 35% | The product forms a habit |
| Word save rate | > 60% | Word cards are valuable |
| Crash-free sessions | > 99% | The release is solid |

---

## 17. Known Issues

Tracked in `CONTEXT.md` ("Known Issues / Tech Debt") and, for work only the Product Owner can do, in the owner-side tasks in `tasks/`. Do not duplicate them here.

---

*Last updated: 2026-11-21 — rewritten for the LanguageBuddy family (TASK-041 to TASK-050: language packs, variants, per-language word banks, store material, app QA suite; SpanishBuddy icon and palette). Earlier: Expo SDK 53 (TASK-026), standalone offline architecture (TASK-016 to TASK-021).*
