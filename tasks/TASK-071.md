# TASK-071 — Engine: a language with fewer levels and unspaced sentences

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** none (design: TASK-070)

## Context
ChineseBuddy (TASK-070) ships A1 only and writes sentences without spaces. Today such a language cannot be activated, the level quiz can send the learner to an empty level (crash on the word of the day), and reorder, find the mistake and typed cloze cannot work on unspaced text. This task makes the engine able to host it. **No Chinese pack, word or screen text is added.**

## Scope
### In
1. `levels` on the pack; level coercion; quiz skipped when a pack has none; level UI follows the pack.
2. Activation of a language with a prefix of the levels (`A1`, `A1`–`A2`, …).
3. Segmented sentences: data driven word boundaries and a joiner.
4. Device language fallback: a phone language the app does not offer starts in English.
5. A Chinese-like test pack, and the QA suite reading the pack's levels.

### Out
Chinese pack, bank format, validator and build changes (072); pinyin, characters, new exercises (074/075); catalog sort order; store files; any change to word content.

## Acceptance Criteria
- [x] German, Spanish and French behave as before, except criterion "phone language" below. Their seeded exercise tests pass **without edits**.
- [x] The committed seams are unchanged: activating `de` writes byte-identical files.
- [x] A fixture language with `levels: ["A1"]` activates; the generated `LEVEL_FILES` holds `[]` for A2–C2. Levels that are not a non-empty prefix of A1…C2 (`[]`, `["A2"]`, `["A1","B1"]`) are refused and nothing is written; a listed level without its JSON is still refused.
- [x] With an A1-only pack and bank: a profile row holding `B1` reads as `A1`, the word of the day is an A1 word (no crash), and the stored row is not rewritten.
- [x] With a pack without a quiz: the welcome button goes to `/topics` with `cefrLevel` = first level; opening `/quiz` directly redirects there. With a quiz nothing changes; the inferred level is coerced to the pack's levels.
- [x] With one level: catalog and word lists show no level filter, statistics show no "by level" section. With six levels the screens are as before.
- [x] With the segmented test pack, a card `他有一本书。` (segments `他|有|一|本|书|。`, word `书`) builds: typed cloze `他有一本` / `。`; reorder tiles `他`,`有`,`一`,`本`,`书。`; the revealed and spoken sentence has no spaces. A card tagged `QUESTION_PARTICLE` (`你|是|学生|吗|？`, word `学生`) gives a choice question and a find-the-mistake with options `吗`/`呢`.
- [x] The same cards without segments, or with segments that do not concatenate to the example, build none of the four formats and fall back to a flip card.
- [x] Phone language: offered → itself; anything else → `en` when offered (a Spanish phone on SpanishBuddy now starts in English, before: Italian).
- [x] `npx tsc --noEmit`, `npm test`, `npm run test:app -- es`, `npm run test:app -- fr` green.

## Technical Spec

### Files to create
```
mobile/src/lib/levels.ts                 coerceLevel
mobile/src/lib/sentence.ts               sentenceParts, sentenceTokens, joinTokens
mobile/test-support/testPackCjk.ts       the segmented, A1-only fake pack
mobile/__tests__/levels.test.ts          coercion, profile, daily word (mocks the wordbank seam)
mobile/__tests__/singleLevelScreens.test.tsx
mobile/__tests__/sentence.test.tsx       pure functions and the four formats
```
### Files to modify
```
src/languages/types.ts, de.ts, es.ts, fr.ts, test-support/testPack.ts     levels, sentences
src/languages/targetStrings.ts           quiz keys only for packs with a quiz
src/data/wordbank/index.ts               WordBankEntry.segments?: string[]
src/services/profileService.ts           mapRow: coerceLevel(row.cefr_level); no write
src/services/reviewService.ts            ReviewCard.segments?: string[] | null, from bankFor
src/lib/cloze.ts, grammar.ts             use sentenceParts
src/lib/exercises/reorder.ts, mistake.ts, registry.ts, practice.ts        pass segments
src/lib/sentenceSpeech.ts                join with joinTokens
src/components/exercises/SentenceReorderView.tsx                          joinTokens
src/screens/WelcomeScreen.tsx, QuizScreen.tsx, TopicsScreen.tsx
src/screens/CatalogScreen.tsx, StatsScreen.tsx, StatsWordsScreen.tsx
src/components/ui/filterSections.ts      levelSection maps and totals the pack's levels
src/i18n/language.ts                     detectDeviceLanguage
scripts/lib/active-language.mjs          level prefix, empty arrays
test-support/appExpectations.ts          sampleWord: Partial<…>
__tests__/activeApp/content.test.ts, flows.test.ts                        see "QA suite"
__tests__/withLanguage.test.ts (or wordbankScripts.test.ts), languageRegistry.test.ts, targetStrings.test.ts
CLAUDE.md (§3 pack parts, §9), CONTEXT.md, tasks/TASK-071.md (status)
```

### Pack
```ts
/** The levels this app has words for: a non-empty prefix of CEFR_ORDER. */
levels: readonly CefrLevel[];              // import type from ../data/wordbank
/** 'spaced': words are found with `letters`. 'segmented': the bank says where words are; no joiner space. */
sentences: 'spaced' | 'segmented';
quiz: readonly QuizItem[];                 // [] = no level quiz
```
`de`, `es`, `fr`, `testPack`: all six levels, `'spaced'`, quiz unchanged. Rule, tested for every registered pack: `quiz.length === 0` exactly when `levels.length === 1`.

`testPackCjk`: `code: 'de'` (as `testPack`; the code type is widened in 072), app `TestHanzi`, `levels ['A1']`, `sentences 'segmented'`, `letters /([㐀-鿿]+)/`, `fold` trim, `typoMinLength 5`, `punctuation { lead: /^[“‘《（]+/, trail: /[。，、？！：；”’》）…]+$/ }`, `collation 'zh'`, `speech zh-CN 0.8`, `articles`, `gender`, `cases` null, `choices { ruleSets: { QUESTION_PARTICLE: [['吗','呢']] } }`, `quiz []`, `uiLanguages ['it','en']`, `strings {}`.

### Levels
```ts
/** Anything from storage, a route or a backup: a level this pack has. Higher than it has → its highest; else its first. */
export function coerceLevel(value: unknown, pack: LanguagePack = getActivePack()): CefrLevel;
```
- `TopicsScreen`: coerce the route param once; use the result for `submitOnboarding` and `setCefrLevel`.
- `WelcomeScreen`: `quiz.length > 0` → `/quiz` as today, else `/topics` with `{ cefrLevel: levels[0], nativeLanguage }`.
- `QuizScreen`: with no question, `router.replace` to the same target in an effect and render nothing (all hooks run before the return). `inferCefrLevel` is unchanged; its result goes through `coerceLevel`.
- `CatalogScreen`: initial and own level via `coerceLevel`; omit the level section when `levels.length === 1`.
- `StatsWordsScreen`: omit the level section when one level.
- `StatsScreen`: show only `byLevel` rows of the pack's levels; the heading and rows only when more than one. `computeStats` is unchanged.

### Activation
`levels = cfg.levels ?? LEVELS`. Problem when `levels.length === 0` or `levels.join() !== LEVELS.slice(0, levels.length).join()`; the message names the rule. Check JSON files for listed levels only. Import only listed levels; the others appear as `[]` in `LEVEL_FILES`, same key order. Draft refusal unchanged.

### Sentences
```ts
/** Same shape as `text.split(pack.letters)`: even indexes separators, odd indexes words. */
export function sentenceParts(text: string, segments: readonly string[] | null | undefined, pack?: LanguagePack): string[];
/** Tiles: words as shown, punctuation attached. [] when a segmented sentence has no usable segments. */
export function sentenceTokens(text: string, segments: readonly string[] | null | undefined, pack?: LanguagePack): string[];
export function joinTokens(tokens: readonly string[], pack?: LanguagePack): string;   // '' or ' '
```
- Spaced: parts = `text.split(pack.letters)`, tokens = `tokenizeSentence(text)`; `segments` ignored.
- Segmented, usable only when `segments.join('') === text`: a segment is a **word** when `segment.split(pack.letters)` has length 3 with both ends empty; consecutive non-words are merged into one separator; the array starts and ends with a separator (possibly empty). Otherwise parts = `[text]`.
- Segmented tokens: each word is a token. A non-word that matches `punctuation.lead` entirely is prefixed to the next word; any other non-word is appended to the previous token (or prefixed to the next when there is none). Leftover prefix at the end is appended to the last token.
- `buildCloze(sentence, word, pack = getActivePack(), segments?)` and `buildChoiceCloze(sentence, ruleCode, pack = getActivePack(), segments?)`. `buildCaseCloze` unchanged (no segmented language has cases). `buildChoiceQuestion` accepts `segments?` on the entry and passes it.
- `buildReorder`, `buildFindMistake`: `sentenceTokens(card.example, card.segments, pack)`; pass segments to the cloze calls. `TYPED_CLOZE` and `canPractice` pass them too.
- `reorderSentence`, `correctedSentence`, and the "correct sentence was" text in `SentenceReorderView` use `joinTokens`.
- No segmentation is ever computed on the phone.

### Device language
`detectDeviceLanguage`: the primary subtag if it is in `offeredLanguages()`, else `coerceNativeLanguage('en')`.

### Target strings
Export `BASE_TARGET_KEYS` (4), `QUIZ_TARGET_KEYS` (15), `REQUIRED_TARGET_KEYS` (both, as today) and `requiredTargetKeys(pack)` (base, plus quiz keys when `quiz.length > 0`). The overlay test uses the function.

### QA suite (so TASK-078 only adds a row)
- New test: `pack.levels` equals the levels with words in `WORD_BANK`.
- Sample words, daily walk and `daily flow at %s` iterate `getActivePack().levels`.
- Article tests run only when `articleForms` is non-empty; with none, assert no entry has an article.
- The `localizedText` translated-language test is skipped when `translatedLanguages` is empty.
- Cloze and choice calls pass `entry.segments`; `cards()` copies it.

## Tests (write first, watch them fail)
- `levels.test.ts`: coercion table for German and the CJK pack (`'C2'`→max, `'x'`/`null`→first); with `src/data/wordbank/active` mocked to an A1-only bank, a `B1` profile row gives an A1 daily word (today: TypeError).
- `singleLevelScreens.test.tsx`: welcome and quiz routing both ways; catalog, word list and statistics with one level and with six.
- `sentence.test.ts`: parts and tokens including opening quotes, a mid-sentence comma, mismatched and missing segments; the four formats from the criteria; flip-card fallback.
- Activation: A1-only fixture; the three refused shapes; German output equals the committed seams.
- `languageRegistry.test.ts`: CJK pack `fr_FR`, `zh_CN`, `de_DE` → `en`, `it_IT` → `it`; German cases unchanged.
- Pack rules: `levels` prefix and quiz/levels rule for every registered pack.
- Guard checks: remove the coercion in `mapRow` and see the daily-word test fail; drop the concatenation check and see the mismatch test fail.

## Definition of Done
- [x] Criteria checked, tests red then green
- [x] Checks listed above green; seams German
- [x] Review checklist (CLAUDE.md §15): no `if (code === …)`, no word content, no unrelated files
- [x] `CONTEXT.md` updated, status `done`
- [x] Commit when asked: `feat(TASK-071): partial levels and segmented sentences`
