# TASK-078 — ChineseBuddy: store files, CI and release input

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-076, TASK-077

---

## Context

The Chinese variant, palette, page colours and QA row exist (TASK-070 to 077). What is missing to treat ChineseBuddy as the other apps are treated
is the store folder, its place in CI and in the release workflow, and a store builder that copes with an app that has one level (as TASK-066 did for French).

---

## Scope

### In scope
- `store/zh/`: `support.json`, `listing/{it,en}.json` (status `draft`), `play-checklist.md`, `qa-checklist.md`, `screenshots.md`, `graphics-brief.md`.
- `build-store.mjs`: count words over the app's own levels. New token `{{LEVEL_RANGE}}` in the privacy page ("A1–C2" for the three existing apps, "A1" for Chinese).
- `ci.yml` runs `npm run test:app -- zh`; `release-android.yml` accepts `zh`.
- Icon: the committed `icon-zh.png` / `adaptive-icon-zh.png` (word card with 字 on jade, no flag) are the app's icon unless the owner replaces them.
- CLAUDE.md and CONTEXT.md.

### Out of scope
- Anything the owner does (TASK-079): native reader, phone QA, support site repository, Play app, screenshots, feature graphic, upload.
- Listings in other languages.

---

## Acceptance Criteria

- [x] AC1: `npm run build:store -- zh --out <tmp>` writes the four pages, `icon.png`, `listing/{it,en}` and `STATUS.txt`; pages name ChineseBuddy and Chinese, no other app or language, no leftover token, level range "A1".
- [x] AC2: The German, Spanish and French pages are unchanged (still "A1–C2").
- [x] AC3: Both listings validate; the word count comes from the bank; every exercise and drill they name can be built from the Chinese bank; no claim of a native review, of HSK or of a link with any exam.
- [x] AC4: CI and the release workflow know `zh`; `node scripts/verify-prebuild.mjs zh` passes.
- [x] AC5: Italian and English native-speaker agents read the listings and the checklist's Chinese claims; findings applied or reported.
- [x] AC6: `tsc`, `npm test`, the three app suites pass; seams German.

---

## Technical Spec

### Files to create
```
store/zh/{support.json,play-checklist.md,qa-checklist.md,screenshots.md,graphics-brief.md}
store/zh/listing/{it,en}.json
mobile/__tests__/chineseStore.test.ts
```

### Files to modify
```
mobile/scripts/build-store.mjs, mobile/scripts/lib/store.js
store/support-template/privacy-policy.html
.github/workflows/{ci.yml,release-android.yml}
mobile/__tests__/releaseWorkflow.test.ts
CLAUDE.md, CONTEXT.md
```

### Implementation notes
- The levels of an app are the `levels` of its `scripts/wordbank/<code>/language.json`; German lists none there, so the default is A1…C2.
- `levelRange(levels)`: one level is itself, several are `first–last` (en dash).
- `support.json` follows the French one: `supportUrl` `https://giamat90.github.io/chinesebuddy-support/` (repository to be created by the owner), same developer and support email.

---

## Tests

- `chineseStore.test.ts`: AC1–AC3.
- `releaseWorkflow.test.ts`: `zh` among the choices; CI runs the three app suites.

---

## Definition of Done

- [x] Tests written first, seen red, then green
- [x] Diff review: seams German, no secrets, no other app's output changed
- [x] Owner steps recorded in TASK-079 terms in CONTEXT.md
