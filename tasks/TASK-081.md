# TASK-081 — The privacy texts name the word's meaning among the data sent to the AI provider

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** none

---

## Context

`lib/ai/wordInsight.ts` sends the word (with its article), **its meaning as the app shows it**, its level and the learner's language to the provider the
learner chose. The public privacy policy and CLAUDE.md §7 name only the word, the level and the language ("nothing else"). All apps, since the initial
import. Found 2026-11-27. Decision of the Product Owner (2026-11-27): **keep sending the meaning and say so** (it tells the model which sense of the word is meant).

---

## Scope

### In scope
- Policy template: both sentences about the AI data; `lastUpdated` of every `store/<code>/support.json`.
- The same two sentences and the date on the public pages of GermanBuddy, SpanishBuddy and FrenchBuddy (separate repositories).
- CLAUDE.md §7, the Play and QA checklists, the name of the activeApp prompt test, CONTEXT.md.

### Out of scope
- No change to what the app sends. No app release.
- **Publishing:** pushing a support repository is its own request from the Product Owner.
- Play's Data safety forms (owner).

---

## Acceptance Criteria

- [x] AC1: the built policy names the meaning in the list item and in the third-party table, and no longer says "nothing else" there.
- [x] AC2: CLAUDE.md §7 and each `store/*/play-checklist.md` and AI row of `store/*/qa-checklist.md` name the meaning.
- [x] AC3: a test shows the request holds the word, meaning, level and language.
- [x] AC4: `tsc`, `npm test`, `npm run test:app -- es|fr|zh` pass; the seams are German.

---

## Technical Spec

### Wording (English pages)
- List item: "Only the word (with its article, if it has one), its meaning as the app shows it, its level, and your native language are sent to the provider you chose to generate the response, with fixed instructions asking for the study material — never your saved word list, profile, or any other app data"
- Table cell: "A single word, its meaning, CEFR level, and native language — no other app data"
- Date: "November 27, 2026"

### Files to modify
```
store/support-template/privacy-policy.html, store/{de,es,fr}/support.json, store/{es,fr,zh}/{play,qa}-checklist.md
CLAUDE.md, CONTEXT.md
mobile/__tests__/storeSupport.test.ts, mobile/__tests__/activeApp/platform.test.ts
```

---

## Tests

- `storeSupport.test.ts`: the built Spanish policy has both new sentences and not "nothing else"; every checklist AI row and CLAUDE.md's privacy bullet mention the meaning. Red first.
- `activeApp/platform.test.ts`: the prompt test also expects the meaning, level and "Italian" (already true: it pins what the texts now say).

---

## Definition of Done

- [x] Tests written first, seen red, then green
- [x] Support pages changed locally; published only when the Product Owner asks (asked and published 2026-11-27)
