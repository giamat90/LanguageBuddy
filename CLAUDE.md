# CLAUDE.md — GermanBuddy

This file is the authoritative reference for Claude Code working on this project.
Read it fully before writing any code, suggesting any architecture, or making any decisions.

**How the docs fit together**

| File | Answers | Updated by |
|------|---------|------------|
| `CLAUDE.md` (this file) | *How do we work here?* Architecture, rules, conventions, business logic. | Tech Lead / Product Owner when a rule changes |
| `CONTEXT.md` | *What exists right now?* Status, completed tasks, known issues, release setup, decisions log. | **Whoever pushes, in the same push** |
| `tasks/TASK-xxx.md` | *What exactly are we building next?* | Tech Lead |

When this file and `CONTEXT.md` disagree about the current state of the code, trust `CONTEXT.md`.

> **Architecture in one sentence:** GermanBuddy is a **fully standalone, offline React Native (Expo) Android app**.
> There is no backend, no account, no analytics and no network call unless the learner turns on the optional AI feature
> with their own API key. Earlier versions of this project had a Kotlin client, a FastAPI backend, Supabase, Firebase,
> RevenueCat and an AI chat (Lena); all of that was removed in September 2026 (TASK-016) and is **not** described here.

---

## 0. Development Pattern — READ THIS FIRST

This project uses a **two-instance Claude Code pattern**. Your role is determined by which instance you are. Read your role and stay in it — never cross boundaries.

### Roles

| Role | Model | Mode | Responsibility |
|------|-------|------|----------------|
| **Tech Lead** | Claude Opus | Plan mode | Reads codebase + CONTEXT.md, writes detailed task specs to `tasks/TASK-xxx.md`. **Never writes production code.** |
| **Developer** | Claude Sonnet | Execution mode | Reads task spec, implements exactly what is specified, commits to `main`. **Never redesigns the spec.** |
| **Product Owner** | Human (Giacomo) | — | Reviews output, runs the app on a phone, decides what ships and when to push. |

When the Product Owner explicitly asks one instance to do the whole cycle (spec, tests, implementation, review, fixes),
do it in that order and keep the roles distinct in the output: the spec is written first and then treated as the contract.

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
Product Owner tests on a phone
```

### Task specs
All specs live in `tasks/` (`TASK-001.md`, `TASK-002.md`, …; format in `tasks/TEMPLATE.md`). A spec fixes the design so the
Developer makes no architectural decisions: files to create and modify, exact signatures, acceptance criteria, the tests to write first, and rationale notes.
Status lines are `ready` → `in-progress` → `done`.

### Permissions
Both instances run with `--dangerously-skip-permissions`. This is intentional — the task spec is the safety boundary, not the permission system.
Even so: **commit only when asked, and push only when asked.** Anything outward-facing (pushing, publishing, deleting a remote branch, uploading
secrets, editing the public support site) needs a clear request from the Product Owner.

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
4. **Write the tests the spec lists first and watch them fail** (red)
5. Implement exactly what the spec says — no more, no less (green)
6. Review the diff critically (see "Review checklist" in §13); fix every real finding, each with a regression test
7. Run `npx tsc --noEmit` and `npm test` from `mobile/`
8. Update `CONTEXT.md` (see §13 Git), then commit directly to `main` with a conventional message that references the task. Stop — do not pick up the next task.

---

## 1. Project Overview

**GermanBuddy** is a free Android app for learning German vocabulary and key grammar, offline, built around a daily word.

- Every day the learner gets one German word at their CEFR level (article, IPA, meaning, example, cultural note).
- Saved words go into a **vault** and come back through **spaced repetition**, practised with several exercise formats.
- The learner can also **practise any time** in a format of their choice, and drill **grammar** (articles and cases).
- An optional, bring-your-own-key AI feature adds extra examples and a usage note for a word.

**Target user:** intellectually curious adult learners who want to genuinely understand German, primarily Italian speakers. The app itself (UI language) is available in 13 languages — Italian, English, French, Spanish, Portuguese, Russian, Ukrainian, Polish, Turkish, Chinese, Japanese, Hindi, Arabic; the language being studied is always German.

**Platform:** Android (minSdkVersion 24). The code is React Native, so iOS is possible later but is not a goal today.

---

## 2. Repository Structure

```
GermanBuddy/
├── mobile/                          # the whole product
│   ├── app/                         # expo-router routes
│   │   ├── onboarding.tsx, quiz.tsx, topics.tsx
│   │   └── (app)/                   # index (Vocabolario), today, review, practice, practice-session, grammar, word, settings
│   ├── src/
│   │   ├── data/                    # db.ts, schema.ts, srs.ts, backup.ts, dailyWord.ts, bootstrap.ts, wordbank/<lang>/*.json
│   │   ├── services/                # profile, word, vault, review (due + practice grading), grammar, restore
│   │   ├── lib/
│   │   │   ├── exercises/           # the exercise engine — pure TypeScript, no I/O (see §8)
│   │   │   ├── ai/                  # keys.ts, llm.ts (transport), providers/, wordInsight.ts
│   │   │   ├── autoBackup/          # helpers (pure), scheduler (pure), index (SAF writer, change tracking)
│   │   │   └── cloze.ts, grammar.ts, notifications.ts, errorHandling.ts
│   │   ├── screens/                 # ExerciseSession (shared by Review and Practice), Vault, WordCard, WordDetail, Grammar, Settings, …
│   │   ├── components/ui/           # design-system components
│   │   ├── components/exercises/    # one view per exercise format
│   │   └── store/ (incl. useAutoBackupStore), i18n/, theme/, types/, hooks/
│   ├── scripts/                     # build-wordbank.mjs, validate-wordbank.mjs, set-active-language.mjs, wordbank/<lang>/*.tsv (source of each word bank)
│   ├── plugins/                     # withReleaseSigning.js, withAndroidBackupRules.js (Expo config plugins)
│   ├── __tests__/, __mocks__/       # jest-expo; expo-sqlite and react-native-mmkv are mocked in memory
│   └── app.config.js                # version and versionCode — single source of truth
├── tasks/                           # specs (TEMPLATE.md + TASK-001 … )
├── .github/workflows/               # ci.yml (type check + tests), release-android.yml (manual build and Play upload)
├── build_*.bat, deploy_*.bat        # local build/install scripts (Windows)
├── germanbuddy-support/             # SEPARATE repo (giamat90/germanbuddy-support) — public privacy policy, terms; gitignored here
├── GoogleCloud/                     # Play service-account key — gitignored, never commit
├── CLAUDE.md, CONTEXT.md
```

---

## 3. Tech Stack

| Component | Choice | Notes |
|-----------|--------|-------|
| Language | TypeScript (`strict`) | no linter or formatter is configured: match the surrounding code |
| Framework | React Native 0.79 + Expo SDK 53 (React 19) | built with `expo prebuild`; `mobile/android/` is **generated and gitignored** |
| Navigation | expo-router 5 | file-based routes under `mobile/app/` |
| State | Zustand | small stores in `src/store/` |
| Data | `expo-sqlite` | on-device relational data (§4) |
| Flags / settings | `react-native-mmkv` | install id, onboarding flag, notification ids, AI settings |
| Notifications | `expo-notifications` | local only; no push token |
| Speech | `expo-speech` | on-device Android TTS to read a German word aloud; imported only in `lib/speech.ts` |
| i18n | `i18n-js` | 13 app languages, `src/i18n/<code>.ts`, registry in `language.ts`; `it.ts` is the key source and every file must have the same keys and `%{}` placeholders |
| Tests | Jest (`jest-expo`) + React Native Testing Library | §13 |
| CI | GitHub Actions | `ci.yml` on push/PR; `release-android.yml` is manual |
| AI (optional) | user's own key | Anthropic, or any OpenAI-compatible endpoint (§6) |

No server, database service, auth provider, billing library or analytics SDK is used. Do not add one without a task that says so.

---

## 4. Data

Source of truth: `mobile/src/data/schema.ts`. **Migrations are additive and idempotent:** `CREATE TABLE IF NOT EXISTS` in `STATEMENTS`
for new tables, and `ensureColumn(...)` in `runMigrations` for new columns on existing tables. Never edit an existing `STATEMENTS` entry to add a column
(tests simulate a pre-migration database from the base statements), and never drop data.

| Table | Purpose |
|-------|---------|
| `learner_profile` | CEFR level, topic preferences, streak, last activity, total words seen, `native_language` |
| `daily_items` | one row per day: the word of the day (copied from the bank) and `saved_at` |
| `vocabulary_items` | saved words and SRS state: `retention_score`, `times_seen`, `times_used`, `next_review_at` |
| `review_log` | one row per scheduled review: `was_correct` and `quality` (0–1) |
| `grammar_mastery` | per grammar-rule mastery used by the grammar drill |
| `ai_word_notes` | cached AI output, one row per word |
| `schema_meta` | local bookkeeping (e.g. word-bank version) |

**Word bank:** one folder per target language: `mobile/src/data/wordbank/<lang>/{A1…C2}.json` (German: 2,194 entries; one example sentence each, field `example`), generated from the TSV files in
`mobile/scripts/wordbank/<lang>/` (plus its `language.json` with the rule codes, parts of speech and articles the validator accepts) with `npm run build:wordbank`.
One language is active per build: `npm run set:language -- <code>` (default `de`) regenerates the seams `src/data/wordbank/active.ts`, `src/i18n/wordContentLoaders.ts` and `src/languages/active.ts`. Database columns keep their legacy names (`example_de`); the data layer maps them to `example`. **Edit the TSVs, never the JSON.** `npm test` validates the bank first (`pretest`).
Bump `WORDBANK_VERSION` in `wordbank/index.ts` whenever the bundled data changes.

**Backups** (`src/data/backup.ts`): a single JSON file (`format` 1) holding every user table plus a few MMKV values. Restore replaces **all** local data in a
transaction and inserts only columns that exist in the installed schema (column names from a file are never trusted). The AI key and provider settings are
**excluded unless the user opts in** when exporting; a restored base URL is applied only together with the same backup's own key.
**Automatic backup** (`src/lib/autoBackup/`, Android only): an optional copy written through the Storage Access Framework to a folder the user picked, shortly after backed-up tables change (database change listener, debounced). It **never** contains AI keys or provider settings, keeps the newest 10 files from its own URI list, and has no network code. Android's own cloud backup is restricted by the `withAndroidBackupRules` plugin (allowlist; the `ai`, `notifications-store` and `auto-backup` MMKV stores are excluded).

### Grammar rule codes (canonical list, German; each language lists its own in `scripts/wordbank/<lang>/language.json`)
```
A1: VERB_CONJ_REGULAR, NOUN_GENDER, WORD_ORDER_V2, NEGATION_NICHT_KEIN
A2: VERB_CONJ_IRREGULAR, ACCUSATIVE_MASC, ACCUSATIVE_PREP, SEPARABLE_VERB
B1: DATIV_PREP, DATIV_INDIRECT_OBJ, MODAL_VERB, PERF_SEIN_HABEN, SUBORD_VERB_FINAL
B2: KONJUNKTIV_II, GENITIV_CASE, PASSIVE_VOICE
C1: KONJUNKTIV_I, EXTENDED_ATTR
```
Every word-bank entry carries one of these in `grammar_angle`. The grammar drill currently covers `NOUN_GENDER` (article picker) and the case rules
`ACCUSATIVE_MASC`, `ACCUSATIVE_PREP`, `DATIV_PREP`, `DATIV_INDIRECT_OBJ`, `GENITIV_CASE` (case cloze).

### Grammar rule codes of Spanish (`scripts/wordbank/es/language.json`)
```
A1: NOUN_GENDER, ADJ_AGREEMENT, VERB_PRESENT_REGULAR, SER_ESTAR, NEGATION_NO, VERB_PRESENT_IRREGULAR
A2: REFLEXIVE_VERBS, POR_PARA, PRETERITO_PERFECTO, PRETERITO_INDEFINIDO, DIRECT_OBJECT_PRONOUN
B1: PRETERITO_IMPERFECTO, FUTURO_SIMPLE, CONDICIONAL, IMPERATIVO, INDIRECT_OBJECT_PRONOUN, GUSTAR_VERBS
B2: SUBJUNTIVO_PRESENTE, SUBJUNTIVO_IMPERFECTO, PERIFRASIS_VERBAL, PASIVA_REFLEJA, RELATIVOS
C1: SUBJUNTIVO_COMPUESTO, ORACIONES_CONDICIONALES, SER_ESTAR_ADJETIVOS
C2: CONCORDANCIA_TEMPORAL, REGISTRO_FORMAL
```
`levelRules.<L>.allowedCodes` lists what each level may carry (cumulative). The Spanish drill covers `NOUN_GENDER` (el/la) and the choice rules `SER_ESTAR`,
`POR_PARA`, `DIRECT_OBJECT_PRONOUN` (`pack.choices`); the other codes are metadata for now. Caps per level keep the choice sentences clean: `SER_ESTAR` ≤ 20 (A1-B1) then ≤ 10,
`POR_PARA` none at A1, ≤ 20 at A2-B1, then ≤ 10; `DIRECT_OBJECT_PRONOUN` only at A2-B1 (≤ 15).
Spanish (draft until TASK-045) drills `NOUN_GENDER` (el/la) and the *choice* rules `SER_ESTAR`, `POR_PARA`, `DIRECT_OBJECT_PRONOUN` (`pack.choices`: sets of mutually exclusive forms; only sentences an author tagged with the rule are used). A `language.json` with `"draft": true` is skipped by build/validate and cannot be activated.

---

## 5. Screens and Routes

| Route | Screen | What it does |
|-------|--------|--------------|
| `/onboarding`, `/quiz`, `/topics` | Welcome / Quiz / Topics | level quiz, topic preferences, creates the local profile; the welcome screen can restore a backup |
| `/(app)` | Vault ("Vocabolario") | saved words with review-date chips; buttons for today's word, Grammatica, Pratica, Ripassa (when words are due) |
| `/(app)/today` | WordCard | today's word, save to vault |
| `/(app)/catalog`, `/(app)/stats-words` | Catalog / word lists | the whole word bank by level and topic with status colors; tap an unsaved word to start learning it (TASK-036/037) |
| `/(app)/word` | WordDetail | one saved word; the optional AI "Approfondisci" |
| `/(app)/review` | Review | scheduled review of due words (graded into the SRS) |
| `/(app)/practice`, `/practice-session` | Practice menu / session | free practice by format (§7) |
| `/(app)/grammar` | Grammar | article and case drills |
| `/(app)/settings` | Settings | language, notifications, backup/restore, AI provider and key |

---

## 6. Optional AI feature

- **Off by default.** The app ships with no key. The learner chooses a provider in Settings and pastes their own key.
- **Providers:** `anthropic` (fixed endpoint, model `claude-haiku-4-5`) and `openai` — any OpenAI-compatible service, with a user-set **https** base URL
  (default `https://api.openai.com/v1`) and model (default `gpt-4o-mini`). One key per provider.
- **Code:** `src/lib/ai/keys.ts` (MMKV store id `ai`), `llm.ts` (`callLLM`, retry on network/429/5xx, no retry on other 4xx), `providers/anthropic.ts` and `providers/openai.ts`, `wordInsight.ts` (the one feature today).
- **Privacy rules (the public privacy policy depends on them):** only the word, its CEFR level and the native language are sent; never the word list, profile or any
  other app data. Requests go straight to the provider, never through a server of ours. Keys stay on the device and are exported in a backup only on explicit opt-in; **automatic backups never contain them**, and Android's cloud backup excludes their store.
- Anything new that sends data off the device needs a task, an update of the privacy policy and terms in `germanbuddy-support/`, and Play's Data safety form.
- **Deferred (not built):** Lena chat, grammar-error classification from free text, session recap. They need an LLM; the bring-your-own-key plumbing makes them possible as opt-in features.

---

## 7. Key Business Logic

All of this is covered by unit tests; keep the behaviour unless a task changes it.

### Spaced repetition (`src/data/srs.ts`, ported from the old backend)
```ts
// weight = 1 / (1 + 0.1 * timesSeen); outcome is a boolean or a quality in [0, 1]
updateRetentionScore(current, outcome, timesSeen) = round3(current * (1 - weight) + outcome * weight)
// next review interval from the NEW retention score
retention >= 0.9 -> 21 days;  >= 0.75 -> 7;  >= 0.6 -> 3;  otherwise 1 day
```
A newly saved word starts at retention 0.5 and is due after 1 day. `MASTERY_WEAK_THRESHOLD = 0.6` marks weak grammar rules. Grammar mastery uses the same update (`updateMastery`).

### Streak (`updateStreak`)
Saving today's word on consecutive calendar days increments the streak; saving twice in a day does nothing; a gap restarts it at 1. **Only saving the word of the day touches the streak** — reviews and practice never do. Starting a word from a word list (`startLearning`, TASK-037) adds it to the vault like the daily save (retention 0.5, first review in 1 day, `source = 'catalog'`) but **never touches the streak**.

### Graded outcomes (`src/lib/exercises/quality.ts`)
A review result is a quality in [0, 1], not pass/fail. `PASS_QUALITY = 0.5`. Typed answers: exact 1.0, close (umlaut/ß slip or one typo on a word of 5+ letters) 0.7,
wrong 0; using the hint caps the quality at 0.6. Format ceilings: multiple choice 0.8; matching 0.7 / 0.4 / 0 for 0 / 1 / 2+ mistakes; sentence reorder 0.9, or 0.5 when the
learner confirms "my sentence is also correct". **Only the first attempt of a word in a session is graded**; relearning retries are practice only.

### Free practice (`gradePractice` in `reviewService.ts`)
Practice **never pushes a review later**. A pass changes nothing. A miss (quality < `PASS_QUALITY`) lowers the retention score and sets
`next_review_at = min(existing, date for the new score)`. Practice does not change `times_seen`, `times_used`, the review log or the streak.

### Not implemented (old design, dropped with the chat)
The session "difficulty dial" and the "CEFR promotion check every 10 sessions" no longer exist. The learner's level is chosen at onboarding.

---

## 8. Exercise Engine (`mobile/src/lib/exercises/`)

Pure TypeScript: no I/O, no React, injectable `rng` — which is what makes it testable. UI lives in `components/exercises/` and `screens/ExerciseSession.tsx`.

- **Tiers** (`tier.ts`): `new` (seen once, or retention < 0.6), `strong` (retention ≥ 0.85 and seen ≥ 4 times), otherwise `learning`.
- **Formats** (`registry.ts`): typed cloze (weight 2) and sentence reorder (weight 1) for learning/strong words; multiple choice for new words; matching pairs (a *group* step of 4–5 new
  words); flip-card as the fallback. A format that cannot be built for a word returns `null` and the next candidate is tried.
- **Session** (`session.ts`): a pure state machine. A missed word returns 3 cards later, at most 2 retries; matching rounds are planned first; progress counts first attempts.
- **Practice** (`practice.ts`): per-format config that ignores tiers, card selection (weaker words favoured), availability for the menu.
- **Adding a format:** add a definition to the registry (`tiers`, `weight`, `build`), a model type, a view in `components/exercises/`, a case in `ExerciseSession`'s switch, strings in both languages,
  a per-format quality ceiling in `quality.ts` chosen so a clean answer never hurts the schedule, and tests (builder, registry gating, screen).

---

## 9. Mobile Architecture

```
Screens / components  →  stores (Zustand) and services  →  data layer (SQLite, MMKV, word bank)
                                      ↘ lib/ (pure logic: exercises, cloze, grammar, ai)
```

- Screens render and handle input; **business rules live in `lib/` and `data/`**, not in components.
- Services are thin async functions over the data layer (`fetchDueReviews`, `gradeReview`, `gradePractice`, …).
- `ExerciseSession` is the single session UI; `ReviewScreen` and `PracticeSessionScreen` only decide which cards to load and how results are persisted.
- Anything that fires several database writes together (a matching round) must not run read-modify-write sequences that overlap: see `refreshReviewReminder`, which queues its runs.
- Do not use network APIs outside `lib/ai/`.

---

## 10. Monetization

GermanBuddy is **free**. No paywall, no billing library, no ads. Monetization may be revisited after launch, but nothing is committed.

---

## 11. Configuration and Secrets

There are **no runtime environment variables**: the app has no backend.

| What | Where | Rule |
|------|-------|------|
| Version | `mobile/app.config.js` (`LOCAL_FALLBACK_VERSION_CODE`; CI sets `ANDROID_VERSION_CODE`) | bump before every local build and every upload; Play needs a strictly higher code each time |
| Release signing | `mobile/release.keystore`, `mobile/release.properties` | gitignored; back up outside the repo |
| CI secrets | GitHub: `ANDROID_RELEASE_KEYSTORE_BASE64`, `ANDROID_RELEASE_PROPERTIES`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | never printed or committed |
| Play service-account key | `GoogleCloud/` | gitignored |

**Never commit:** keystores, `release.properties`, service-account or any API keys, `.env` files, built bundles (`Bundles/`). Check `git status` before every commit.
Release details (scripts, CI inputs, Play setup) are in `CONTEXT.md`.

---

## 12. Scope

### In scope (v1.0)
Daily word, vault, streak, onboarding (level quiz + topics), spaced-repetition review with five exercise formats, free practice, grammar drill, local reminders,
backup/restore, Italian and English, optional bring-your-own-key AI "Approfondisci", Google Play release.

### Out of scope for now
Lena chat and session recap (deferred, see §6), speech-to-text and bundled audio (on-device text-to-speech of a word or sentence is in scope: `expo-speech`, TASK-035/040), multiple tutor personas, progress charts, social features, iOS and web releases, any server, accounts, billing, analytics.

---

## 13. Coding Conventions

### TypeScript / React Native
- `strict` TypeScript; no `any` unless a type genuinely cannot be named. `npx tsc --noEmit` must be clean.
- Match the surrounding style (there is no formatter). Comments explain *why*, not *what*.
- Logic that can be pure **is** pure and takes an injectable `rng`/clock, so tests stay deterministic.
- **No hard-coded UI strings:** every string goes in **all** `src/i18n/<code>.ts` files (`it.ts` is the key source); the key sets and `%{}` placeholders must be identical (`uiStringsParity.test.ts` enforces it). Never write the app name or the studied language into a shared string: use `%{app}` (filled by `t()` from the language pack), and put text that is about the target language (welcome line, quiz sentences, grammar-rule explanations, voice alert) in the pack's overlay `src/languages/<code>/strings/<ui>.ts` (13 files per language, parity-tested in `targetStrings.test.ts`). Anything that comes from outside (backup, route param, DB row) goes through `coerceNativeLanguage`.
- **Accessibility:** every touchable has `accessibilityRole` and an `accessibilityLabel`. Add a `testID` when tests need to find an element that has no unique text.
- **Errors:** log with `console.error(...)` at the point of failure; the UI shows a **generic i18n string**, never `e.message`, a stack trace or provider text.
- Never log secrets or learner content (typed answers, keys).
- UI components avoid timers unless a task needs one; keep them state-driven so tests need no fake timers.
- Database changes are additive (§4). Any SQL built from external input must whitelist identifiers.

### Testing
- Tests live in `mobile/__tests__/`. Run from `mobile/`: `npx tsc --noEmit` and `npm test` (validates the word bank, then Jest).
- **Write the tests listed in the spec first and see them fail.** A review finding gets a failing test before the fix; for a guard, remove it once and confirm the test goes red.
- Pure logic: unit tests with seeded or constant rngs. Services: the in-memory `expo-sqlite` mock (it is schema-less, so also assert the real schema where it matters, e.g. `PRAGMA table_info`).
  Screens: React Native Testing Library with `jest.mock` for services and `expo-router`.
- Property-style tests over the real word bank are encouraged for data-dependent code (they caught real problems).

### Review checklist (before declaring a task done)
Untrusted input (backup files, URLs, keys) · concurrency (several writes or notifications at once) · double taps and stale state · performance on a vault of hundreds of words ·
schedule side effects (does a correct answer ever make things worse?) · what the public privacy policy says · unneeded files in the diff.

### Git
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `ci:`; reference the task: `feat(TASK-xxx): …`.
- **Commit directly to `main`.** No feature branches.
- **Every push updates `CONTEXT.md` in the same push** (status and test count, completed tasks, known issues, decisions, last-updated date) — see "How to Update This File" in `CONTEXT.md`. A push without it is incomplete.
- Commit only when asked; push only when asked. Never `--force`, never `--no-verify`.
- Never commit anything listed in §11.

---

## 14. Success Metrics (v1.0, 90 days after launch)

The app has no analytics by design, so these come from the **Google Play Console** (installs, retention, vitals) and from the learners themselves.

| Metric | Target | Meaning |
|--------|--------|---------|
| Daily open rate | > 40% | The word streak is working |
| 30-day retention | > 35% | The product forms a habit |
| Word save rate | > 60% | Word cards are valuable |
| Crash-free sessions | > 99% | The release is solid |

---

## 15. Known Issues

Tracked in `CONTEXT.md` ("Known Issues / Tech Debt"). Do not duplicate them here.

---

*Last updated: 2026-11-07 — stack moved to Expo SDK 53 (TASK-026). Rewritten for the standalone offline architecture (TASK-016 to TASK-021). The old client/server sections were removed.*
