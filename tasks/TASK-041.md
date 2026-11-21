# TASK-041 — `LanguagePack`: move every German-specific rule behind one interface

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** none (first task of the LanguageBuddy monorepo; numbering continues from GermanBuddy)

---

## Context
LanguageBuddy will build one app per target language (SpanishBuddy next). Today the German rules are scattered: articles and cases in `lib/grammar.ts`, umlaut folding and the letter regex in `lib/cloze.ts`, gender/case tables in `lib/exercises/mistake.ts`, `de-DE` in `lib/speech.ts`, "German" in the AI prompt, gender colors in `ArticleBadge`. This task gathers them into a `LanguagePack` and makes the code read from it. **German behavior must not change by a single character**: the German pack is exactly today's logic, and every existing test stays green. It is a pure refactor plus the proof that a second language can plug in.

Part of the plan: 041 (this), 042 (bank schema neutral names, pack-driven bank), 043 (templated UI strings), 044–046 (Spanish), 047 (app variant, build scripts), 048 (store/legal), 049 (QA).

## Scope

### In
- `LanguagePack` type and a `de` pack holding today's rules.
- A single "active pack" accessor, fixed to `de` for now (the variant wiring is TASK-047).
- Pure functions in `lib/` take an optional trailing `pack` argument (default: the active pack) so tests can pass a fake language without global state.
- Features a language lacks are expressed as `null` in the pack and degrade gracefully (no case drill, no gender slot in "find the mistake", no article drill).
- A fake `testPack` (Spanish-like: accents, no cases, `el/la`) used to prove the abstraction.

### Out
- Renaming `example_de`, `exampleDe`, `de:` in the AI JSON, or the word-bank loader (TASK-042).
- Any UI string, "tedesco/German" wording, `grammar_rule_*` keys (TASK-043/044).
- App variants, package names, icons (TASK-047).
- Any Spanish content or pack (TASK-044/045). Only the test pack exists here.
- Changing the DB, backups, the SRS or exercise selection.

## Acceptance Criteria
- [ ] `src/languages/` exists with `types.ts`, `de.ts`, `index.ts` (`getActivePack()`, `setActivePackForTests()`), and no German literal remains outside `src/languages/de.ts` in the files listed under "Files to modify" (check with grep: `der|die|das|einen|dem|des|eines|ß|äöü|de-DE|German` in those files only appears in comments or the pack).
- [ ] The `de` pack reproduces the old constants exactly (a characterization test compares each field to literal expected values copied from the old code).
- [ ] All existing tests pass **unchanged** except renames forced by moved exports (list them in the commit message). `tsc` clean. `npm test` green.
- [ ] With the fake `testPack` passed or set active: typed answer `cafe` for `café` is `close`, `Cafe` / `cafe` for `Café` is `close`/`exact` per the pack's fold; `LETTERS` accepts `ñ` and accents; the case drill yields no questions; "find the mistake" builds only gender mistakes (articles `el/la`) and returns `null` for a sentence with only a case slot; the article drill uses `el/la` options.
- [ ] When `pack.cases` is `null`, `buildDrill` adds no case questions and `GrammarScreen` shows only the article drill (no crash on empty pools).
- [ ] TTS uses `pack.speech.locale` and `rate`; the AI system prompt and example prompt use `pack.ai.languageName` and produce the **identical** string for German as before (existing `ai.test.ts` untouched).
- [ ] `ArticleBadge` keeps today's colors for `der/die/das` and unknown articles; a pack gender map drives it.
- [ ] No new dependency; no runtime behavior change on a phone (spot-check one session of each exercise format in the German app).
- [ ] `CONTEXT.md` updated.

## Technical Spec

### Files to create
```
mobile/src/languages/types.ts           — LanguagePack and its parts
mobile/src/languages/de.ts              — the German pack (today's rules, moved)
mobile/src/languages/index.ts           — active pack accessor
mobile/test-support/testPack.ts          — fake Spanish-like pack (not shipped; tests only)
mobile/__tests__/languagePack.test.ts   — characterization of `de` + abstraction proof with `testPack`
```

### Files to modify
```
mobile/src/lib/cloze.ts                  — letters regex and fold from the pack; gradeTypedAnswer/isAnswerCorrect/buildCloze take optional pack
mobile/src/lib/grammar.ts                — ARTICLES, RULE_FORMS, DEFINITE/INDEFINITE, TWO_WAY from pack; builders take optional pack
mobile/src/lib/exercises/mistake.ts      — GENDER_FORMS, NEVER_VALID, PLURAL_LOOKALIKE, DATIVE/ACCUSATIVE_PREPOSITIONS, ruleForCaseForm, quote regexes from pack
mobile/src/lib/speech.ts                 — speakGerman → speak (locale/rate from pack); speechText unchanged
mobile/src/hooks/useSpeech.ts            — call `speak`
mobile/src/lib/ai/wordInsight.ts         — "German" from pack.ai.languageName
mobile/src/services/grammarService.ts    — `CASE_RULES` and article rule via pack; skip case questions when pack.cases is null
mobile/src/screens/GrammarScreen.tsx     — ARTICLE_RULE and rule gating via pack
mobile/src/components/ui/ArticleBadge.tsx— gender tone from pack.articles.genderOf
mobile/__tests__/*                       — only mechanical renames (speakGerman → speak, moved exports)
CONTEXT.md
```
`lib/exercises/types.ts`, `quality.ts`, `registry.ts`, `practice.ts`, `reorder.ts`, `distractors.ts` keep their logic; they already call `buildCloze`, `shuffle` and friends, which now read the pack. Do not rename `exampleDe` (TASK-042).

### Implementation notes

**`languages/types.ts`**
```ts
export type TargetLanguageCode = 'de';           // widened by later tasks ('es', 'fr', …)
export type Gender = 'm' | 'f' | 'n';

export interface ArticleSupport {
  /** Definite articles in drill order, e.g. ['der','die','das']. */
  forms: readonly string[];
  /** Rule code used for the article question (grammar_rule_<code> string). */
  rule: string;
  /** Article → gender, for badge color (der m, die f, das n). Unknown article → undefined. */
  genderOf(article: string): Gender | undefined;
}

export interface GenderSupport {
  /** Forms that can precede the noun in SOME case, per article (documentation/tests). */
  forms: Record<string, string[]>;
  /** Forms that are never valid before a singular noun taking this article. */
  neverValid: Record<string, string[]>;
  /** Nouns whose plural looks like the singular (skip risky gender mistakes). */
  pluralLookalike: RegExp;
  /** Article that is skipped for lookalike nouns ('das'); and the only safe wrong forms for 'der'. */
  lookalikeRules: { skipArticle: string; onlyWrongFor: Record<string, string[]> };
}

export interface CaseSupport {
  /** Rule code → determiner forms that fix the case on their own. */
  ruleForms: Record<string, readonly string[]>;
  definiteForms: readonly string[];
  indefiniteForms: readonly string[];
  /** Prepositions after which two cases are grammatical (the blank would be ambiguous). */
  twoWayPrepositions: ReadonlySet<string>;
  /** Which explanation fits a case-fixing determiner (both args lower-case). */
  ruleForForm(form: string, previousWord: string): string;
}

export interface LanguagePack {
  code: TargetLanguageCode;
  /** English name, used in AI prompts ("German"). */
  name: string;
  /** Letters that make up a word, with ONE capture group (what `LETTERS` was). */
  letters: RegExp;
  /** Lower-case, trim and fold the accents/letters a learner may slip on (ß→ss, ä→a …). */
  fold(s: string): string;
  /** Min length of a target word for one typo to count as `close`. */
  typoMinLength: number;                   // 5 today
  /** Quote/punctuation split off a token (find-the-mistake, reorder). */
  punctuation: { lead: RegExp; trail: RegExp };
  speech: { locale: string; rate: number };       // 'de-DE', 0.9
  ai: { languageName: string; exampleKey: string };  // 'German', 'de' (JSON key, renamed in 042)
  articles: ArticleSupport | null;
  gender: GenderSupport | null;            // null → no gender slot in find-the-mistake
  cases: CaseSupport | null;               // null → no case drill, no case slot
}
```
The Developer may adjust member names only if the characterization test still reads the same values; the *shape* (nullable `articles`/`gender`/`cases`, a `fold`, `letters`, `punctuation`, `speech`, `ai`) is fixed.

**`languages/de.ts`** — move, do not rewrite:
- `letters = /([A-Za-zÄÖÜäöüß]+)/`; `fold` = `trim().toLowerCase()` + `ß→ss`, `ä→a`, `ö→o`, `ü→u` (today's `normalize`).
- `typoMinLength = 5`.
- `punctuation.lead = /^[„"«(‹‚“‘']+/`, `trail = /[.,!?;:“”"»)›’'…]+$/`.
- `speech = { locale: 'de-DE', rate: 0.9 }`; `ai = { languageName: 'German', exampleKey: 'de' }`.
- `articles.forms = ['der','die','das']`, `rule = 'NOUN_GENDER'`, `genderOf`: der→m, die→f, das→n.
- `gender`: `GENDER_FORMS`, `NEVER_VALID`, `/(er|el|en|chen|lein)$/i`, lookalike rule (skip `das`; for `der` only `['das']`).
- `cases`: `RULE_FORMS` (ACCUSATIVE_MASC/PREP `einen`; DATIV_* `dem,einem`; GENITIV_CASE `des,eines`), `DEFINITE_FORMS`, `INDEFINITE_FORMS`, the two-way set, and `ruleForForm` (the old `ruleForCaseForm` with its dative/accusative preposition sets).

**`languages/index.ts`**
```ts
import { de } from './de';
let active: LanguagePack = de;
export const getActivePack = (): LanguagePack => active;
/** Tests only. Always restore in afterEach. */
export function setActivePackForTests(p: LanguagePack | null): void { active = p ?? de; }
```
No React context, no module-level reads elsewhere: functions call `getActivePack()` at call time (not at import) so a test switch is effective.

**Pure functions** — add `pack: LanguagePack = getActivePack()` as the **last** parameter (after `rng`): `buildCloze(sentence, word, pack?)`, `gradeTypedAnswer(answer, word, pack?)`, `isAnswerCorrect`, `buildCaseCloze(sentence, ruleCode, pack?)`, `caseOptions(answer, rng, pack?)`, `buildArticleQuestion(entry, rng, pack?)`, `buildCaseQuestion(entry, rng, pack?)`, `buildFindMistake(card, rng, pack?)`, `splitToken(token, pack?)`. Keep exported names that other modules/tests import (`LETTERS`, `ARTICLES`, `CASE_RULES`, `GENDER_FORMS`, …) as thin re-exports of the **active German** values only if an existing test imports them; otherwise remove them and fix the import. Do not keep dead duplicates.

**Behavior with `null` parts**
- `articles === null` → `buildArticleQuestion` returns `null`; `GrammarScreen` hides the article option.
- `cases === null` → `buildCaseCloze`/`buildCaseQuestion` return `null`; `CASE_RULES` is `[]`; find-the-mistake has no case slot.
- `gender === null` → no gender slot. Both null → `buildFindMistake` returns `null` and the format is simply unavailable (the registry already falls through on `null`, and `practice.ts` availability asks the builder).
- `fold` is the only place accents are folded; `gradeTypedAnswer` stays: exact (case-insensitive, NFC) → `close` if `fold(a) === fold(w)` or one typo on a word of `typoMinLength`+ letters → else `wrong`.
- Capitalization helpers (`capitalize`, `matchCase`) stay generic.

**`speech.ts`**: `speak(text, handlers)` replaces `speakGerman`; `Speech.speak(text, { language: pack.speech.locale, rate: pack.speech.rate, … })`. Keep `speechText`, `stopSpeaking`. The once-per-session "voice unavailable" alert text still says German until TASK-043 (do not touch strings).

**`wordInsight.ts`**: replace the three "German" occurrences with `pack.name`/`pack.ai.languageName`, and the JSON key `"de"` with `pack.ai.exampleKey`. Parsing keeps reading `de` (renamed in 042).

**`ArticleBadge`**: look up `pack.articles?.genderOf(article)` → `m`→`derBlue*`, `f`→`diePink*`, `n`→`dasGray*`; no pack match → `mist/muted` as today. Color token names stay (renamed in a later design task).

**Fake `testPack`** (tests only): `code` cast to `'de'` or the type widened to `string` in the helper via a cast; `letters = /([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)/`; `fold` strips accents (`é→e`, `ñ→n`); `articles.forms = ['el','la']`, `genderOf`: el m, la f; `gender` with `NEVER_VALID` `el: ['la']`, `la: ['el']`, `pluralLookalike = /$^/`; `cases = null`; `punctuation` adds `¿¡`; `speech = { locale: 'es-ES', rate: 0.9 }`.

## Tests (write first, watch them fail)
`languagePack.test.ts`:
- `de` characterization: every field equals literal expected values (articles, rule codes, regexes' `.source`, speech, ai, `ruleForForm('des','x') === 'GENITIV_CASE'`, `('einen','für') === 'ACCUSATIVE_PREP'`, `('dem','mit') === 'DATIV_PREP'`).
- Active pack defaults to `de`; `setActivePackForTests(testPack)` switches and `null` restores.
- With `testPack`: `gradeTypedAnswer('cafe','café') === 'close'`, `('Café','café') === 'exact'`, `('cafés','café')` wrong for a 4-letter word, close for 5+ with one typo; `buildCloze('¿Dónde está el baño?','baño')` finds `baño`; `buildCaseCloze(...)` is `null`; `buildArticleQuestion({word:'casa',article:'la',…})` has options `['el','la']` in some order and answer `la`; `buildFindMistake` on `"El perro come la carne"` with card `perro/el` returns a `gender` mistake whose wrong form is `la`; with a sentence lacking an article it returns `null`; `buildDrill`-level: no case questions with `testPack` (use `grammarService` with mocked bank or test `buildPools` through `buildDrill` with a small mocked `WORD_BANK` if simpler).
- `speak` passes `language: 'de-DE'` by default and `'es-ES'` with `testPack`.
- `buildPrompt` for German is byte-identical (existing `ai.test.ts` already covers it; add one assertion with `testPack` that the prompt contains its `name`).
- `ArticleBadge`: `der` → blue, `die` → pink, `das` → gray (existing snapshot test stays), `el` with `testPack` → blue.
- Guard check: make `getActivePack()` ignore the override and confirm the abstraction tests go red; make `gradeTypedAnswer` skip `fold` and confirm the `cafe` test goes red.

Existing suites that must stay green without edits beyond renames: `cloze`, `grammar`, `mistake`, `speech`, `useSpeech`, `ai`, `exercises*`, `practice*`, `ReviewScreen*`, `GrammarScreen` flows, `uiStringsParity`.

## Definition of Done
- [ ] Acceptance criteria checked; tests written first, red then green; German snapshot and prompt tests unchanged
- [ ] `npx tsc --noEmit` and `npm test` green from `mobile/`
- [ ] Spot-checked on a phone: one German review session (typed, reorder, find-the-mistake, multiple choice), the grammar drill, the speaker button
- [ ] Review of the diff: no German literal left outside `languages/de.ts`; no unrelated files
- [ ] Conventional commit: `refactor(TASK-041): LanguagePack — language rules behind one interface`
- [ ] `CONTEXT.md` updated, status `done`

## Notes for Tech Lead (remove before handing over)
- Rejected: a runtime language switch inside one app (each app is one target language; a build-time pack keeps bundles small and avoids stale learner data across languages); React context for the pack (pure functions already take injectable arguments, which is the codebase's pattern); inheriting from a base class (a plain data object with nullable parts is easier to test).
- Spanish will not fit `cases`: it needs its own rule family (ser/estar, por/para, subjunctive). TASK-044 adds an optional `rules` part (a generic "pick the right form" drill) rather than stretching `CaseSupport`. Keep `CaseSupport` German-shaped here.
- `distractors.ts` and `catalog.ts` read the German bank directly; TASK-042 makes the bank load through the pack. Do not touch them now.
- The word bank's `meaning_it`/`meaning_en` assumption (Italian primary) stays; Spanish uses the same fields.
