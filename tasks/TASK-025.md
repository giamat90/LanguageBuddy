# TASK-025 — Word content in the new app languages

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Depends on:** TASK-024 (language registry and the `wordContent.ts` seam)

---

## Context

TASK-024 makes the UI available in 13 languages, with word content in the new languages falling back to English. This task
supplies the real content: for each of the 11 new languages, the **meaning**, **example translation** and **cultural note**
of every one of the 2,194 word-bank entries (2,194 × 3 × 11 ≈ 72,000 strings).

---

## Scope

### In scope
- Source TSVs `scripts/wordbank/i18n/<lang>.tsv`, one per language, authored by hand (the editable source of truth, like the existing word-bank TSVs).
- `scripts/build-wordbank.mjs` emits `src/data/wordbank/i18n/<lang>.json` (`{ "<LEVEL>:<word-key>": [meaning, example, note] }`).
- `scripts/validate-wordbank.mjs` validates completeness and format (runs in `pretest`).
- Loader table in `wordContent.ts` filled via `require` (lazy, memoized).
- Dedupe of ambiguous options in the **learner's** language for multiple choice and matching (see below).
- `WORDBANK_VERSION` bump is **not** needed (bundled i18n data is read at render time, not seeded into the DB); document that.

### Out of scope
- Re-translating Italian/English content; changing the German words, IPA, topics or grammar angles.
- Per-language IPA or transliteration (pinyin, romaji, romanization).

---

## Acceptance Criteria

- [ ] AC1: For each of the 11 languages the TSV has exactly one line for each of the 2,194 `(level, word)` entries, in word-bank order; no missing/empty field, no tab or newline inside a field.
- [ ] AC2: The validator fails the build on: unknown or duplicate key, missing entry, empty field, a meaning longer than 60 chars, an example or note longer than 3× its English length + 40, a field identical to the German source, leftover markers (`TODO`, `???`).
- [ ] AC3: Meanings of two entries with the same part of speech are never identical after normalisation within a language (the validator reports the colliding pairs; translators disambiguate with a short qualifier in parentheses, e.g. `llave (de puerta)`).
- [ ] AC4: In-app, every screen that showed an Italian/English meaning, example or note now shows the learner's language when present, else English.
- [ ] AC5: Multiple-choice options and matching tiles never show two identical texts in the learner's language (extra dedupe key on the localized meaning; non-Latin scripts handled by the normaliser).
- [ ] AC6: Bundle impact measured and written in `CONTEXT.md` (JSON size per language; all languages are lazy-required).
- [ ] AC7: A native-speaker review checklist per language exists in `CONTEXT.md`; machine-translated status is explicit.
- [ ] AC8: `tsc` clean; `npm test` green.

---

## Technical Spec

### TSV format
`<LEVEL>\t<word>\t<meaning>\t<example>\t<note>` — word exactly as in the bank (case preserved); the key is derived with `entryId`.
`-` is not allowed (every field is required). Lines starting with `#` ignored.

### Translation brief
Meaning: the dictionary gloss a learner would expect (verbs in the infinitive form of that language, nouns without article
unless gender-marked languages need none). Example: a natural translation of the *German* sentence in the bank — keep named
entities, numbers and German quoted words (`'gehen'`) as they are. Note: translate faithfully, keep quoted German words, keep
within one to two sentences. Same register as the English note. Hindi: Devanagari, no transliteration. Chinese: Simplified.
Portuguese: Brazilian. Arabic: Modern Standard Arabic (the text will be displayed RTL; German words inside stay LTR).

### Dedupe in the learner's language
`distractors.ts` / `matching.ts` today dedupe on the Italian and English meaning keys. Add an optional `lang` through
`ExerciseDefinition.build(card, rng, lang?)` and `buildMatchingRound(cards, rng, lang?)`; when `lang` is neither `it` nor `en`,
also dedupe on `normalizeLocal(localizedText(lang,'meaning',…))`. `normalizeLocal` lower-cases, strips parenthetical qualifiers
and splits on whitespace/punctuation — **not** the Latin-only `LETTER_RUN` regexp used today, which returns `''` for CJK,
Cyrillic, Devanagari and Arabic. Existing it/en behaviour must stay byte-identical (property test over the real bank).

### Process
1. Developer writes the validator and the builder first (red against empty TSVs).
2. TSVs are produced language by language, **one commit-sized batch per language**, each validated before the next.
3. Review spot-check: for each language, 50 random entries compared against the English text.

---

## Tests (write first)
- `wordContentBuild.test.ts`: validator rejects each AC2 fault with a fixture; accepts a good fixture.
- `wordContentBank.test.ts` (real data, per language that has a JSON): complete coverage, no collisions per POS, `localizedText` returns the local text for 20 sampled keys.
- `exerciseLocalDedupe.test.ts`: builders with `lang='ru'`/`'zh'` never emit two identical option texts; `it`/`en` results unchanged (seeded rng, snapshot against the current builders).

---

## Definition of Done
- [ ] AC1–AC8 checked; all 11 languages complete and validated
- [ ] Conventional commit `feat(TASK-025): word content in 11 more languages` (only when asked)
- [ ] `CONTEXT.md` updated; status → `done`

---

## Notes for Tech Lead
- **Cost:** ~2.5–3M output tokens of translation. Run per language, in parallel if the Product Owner agrees to the subagent spend; each language is independent.
- **Quality ceiling:** machine translation of 6,500 strings per language will contain mistakes in idioms and cultural notes. Ship UI first (TASK-024), content with an in-app "translations may contain errors" line is **not** in scope — decide with the Product Owner before the store listing.
- **Why not seed into the DB:** it/en are copied into `daily_items`/`vocabulary_items` for historical reasons; the new content is derived data from a bundled, versioned file, so reading it at render keeps old vaults and backups untouched and the format stable.

---

## Implementation notes

- **Result:** all 11 languages (fr, es, pt, ru, uk, pl, tr, zh, ja, hi, ar) ship with 2,194 entries each. JSON sizes 385 KB (zh) to 856 KB (hi), about 5.8 MB in total, each lazily required.
- **Deviations from the spec above (decided while building):**
  - Sources are `scripts/wordbank/i18n/<lang>/<LEVEL>.tsv` (one file per level), not one TSV per language; work in progress lives in `scripts/wordbank/i18n-wip/`, which the build ignores.
  - A meaning equal to the German word is allowed (loanwords); only an example identical to the German sentence fails. Every field must also contain the language's script for ru, uk, zh, ja, hi, ar.
  - The collision rule compares the full normalised meaning including qualifiers, and exempts the same word listed in two levels (e.g. trotzdem, essen) and entries whose English meanings are also identical.
  - The loader table `src/i18n/wordContentLoaders.ts` is generated by the build from the JSON files that exist (Metro needs static paths).
  - The learner-language dedupe is `lang` threaded through `build`, `pickDistractors`, `buildMatchingRound`, `createSession` and `pickExercise`, with `normalizeLocal` (all scripts) in place of the Latin-only regexp.
- **Process note:** translators ran as parallel agents per language and level-half and were interrupted by session limits several times; their files were the checkpoint, each language was then validated whole, and about ten cross-level collisions were fixed by hand with parenthetical qualifiers.
- **Still to do:** native-speaker review per language; a phone pass on how long notes wrap in each script.
