# TASK-061 — Native-agent sweep of the whole word banks for the error classes found in TASK-058

**Status:** `ready` (optional: run after TASK-059 and TASK-060; the Product Owner decides whether the cost is worth it)
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-059, TASK-060

## Context
TASK-058 reviewed only 40 rows per level (about 11% of German, 14% of Spanish). It found classes of error, not isolated ones, so the same errors very likely exist in the rows nobody looked at. TASKs 059/060 fix the rows that were seen; this task looks at **every other row** with the same checklist and fixes what the agents and a second opinion agree on. The human reader of TASK-054 reviews Spanish samples only; this sweep is what gives the rest a native-style check.

## Scope
### In
All rows of `scripts/wordbank/de/` and `scripts/wordbank/es/` that were not already reviewed (the rows of the 40-row samples of TASK-058 and the items of 059/060 are skipped; the sample seeds are fixed, `export-review-sample.mjs --per 40 --seed 1`).
### Out
Tags (see TASK-059 Process 3), adding words (TASK-062), grammar-rule drills, any change that is not one of the four error classes below.

## The checklist given to the agents (four classes, nothing else)
1. **Note**: the Italian or English cultural/usage note is false, contradicts the example, is padding, or explains another word instead of the headword.
2. **Example**: unnatural, ungrammatical, does not contain the headword, a translation error in `example_it`/`example_en`, or does not teach the word at its level.
3. **Entry**: invented, archaic, vulgar, offensive, not a lexical item (a phrase or sentence), wrong article, wrong lemma form, wrong capitalisation, unlabelled regional word (Spanish: neutral or region named in the note).
4. **Level**: off by **two or more** levels (a one-level difference is not reported: level boundaries are a judgment call).

## Process
1. Export the unreviewed rows as sheets of about 110 rows (`node scripts/export-review-sample.mjs --lang <code> --per 9999 --out <scratch>`, then drop the sampled rows and cut by level; if the script cannot do this, add a flag to it with a test). About 20 sheets for German, 16 for Spanish; level groups are not mixed.
2. Start native agents in parallel batches of at most 6 (read-only, one sheet each) with the checklist; they return `{word, level, class, verdict, suggestion}` only for rows that are wrong, and an overall paragraph.
3. Merge the answers; **a second set of native agents confirms or rejects each item** (as in TASK-059 Process 2). Apply only agreed items, with the same rules as TASK-059/060 (TSVs only, translations refreshed, 1:1 replacements, saved words keep working, pins, `WORDBANK_VERSION`).
4. Report: rows reviewed, items per class and language, applied vs rejected, and the **error rate per class** (so the Product Owner can see how clean the bank now is). A class with a rate above 5% of the rows in a level is flagged for a targeted follow-up.
5. Final native-agent check of the changed rows; `tsc`, `npm test`, `npm run test:app -- es`, audit numbers before/after; `CONTEXT.md`; commit `fix(TASK-061): native-agent sweep of both word banks`.

## Acceptance Criteria
- [ ] Every non-sample row was seen by an agent (the report states the row counts per sheet and that none was skipped).
- [ ] Only agreed items were applied; the rest listed with the reason.
- [ ] The error rates per class and level are in the hand-off and in `CONTEXT.md`.
- [ ] All checks of TASK-059 Process 7 green.

## Definition of Done
- [ ] Criteria checked; hand-off as above; `CONTEXT.md` updated; status `done`

## Notes for Tech Lead (remove before handing over)
- Cost: about 36 agent runs plus a verification pass; this is why it is optional. A cheaper variant is to sweep only the classes with the highest sample rates (notes and entries at C1/C2), decided after TASK-059/060 report their numbers.
- Agents are a quality filter, not native humans; the Spanish human review (TASK-054) is unchanged by this task.
