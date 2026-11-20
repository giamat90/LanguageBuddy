# TASK-016 — Convert GermanBuddy to a standalone, offline app

**Status:** `done` (merged to main 2026-10-08)
**Assigned to:** Developer (Sonnet)
**Written by:** Developer (implemented directly on `feature/standalone-offline` at the Product Owner's request)
**Depends on:** none

---

## Context

GermanBuddy was a thin React Native client over a FastAPI backend + Supabase +
Firebase Auth + RevenueCat + the Anthropic API. The Product Owner asked for a fully
self-contained app that runs on the device with **no external server calls** — no
Supabase, no backend, no Firebase, no Anthropic. This replaces the client/server
architecture described in the pre-v1.0 CLAUDE.md.

---

## Scope

### In scope
- On-device SQLite data layer (`expo-sqlite`) — `learner_profile`, `daily_items`,
  `vocabulary_items`, `review_log`, `schema_meta`.
- Bundled word bank JSON (`src/data/wordbank/*.json`) + validator
  (`scripts/validate-wordbank.mjs`, runs on `pretest`).
- Deterministic per-install daily-word selection (`src/data/dailyWord.ts`), never
  repeating until a level is exhausted.
- SRS + streak logic ported verbatim from the old Python backend
  (`src/data/srs.ts`).
- Local onboarding: Welcome → level quiz → topics → local profile. No sign-in.
- New lightweight self-graded SRS review screen (`src/screens/ReviewScreen.tsx`).
- Removal of backend, Firebase, RevenueCat, SSE, axios, NetInfo, chat, recap,
  paywall.

### Out of scope
- The Lena AI chat + grammar error classification + recap (deferred — needs an
  on-device model or a user-supplied API key; no server available).
- iOS-specific store config, push notifications.
- Data migration from the old backend (pre-launch, no released installs).

---

## Acceptance Criteria

- [x] AC1: App launches and completes onboarding fully offline (airplane mode).
- [x] AC2: A new, non-repeating word appears each calendar day for the profile level.
- [x] AC3: Saving the word persists it to the vault and updates the streak
      (1 → +1 consecutive day → reset after a gap).
- [x] AC4: Vault + review read from SQLite; review grading reschedules via SRS.
- [x] AC5: No references to axios / firebase / supabase / railway / anthropic /
      purchases / EXPO_PUBLIC_API remain in `mobile/src` or `mobile/app`.
- [x] AC6: `npm test` green (word-bank validator + unit + flow tests).
- [x] AC7: `npx tsc --noEmit` clean.
- [x] AC8: `npx expo prebuild --clean` succeeds without google-services config.

---

## Notes for the Product Owner

- Word bank is complete at 365 entries per CEFR level (2,194 total, ~1.3MB bundled
  JSON). Source of truth is `scripts/wordbank/*.tsv`; run
  `npm run build:wordbank` after editing, then `npm run validate:wordbank`. See the
  header of `scripts/validate-wordbank.mjs` for the process to extend it further.
  C1/C2 entries lean on rarer, idiomatic vocabulary by necessity at that level —
  worth a native-speaker spot-review pass before shipping, given the volume
  authored in one sitting.
- `android/` still contains stale Firebase gradle wiring — regenerate with
  `npx expo prebuild --clean` before the next native build.
- CONTEXT.md updated in the same branch.
