# TASK-022 — New exercise format: "Find the mistake"

**Status:** `done` (uncommitted, awaiting Product Owner review)
**Assigned to:** Developer
**Written by:** Tech Lead
**Depends on:** TASK-019, TASK-020, TASK-021 (engine, formats, free practice) — all on `main`.

---

## Context

The exercise formats so far test *recall* (typing, choosing a meaning) and *word order* (reorder). None trains the thing German
learners get wrong most: **articles and case endings**. "Find the mistake" shows a saved word's example sentence with **one deliberately
wrong determiner** and asks two things: *tap the wrong word*, then *pick the right form*. It builds on the grammar machinery already in the app
(`lib/grammar.ts`, the case rules, the `grammar_rule_*` explanations) and appears in both the scheduled review and free practice.

Scope decision (Tech Lead): the roadmap paired this with a compound-noun builder. **The data says no for now:** only **46** of the 2,194 bank words
are compounds whose parts are also in the bank (2 %), so a learner with 100 saved words would meet about two of them. It becomes its own task, with a content
step first (see "Notes"). This task is *Find the mistake* only.

---

## Scope

### In scope
- A pure builder `buildFindMistake(card, rng)` that corrupts exactly one determiner of the card's example sentence — two kinds:
  - **gender:** the article directly before the target noun is replaced by a form that is *never* valid for that noun's gender;
  - **case:** a case-fixing determiner (`dem, einem, einen, des, eines`) is replaced by another form of the same family.
- A `find_mistake` exercise definition in the registry (review tiers `learning`/`strong`, weight 1) and a view with the two steps.
- Free practice: a new "Trova l'errore / Find the mistake" format in the menu, selection, availability and Mixed.
- A format quality ceiling, i18n (it + en), tests.

### Out of scope
- The compound-noun builder (→ TASK-023, content first).
- Updating `grammar_mastery` from these results (they only grade the word's schedule, like every other format; linking to the grammar drill is a later task).
- Other mistake types (verb position, adjective endings, tense), indefinite-article gender mistakes, and multiple mistakes per sentence.
- A "report this sentence" feature.

---

## Acceptance Criteria

- [ ] AC1: A corrupted sentence differs from the original in **exactly one token**; punctuation attached to that token and its capitalisation are preserved.
- [ ] AC2: **Gender kind** applies only when the token directly before the target word (case-insensitive, punctuation stripped) equals the card's article (`der|die|das`) and the card is a noun.
      The replacement comes from the never-valid set for that gender (`der`→`die|das`, `die`→`das|den|dem|des`, `das`→`der|die|den`).
      **Review amendment:** nouns ending in `-er -el -en -chen -lein` can have a plural identical to the singular, so *neuter* ones are skipped (every article form is valid for some case, singular or plural) and for *masculine* ones only `das` is used.
- [ ] AC3: **Case kind** applies to the first token in `{dem, einem, einen, des, eines}` that is **not** directly after a two-way preposition
      (`an auf hinter in neben über unter vor zwischen`, where dative and accusative both fit). The replacement is another form of the same family
      (definite: `der die das dem den des`; indefinite: `ein eine einen einem einer eines`).
- [ ] AC4: Sentence length 4–12 tokens; the card must have an example sentence; otherwise `null`. When both kinds are available the kind is chosen by `rng() < 0.5` (gender first).
- [ ] AC5: The fix step offers **three** forms: gender → `der, die, das`; case → the original form plus two distractors from its family (`caseOptions`). Exactly one is the correct form;
      options carry the same capitalisation as the slot.
- [ ] AC6: Quality: tapped the right word **and** picked the right form → 0.9; right word, wrong form → 0.4; wrong word → 0 (no fix step; the real mistake is revealed).
- [ ] AC7: After the exercise the matching `grammar_rule_<RULE>` explanation is shown (`NOUN_GENDER`, `ACCUSATIVE_MASC`, `ACCUSATIVE_PREP`, `DATIV_PREP`, `DATIV_INDIRECT_OBJ`, `GENITIV_CASE`).
- [ ] AC8: Registry: `find_mistake` is offered to `learning` and `strong` words that qualify; the other formats' behaviour is unchanged. A clean answer never takes a ≥ 0.9 card below 0.9.
- [ ] AC9: Practice: six formats in the menu (new one before "Scrivi la parola"); "Find the mistake" is enabled only if a saved word qualifies; Mixed includes it; selection only draws words it can be built for.
- [ ] AC10: Over the **real word bank** at least **500** entries qualify, and for every qualifying entry all invariants (AC1–AC5) hold.
- [ ] AC11: `tsc --noEmit` clean; no hard-coded strings; every touchable has role + label; keys identical in both languages; all existing tests pass after the mechanical updates listed below.

---

## Technical Spec

### Files to create
```
mobile/src/lib/exercises/mistake.ts                    — pure builder and helpers
mobile/src/components/exercises/FindMistakeView.tsx    — the two-step view
mobile/__tests__/mistake.test.ts                       — builder, invariants, real-bank properties
```

### Files to modify
```
mobile/src/lib/grammar.ts                  — export what the builder shares (see below)
mobile/src/lib/exercises/types.ts          — 'find_mistake' kind, FindMistakeModel, union
mobile/src/lib/exercises/quality.ts        — FORMAT_QUALITY.find_mistake
mobile/src/lib/exercises/registry.ts       — FIND_MISTAKE definition; DEFAULT_REGISTRY order
mobile/src/lib/exercises/practice.ts       — 'find_mistake' format (list, config, canPractice)
mobile/src/lib/exercises/index.ts          — export mistake
mobile/src/screens/ExerciseSession.tsx     — one more case in the exhaustive switch
mobile/src/i18n/it.ts, en.ts               — strings
mobile/__tests__/…                         — mechanical updates (below) and the new cases
```

### `lib/grammar.ts` — export (no behaviour change)
`TWO_WAY_PREPOSITIONS` (set), `DEFINITE_FORMS`, `INDEFINITE_FORMS` (the arrays now named `DEFINITE` / `INDEFINITE`, exported under these names; keep the internal uses working),
and `CASE_FORMS` = the distinct forms in `RULE_FORMS` (`einen dem einem des eines`). `caseOptions` is already exported.

### Model (`types.ts`)
```ts
export type ExerciseKind = … | 'find_mistake';
export interface FindMistakeModel {
  kind: 'find_mistake';
  card: ReviewCard;
  mistakeKind: 'gender' | 'case';
  ruleCode: string;          // NOUN_GENDER | ACCUSATIVE_MASC | ACCUSATIVE_PREP | DATIV_PREP | DATIV_INDIRECT_OBJ | GENITIV_CASE
  tokens: string[];          // the sentence as shown: exactly one token is wrong
  wrongIndex: number;
  correctToken: string;      // what tokens[wrongIndex] originally was (case and punctuation as in the sentence)
  options: string[];         // 3 bare forms for the fix step
  correctOption: number;     // index into options
}
// ExerciseModel gains FindMistakeModel
```

### `mistake.ts`
```ts
export const MISTAKE_MIN_TOKENS = 4;
export const MISTAKE_MAX_TOKENS = 12;
export const GENDER_FORMS: Record<'der'|'die'|'das', string[]>;      // forms valid before this noun in SOME case: der→[der,den,dem,des] die→[die,der] das→[das,dem,des]  (documentation + tests)
export const NEVER_VALID: Record<'der'|'die'|'das', string[]>;        // der→[die,das]  die→[das,den,dem,des]  das→[der,die,den]
export function splitToken(token: string): { lead: string; core: string; trail: string }   // lead/trail = leading/trailing quotes & punctuation „"«( and .,!?;:“"»)
export function ruleForCaseForm(form: string, previousWord: string): string
export function mistakeQuality(found: boolean, fixed: boolean): number
export function buildFindMistake(card: ReviewCard, rng: Rng): FindMistakeModel | null
```
**`ruleForCaseForm(form, prev)`** (both lower-case): `des|eines` → `GENITIV_CASE`; `einen` → `ACCUSATIVE_PREP` if `prev ∈ {durch, für, gegen, ohne, um}` else `ACCUSATIVE_MASC`;
`dem|einem` → `DATIV_PREP` if `prev ∈ {aus, bei, mit, nach, seit, von, zu}` else `DATIV_INDIRECT_OBJ`.

**`buildFindMistake` algorithm** (rng is consumed in exactly this order, so tests with seeded rngs are reproducible):
1. `null` unless `card.exampleDe`; `tokens = exampleDe.trim().split(/\s+/)`; `null` unless `MISTAKE_MIN_TOKENS ≤ tokens.length ≤ MISTAKE_MAX_TOKENS`.
2. **Gender slot:** if `card.partOfSpeech === 'noun'` and `card.article ∈ {der,die,das}`: the first `j ≥ 1` with `core(tokens[j]).toLowerCase() === card.word.toLowerCase()` **and**
   `core(tokens[j-1]).toLowerCase() === card.article` → slot `{ kind: 'gender', index: j-1 }`.
3. **Case slot:** the first `i` with `core(tokens[i]).toLowerCase() ∈ CASE_FORMS` and `core(tokens[i-1]).toLowerCase() ∉ TWO_WAY_PREPOSITIONS` (`i = 0` has no previous word) → `{ kind: 'case', index: i }`.
4. No slot → `null`. One slot → use it. Both → `rng() < 0.5 ? gender : case` (one `rng()` call).
5. **Wrong form:** gender → `NEVER_VALID[article][Math.floor(rng() * length)]`; case → pick from the original's family (`DEFINITE_FORMS` or `INDEFINITE_FORMS`) without the original: `list[Math.floor(rng() * list.length)]`.
6. Rebuild the slot token as `lead + matchCase(wrong, core) + trail`, where `matchCase` capitalises the first letter iff `core` starts with an upper-case letter. Every other token is untouched.
7. **Options:** gender → `shuffle(['der','die','das'], rng)`; case → `caseOptions(originalCore.toLowerCase(), rng)`. Apply `matchCase` to each option with the slot's `core`.
   `correctOption` = index of the option equal to `matchCase(originalCore.toLowerCase())`.
8. `ruleCode`: gender → `NOUN_GENDER`; case → `ruleForCaseForm(originalCore.toLowerCase(), previousWord)`.
9. Return `{ kind: 'find_mistake', card, mistakeKind, ruleCode, tokens: corrupted, wrongIndex, correctToken: originalToken, options, correctOption }`.

Why these sets are safe (also a code comment): a never-valid article cannot belong to that noun's gender in *any* case, so the sentence is wrong whatever the case; for the case kind the following noun and the governing word fix the case, so
any other form of the family is wrong in that slot — and two-way prepositions are excluded because both `dem` and `den` can be right after them.
If the bank has two rows for the same word with different articles (e.g. *der See* / *die See*), the strict equality with the card's own article protects against using the other row's sentence.

### Registry (`registry.ts`) and quality
```ts
FIND_MISTAKE: { kind: 'find_mistake', tiers: ['learning','strong'], weight: 1, build: (card, rng) => buildFindMistake(card, rng) }
DEFAULT_REGISTRY = [TYPED_CLOZE, SENTENCE_REORDER, FIND_MISTAKE, MULTIPLE_CHOICE, FLASHCARD]   // order matters for weighted picks
FORMAT_QUALITY.find_mistake = { fixed: 0.9, foundOnly: 0.4, missed: 0 }
mistakeQuality(found, fixed) = !found ? 0 : fixed ? 0.9 : 0.4
```
Rationale for 0.9: same context-evidence argument as reorder — a clean answer never takes a ≥ 0.9 card below 0.9 (extend the existing property test). 0.4 is below the pass mark on purpose: finding the error but not knowing the form is a miss for the schedule.

### Practice (`practice.ts`)
`PracticeFormat` gains `'find_mistake'`; `PRACTICE_FORMATS = ['mixed','matching','multiple_choice','sentence_reorder','find_mistake','typed_cloze']`.
`practiceConfig('find_mistake') = { registry: [anyTier(FIND_MISTAKE), FLASHCARD], groups: [], groupsOnly: false }`;
`canPractice(card, 'find_mistake', rng)` = `buildFindMistake(card, rng) !== null`. `mixed` picks it up automatically through `DEFAULT_REGISTRY`.

### View (`FindMistakeView.tsx`) — props `{ model, isRetry, onResult(quality) }`, no DB or SRS logic
State: `tapped: number | null`, `chosen: number | null`.
1. Retry tag as in the other views. Prompt `review_mistake_prompt`. The sentence translation (`pickLocalized(lang, card.exampleIt, card.exampleEn)`) below it.
2. The sentence as wrapped tappable chips, one per token (`testID mistake-token-<i>`, role `button`, label = the token). Tapping a token before step 2:
   - `i === wrongIndex` → `tapped = i`, step 2 opens (chip shown in the error style);
   - otherwise → result **missed**: the chip tapped is dimmed, the real mistake is highlighted, message `review_mistake_missed` with `{wrong, right}`; "Continua" → `onResult(0)`.
3. Step 2: prompt `review_mistake_fix_prompt` and three option buttons (`testID mistake-option-<k>`, label = the form). Choosing locks the options; the right one is shown in the success style.
   Right → message `review_correct`; wrong → `review_mistake_fix_was` with `{form: model.options[model.correctOption]}`.
4. After the exercise ends (any outcome) show the explanation `t('grammar_rule_' + ruleCode)`, then "Continua" → `onResult(mistakeQuality(found, fixed))`.
5. Tokens are not tappable once the exercise has ended.

### `ExerciseSession.tsx`
Add `case 'find_mistake': return <FindMistakeView key={position} model={model} isRetry={isRetry} onResult={onResult} />;` (the switch stays exhaustive).

### i18n (both files; keys identical)
```
review_mistake_prompt:      'Nella frase c\'è un errore. Toccalo.'          | 'There is a mistake in the sentence. Tap it.'
review_mistake_fix_prompt:  'Qual è la forma giusta?'                        | 'Which form is right?'
review_mistake_missed:      'L\'errore era «%{wrong}»: va scritto «%{right}».' | 'The mistake was “%{wrong}”: it should be “%{right}”.'
review_mistake_fix_was:     'Forma corretta: %{form}'                        | 'Correct form: %{form}'
practice_format_find_mistake: 'Trova l\'errore'                              | 'Find the mistake'
practice_desc_find_mistake: 'Individua e correggi l\'errore nella frase'     | 'Spot and fix the error in a sentence'
```
The `grammar_rule_*` strings already exist.

---

## Existing tests that must be updated mechanically
- `exerciseFormats.test.ts`: the "offers typed cloze or sentence reorder (2:1)" test passes an explicit registry `[TYPED_CLOZE, SENTENCE_REORDER, FLASHCARD]`
  (the default now also offers *find the mistake* to that card); the quality-ceiling property tests also loop over `FORMAT_QUALITY.find_mistake.fixed`.
- `practice.test.ts`: the formats array has six entries (order above); `practiceAvailability` expectations gain `find_mistake` (true for a word like *Brot* with `Ich kaufe das Brot beim Bäcker.`,
  false for words without a qualifying sentence).
- `PracticeScreens.test.tsx`: the menu lists the sixth label "Trova l'errore"; the empty-vault loop includes `find_mistake`.
- `ReviewScreenFormats.test.tsx`: the reorder block's card is `{ ...brotLearning, article: null }` (the gender kind needs an article) so reorder is still the only second candidate.

---

## Tests (write FIRST, see them fail)

`mistake.test.ts`
- `splitToken`: plain word, `„Haus,`, `Haus.`, quotes both sides, empty core.
- Slot detection: gender requires the article **directly** before the word and equal to the card's article (`das Haus`, `Das Haus` ✓; `ein Haus`, `dem Haus` for a `das` noun ✗); not for verbs or cards without an article; the word as part of a longer token (`Haustür`) does not count.
  Case slot: first of the five forms; skipped after each two-way preposition (parametrised); `i = 0` allowed.
- `buildFindMistake` on fixtures: exactly one token differs; `wrongIndex` points at it; `correctToken` restores the sentence; sentence-initial capital kept (`Das Haus …` → `Den Haus …`); attached punctuation kept; options are three unique forms with the
  slot's capitalisation and exactly one correct; gender replacement ∈ `NEVER_VALID[article]`; case replacement is in the family and ≠ original; `ruleCode` per branch of `ruleForCaseForm`; both kinds available → `rng` 0 gives gender and 0.9 gives case;
  `null` for: no sentence, 3-token and 13-token sentences, no slot, noun without article; deterministic for a seeded rng; the corrupted token is never one of the options' correct form.
- `mistakeQuality`: (true,true)=0.9, (true,false)=0.4, (false,*)=0.
- **Real bank:** at least 500 entries qualify (use the card fields as `fetchDueReviews` builds them); for each qualifying entry check AC1–AC5 and that `grammar_rule_<ruleCode>` exists in both languages. Report any failing entry; do not weaken the assertion.
- Registry/practice: a learning card that qualifies gets `find_mistake` at the right `rng` (weights typed 2 : reorder 1 : find 1; order above), a card that does not qualify never does; `canPractice`/`selectPracticeCards`/`practiceAvailability` for the new format; Mixed over `[0, 0.5, 0.9]` still reaches typed, reorder and choice.

`ReviewScreenFormats.test.tsx` — new `describe('ReviewScreen — find the mistake')` (spy on `Math.random` → 0.99, which makes `pickWeighted` choose the last candidate and leaves the shuffles unchanged; card *Haus*, article `das`, `Das Haus ist sehr groß.`, learning tier)
- Tapping the corrupted word (`Den`) opens the options; choosing `Das` → "Corretto!" + the `NOUN_GENDER` explanation → Continua → `gradeReview('c1', 0.9)`.
- Right word, wrong option → "Forma corretta: Das" → `gradeReview('c1', 0.4)` (a miss: the card returns with "Riprova").
- Wrong word → the reveal message with the real error → `gradeReview('c1', 0)`; no options are shown.
- Tokens are inert after the exercise; double tap on Continua grades once (same pattern as the other views).
- A case-kind fixture (e.g. `Ich spreche mit dem Lehrer.` with `Math.random` mocked so the case slot is used) shows the `DATIV_PREP` explanation.

`PracticeScreens.test.tsx`: format `find_mistake` runs a session of qualifying words, grades through `gradePractice`, and a vault with no qualifying sentence shows `practice_nothing`.

---

## Definition of Done
- [ ] AC1–AC11 checked; all new and existing tests green; `tsc --noEmit` clean
- [ ] No hard-coded strings; role + label on every touchable; errors via `console.error`, generic strings in the UI
- [ ] Manual check on a phone: a sentence with a visibly wrong article appears in Pratica → "Trova l'errore"; long sentences wrap; the explanation text fits
- [ ] A Product Owner spot-check of ~20 generated sentences (see Notes) found no sentence that is still grammatical after corruption
- [ ] Conventional commit: `feat(TASK-022): find the mistake exercise`
- [ ] Status → `done`; Product Owner updates `CONTEXT.md` (completed tasks, format list)

---

## Implementation notes and review fixes

- **Result:** 542 of 2,194 words qualify (433 with a gender exercise, 139 with a case exercise; some have both). 368 tests pass in 32 suites.
- **Review finding — plural look-alikes.** Reading generated samples showed *"Die Handelsabkommen wird neu verhandelt"*: for a noun whose plural equals its singular, the corrupted sentence reads as a plural with the wrong verb, so a learner could blame the verb and be marked wrong.
  Fixed as in the AC2 amendment (neuter -er/-el/-en/-chen/-lein skipped; masculine ones only get `das`). Found by a failing real-bank invariant test written first; the fix removed 17 words (559 → 542).
- **Checked on the data:** none of the 139 case sentences uses `dem`/`des` as a relative pronoun (0 after a comma, 0 before a personal pronoun); the 33 slots followed by a lower-case word are adjectives or an ordinal.
- **Smaller:** the word chips have a 44 px minimum width (short words like *ist*); the registry comment about ordering was corrected.

---

## Notes for Product Owner (Tech Lead's rationale)

- **Data check:** strictly eligible sentences before the review fix — gender kind 452, case kind 139, 561 words in total (26 % of the bank; 30 qualify for both); after the plural look-alike rule 542 qualify (see "Implementation notes"). Typical corruptions: *Ich kaufe **der** Brot beim Bäcker.*, *Die Bahnhof ist nicht weit von hier.*, *Ich fahre mit **der** Bus zur Arbeit.* — all clearly ungrammatical.
- **Why the strict rules:** an exercise that marks a *correct* sentence as wrong is worse than none. That is why the gender kind only corrupts to forms impossible for that gender, the case kind skips after two-way prepositions, and the article must sit directly before the noun. Residual risk: an unusual sentence where another case form is also acceptable (e.g. dative of *Kind*). The spot-check in the Definition of Done is the safety net; a "report" button is a later idea.
- **Two steps, not one:** tapping the error trains *noticing*, choosing the form trains *retrieval*. Finding it without knowing the fix scores 0.4 (a miss) on purpose.
- **Why not feed `grammar_mastery`:** these results grade the word's schedule like every other format. Linking them to rule mastery is a clean follow-up (the model already carries `ruleCode`).
- **Compound builder → TASK-023 (not written).** Only 46 bank words are compounds with both parts in the bank (e.g. *Parkplatz = Park + Platz*, *Zahnarzt = Zahn + Arzt*, *Jahreszeit = Jahr + es + Zeit*); the gender of a compound is the gender of its last part, which makes it a great teaching idea, but at 2 % reach it needs content first:
  a generator script (the 46 found are a seed list), a curated `compounds.tsv` of ~150–250 entries reviewed by the Product Owner, then the format (e.g. "Hand + Schuh → *der* Handschuh", with distractors that flip the article or the order).
- **Next:** TASK-023 (compounds, content first), more example sentences per word (also improves this format), linking results to grammar mastery.
