# TASK-080 — The drill's score screen announces the wrong name for "Back to vocabulary"

**Status:** `in-progress`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-076

---

## Context

Found on a phone (ChineseBuddy, Android 11, 2026-11-27): on the grammar drill's score screen the link "Back to vocabulary" is announced as
"Pinyin and tones". The link has no `accessibilityLabel`. TASK-076 added the guide link to the question header with a label; React reuses that
native view for the score screen's link, and Android keeps the old label. CLAUDE.md §15 requires a label on every touchable.

---

## Scope

### In scope
- Give the score screen's link its own label in `GrammarScreen`.

### Out of scope
- Other touchables without a label elsewhere (their visible text is what a screen reader says; recorded in CONTEXT.md).

---

## Acceptance Criteria

- [x] AC1: after the last answer, the link is found by the label `t('review_back')` and goes back.
- [x] AC2: no change to what is shown.
- [x] AC3: `tsc`, `npm test`, `npm run test:app -- es|fr|zh` pass; the seams are German.

---

## Technical Spec

### Files to modify
```
mobile/src/screens/GrammarScreen.tsx   accessibilityLabel={t('review_back')} on the score screen's link
mobile/__tests__/primer.test.tsx       the test below
CONTEXT.md
```

---

## Tests

- `primer.test.tsx`, "the grammar screen": answer a one-question drill, press Finish, press the element labelled `t('review_back')`, expect `router.back`.
  (Jest cannot reproduce Android's view reuse: the test pins the label that prevents it.)

---

## Definition of Done

- [x] Test written first, seen red, then green
- [ ] Phone check on the next build (owner or next phone session)
