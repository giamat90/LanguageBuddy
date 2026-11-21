# TASK-046b — Spanish word content in the 10 other app languages

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-046 (pushed, `3f6da6b`). **Content gate:** see "Gate" below.

## Context
The Spanish bank (1,739 words) carries meaning, example and cultural note in Italian and English only. A learner whose app is in French, Russian, Arabic… sees the English text (the fallback), exactly as German did before TASK-025. This task writes the translated word content (meaning, example, cultural note) for the 10 app languages of Spanish (`i18nLanguages` in `scripts/wordbank/es/language.json`: fr, pt, ru, uk, pl, tr, zh, ja, hi, ar) for all six levels. **No new code is needed for the pipeline:** build, validator, loader table and fallback already exist (TASK-025, generalised in TASK-042/045). The work is content, a small set of checks over it, and the bookkeeping.

## Gate (read before starting)
Translating copies the mistakes of the source. The Product Owner (or a Spanish reader they appoint) reviews the 40-row sheets in `scripts/wordbank/es/review/` first; every fix goes into `<LEVEL>.tsv`, then `npm run build:wordbank` and `node scripts/export-i18n-source.mjs --lang es` regenerate the sources. **A level is translated only after its review is applied.** If the Product Owner says "translate anyway" (accepting that fixes later mean re-translating the touched rows), the Developer may start; record that decision in `CONTEXT.md`. Work level by level, A1 first as a pilot: A1 for all 10 languages must pass `validate-i18n` and be reported before A2–C2 start.

## Scope
### In
1. For each language L in the 10 and each level: `scripts/wordbank/es/i18n/<L>/<LEVEL>.tsv` (5 columns: `LEVEL word meaning example note`, format of TASK-025, `word` exactly as in the bank).
2. Build output `src/data/wordbank/es/i18n/<L>.json` (10 files, via `npm run build:wordbank`); the generated `wordContentLoaders.ts` lists them **only when Spanish is the active language** (do not activate it in the repo).
3. A test over the real Spanish translated tables (below).
4. `CONTEXT.md`, `tasks/TASK-046b.md` status.

### Out
Spanish UI overlay strings (TASK-044, already 12 languages), re-reviewing the Spanish/Italian/English columns, native review of the translations (Product Owner, later), changing the validator thresholds, activating Spanish in the repo (TASK-047).

## Translation rules
- **Source:** `scripts/wordbank/es/i18n-source/<LEVEL>.tsv` (columns: level, word, article, pos, meaning_en, example, example_en, note_en). Translate from the **English** columns; use the Spanish `example` to keep the meaning and the word's sense. The Italian columns are not a source.
- **meaning:** the shortest natural equivalent, ≤ 60 characters, part of speech preserved (verbs in the language's dictionary form, nouns without article unless the language needs one). A word with several senses: the sense the example uses first.
- **example:** a natural translation of the Spanish sentence, not of the English one; same tense and person; ends with the sentence mark of that language (`。` for zh/ja, `।` or `.` for hi, `؟`/`.` for ar). Must not be the Spanish sentence.
- **note:** same facts as `note_en`, same length ±; Spanish words inside «…» stay Spanish; explanations of Spanish-vs-Italian false friends are rewritten so they still make sense (name the English/Italian word, not the Italian meaning alone). Never invent a custom; if a note is untranslatable as written, shorten it, do not alter the fact.
- **Collisions:** the validator rejects two words of the same part of speech with the same `meaning` unless their English meanings are equal. Disambiguate with a short qualifier in parentheses or a more precise synonym (e.g. *ahorrar* "save money" vs *guardar* "put away"); never by changing the sense.
- **Script and direction:** ru/uk Cyrillic, zh Simplified, ja with kana/kanji, hi Devanagari, ar Arabic script (no Latin letters except the quoted Spanish words, no manual direction marks).
- **Machine drafting is accepted** (as in TASK-025); the output is marked unreviewed in `CONTEXT.md`.

## Acceptance Criteria
- [ ] 60 TSVs (10 languages × 6 levels) exist, one row per bank word, validated with `node scripts/validate-i18n.mjs <L> --target es --dir scripts/wordbank/es/i18n/<L>` (A1 pilot first).
- [ ] `npm run build:wordbank` writes 10 JSON tables with 1,739 entries each; `npm run validate:wordbank` is green (it reports "10 translated table(s)" more for Spanish).
- [ ] Total size of the 10 tables ≤ 4.5 MB (German's 11 languages are 5.8 MB for 2,194 words); report the real figure.
- [ ] Test `spanishWordContent.test.ts` green (below); German tests and outputs unchanged (`git status` shows no change under `wordbank/de`, no change to the repo's generated seams).
- [ ] With Spanish activated **in a temp copy** (`--root/--src`), `wordContentLoaders.ts` lists the 10 languages and `getWordContent` for a sample word returns the translated meaning in each (done in the test through the loader module of the temp copy, or by requiring the JSON directly if the copy is impractical — say which).
- [ ] `tsc` clean, `npm test` green, `CONTEXT.md` updated (046b done, unreviewed translations, 047 next).

## Technical Spec
### Files to create
```
mobile/scripts/wordbank/es/i18n/<L>/<LEVEL>.tsv      60 files
mobile/src/data/wordbank/es/i18n/<L>.json            10 generated files
mobile/__tests__/spanishWordContent.test.ts
```
### Files to modify
```
CONTEXT.md, tasks/TASK-046b.md (status)
```
No script changes are planned. If the Developer finds a validator limit that blocks correct Spanish content (for example the `example is too long` rule against `example_en` for a language such as hi), **stop and report with the row**; do not change thresholds.

### Test: `spanishWordContent.test.ts`
Reads the real generated tables and the Spanish bank (A1–C2 JSON), never imports the repo's active-language seams.
- For each of the 10 languages: the table has exactly one key per bank entry (`<LEVEL>:<slug word>`), every triple has three non-empty strings, `meaning` ≤ 60, no tab/newline, no `TODO|XXX|???`.
- Script checks per language (ru/uk Cyrillic, zh Han, ja kana/Han, hi Devanagari, ar Arabic) on meaning, example and note; for fr/pt/pl/tr: not equal to the Spanish source text and not equal to the English text for the example (a language may keep an English loanword in `meaning`, so this check is on the example and note only).
- Same-part-of-speech meaning collisions: none (reuse `validateLanguage` from `wordbank-i18n-lib.cjs`).
- Spanish words inside «…» in a note appear in the original spelling (accents kept): for 20 seeded random entries per language, every «…» fragment of the translation that exists in `cultural_note_en` is present verbatim.
- Guard: delete one entry from a temp copy of a table and confirm `validateLanguage` reports `missing entry` (keeps the test honest, as in earlier tasks).

## Definition of Done
- [ ] Criteria checked; the test written first and seen red (no tables), then green
- [ ] `npx tsc --noEmit`, `npm test` green
- [ ] Review of the diff: only the files above; German untouched; no seam change
- [ ] A reader of at least one language (Product Owner for it/en-adjacent checks, or a volunteer) skims 20 random rows per language later; note in `CONTEXT.md` that none was read yet
- [ ] Conventional commit: `feat(TASK-046b): Spanish word content in 10 app languages` (A1 pilot may be committed separately as `feat(TASK-046b): A1 pilot` if the Product Owner wants to look first)
- [ ] `CONTEXT.md` updated, status `done`

## Notes for Tech Lead (remove before handing over)
- The pipeline needs no code because TASK-045 already made `i18nLanguages` per language; the only structural risk is validator thresholds that were tuned on German/English length ratios. The explicit "stop and report" avoids silent threshold edits.
- Splitting A1 first gives the Product Owner a cheap look at translation quality (60 files is a lot) before the other 50.
- Opus/Sonnet cost: ~1,739 × 10 triples ≈ 17,000 translated entries. Batch by 40–60 rows per call, one language and level at a time, and validate after each level.
