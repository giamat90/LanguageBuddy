# TASK-065 — French word content in the 10 other app languages

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-064 (French bank validated, native-agent loop done)

## Context
The French bank carries meaning, example and note in Italian and English only. A learner whose app is in Spanish, Russian, Arabic… would see English (the fallback). This task writes the translated word content for the 10 app languages of French (`i18nLanguages` in `scripts/wordbank/fr/language.json`: **es pt ru uk pl tr zh ja hi ar**; no `fr`, and `it`/`en` are in the bank itself) for all six levels. The pipeline (build, validator, loader table, fallback) already exists from TASK-025/042/046b: **no new pipeline code is needed**, except what the gate below says about reviewed sources.

## Gate
Translating copies the mistakes of the source. TASK-064's native-agent loop is the quality filter that makes translating now acceptable; **a human French reader has not seen the bank** (TASK-067). The Product Owner accepted this trade for Spanish ("translate anyway", fixes later mean re-translating the touched rows); record the same decision for French in `CONTEXT.md` when starting. Work **level by level, A1 first as a pilot**: A1 for all 10 languages must pass `validate-i18n` and be spot-checked by native agents before A2–C2 start.

## Scope
### In
1. For each language L of the 10 and each level: `scripts/wordbank/fr/i18n/<L>/<LEVEL>.tsv` (5 columns `LEVEL word meaning example note`, `word` exactly as in the bank). Line endings LF (as Spanish).
2. Build output `src/data/wordbank/fr/i18n/<L>.json` (10 files, via `npm run build:wordbank`).
3. A test over the real translated tables (below).
4. A **native-agent check per language** (standing rule), applied before the commit.
5. `CONTEXT.md`, `tasks/TASK-065.md` status.

### Out
French UI overlay strings (TASK-063), re-reviewing the French/Italian/English columns, activating French in the repo, any change to German or Spanish.

## Translation rules (as TASK-046b, plus what went wrong then)
- **Source:** `scripts/wordbank/fr/i18n-source/<LEVEL>.tsv` (level, word, article, pos, meaning_en, example, example_en, note_en). Translate from the **English** columns and use the French `example` for the sense and the tense. The Italian columns are not a source.
- **meaning:** the shortest natural equivalent, ≤ 60 characters, part of speech preserved. A word with several senses: the sense of the example first.
- **example:** a natural translation of the **French** sentence, same tense and person, ending with that language's sentence mark (`。` zh/ja, `।` or `.` hi, `.`/`؟` ar); never the French sentence itself.
- **note:** same facts as `note_en`, same length ±; French words quoted inside the note stay French (keep the quotation marks used in the source; in `pl` the **same quotation marks** as the source, not `„…”`, so the build's quote check passes); French–Italian/English false-friend notes are rewritten so they still make sense in the target language (name the word, not only the Italian meaning); never invent a custom, a date or an etymology; if a note cannot be translated as written, shorten it, do not change the fact.
- **Collisions:** the validator rejects two words of the same part of speech with the same `meaning` unless their English meanings are identical. Disambiguate with a short qualifier or a more precise synonym; never by changing the sense. (In TASK-061 the same words collided in many languages at once: *Unnachgiebigkeit/Kompromisslosigkeit*, *patrimonio/legado*; expect near-synonym pairs and check for them before the build.)
- **Script and direction:** ru/uk Cyrillic, zh Simplified, ja kana/kanji, hi Devanagari, ar Arabic script (no Latin letters except quoted French words, no manual direction marks); `es` and `pt` (Brazilian) use their own accents and inverted marks.
- **Machine drafting is accepted** (translator agents, one per language and level group). The output is marked unreviewed in `CONTEXT.md`.

## Procedure
1. Pilot A1: 10 translator agents (one per language), each writing **only into its own subfolder** of the scratch directory (a TASK-061 run lost drafts because 11 agents shared one folder and reused names like `p1.txt`); the Developer joins the outputs, checks line count, 5 columns, LEVEL/word identical to the source in order, script check per language, ≤ 60 characters, example ≠ French sentence, no duplicate meanings per part of speech; then merges with a script and builds.
2. One native agent per language reads a 40-row random sample of its A1 table together with the French source and reports errors (`{word, problem, fix}`); fix, and if the error rate is above 5 %, re-translate the batch with the findings in the brief.
3. Repeat for A2–C2 (the sample check per level and language is 30 rows).
4. Build, validate, tests.

## Acceptance Criteria
- [ ] 60 TSVs exist, one row per bank word, validated with `node scripts/validate-i18n.mjs <L> --target fr --dir scripts/wordbank/fr/i18n/<L>` (A1 pilot first).
- [ ] `npm run build:wordbank` writes 10 JSON tables with the bank's number of entries each; `npm run validate:wordbank` is green ("10 translated table(s)" more for French).
- [ ] Total size of the 10 tables ≤ 4.5 MB; report the real figure.
- [ ] `frenchWordContent.test.ts` green (below); German and Spanish tests and outputs unchanged (`git status` shows nothing under `wordbank/de`, `wordbank/es`, and no change to the generated seams).
- [ ] With French activated **in a temp copy** (`--root/--src`), `wordContentLoaders.ts` lists the 10 languages and `getWordContent` of a sample word returns the translated meaning in each (say whether done through the loader module of the temp copy or by requiring the JSON).
- [ ] Native-agent results per language and level (sample size, errors, what was fixed) in the report; honest sentence that this is **not** a native human's approval.
- [ ] `tsc` clean, `npm test` and `npm run test:app -- es` green, `CONTEXT.md` updated (065 done, translations unreviewed by a human, 066 next).

## Technical Spec
### Files to create
```
mobile/scripts/wordbank/fr/i18n/<L>/<LEVEL>.tsv      60 files
mobile/src/data/wordbank/fr/i18n/<L>.json            10 generated files
mobile/__tests__/frenchWordContent.test.ts
```
### Files to modify
`CONTEXT.md`, `tasks/TASK-065.md` (status).

## Tests (write first)
`frenchWordContent.test.ts` over the real tables (shape as `spanishWordContent.test.ts`): every language × level covers every bank word exactly once with the same `word`; meaning non-empty and ≤ 60; example non-empty and different from the French sentence; the script of each language is present in meaning, example and note (Cyrillic, Han, kana/Han, Devanagari, Arabic); no Latin-only note in ru/uk/zh/ja/hi/ar unless it is only a French word; `«…»` fragments of the English note appear in the translated note; no two same-pos entries share a meaning; the loader maps each language code to its JSON when French is active (temp copy or direct require).
Guard: blank one meaning in a fixture table and see the coverage test go red.

## Definition of Done
- [ ] Criteria checked, tests first (they fail while the tables are missing)
- [ ] `npx tsc --noEmit`, `npm test`, `npm run test:app -- es` green
- [ ] Diff review: only the files above (plus generated JSON), no change under `wordbank/de`, `wordbank/es`
- [ ] Conventional commit: `feat(TASK-065): French word content in 10 app languages`
- [ ] `CONTEXT.md` updated, status `done`

## Notes for Tech Lead (remove before handing over)
- Translating from English (not French) matches TASK-046b: the English column is already a vetted paraphrase and the translators work from it plus the French sentence for sense.
- Per-agent subfolders are a hard rule after the TASK-061 translation run: agents wrote the same helper file names into one shared folder and overwrote each other's drafts (each detected it, but it cost rewrites).
- If the native agents find source problems in the French columns (not translation problems), fix the TSV, rebuild, re-export the source sheet and re-translate only the touched rows; list them in the report.
