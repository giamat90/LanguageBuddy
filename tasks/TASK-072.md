# TASK-072 — Chinese pack (draft), bank and character formats, validator rules

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-071 (design: TASK-070 §4, §6)

## Context
Chinese needs a pack, a bank format that carries word boundaries, pinyin and characters, and checks that catch the likely mistakes of machine-drafted content. The pack stays a **draft**: no words, no app variant (TASK-073).

## Scope
### In
1. `zh` pack (draft), overlay strings it/en, jade palette.
2. Pack properties `pronunciation` and `ai.rules`; pinyin shown without slashes; word lists sorted by pinyin; no Grammar button for a pack without drills.
3. Bank format for segmented sentences, extra columns and a character table.
4. Validator rules, driven by `language.json`.
5. `scripts/wordbank/zh/language.json`.

### Out
Words and characters (073). Variant, icon, appExpectations row (073). `characters.json` in the wordbank seam and any character screen (075). Pinyin above sentences, fading, typed pinyin, tone choice (074). Measure word and particle drills, daily order by stage, primer (076). Unihan reading check (077). Store files, CI (078).

## Acceptance Criteria
- [x] `src/languages/zh.ts` exports `zh` as below; `de`, `es`, `fr` and the test packs gain `pronunciation: 'ipa'` and otherwise behave as before.
- [x] A word with `pronunciation: 'pinyin'` is shown as `nǐhǎo`, with `'ipa'` as `/…/` (unchanged).
- [x] Catalog and word lists of a pinyin pack are ordered by pinyin (tones ignored first, then tones, then the word); other packs are ordered by word as before.
- [x] The vault shows the Grammar button only when the pack has articles, cases or choices.
- [x] The AI prompt of a pack with `ai.rules` lists them under "Rules"; the prompt of the other packs is byte-identical to today's.
- [x] `build-wordbank` on a fixture with `segmented` and `extraColumns` writes `example` without separators, `segments`, and the extra fields; with `characters: true` it writes `characters.json`. Wrong column counts, unknown extra columns and a missing `characters.tsv` fail.
- [x] `validate-wordbank` rejects, one test each: a segment that is neither a Han word nor listed punctuation (digits and Latin letters included); a sentence without an end mark; too few / too many words; the headword absent or twice; a word that is neither a headword (this level or lower) nor allowed; a character without a row; word pinyin that does not spell the word's characters; example pinyin with the wrong number of words, a syllable that is no reading of its character, or a headword read differently from the entry; a noun without a measure word (`none` is allowed) or with an unlisted one; a measure word on a non-noun; `measure_also` unlisted or repeating `measure`; a stage outside the list; a bad character row (two characters, malformed reading, parts and glosses of different length, itself as look-alike, a trick in one language only, duplicate).
- [x] It accepts: neutral tone, 一 yí/yì and 不 bú, erhua (一点儿 `yìdiǎnr`), capitals and apostrophes in pinyin.
- [x] Rule checks read segments for a segmented bank (a tagged sentence needs exactly one member **word**).
- [x] A noun needs an article only in a language whose `articles` list is not empty.
- [x] `npm run build:wordbank` and `validate:wordbank` skip `zh` as a draft; German, Spanish and French JSON is unchanged; committed seams unchanged.
- [x] `npx tsc --noEmit`, `npm test`, `npm run test:app -- es`, `-- fr` green.

## Technical Spec

### Files to create
```
mobile/src/languages/zh.ts, zh/strings/it.ts, zh/strings/en.ts
mobile/scripts/wordbank/zh/language.json
mobile/scripts/lib/pinyin.js           syllables and readings (CommonJS, pure)
mobile/scripts/lib/segmented.js        sentence, pinyin, measure, stage and character checks (CommonJS, pure)
mobile/__tests__/chinesePack.test.ts
mobile/__tests__/segmentedBank.test.ts build and validate on fixtures
mobile/__tests__/pinyin.test.ts
```
### Files to modify
```
src/languages/types.ts, de.ts, es.ts, fr.ts, test-support/testPack.ts, testPackCjk.ts
src/theme/palettes.ts, scripts/lib/store.js (SUPPORT_COLORS)
src/components/ui/WordHero.tsx, src/lib/catalog.ts, src/lib/grammar.ts (hasGrammarDrill),
src/screens/VaultScreen.tsx, src/lib/ai/wordInsight.ts, src/data/wordbank/index.ts (types)
scripts/build-wordbank.mjs, scripts/validate-wordbank.mjs
__tests__/palettes.test.ts, levels.test.ts (pack list)
CLAUDE.md (§3, §5), CONTEXT.md
```

### Pack
```ts
export type TargetLanguageCode = 'de' | 'es' | 'fr' | 'zh';
/** What the bank's `ipa` column holds. 'pinyin' is shown bare and orders the word lists. */
pronunciation: 'ipa' | 'pinyin';
ai: { languageName: string; rules?: readonly string[] };
```
`zh`: name `Chinese`; app `ChineseBuddy` / `ChineseBuddy` / `chinesebuddy.db`; `levels ['A1']`; `sentences 'segmented'`; `pronunciation 'pinyin'`; `letters /([㐀-鿿]+)/` (written as `㐀-鿿`); `fold` removes whitespace; `typoMinLength Number.POSITIVE_INFINITY` (a wrong character is wrong); punctuation as `testPackCjk`; `collation 'zh'`; speech `zh-CN`, 0.8; ai `Mandarin Chinese` with rules: simplified characters only; every `"native"` text of an example begins with the pinyin (tone marks) of its sentence in square brackets. `articles`, `gender`, `cases`, `choices` null; `quiz []`; `uiLanguages ['it','en']`.

Palette `zh`: paper `#F5FAF7`, mist `#DFEAE4`, cream `#EAF3EE`, ink `#0B2A20`, muted `#567065`, primary `#0F6B50`, primaryLight `#DFEFE8`, gold `#8F6108`, goldLight `#FBF0D9`, border `rgba(11,42,32,0.12)`.

### language.json keys (all optional; absent = today's behaviour)
```jsonc
"segmented": { "separator": "|", "punctuation": "。？！，、：；“”‘’《》（）…", "end": "。？！",
               "minWords": 4, "maxWords": 10, "allow": [] },
"extraColumns": ["example_pinyin", "measure", "measure_also", "stage"],
"characters": true,
"pinyin": { "alternatives": { "一": ["yí", "yì"], "不": ["bú"] }, "erhua": "儿" },
"measureWords": ["个", "本", "…"],
"stages": [1, 2, 3, 4]
```
`zh` also: `draft true`, `levels ["A1"]`, `i18nLanguages []`, the 13 rule codes of TASK-070 §4.5, parts of speech `noun verb adj adv pron num measure prep conj particle phrase`, `articles []`, `ruleChecks` for the four choice codes (`mustContainAny` = `exactlyOneOf` = 是/在/有, 吗/呢, 二/两, 不/没).

### TSV
The 14 columns, then `extraColumns` in order. `example`: words and punctuation separated by `|`.
- `example_pinyin`: one space-separated pinyin word per **word** segment, no punctuation.
- `measure`: nouns a listed measure word or `none`; others `-`. `measure_also`: space separated or `-`. `stage`: number.
JSON: `segments: string[]`, `example` = joined; `measure: string | null` (`-` → null, `none` kept); `measure_also: string[]`; `stage: number`.

`characters.tsv`, 10 columns: `char, pinyin (readings, space separated), meaning_en, meaning_it, parts (space separated), parts_en (; separated), parts_it, lookalikes (space separated), trick_en, trick_it`; `-` = empty for the last six. JSON: `{ char, pinyin: string[], meaning_en, meaning_it, parts: {char,en,it}[], lookalikes: string[], trick_en: string|null, trick_it: string|null }[]`.

### Pinyin matching (`pinyin.js`)
`toneless(s)` removes the four tone marks, keeps ü. A reading is valid when it is one syllable (initial + final, at most one tone mark). `spells(text, chars, readings, cfg)`: lower-case, drop spaces, apostrophes and hyphens, then match one syllable per character, allowing for each character its readings, their toneless forms, `alternatives`, and `r` for the erhua character when it is not first. Headword check in an example: the token equals the entry's pinyin (same normalisation); if the headword contains a character listed in `alternatives`, compare toneless.

Han word = `^[㐀-鿿]+$` (same range as the pack). Parts and look-alikes: one `\p{Script=Han}` character each. Characters needing a row: all in headwords, example words and measure words.

## Tests (write first, watch them fail)
Pack facts and strings; pinyin matching table (accept and reject); each validator rejection from a valid base fixture (changing one thing); build output and failures; `WordHero`, catalog order, vault button both ways; AI prompt with and without rules.
Guard checks: remove the headword-count check and the reading check, see their tests fail.

## Definition of Done
- [x] Criteria checked, tests red then green; checks above green; seams German
- [x] Review checklist (§15): no `if (code === 'zh')`
- [x] `CONTEXT.md` updated, status `done`. Commit only when asked.
