# TASK-058 — Audit the word lists against a public frequency list

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-046 (Spanish bank), nothing else. Independent of TASK-054 (reader review); its output feeds that review.

## Context
Both banks were put together by judgment ("frequency and usefulness for the level", TASK-046 for Spanish; the German bank earlier): no external word list was used, so level placement, coverage and topic balance have never been measured. German C1 has 209 `culture` words and 3 each of `home`, `travel`, `leisure`; Spanish is even by construction. This task **measures** both banks against a public frequency list and writes a report. It changes **no word**: fixing what the report finds is for the Product Owner to decide and for follow-up tasks (a word moved or added needs example, translations and a reader).

## Scope
### In
1. A reusable script `npm run audit:wordbank -- <code>` (works for any language that has a `language.json`, so French and Italian get it for free) that reads the language's TSVs and a **frequency list the user downloads** and prints a report with five sections (below).
2. Pure functions in `scripts/lib/wordbankAudit.js` with tests; the script is a thin wrapper.
3. A short "how to run the audit" section in `CLAUDE.md` §5 (Data) and a decisions line in `CONTEXT.md`.
4. A first run for `de` and `es` by the Developer, with the report summary in the hand-off (not in the repo, see below), so the Product Owner can decide what to change.
5. **A native-agent quality check** of what the audit found and of a sample of each bank (section "Native-agent review"). This is a standing rule for every content task (`CLAUDE.md` §14), started here.

### Out
Changing, moving, adding or removing any word, example, translation or tag; bumping `WORDBANK_VERSION`; committing the frequency list or any text derived from it beyond the summary numbers in `CONTEXT.md`; using an official CEFR list (Goethe, Instituto Cervantes PCIC) as machine input (they are copyrighted: the human reader uses them by hand in TASK-054); lemmatisation or any NLP dependency; a runtime feature.

## The reference list (decision made here)
- **A plain public frequency list, one `word count` pair per line**, e.g. hermitdave/FrequencyWords (`content/2018/<code>/<code>_50k.txt`, from film subtitles; the Developer checks that the path still exists, any equivalent list with the same line format is fine).
- It is **downloaded by hand** into the gitignored folder `mobile/scripts/reference-lists/<code>.txt` and **never committed** (its licence, CC-BY-SA for the data, would attach to anything copied). Add `mobile/scripts/reference-lists/` to `.gitignore`.
- Subtitles skew toward speech: everyday words rank high, formal and written words rank low. That is acceptable for an A1–B2 vocabulary app but the report says so, and the C1/C2 flags are weaker evidence than the A1/A2 ones.
- Rank = 1-based line number (the file is sorted by count). A word's rank is looked up by its **folded form**: lower-case, NFC, and, when there is no exact match, accent-insensitive (`pan`/`pán`; German `ß`→`ss`, umlaut folded). Bank entries are lemmas (infinitive verbs, singular nouns) while the list holds word forms, so verbs rank lower than they should; thresholds below are deliberately generous, every flag is a *question for a human*, never an instruction.

## The report (five sections, plain text to stdout; `--out <file>` also writes it)
1. **Level medians.** Per level: word count, median rank, share found in the list, share in the top 1,000 / 3,000 / 10,000. Expectation: the median rank rises from A1 to C2. Print `OK` or `NOT MONOTONE (A2 easier than A1)`.
2. **Words that look misplaced** (the useful part). Thresholds in `scripts/wordbank/<code>/audit.json` (defaults used when absent): `tooRare: {A1: 8000, A2: 12000, B1: 20000}` → a word at that level with a rank above the number is listed as *too rare for its level*; `tooCommon: {B2: 1000, C1: 2000, C2: 3000}` → a word at that level with a rank *below* the number is listed as *possibly too early/late (very common)*. Each line: level, word, rank, topic, the example sentence. Sorted by how far past the threshold.
3. **Not found** in the list (multi-word entries, names, rare words, spelling variants): count per level and the words, so a human can tell a typo from a rare word.
4. **Coverage gaps.** The 500 most frequent entries of the list that are **not** in the bank at any level (matched by folded form), after skipping tokens that are numbers, one letter or in a small per-language stop list (`audit.json` `stop`: articles, pronouns, prepositions, conjunctions; the default is empty and the report prints how many tokens it skipped). These are candidates only: many are inflected forms of a word the bank has (`tengo`, `vamos`).
5. **Topic balance.** A level × topic table of counts, and a line per level naming topics with fewer than 5% of the level's words (`audit.json` `minTopicShare`, default 0.05). German C1/C2 will show up; that is expected and is the data for the Product Owner's decision.

Exit code is 0 whenever the report was produced (the audit informs, it does not gate CI). It exits 2 with a clear message if the reference file is missing: the message names the expected path and says where to download.

## Native-agent review (required; the Product Owner asked for it on every content task)
After the audit has run, the Developer starts **native agents**: subagents, each briefed as a native speaker and language teacher of one language, **read-only** (they never edit a file), working on material the Developer hands them as text.
- **Who:** per language (`de`, `es`) three agents, one for A1–A2, one for B1–B2, one for C1–C2 (six in total), started in parallel.
- **What each gets:** (a) the audit's flagged rows for its levels (sections 2 and 3, with example and topic), (b) the 40-row review sheets of its levels (`node scripts/export-review-sample.mjs --lang <code> --per 40`; the sheets for `de` are produced the same way, the Spanish wording in their header is ignored), (c) the thin topics of section 5 for its levels, (d) the section 4 gap candidates (top 100 only).
- **What each must answer, as a JSON list** of `{word, level, kind, verdict, suggestion}` with `kind` one of `level` (belongs earlier/later: say which level), `word` (unnatural, wrong, regional or offensive), `example` (unnatural, wrong grammar, not teaching the word), `tag` (grammar tag does not fit the sentence), `note` (cultural/usage note false or misleading), `gap` (an important everyday word missing), and `verdict` one of `fix`, `check`, `ok-as-is`. A row that is fine is not listed. Each agent also gives a one-paragraph overall judgment of its level range (natural? useful for a learner at that level? what is systematically off?).
- **Rules for the agents:** they judge from their own knowledge of the language, say "not sure" instead of inventing, and note when a flag is only an artefact of the list (an infinitive ranking low, a subtitle-register bias).
- **What the Developer does with it:** merges the six answers into one table in the hand-off (counts per `kind`/`verdict`, the 10 most serious items per language) and **fixes nothing**. Findings are input to the Product Owner's decisions and to the human reader of TASK-054. Be honest in the hand-off: agent review is a quality filter, **not** a native human's approval, and it does not remove the need for TASK-054.
- Keep the agents' raw answers outside the repo (scratch folder); only the merged summary goes into the hand-off.

## Acceptance Criteria
- [ ] `npm run audit:wordbank -- es` and `-- de` print the five sections from a real reference list; without the file they exit 2 with the path and a download hint, and they never touch the network themselves.
- [ ] No frequency data and no list of words from it is committed; `.gitignore` covers the folder; `git status` after a run is clean.
- [ ] The functions in `wordbankAudit.js` are pure (no file or network access) and unit-tested with small fixtures.
- [ ] A language with no `audit.json` still works (defaults); a language without `language.json` is refused with a clear message.
- [ ] `npx tsc --noEmit`, `npm test`, `npm run test:app -- es` green; seams unchanged; no bank file changed (`git diff --stat` shows only scripts, test, `.gitignore`, `package.json`, `CLAUDE.md`, `CONTEXT.md`, the task, and `audit.json` files if added).
- [ ] The hand-off contains the summary numbers of both runs (section 1 table, counts for sections 2–5, the ten most extreme items of section 2 per language).
- [ ] Six native agents (three per language) ran read-only, and the hand-off holds the merged findings table and each agent's overall judgment; no file was edited by an agent.

## Technical Spec
### Files to create
```
mobile/scripts/audit-wordbank.mjs           thin wrapper: args, reads the built JSON of the bank (so a TSV column change cannot desynchronise it), the reference file, calls the library, prints
mobile/scripts/lib/wordbankAudit.js         pure functions (below)
mobile/__tests__/wordbankAudit.test.ts      fixtures, no real bank
mobile/scripts/wordbank/de/audit.json       thresholds for German (optional; start from the defaults and adjust only if a first run shows the defaults are nonsense)
mobile/scripts/wordbank/es/audit.json       same for Spanish
```
### Files to modify
```
mobile/package.json                         "audit:wordbank": "node scripts/audit-wordbank.mjs"
.gitignore                                  mobile/scripts/reference-lists/
CLAUDE.md                                   §5: how to run the audit, that it never changes the bank
CONTEXT.md                                  task done; decision: references are downloaded, never committed; summary numbers; what the Product Owner should decide
```
### `wordbankAudit.js`
```js
parseFrequencyList(text)                       // → Map<foldedWord, rank>; first occurrence wins; blank and malformed lines skipped
fold(word, code)                               // lower-case, NFC; 'de': ß→ss; used for both bank words and list words
rankOf(rankMap, word, code)                    // exact folded match, else accent-insensitive match, else null
levelStats(entries, rankMap, code)             // → [{level, count, found, median, top1000, top3000, top10000}]
isMonotone(stats)                              // median(A1) <= median(A2) <= … over levels that have a median
misplaced(entries, rankMap, code, cfg)         // → {tooRare:[…], tooCommon:[…]} each {level, word, rank, topic, example}, worst first
notFound(entries, rankMap, code)               // → {byLevel:{A1:[words]…}}
coverageGaps(rankMap, bankWords, code, cfg)    // → {candidates:[{word, rank}], skipped:number}; first `limit` (500) frequent tokens absent from the bank
topicBalance(entries, minShare)                // → {table:{level:{topic:n}}, thin:{level:[topics]}}
```
Entries are the TSV rows as objects with `word`, `level`, `topic_domain` (use the names `build-wordbank.mjs` already uses; read its column list instead of guessing). Median of an empty set is `null`. Every function takes plain data and returns plain data.

### Notes
- Print counts first, long lists after, so the top of the output fits a screen.
- Use the same TSV reader as the build so a column change cannot desynchronise the two.
- If a threshold produces more than ~25% of a level as flagged, say so in the output ("thresholds are probably wrong for this list") instead of printing hundreds of lines; the full list still goes to `--out`.

## Tests (write first, see them red)
- `parseFrequencyList`: ranks in file order; duplicates keep the first; `"palabra 123"`, a tab-separated line and a line with extra spaces parse; blank and `"x"` lines skipped.
- `fold`/`rankOf`: `Pan`→`pan`; `Straße` finds `strasse`; an accented bank word finds an unaccented list word and vice versa; missing → `null`.
- `levelStats`: medians, found share and top-N shares on a hand-made level; empty level → `median: null` and no crash; `isMonotone` true/false and ignores empty levels.
- `misplaced`: a rare A1 word and a very common C2 word are flagged with the right category and sorted worst first; a word without a rank is **not** flagged there (it belongs in `notFound`); thresholds from the config override the defaults.
- `notFound`: grouped by level.
- `coverageGaps`: bank words and their accent variants are excluded; stop-list, numbers and one-letter tokens are skipped and counted; `limit` respected.
- `topicBalance`: counts per level and topic; a topic under the minimum share is `thin`; a level with no words is absent or empty, not an error.
- Script (via `spawnSync`, like `scriptsTestApp.test.ts`): no reference file → exit 2, stderr contains the expected path; unknown language → non-zero with a message. These run without the real list.
- Guard: change the monotone comparison once and watch the `isMonotone` test go red.

## Definition of Done
- [ ] Criteria checked, red before green, guard done
- [ ] Hand-off: the summary numbers and top-10 per language from the real run (the report file itself stays untracked), plus the merged native-agent findings
- [ ] Diff review: only the files above changed; no word bank file, no reference data
- [ ] `CONTEXT.md` updated; commit `feat(TASK-058): audit the word banks against a frequency list`
- [ ] Task status `done`

## Notes for Tech Lead (remove before handing over)
- Why not apply fixes in this task: a wrong level is a judgment call (subtitle frequency is a proxy), and every moved or added Spanish word means re-translating ten languages and a reader's pass. Measure first, then decide what is worth it.
- Why no official CEFR lists as input: Goethe's Wortliste and the PCIC are copyrighted and structured as PDFs; the Spanish reader (TASK-054) can hold them next to the "misplaced" sheet by hand, which is where level questions are really settled.
- Likely findings to prepare the Product Owner for: German C1/C2 thin in `home`, `travel`, `leisure`, `shopping` (decide: accept, since the daily word falls back to other topics, or commission about 40–60 new words per thin cell); Spanish A1 verbs flagged as rare only because infinitives are less frequent than conjugated forms (a known limit of form-based lists).
- Next after this: a follow-up task per decision (re-level N words, add M words to thin topics), each with its own review sheet.
