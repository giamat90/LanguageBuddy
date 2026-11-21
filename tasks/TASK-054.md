# TASK-054 — Spanish reader review: bank, translations, listing

**Status:** `ready`
**Assigned to:** Product Owner (Giacomo) — not a Developer task; Claude can help on request
**Written by:** Tech Lead
**Depends on:** TASK-046, TASK-046b, TASK-048

## Context
All Spanish words, examples, notes, translations into 10 languages and the store listing in 12 languages are machine-written. Nobody who reads Spanish has checked them. The listings stay `draft` until someone has.

## Steps
1. Find a Spanish reader for the review sheets in `mobile/scripts/wordbank/es/review/` (40 rows per sheet, 6 sheets). They mark wrong words, unnatural examples and wrong grammar tags.
2. Send the corrections to Claude: Spanish source fixes go in the TSVs and `npm run build:wordbank`; because translations come from the English columns, touched rows are re-translated (note: this was the accepted cost of translating before review).
3. Find a skim reader per important language (at least it/en/fr/pt) for 20 random rows of `src/data/wordbank/es/i18n/<L>.json` and the Play listing in `store/es/listing/<L>.json`.
4. Set `reviewed` in the listing files only for languages a reader approved; publish only those.

## Done when
- [ ] Spanish bank reviewed and corrected
- [ ] At least en and it listings reviewed; the rest stay unpublished until they are
- [ ] `CONTEXT.md` records who reviewed what
