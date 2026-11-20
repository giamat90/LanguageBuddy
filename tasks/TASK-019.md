# TASK-019 — Exercise engine for vocabulary review (registry, tiers, graded outcomes, relearning)

**Status:** `done` (merged to main 2026-10-08)
**Assigned to:** Developer
**Written by:** Tech Lead
**Depends on:** none (independent of TASK-018). Foundation for TASK-020 (new exercise formats).

---

## Context

`ReviewScreen` hard-codes two modes in one component (typed cloze, or flip-card when the
word has no example), grades only pass/fail, and never retries a missed card. Every new
exercise format would add more branches to that screen. This task introduces a small
**exercise engine** — pure, testable TypeScript — and moves the screen onto it, adds
graded outcomes (a typo or a hint is not a clean pass), a hint, and an in-session
relearning queue. **No new exercise formats** are added here; that is TASK-020.

Pure-function style follows `src/lib/cloze.ts` and `src/lib/grammar.ts` (injectable `rng`,
no React, no I/O) so everything below is unit-testable without rendering.

---

## Scope

### In scope
- `src/lib/exercises/`: types, tier computation, quality constants, registry + selection
  policy, pure session state machine.
- Two exercise definitions in the registry: `typed_cloze`, `flashcard` (behaviour of
  today's screen, now data-driven).
- Graded quality (0–1) end to end: answer grading → `gradeReview` → SRS score → review log.
- Typed-cloze feedback levels: exact / close ("Quasi!") / wrong.
- One-tap hint on typed cloze (first letter + letter count), which caps the quality.
- Relearning queue: a missed card comes back in the same session (not re-graded in the DB).
- Session summary on the finish screen (first-try accuracy).
- Thin `ReviewScreen` + two view components; i18n (it + en); tests.

### Out of scope
- New exercise formats (multiple choice, matching, sentence reorder, find-the-mistake,
  listening, …) → TASK-020+. The registry only has to make adding them trivial.
- The grammar drill (`GrammarScreen`, `grammarService`) — untouched.
- Hiding the word meaning for strong words. **Deliberately rejected:** the meaning is what
  disambiguates a cloze blank (many words fit "Ich trinke gern ___"); hiding it makes
  answers unfair. Do not add scaffold-fading in this task.
- AI-checked free production, TTS, new data fields.
- Changing SRS interval thresholds in `nextReviewDate`.

---

## Acceptance Criteria

- [ ] AC1: Card selection is unchanged for users: a due card whose example contains the
      word gets `typed_cloze`; otherwise `flashcard`. (Behaviour parity.)
- [ ] AC2: Selection goes through a registry: a definition declares the tiers it serves;
      the policy picks among matching non-fallback definitions, and only falls back to
      `flashcard` when none builds. A test proves tier-based selection with an injected
      fake registry (this is the extension point TASK-020 uses).
- [ ] AC3: Typed answers have three outcomes — `exact` (case-insensitive, umlauts and ß
      must match), `close` (umlaut/ß-folded match, or edit distance ≤ 1 on words of 5+
      letters), `wrong`. `isAnswerCorrect` keeps its signature/behaviour (true for exact
      and close) so `cloze.test.ts` still passes untouched.
- [ ] AC4: Quality mapping: exact → 1, close → 0.7, wrong / "Non ricordo" → 0, flashcard
      knew → 1, forgot → 0. Using the hint caps quality at 0.6 (never raises it).
- [ ] AC5: `gradeReview(itemId, outcome: boolean | number)` accepts a boolean (true→1,
      false→0, existing callers/tests unchanged) or a quality in [0,1] (clamped).
      Retention score uses the numeric outcome; `times_used` increments when quality ≥ 0.5;
      the review log row stores `was_correct` (quality ≥ 0.5) and the new `quality` value.
- [ ] AC6: `review_log` gets a nullable `quality REAL` column through the idempotent
      migration; old databases migrate, old backups (no such column) still restore, and
      new backups include it.
- [ ] AC7: Relearning: a first-attempt result with quality < 0.5 re-queues the card 3
      positions later (or at the end if fewer remain), at most 2 retries per card.
      Retries are NOT written to the DB (only the first attempt is graded). Retried cards
      show a "Riprova / Retry" tag.
- [ ] AC8: Header progress counts first attempts (`current` of `total`, where `total` is the
      number of due cards); retries do not inflate it.
- [ ] AC9: Finish screen shows `N su M al primo colpo` / `N of M right first time`
      (first-attempt quality ≥ 0.5) in addition to the existing done message.
- [ ] AC10: Hint button appears on typed cloze before checking; shows
      `Inizia con "H" · 4 lettere` / `Starts with "H" · 4 letters`; hidden after the answer
      is checked.
- [ ] AC11: A failure to load due cards is logged with `console.error` and shows the
      existing "nothing due" state; no raw error text in the UI.
- [ ] AC12: All existing tests pass; new tests below are green; `tsc --noEmit` clean.

---

## Technical Spec

### Files to create
```
mobile/src/lib/exercises/types.ts      — Tier, ExerciseKind, ExerciseModel union, ExerciseDefinition
mobile/src/lib/exercises/tier.ts       — tierOf(card)
mobile/src/lib/exercises/quality.ts    — constants + typedQuality() + toQuality()
mobile/src/lib/exercises/registry.ts   — DEFAULT_REGISTRY, pickExercise()
mobile/src/lib/exercises/session.ts    — pure session state machine
mobile/src/lib/exercises/index.ts      — re-exports
mobile/src/components/exercises/TypedClozeView.tsx
mobile/src/components/exercises/FlashcardView.tsx
mobile/__tests__/exercises.test.ts     — engine unit tests
mobile/__tests__/ReviewScreen.test.tsx — screen integration test
```

### Files to modify
```
mobile/src/lib/cloze.ts              — add gradeTypedAnswer(); isAnswerCorrect delegates to it
mobile/src/data/srs.ts               — updateRetentionScore accepts boolean | number
mobile/src/data/schema.ts            — ensureColumn(review_log, quality, 'quality REAL')
mobile/src/services/reviewService.ts — gradeReview(itemId, outcome: boolean | number)
mobile/src/screens/ReviewScreen.tsx  — thin shell over the engine
mobile/src/i18n/it.ts, en.ts         — new strings (keys must be identical in both)
mobile/__tests__/cloze.test.ts, srs.test.ts, schema.test.ts, backup.test.ts — additions
```

### Types (`types.ts`)
```ts
export type Tier = 'new' | 'learning' | 'strong';
export type ExerciseKind = 'typed_cloze' | 'flashcard';

export interface TypedClozeModel { kind: 'typed_cloze'; card: ReviewCard; before: string; after: string }
export interface FlashcardModel  { kind: 'flashcard';  card: ReviewCard }
export type ExerciseModel = TypedClozeModel | FlashcardModel;

export interface ExerciseDefinition {
  kind: ExerciseKind;
  tiers: Tier[];                 // tiers this exercise may be offered to
  fallback?: boolean;            // chosen only when no non-fallback definition builds
  build(card: ReviewCard, rng: Rng): ExerciseModel | null;   // null = not applicable to this card
}
```
`ReviewCard` stays exported from `reviewService.ts`; `Rng` from `lib/grammar.ts`.

### Tiers (`tier.ts`)
```ts
export function tierOf(card: Pick<ReviewCard, 'timesSeen' | 'retentionScore'>): Tier
```
- `'new'`   if `timesSeen <= 1` or `retentionScore < 0.6`
- `'strong'` if `retentionScore >= 0.85` and `timesSeen >= 4`
- otherwise `'learning'`
Export the three thresholds as named constants. (In this task both definitions serve all
tiers, so tiers have no visible effect yet — that is intentional.)

### Quality (`quality.ts`)
```ts
export const PASS_QUALITY = 0.5;
export const QUALITY = { exact: 1, close: 0.7, wrong: 0, hintCap: 0.6 } as const;
export type TypedResult = 'exact' | 'close' | 'wrong';
export function typedQuality(result: TypedResult, hintUsed: boolean): number  // wrong stays 0; else min(q, hintCap) if hint
export function toQuality(outcome: boolean | number): number                   // boolean→1/0, number clamped to [0,1], NaN→0
```

### Answer grading (`cloze.ts`)
```ts
export function gradeTypedAnswer(answer: string, word: string): TypedResult
```
- empty/whitespace → `'wrong'`
- `answer.trim().toLowerCase() === word.toLowerCase()` → `'exact'`
- folded (existing `normalize`) equal → `'close'`
- folded edit distance ≤ 1 and `word.length >= 5` → `'close'`
- else `'wrong'`
`isAnswerCorrect = gradeTypedAnswer(...) !== 'wrong'`. Rationale: German spelling matters,
so "Mutter" typed as "Mutter" is clean but "Muter"/"Mütter" is a near-miss, not a pass.
Import of the `TypedResult` type must not create a cycle (`quality.ts` imports nothing from `cloze.ts`).

### Registry & policy (`registry.ts`)
```ts
export const DEFAULT_REGISTRY: ExerciseDefinition[]   // [typed_cloze, flashcard(fallback)]
export function pickExercise(card: ReviewCard, registry = DEFAULT_REGISTRY, rng: Rng = Math.random): ExerciseModel
```
Algorithm:
1. `tier = tierOf(card)`.
2. Candidates = non-fallback definitions whose `tiers` include `tier`, mapped through
   `build(card, rng)`, dropping `null`s.
3. If candidates exist → pick uniformly with `rng` (one candidate → no randomness consumed
   beyond what `pickWeighted`-style uniform pick needs; keep deterministic for a given rng).
4. Else → the fallback definition's `build` (must never return null; `flashcard` always builds).
- `typed_cloze.build`: uses `buildCloze(card.exampleDe, card.word)`; `null` when absent.
- `typed_cloze.tiers` = all three; `flashcard.tiers` = all three, `fallback: true`.

### Session state machine (`session.ts`) — pure, immutable
```ts
export const RELEARN_GAP = 3;
export const MAX_RETRIES = 2;

export interface QueueEntry { card: ReviewCard; retry: number }       // retry 0 = first attempt
export interface SessionState {
  queue: QueueEntry[];
  position: number;           // index of the current entry
  total: number;              // number of distinct due cards at start
  gradedCount: number;        // first attempts answered so far
  firstTryCorrect: number;    // first attempts with quality >= PASS_QUALITY
}
export interface GradeInstruction { cardId: string; quality: number }

export function createSession(cards: ReviewCard[]): SessionState
export function currentEntry(s: SessionState): QueueEntry | undefined
export function submitResult(s: SessionState, quality: number): { state: SessionState; grade: GradeInstruction | null }
export function isFinished(s: SessionState): boolean
export function progress(s: SessionState): { current: number; total: number }   // current = min(gradedCount + 1, total)
```
`submitResult` rules:
- `quality = toQuality(quality)`.
- If `entry.retry === 0`: `grade = { cardId, quality }`, `gradedCount++`, `firstTryCorrect++` when `quality >= PASS_QUALITY`.
  Else `grade = null`.
- If `quality < PASS_QUALITY` and `entry.retry < MAX_RETRIES`: insert `{card, retry: retry+1}`
  at index `min(position + 1 + RELEARN_GAP, queue.length)`.
- `position++`. Never mutate the input state.

### Screen (`ReviewScreen.tsx`)
- Load with `fetchDueReviews()`; on error `console.error('[Review] failed to load due cards:', err)`
  and treat as empty (AC11). `createSession(cards)`.
- Per entry: `pickExercise(entry.card)` — **memoise per queue entry** (a re-render must not
  re-roll the exercise; key it on `position`).
- Render `<TypedClozeView>` or `<FlashcardView>` by `model.kind`. Each view receives
  `model`, `isRetry`, and `onResult(quality: number)` and owns its local UI state
  (answer text, revealed, hint shown). Views contain **no** DB/SRS logic.
- On `onResult(q)`: `const { state, grade } = submitResult(session, q)`; if `grade`,
  `await gradeReview(grade.cardId, grade.quality)` (log failures with `console.error`,
  do not block the UI); then set state.
- Finish: when `isFinished` → existing done / nothing-due message plus the summary line
  (only when `session.total > 0`).

### TypedClozeView behaviour
1. Prompt, sentence with `_____`, sentence translation + word meaning (as today).
2. "Suggerimento / Hint" button (hidden once checked): reveals
   `review_hint_text` with `{letter}` = first letter uppercased if the word is a noun
   (has article), else as written; `{count}` = letter count. Sets `hintUsed`.
3. Check → `result = gradeTypedAnswer(answer, word)`; show feedback:
   `exact` → `review_correct`; `close` → `review_almost` with the correct spelling;
   `wrong` → `review_answer_was`. "Non ricordo" → `wrong` without needing an answer.
4. Continue → `onResult(typedQuality(result, hintUsed))`.

### FlashcardView behaviour
Exactly today's flip-card: reveal → "Lo sapevo" → `onResult(1)`, "Non lo sapevo" → `onResult(0)`.

### SRS / service / schema
- `updateRetentionScore(currentScore, outcome: boolean | number, timesSeen)`:
  `outcome = typeof outcome === 'boolean' ? (outcome ? 1 : 0) : clamp01(outcome)`;
  rest of the formula unchanged (`updateMastery` alias keeps working).
- `gradeReview(itemId, outcome: boolean | number)`: `q = toQuality(outcome)`;
  `newScore = updateRetentionScore(row.retention_score, q, row.times_seen)`;
  `times_used += q >= PASS_QUALITY ? 1 : 0`; log insert includes `quality`.
- `schema.ts`: `await ensureColumn(db, 'review_log', 'quality', 'quality REAL')` in
  `runMigrations`. **Do not** add the column to the `CREATE TABLE` statement (the
  pre-migration simulation in tests relies on base statements only).
- Backup needs no code change (`SELECT *` / column-driven inserts) — covered by a test.

### i18n (add to both it.ts and en.ts; `language.test.ts` enforces identical keys)
```
review_hint:        'Suggerimento'                         | 'Hint'
review_hint_text:   'Inizia con "%{letter}" · %{count} lettere' | 'Starts with "%{letter}" · %{count} letters'
review_almost:      'Quasi! Si scrive: %{word}'            | 'Almost! It is spelled: %{word}'
review_retry_label: 'Riprova'                              | 'Try again'
review_summary:     '%{correct} su %{total} al primo colpo' | '%{correct} of %{total} right first time'
```
All new views: `accessibilityRole` + `accessibilityLabel` on every touchable. No hard-coded strings.

---

## Tests (write FIRST, see them fail)

`exercises.test.ts` (pure, no React)
- `tierOf`: new (timesSeen 1; retention < 0.6), learning (middle), strong (≥0.85 & ≥4 seen); boundaries.
- `typedQuality`: exact→1, close→0.7, wrong→0; hint caps exact to 0.6, close stays 0.6 (0.7→0.6),
  wrong stays 0. `toQuality`: true/false, clamp (-1→0, 2→1), NaN→0.
- `gradeTypedAnswer`: exact (case-insensitive, trimmed); `muter`/`Mutter` close; umlaut-folded
  `Mutter` for `Mütter` close; 1-typo on a 5+ letter word close; 1-typo on a 4-letter word wrong;
  empty wrong. `isAnswerCorrect` parity with the existing cases.
- `pickExercise`: card with example → `typed_cloze`; without → `flashcard`;
  injected fake registry `[fakeNewOnly (tiers ['new']), fakeStrongOnly (tiers ['strong']), flashcard fallback]`
  → a `new` card gets `fakeNewOnly`, a `strong` card gets `fakeStrongOnly`, a `learning` card
  gets the fallback; with two matching definitions the injected `rng` decides, deterministically.
- `session`: `createSession` totals; correct first try → grade instruction, `gradedCount`,
  `firstTryCorrect`, no requeue; wrong first try → requeued at `position + 1 + RELEARN_GAP`
  (and at the end when the queue is shorter); retry result → `grade === null`, `gradedCount`
  unchanged; third failure (`retry === MAX_RETRIES`) is not requeued; `progress` never exceeds
  `total`; `isFinished` after the queue is exhausted; input state never mutated (deep-freeze it).

`srs.test.ts` / `cloze.test.ts` additions
- `updateRetentionScore` with numeric 1 / 0 equals the boolean results; 0.7 lands strictly between.

`wordFlow.test.ts` / new `reviewGrading` cases (service level, using the sqlite mock)
- `gradeReview(id, 0.7)` stores `quality = 0.7`, `was_correct = 1`, increments `times_used`.
- `gradeReview(id, 0.3)` stores `was_correct = 0`, does not increment `times_used`.
- `gradeReview(id, true)` still works (existing assertion in `wordFlow.test.ts` unchanged).

`schema.test.ts`
- Running only the base STATEMENTS then `runMigrations` adds `review_log.quality`; running it twice is a no-op.

`backup.test.ts`
- A review_log row with `quality` round-trips; a legacy backup whose review_log rows have no
  `quality` key restores without error.

`ReviewScreen.test.tsx` (follow the pattern in `VaultScreen.test.tsx`; mock `reviewService`
and `expo-router`)
- Typed cloze, typo answer → shows the "Quasi!" feedback with the correct spelling, Continue
  calls `gradeReview(id, 0.7)`.
- Hint: tapping Hint shows the starts-with text; a correct answer afterwards grades 0.6.
- Wrong answer → `gradeReview(id, 0)` once; the same card reappears with the "Riprova" tag;
  answering it correctly does NOT call `gradeReview` again.
- Load failure → "nothing due" state and `console.error` called (spy), no raw error text rendered.
- Finish screen shows the first-try summary.

---

## Definition of Done
- [ ] AC1–AC12 checked; all new and existing tests green; `tsc --noEmit` clean
- [ ] No hard-coded strings (it + en keys identical); accessibility labels on all touchables
- [ ] Errors: `console.error` for logging, generic i18n strings only in the UI
- [ ] No behaviour change for a user with all-pass answers except: the hint, "Quasi!" feedback, retries, summary
- [ ] Conventional commit: `feat(TASK-019): exercise engine with graded outcomes and relearning queue`
- [ ] Status → `done`

---

## Review fixes (applied after implementation)

- **Restore column whitelist (`backup.ts`).** `restoreBackup` now inserts only columns that exist in
  the installed schema (checked with `PRAGMA table_info`). Previously column names from the backup
  file were interpolated into SQL unchecked: a crafted file could inject SQL through a key name, and
  a backup from a newer app (extra columns such as `review_log.quality`) failed to restore on an
  older one. Covered by a test.
- **Double-tap guard test.** `ReviewScreen` ignores a stale "Continua" tap (a second tap on the same
  render) instead of grading the card twice or grading the next card with the old answer. The test
  fails if the guard is removed (mutation-checked).

---

## Notes for Product Owner (Tech Lead's rationale)

- **Why tiers exist but do nothing yet:** the policy and the `tiers` field are the seam TASK-020
  plugs into (e.g. multiple choice for `new`, typed cloze for `learning`, sentence reorder for
  `strong`). Shipping them now, with a test using a fake registry, keeps TASK-020 to "add a
  definition + a view".
- **Why retries aren't graded:** counting a re-ask would double-penalise one miss and let the
  learner "launder" a failure into a pass within the same minute. Only the first attempt
  informs the schedule; the retry is for learning, not scoring.
- **Why umlaut-only differences are `close`, not `exact`:** German spelling is part of the
  skill; it still passes (≥ 0.5) but earns a shorter interval than a clean answer.
- **Rejected:** a 4-button Again/Hard/Good/Easy grade — extra friction on a phone and it
  duplicates what the exercise already measures (typo, hint, retry).
- **Next (TASK-020):** multiple choice with smart distractors + matching pairs + sentence
  reorder; then "find the mistake" and the compound builder.
