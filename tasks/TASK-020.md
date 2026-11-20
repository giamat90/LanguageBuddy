# TASK-020 — New exercise formats: multiple choice, matching pairs, sentence reorder

**Status:** `done` (merged to main 2026-10-08)
**Assigned to:** Developer
**Written by:** Tech Lead
**Depends on:** TASK-019 (exercise engine: registry, tiers, graded quality, session queue) — must be merged first.

---

## Context

TASK-019 built the engine but ships only two formats (typed cloze, flip-card). This task adds
three formats and turns the tiers into a real difficulty ladder:

| Tier | Meaning | Formats offered |
|---|---|---|
| `new` | first sighting, or retention < 0.6 | **matching pairs** (rounds of 4–5 new cards), **multiple choice** (single card), flip-card as fallback |
| `learning` | in between | **typed cloze** (weight 2), **sentence reorder** (weight 1), flip-card as fallback |
| `strong` | retention ≥ 0.85 and seen ≥ 4 times | same as `learning` |

Easy recognition formats feed fragile words; production formats feed stronger ones.
Recognition is weaker evidence than typing the word, so each format has a **quality
ceiling** (below) — a word cannot reach a clean "mastered" score through guessing alone.

Everything is offline and uses only the bundled word bank (no new data fields, no AI).

---

## Scope

### In scope
- `multiple_choice` single-card exercise (4 options, two directions) with smart distractors.
- `sentence_reorder` single-card exercise (tap tiles to rebuild the example sentence).
- `matching` **group** exercise (one screen, 4–5 cards at once) — requires a small
  extension of the session queue (group steps).
- Tier gating and weights in the registry; per-format quality ceilings.
- `ReviewCard` gains optional `partOfSpeech`, `cefrBand`, `topicDomain` (from the word bank).
- Three view components; `ReviewScreen` renders them; i18n (it + en); tests.

### Out of scope
- Find-the-mistake, compound builder, listening/TTS, plurals/verb forms, AI features.
- Hints for the new formats; timers/animations/haptics (keep UI state-driven so tests need no timers).
- Auto-detecting alternative valid German word orders (see "Reorder grading" — a manual override is used instead).
- Any change to the grammar drill, SRS thresholds, or the word bank JSON.
- Android < 24 (minSdkVersion is already 24).

---

## Acceptance Criteria

- [ ] AC1: Tier gating exactly as in the table above, driven by the registry (`tiers`), not by `if`s in the screen.
- [ ] AC2: `pickExercise` supports `weight` (default 1) using `pickWeighted`; typed cloze weight 2, reorder 1, multiple choice 1.
      TASK-019 behaviour for a single eligible definition is unchanged.
- [ ] AC3: Multiple choice: 4 options, unique, exactly one correct; distractors share the part of speech,
      come from the whole bank, never share a meaning token with the answer (either language) and
      never duplicate each other's meaning; build returns `null` (→ next candidate / flip-card) when fewer than 3 distractors exist.
- [ ] AC4: Direction: `to_native` (see word, pick meaning) always for `timesSeen <= 1`; otherwise `to_native` or `to_german` by `rng` (50/50).
- [ ] AC5: Sentence reorder: only for cards whose example contains the word and has 4–10 whitespace tokens;
      shuffled order never equals the solution; correct → quality 0.9, wrong → 0, "my sentence is also correct" → 0.5.
- [ ] AC6: Matching: a round has 4–5 cards of tier `new` whose native meanings are pairwise distinct (Italian and English);
      a wrong pairing counts one mistake for both involved cards; per-card quality 0.7 / 0.4 / 0 for 0 / 1 / ≥2 mistakes.
- [ ] AC7: Session planning: `createSession(cards, opts)` forms matching rounds first, singles after (original order);
      leftover cards (fewer than 4) stay singles. `total`/`gradedCount`/`progress` count **cards**, not steps.
- [ ] AC8: `submitGroupResult` grades each card of the round (first attempt), counts `firstTryCorrect`, and requeues each
      failing card as a **single** retry (`RELEARN_GAP`, `MAX_RETRIES` as in TASK-019). Retries are never graded in the DB.
- [ ] AC9: Quality ceilings: multiple choice 0.8, matching 0.7, reorder 0.9. A clean correct answer in any
      format never drops a retention score ≥ 0.9 below 0.9 (so it never shortens a 21-day interval), and
      multiple-choice / matching raise retention for every reachable `new`-tier card.
- [ ] AC10: Double-tap safety and `console.error` logging as in TASK-019, for the group path too.
- [ ] AC11: All TASK-019 behaviour still holds (existing tests pass after the listed mechanical updates);
      new tests green; `tsc --noEmit` clean; no hard-coded strings; accessibility labels on every touchable.

---

## Technical Spec

### Files to create
```
mobile/src/lib/exercises/distractors.ts   — pure MCQ builder + distractor picker
mobile/src/lib/exercises/reorder.ts       — tokenise / shuffle / grade
mobile/src/lib/exercises/matching.ts      — round builder + mistake→quality
mobile/src/components/exercises/MultipleChoiceView.tsx
mobile/src/components/exercises/MatchingView.tsx
mobile/src/components/exercises/SentenceReorderView.tsx
mobile/__tests__/exerciseFormats.test.ts  — builders, registry, quality properties
mobile/__tests__/exerciseGroups.test.ts   — session planning + group results
```

### Files to modify
```
mobile/src/lib/exercises/types.ts      — new kinds/models, weight, GroupExerciseDefinition
mobile/src/lib/exercises/quality.ts    — FORMAT_QUALITY
mobile/src/lib/exercises/registry.ts   — new definitions, weights, DEFAULT_GROUPS, weighted pick
mobile/src/lib/exercises/session.ts    — QueueEntry union, planning, submitGroupResult
mobile/src/lib/exercises/index.ts      — re-exports
mobile/src/services/reviewService.ts   — ReviewCard + fetchDueReviews: partOfSpeech/cefrBand/topicDomain
mobile/src/screens/ReviewScreen.tsx    — render the new kinds, group handler
mobile/src/i18n/it.ts, en.ts           — new strings
mobile/__tests__/exercises.test.ts     — mechanical updates (see "Existing tests")
mobile/__tests__/ReviewScreen.test.tsx — new screen cases
mobile/__tests__/wordFlow.test.ts or reviewGrading.test.ts — one case for the new ReviewCard fields
```

### Types (`types.ts`)
```ts
export type ExerciseKind = 'typed_cloze' | 'flashcard' | 'multiple_choice' | 'sentence_reorder';

export interface MultipleChoiceOption {
  id: string;            // lower-cased German word
  word: string;
  article: string | null;
  meaningIt: string;
  meaningEn: string;
}
export interface MultipleChoiceModel {
  kind: 'multiple_choice';
  card: ReviewCard;
  direction: 'to_native' | 'to_german';
  options: MultipleChoiceOption[];   // length 4, shuffled
  correctIndex: number;
}
export interface SentenceReorderModel {
  kind: 'sentence_reorder';
  card: ReviewCard;
  tokens: string[];     // shuffled
  solution: string[];   // original order
}
export type ExerciseModel = TypedClozeModel | FlashcardModel | MultipleChoiceModel | SentenceReorderModel;

export interface MatchingModel {
  kind: 'matching';
  cards: ReviewCard[];       // 4..5
  leftOrder: string[];       // card ids, shuffled independently of rightOrder
  rightOrder: string[];
}
export interface GroupExerciseDefinition {
  kind: 'matching';
  tiers: Tier[];
  minSize: number;           // 4
  maxSize: number;           // 5
  build(cards: ReviewCard[], rng: Rng): MatchingModel | null;   // may use a subset; model.cards.length >= minSize
}
// ExerciseDefinition gains:  weight?: number   // default 1
```

### ReviewCard (`reviewService.ts`)
Add optional fields `partOfSpeech?: string | null; cefrBand?: string | null; topicDomain?: string | null`,
filled in `fetchDueReviews` from the same bank lookup `exampleFor` already does (extend that index to
carry them; `null` when the word is not in the bank). Optional so TASK-019 fixtures keep compiling.

### Quality (`quality.ts`)
```ts
export const FORMAT_QUALITY = {
  multiple_choice: 0.8,
  matching: [0.7, 0.4, 0] as const,   // by mistakes: 0, 1, 2+
  sentence_reorder: { exact: 0.9, selfApproved: 0.5, wrong: 0 },
} as const;
export function matchingQuality(mistakes: number): number   // index clamped to 2
```
Rationale (also in the code comment): recognition/context evidence is weaker than typing the word.
0.9 for reorder is chosen so a correct reorder never takes a ≥ 0.9 card below 0.9.

### Multiple choice (`distractors.ts`)
```ts
export interface DistractorSource {
  word: string; article: string | null; partOfSpeech: string;
  cefrBand: string; topicDomain: string; meaningIt: string; meaningEn: string;
}
export function getDistractorPool(): DistractorSource[]        // lazily built from allEntries(), cached
export function pickDistractors(card: ReviewCard, pool: DistractorSource[], rng: Rng, count?: number): DistractorSource[] | null   // count default 3
export function buildMultipleChoice(card: ReviewCard, pool: DistractorSource[], rng: Rng): MultipleChoiceModel | null
```
`pickDistractors`:
1. Require `card.partOfSpeech`, `card.translationIt`, `card.translationEn`; else `null`.
2. Hard filters on the pool: `word.toLowerCase() !== card.word.toLowerCase()`; `partOfSpeech === card.partOfSpeech`;
   both meanings non-empty; **no shared meaning token** with the correct answer in Italian or English.
   Token = lower-cased run of `[a-zà-öø-ÿß]` (case-insensitive) of length ≥ 3.
3. Score: `+2` same `cefrBand`, `+1` adjacent band, `+1` same `topicDomain`, plus `rng() * 1.5` jitter. Sort descending.
4. Take greedily while keeping all options' normalised Italian meaning **and** English meaning unique
   (normalise = lower-case, strip non-letters, collapse spaces). Stop at `count`.
5. Fewer than `count` → `null`.
Pool must come from the **whole bank**: some part-of-speech pools are tiny per level (e.g. 16 prepositions in total).

`buildMultipleChoice`: distractors → 4 options (card itself first) → shuffle with `rng` (Fisher–Yates, same helper style as `grammar.ts`)
→ `correctIndex`. Direction: `timesSeen <= 1` ? `'to_native'` : `rng() < 0.5 ? 'to_native' : 'to_german'`.
The correct option is built from the card (`word`, `article`, `translationIt/En`).

### Sentence reorder (`reorder.ts`)
```ts
export const REORDER_MIN_TOKENS = 4;
export const REORDER_MAX_TOKENS = 10;
export function tokenizeSentence(sentence: string): string[]          // trim, split on /\s+/ — punctuation stays attached
export function shuffleTokens(tokens: string[], rng: Rng): string[]  // Fisher–Yates; if result equals input, rotate left by 1
export function buildReorder(card: ReviewCard, rng: Rng): SentenceReorderModel | null
export type ReorderResult = 'exact' | 'wrong'
export function gradeReorder(placed: string[], solution: string[]): ReorderResult   // exact string-by-string equality
```
`buildReorder` returns `null` unless `buildCloze(card.exampleDe, card.word)` is non-null (the sentence contains the word)
and the token count is within `[4, 10]`. Duplicate tokens are fine (equality is on strings).
**Reorder grading:** German often allows several valid orders, so a mismatch is not always wrong. The view therefore offers,
after a mismatch, the correct sentence plus a button "La mia frase è corretta" (self-approved → quality 0.5).

### Matching (`matching.ts`)
```ts
export const MATCH_MIN = 4;
export const MATCH_MAX = 5;
export function buildMatchingRound(cards: ReviewCard[], rng: Rng): MatchingModel | null
```
Takes cards in order, skipping any whose native meaning (normalised, in Italian **or** English) collides with an already
chosen card or is empty, until `MATCH_MAX`. `< MATCH_MIN` usable → `null`. `leftOrder` and `rightOrder` are independent shuffles of the
chosen ids. The model's `cards` is the chosen subset (in original order).

### Registry (`registry.ts`)
```
TYPED_CLOZE      tiers ['learning','strong']   weight 2   (was: all tiers — behaviour change, intended)
SENTENCE_REORDER tiers ['learning','strong']   weight 1
MULTIPLE_CHOICE  tiers ['new']                 weight 1   build = buildMultipleChoice(card, getDistractorPool(), rng)
FLASHCARD        fallback
DEFAULT_REGISTRY = [TYPED_CLOZE, SENTENCE_REORDER, MULTIPLE_CHOICE, FLASHCARD]
MATCHING (group) tiers ['new'], minSize MATCH_MIN, maxSize MATCH_MAX
DEFAULT_GROUPS   = [MATCHING]
```
`pickExercise`: candidates as before; with more than one, choose with `pickWeighted(weights, rng)`
(`weight ?? 1`); with exactly one, no rng call. Candidate order = registry order.

### Session (`session.ts`)
```ts
export interface SingleEntry { kind: 'single'; card: ReviewCard; retry: number }
export interface GroupEntry  { kind: 'group';  model: MatchingModel; cards: ReviewCard[]; retry: 0 }
export type QueueEntry = SingleEntry | GroupEntry;

export interface SessionOptions { groups?: GroupExerciseDefinition[]; rng?: Rng }   // defaults: DEFAULT_GROUPS, Math.random
export function createSession(cards: ReviewCard[], opts?: SessionOptions): SessionState
export function submitGroupResult(s: SessionState, qualities: Record<string, number>): { state: SessionState; grades: GradeInstruction[] }
```
Planning (`createSession`):
1. `rest = cards`. For each group definition: `pool = rest.filter(tier ∈ def.tiers)`; while `pool.length >= def.minSize`:
   `model = def.build(pool.slice(0, def.maxSize), rng)`; if `null` stop this definition; else add a `GroupEntry`,
   remove `model.cards` from `pool` and `rest`.
2. Queue = group entries first, then `rest` as `SingleEntry` (retry 0) in original order.
3. `total = cards.length` (cards, not steps).
`submitGroupResult` (current entry must be a group, else return the state unchanged with `grades: []`):
- For every card of the group: `quality = toQuality(qualities[card.id] ?? 0)`; push `{cardId, quality}`.
- `gradedCount += cards.length`; `firstTryCorrect += passes`; `position += 1`.
- Each failing card (`quality < PASS_QUALITY`) is requeued as `SingleEntry` retry 1 at
  `min(position + 1 + RELEARN_GAP + i, queue.length)` (`i` = its index among the failing cards), inserted in order.
`submitResult` on a group entry is a no-op (`grade: null`, same state). `currentEntry` returns the union.
Immutability rules from TASK-019 still apply.

### Views (no DB/SRS logic inside; all take `onResult`)
**`MultipleChoiceView`** `{model, isRetry, onResult(quality)}`
- Retry tag as in TASK-019. Prompt label: `review_mc_prompt_native` / `review_mc_prompt_german`.
- `to_native`: prompt = `ArticleBadge` (if article) + word; options = native meanings (`pickLocalized(lang, meaningIt, meaningEn)`).
  `to_german`: prompt = native meaning of the card; options = `article + ' ' + word` (article only if present).
- Tapping an option locks all options; correct one gets the success style, a wrong tapped one the error style.
  Feedback: `review_correct`, or `review_mc_answer_was` with the correct label. Then "Continua" → `onResult(correct ? 0.8 : 0)`.
**`MatchingView`** `{model, onResult(qualities: Record<string, number>)}`
- Two columns: words (with `ArticleBadge`) in `leftOrder`, meanings in `rightOrder`. Prompt `review_match_prompt`.
- Tap one tile per column to select; when both are selected: same card id → both become matched (disabled);
  different ids → `mistakes[leftId]++` and `mistakes[rightId]++`, the selection clears, and the two tiles show the error style until the next tap.
  No timers.
- When all pairs are matched show "Continua" → `onResult(Object.fromEntries(cards.map(c => [c.id, matchingQuality(mistakes[c.id] ?? 0)])))`.
**`SentenceReorderView`** `{model, isRetry, onResult(quality)}`
- Shows the sentence translation (`exampleIt/En`), prompt `review_reorder_prompt`, an answer line, and the tile pool.
- Tap a pool tile → appended to the answer; tap an answer tile → back to the pool; "Ricomincia" empties the answer.
  Tiles are identified by their index in `model.tokens`.
- "Controlla" enabled only when all tiles are placed. `exact` → `review_correct`, "Continua" → `onResult(0.9)`.
  `wrong` → `review_reorder_correct_was` with the solution; two actions: "La mia frase è corretta" → `onResult(0.5)`,
  "Continua" → `onResult(0)`. "Non ricordo" (before checking) reveals the solution and counts as `wrong` without the override.
**`ReviewScreen`**: group entry → `<MatchingView key=position …>`; single entry → switch on `model.kind` (exhaustive).
Group results go through `submitGroupResult`; every returned grade calls `gradeReview` (failures → `console.error`).
Same stale-tap guard (`latest` ref) for both handlers. `pickExercise` is only called for single entries.

### i18n (add to both files; keys identical)
```
review_mc_prompt_native:   'Cosa significa?'                       | 'What does it mean?'
review_mc_prompt_german:   'Come si dice in tedesco?'              | 'How do you say it in German?'
review_mc_answer_was:      'Risposta: %{answer}'                   | 'Answer: %{answer}'
review_match_prompt:       'Abbina ogni parola al suo significato' | 'Match each word to its meaning'
review_reorder_prompt:     'Metti le parole nell\'ordine giusto'   | 'Put the words in the right order'
review_reorder_clear:      'Ricomincia'                            | 'Start over'
review_reorder_correct_was:'Frase corretta: %{sentence}'           | 'Correct sentence: %{sentence}'
review_reorder_mine_ok:    'La mia frase è corretta'               | 'My sentence is also correct'
```

---

## Existing tests that must be updated mechanically (TASK-019 → TASK-020)
- `exercises.test.ts`: tests that rely on `DEFAULT_REGISTRY` choosing typed cloze for a learning-tier card
  now pass an explicit `[TYPED_CLOZE, FLASHCARD]` registry (the default has two eligible formats now).
  The session helpers use `entry.kind === 'single' ? entry.card.id : 'group'`, and `currentEntry(s)` accesses are narrowed.
  `createSession(cards)` in those tests may pass `{ groups: [] }` to stay independent of planning.
- `ReviewScreen.test.tsx` fixtures need no change (their cards are learning tier; `Ich trinke Wasser.` has < 4 tokens, so no reorder).

---

## Tests (write FIRST, see them fail)

`exerciseFormats.test.ts`
- **Distractors (fixture pool):** picks 3, all same part of speech, none equal to the card, unique meanings; excludes a candidate
  sharing a ≥ 3-letter token with the correct meaning in Italian *or* English; excludes empty meanings; collapses duplicate
  meanings; prefers same band / topic when `rng = () => 0`; returns `null` with only 2 valid candidates; `null` when the card lacks part of speech or translations.
- **`buildMultipleChoice`:** 4 unique options, exactly one equals the card, `correctIndex` points at it; `timesSeen 1` → always `to_native`
  (try several rng values); `timesSeen 3` reaches both directions via `rng`; deterministic for a fixed rng.
- **Whole bank (real data):** for **every** word-bank entry used as a card (with its own part of speech / band / topic),
  `buildMultipleChoice` is non-null, options are unique, and no distractor shares a token with the answer. If any entry fails,
  report which — do not weaken the assertion.
- **Reorder:** `tokenizeSentence` keeps punctuation attached; `buildReorder` rejects 3-token and 11-token sentences and sentences without the
  word; `shuffleTokens` never returns the original order for any rng (including `() => 0.999…` that would leave it unchanged) and preserves the multiset;
  `gradeReorder` exact vs wrong, including duplicate tokens; **real bank:** at least 1,500 entries are reorder-eligible.
- **Matching:** `buildMatchingRound` with 5 usable cards → 5 cards, `leftOrder`/`rightOrder` are permutations of the ids; cards with a colliding
  meaning (either language) are dropped; fewer than 4 usable → `null`; `matchingQuality(0|1|2|9)` = `0.7|0.4|0|0`.
- **Registry:** `new` card with usable data → `multiple_choice`; `learning`/`strong` card with a ≥ 4-token example containing the word →
  `typed_cloze` for `rng = 0.5` and `sentence_reorder` for `rng = 0.9` (weights 2:1); `learning` card with a 3-token example → `typed_cloze` only;
  `learning` card without example → `flashcard`; `new` card whose part of speech has < 4 pool entries (fixture registry/pool) → `flashcard`.
- **Quality properties (use `updateRetentionScore` + `nextReviewDate`):** for `timesSeen` 2…30 and retention 0.90…1.00 (step 0.01), a reorder
  at 0.9 leaves retention ≥ 0.9; for `timesSeen` 1…30 and retention 0…0.59, quality 0.8 and quality 0.7 both strictly raise retention.

`exerciseGroups.test.ts`
- Planning: 9 `new` cards → two rounds (5 + 4) and no singles; 6 → one round + 1 single; 3 → three singles; 4 `new` + 3 `learning` → one round then
  the 3 learning singles in original order; cards with colliding meanings stay singles; `total` is the card count; `{ groups: [] }` disables grouping.
- `submitGroupResult`: grades every card of the round; `gradedCount`/`firstTryCorrect` count cards; failing cards are requeued as single retry-1 entries at the
  computed positions (including the "fewer cards than the gap" case); retries of those are never graded; a missing quality counts as 0; a
  `submitResult` on a group entry and a `submitGroupResult` on a single entry are no-ops; the input state is never mutated (deep-freeze).
- `progress` after a 5-card round shows `current = 6` of the total (never above total).

`ReviewScreen.test.tsx` additions (mock `reviewService` as before; use real bank words so the pool is real; control randomness with `jest.spyOn(Math, 'random')`)
- **Multiple choice:** a `new` card (`timesSeen 1`, Brot / pane / noun / A1 / food) shows 4 options; tapping `pane` → "Corretto!" → Continua →
  `gradeReview('c1', 0.8)`; tapping a wrong option → "Risposta: pane" → `gradeReview('c1', 0)` and the card returns with "Riprova", whose retry is not graded.
- **Matching:** 4 `new` cards render one round; matching all pairs correctly and pressing Continua → `gradeReview` called 4 times with 0.7;
  one wrong pairing then correct matches → the two involved cards graded 0.4 (and returned as retries), the other two 0.7.
- **Reorder:** a `learning` card with `Ich kaufe das Brot beim Bäcker.` and `Math.random` mocked to 0.99 → tiles tapped in solution order, Controlla →
  "Corretto!" → `gradeReview('c1', 0.9)`; wrong order → the correct sentence is shown and "La mia frase è corretta" → `gradeReview('c1', 0.5)`;
  wrong order + "Continua" → `gradeReview('c1', 0)`.
- **Double tap** on the matching round's Continua grades each card once.

`reviewGrading.test.ts` (or `wordFlow.test.ts`): `fetchDueReviews` returns `partOfSpeech`, `cefrBand`, `topicDomain` for a saved bank word.

---

## Definition of Done
- [ ] AC1–AC11 checked; all new and existing tests green; `tsc --noEmit` clean
- [ ] No hard-coded strings (it + en keys identical); accessibility role + label on every touchable tile/option
- [ ] Errors: `console.error` for logging, generic i18n strings only in the UI; no timers in the new views
- [ ] Manual check on a phone: a session with ≥ 4 new words shows a matching round first; layouts fit a small screen (5 pairs; 10-token reorder)
- [ ] Conventional commit: `feat(TASK-020): multiple choice, matching pairs and sentence reorder`
- [ ] Status → `done`

---

## Implementation notes and review fixes

- **Deviations from the spec:** the new screen tests live in `ReviewScreenFormats.test.tsx` (not appended to
  `ReviewScreen.test.tsx`); `shuffle` in `lib/grammar.ts` is now exported and reused; option/tile elements carry
  `testID`s (`mc-option-*`, `match-left-*`, `match-right-*`, `reorder-pool-*`, `reorder-placed-*`) for tests.
- **Review fix — duplicate reminders.** A matching round grades 4–5 cards at once and each `gradeReview` starts a
  reminder refresh without waiting for it. `scheduleReviewReminder` cancels then schedules one stored notification, so
  overlapping refreshes scheduled several and orphaned all but the last (duplicate "time to review" pushes).
  `refreshReviewReminder` now queues refreshes (each recomputes from the DB, a failed one does not block the next).
  Covered by `reminderSerial.test.ts` (failed first, 5 and 4 concurrent refreshes before the fix).
- **Data check passed:** a multiple-choice question can be built for all 2,194 words in the bank.

---

## Notes for Product Owner (Tech Lead's rationale)

- **Data check behind the thresholds:** 2,194 words; 1,670 nouns but only 16 prepositions and 17 conjunctions, which is why
  distractors come from the whole bank and not the learner's level. 1,717 words (78%) have an example of 4–10 tokens that contains the
  word, so reorder is available for most of the vault; the rest fall back to typed cloze / flip-card. Meanings are short (median 15, max 62 chars) so they fit buttons;
  8 duplicate Italian meanings exist, hence the token-overlap exclusion.
- **Behaviour change to expect:** typed cloze no longer appears for `new`-tier words (they get recognition formats first). A failed word
  that drops below retention 0.6 re-enters the easy formats and climbs back.
- **Why a quality ceiling per format:** otherwise a word could be "mastered" by multiple-choice guessing (25% chance). Ceilings are
  chosen so a correct answer still raises a fragile word and never shortens a long interval on a strong one.
- **Why the reorder override button:** German word order is flexible (fronting, TeKaMoLo). Judging alternatives offline is unreliable; a
  learner-approved override at 0.5 avoids unfairly resetting the schedule without pretending the app verified it.
- **Why matching is a group step:** it is the only format that is naturally set-based. The session keeps per-card grading, so SRS, retries and the
  summary all stay card-level.
- **Known limits:** matching with 5 pairs and reorder with 10 tiles are the largest layouts — verify on a small phone. Multiple choice
  can still be guessed; retries with fresh distractors partly compensate.
- **Next (TASK-021):** "find the mistake" (auto-corrupted sentences) and the compound-noun builder; then plural/verb data.
