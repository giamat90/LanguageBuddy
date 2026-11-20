# TASK-021 — Free practice: exercise on demand, outside the review schedule

**Status:** `done` (merged to main 2026-10-08)
**Assigned to:** Developer
**Written by:** Tech Lead
**Depends on:** TASK-019, TASK-020 (exercise engine and the five formats)

---

## Context

Exercises are only reachable through "Ripassa", which appears when a word is due (a day after saving,
then days apart). A learner who wants to train now — or to try a specific format — cannot. This task adds
**free practice**: pick a format, get a session of ~10 saved words, any time.

**Schedule rule (decided with the Product Owner — "option 2, only misses count"):** practice never pushes a word's
next review later. A **miss** lowers its retention and can only move its next review **earlier**; a pass changes
nothing. Practice never touches the streak, the daily word, `times_seen`/`times_used` or the review log.

---

## Scope

### In scope
- A "Pratica" button in the Vocabolario actions row (visible when the vault has words).
- A practice menu (`/(app)/practice`): Mixed, Matching, Multiple choice, Sentence reorder, Type the word —
  each enabled only if the vault can support it.
- A practice session (`/(app)/practice-session?format=…`) reusing the engine, views and retry queue, with a
  "Pratica" badge, a "Ancora" (again) button and a transparency note on the finish screen.
- Pure helpers in `lib/exercises/practice.ts`: format parsing, per-format engine config, card selection
  (weak words favoured), availability.
- Service: `fetchVaultCards()` and `gradePractice()` (the miss-only rule).
- Refactor: extract the session UI of `ReviewScreen` into a shared `ExerciseSession`; `ReviewScreen` becomes a thin wrapper.
- i18n (it + en), tests.

### Out of scope
- Practising words not saved in the vault; topic/level filters; adjustable session length.
- XP, achievements, practice history/statistics, a practice reminder.
- Any change to the scheduled review's behaviour, to SRS thresholds, or to the backup format.

---

## Acceptance Criteria

- [ ] AC1: "Pratica" appears in the Vocabolario actions row whenever the vault has ≥ 1 word (not only when words are due); it opens the practice menu. The row wraps on narrow screens.
- [ ] AC2: The menu lists the 5 formats with a title and description. A format is **disabled** (with a visible reason) when it cannot be built from the vault:
      Matching needs ≥ 4 words with usable, distinct meanings; Multiple choice / Sentence reorder / Type the word need ≥ 1 word they apply to; Mixed needs ≥ 1 word.
      An empty vault shows `practice_need_words` and everything is disabled.
- [ ] AC3: A session has up to `PRACTICE_SIZE` (10) cards, drawn without repeats from the vault, **only from words the chosen format can be built for**, favouring weaker words
      (weight `1 − retention + 0.15`).
- [ ] AC4: With a chosen format, every word gets that format **regardless of its tier**; leftovers the planner cannot place (e.g. matching with < 4 distinct meanings) fall back to a flip-card.
      "Mixed" picks among the single-card formats (typed 2 : reorder 1 : choice 1), also tier-independent — it never builds matching rounds (see review fixes).
      "Match" builds **only** matching rounds: words that do not fit a round are left out (no flip-cards).
- [ ] AC5: `gradePractice(id, outcome)`: quality ≥ `PASS_QUALITY` → no database change at all. Quality < `PASS_QUALITY` → retention is updated with
      `updateRetentionScore(retention, quality, times_seen)` and `next_review_at = min(existing, nextReviewDate(newRetention))`; `times_seen`, `times_used`,
      the review log, the streak and `last_active_at` are untouched. Unknown ids are ignored. Booleans are accepted. The reminder is refreshed after a change.
- [ ] AC6: Retries within a practice session behave as in review (first attempt only is graded; `RELEARN_GAP`, `MAX_RETRIES`).
- [ ] AC7: The finish screen shows the first-try summary, "Ancora" (loads a fresh batch with the same format), a back button, and `practice_note`.
      "Nothing suitable" and load errors show `practice_nothing` (errors via `console.error`, no raw text).
- [ ] AC8: The scheduled review is unchanged: all existing `ReviewScreen`/`ReviewScreenFormats` tests pass without modification.
- [ ] AC9: `tsc --noEmit` clean; no hard-coded strings; accessibility role + label on every touchable; i18n keys identical in both languages.

---

## Technical Spec

### Files to create
```
mobile/src/lib/exercises/practice.ts            — formats, config, selection, availability
mobile/src/screens/ExerciseSession.tsx          — shared session UI (extracted from ReviewScreen)
mobile/src/screens/PracticeMenuScreen.tsx
mobile/src/screens/PracticeSessionScreen.tsx
mobile/app/(app)/practice.tsx                   — export default from PracticeMenuScreen
mobile/app/(app)/practice-session.tsx           — export default from PracticeSessionScreen
mobile/__tests__/practice.test.ts               — pure helpers
mobile/__tests__/practiceGrading.test.ts        — fetchVaultCards + gradePractice
mobile/__tests__/PracticeScreens.test.tsx       — menu + session
```

### Files to modify
```
mobile/src/services/reviewService.ts   — fetchVaultCards, gradePractice, shared row→card mapper
mobile/src/screens/ReviewScreen.tsx    — thin wrapper over ExerciseSession
mobile/src/screens/VaultScreen.tsx     — "Pratica" button, wrapping actions row
mobile/app/(app)/_layout.tsx           — register the two routes
mobile/src/lib/exercises/index.ts      — export practice
mobile/src/i18n/it.ts, en.ts           — strings
mobile/__tests__/VaultScreen.test.tsx  — Pratica button cases
```

### `lib/exercises/practice.ts`
```ts
export type PracticeFormat = 'mixed' | 'matching' | 'multiple_choice' | 'sentence_reorder' | 'typed_cloze';
export const PRACTICE_FORMATS: PracticeFormat[]           // in menu order: that order
export const PRACTICE_SIZE = 10;
export const PRACTICE_WEAK_FLOOR = 0.15;

export function parsePracticeFormat(raw: unknown): PracticeFormat   // unknown/array/undefined -> 'mixed'; takes the first element of an array

export interface PracticeConfig { registry: ExerciseDefinition[]; groups: GroupExerciseDefinition[] }
export function practiceConfig(format: PracticeFormat): PracticeConfig

export function canPractice(card: ReviewCard, format: PracticeFormat, rng?: Rng): boolean
export function selectPracticeCards(cards: ReviewCard[], format: PracticeFormat, count?: number, rng?: Rng): ReviewCard[]
export function practiceAvailability(cards: ReviewCard[]): Record<PracticeFormat, boolean>
```
`anyTier(def)` (internal): a copy of a definition with `tiers = ['new','learning','strong']`. Practice ignores the review ladder.

`practiceConfig`:
| format | registry | groups |
|---|---|---|
| `typed_cloze` | `[anyTier(TYPED_CLOZE), FLASHCARD]` | `[]` |
| `sentence_reorder` | `[anyTier(SENTENCE_REORDER), FLASHCARD]` | `[]` |
| `multiple_choice` | `[anyTier(MULTIPLE_CHOICE), FLASHCARD]` | `[]` |
| `matching` | `[FLASHCARD]` | `[anyTier(MATCHING)]`, `groupsOnly: true` |
| `mixed` | `DEFAULT_REGISTRY` with every non-fallback definition widened by `anyTier` | `[]` |

`canPractice`: `typed_cloze` → `buildCloze(card.exampleDe, card.word)` non-null; `sentence_reorder` → `buildReorder` non-null;
`multiple_choice` → `buildMultipleChoice(card, getDistractorPool(), rng)` non-null; `matching` → both translations non-empty; `mixed` → always true.
(`rng` default `Math.random`.)

`selectPracticeCards`: eligible = cards where `canPractice`. For `matching`, fewer than `MATCH_MIN` eligible → `[]`.
Otherwise draw up to `count` **without replacement** with `pickWeighted`, weight `max(1 − retentionScore, 0) + PRACTICE_WEAK_FLOOR`.
`practiceAvailability`: for each format, `selectPracticeCards(cards, format, 1)` is non-empty — **except** `matching`, which needs `MATCH_MIN` distinct
usable cards (use `selectPracticeCards(cards, 'matching', MATCH_MIN)` and check that `buildMatchingRound` succeeds on them).

### Service (`reviewService.ts`)
```ts
export async function fetchVaultCards(): Promise<ReviewCard[]>        // every vocabulary_items row, newest first, mapped exactly like fetchDueReviews
export async function gradePractice(itemId: string, outcome: boolean | number): Promise<void>
```
Extract the row→`ReviewCard` mapping used by `fetchDueReviews` into one function and reuse it.
`gradePractice`: `quality = toQuality(outcome)`; if `quality >= PASS_QUALITY` return without touching the database. Otherwise read
`retention_score, times_seen, next_review_at`; (missing row → return); `newScore = updateRetentionScore(retention_score, quality, times_seen)`;
`candidate = nextReviewDate(newScore).toISOString()`; `next = candidate < next_review_at ? candidate : next_review_at` (ISO strings compare lexicographically);
`UPDATE vocabulary_items SET retention_score = ?, next_review_at = ? WHERE id = ?`; then
`refreshReviewReminder().catch(console.warn …)` as `gradeReview` does. No `review_log` row, no `times_*` change.

### `ExerciseSession.tsx` (the former ReviewScreen body)
```ts
interface Props {
  load: () => Promise<ReviewCard[]>;
  grade: (cardId: string, quality: number) => Promise<void>;
  registry?: ExerciseDefinition[];        // default DEFAULT_REGISTRY
  groups?: GroupExerciseDefinition[];     // default DEFAULT_GROUPS
  practice?: boolean;                     // copy + badge + "Ancora" + note
}
```
Behaviour identical to today's `ReviewScreen` (load → `createSession(cards, { groups })`, `pickExercise(card, registry)`, stale-tap guard, serial grading via `grade`, `console.error` on failure).
Differences when `practice`: header shows a `practice_badge` chip next to the progress; the finish title is `practice_done` (or `practice_nothing` when nothing was graded);
below the summary a muted `practice_note`; an "Ancora" secondary button that reloads (`load()` again → new session) above the back button.
A `reload` counter state re-runs the load effect. Because `load` is a prop, wrap it in `useCallback`/keep it stable in the callers.
`ReviewScreen` = `<ExerciseSession load={fetchDueReviews} grade={gradeReview} />` (the imports stay in `ReviewScreen`, so existing test mocks of `reviewService` keep working).

### Screens
**`PracticeSessionScreen`**: `format = parsePracticeFormat(useLocalSearchParams().format)`; `config = useMemo(() => practiceConfig(format), [format])`;
`load = useCallback(async () => selectPracticeCards(await fetchVaultCards(), format), [format])`;
renders `<ExerciseSession practice load={load} grade={gradePractice} registry={config.registry} groups={config.groups} />`.
**`PracticeMenuScreen`**: header (back + `practice_title`), `practice_note`, then one row per format in `PRACTICE_FORMATS` order:
title `practice_format_<format>`, description `practice_desc_<format>`. Loads `fetchVaultCards()` once → `practiceAvailability`; disabled rows are muted, `accessibilityState.disabled`,
and show `practice_need_four` (matching) or `practice_nothing` (others) as the reason. Empty vault → `practice_need_words`.
Pressing an enabled row → `router.push({ pathname: '/(app)/practice-session', params: { format } })`. Load error → `console.error`, treat as empty vault.
**`VaultScreen`**: add the "Pratica" button after "Grammatica" when `total > 0`; `actionsRow` gets `flexWrap: 'wrap'` and a row gap.

### i18n (add to both files; keys identical)
```
vault_practice_cta:                'Pratica'                                   | 'Practice'
practice_title:                    'Pratica libera'                            | 'Free practice'
practice_note:                     'Allenati quando vuoi. Il calendario dei ripassi cambia solo per le parole che sbagli.'
                                   | 'Practise whenever you like. Your review schedule only changes for words you get wrong.'
practice_badge:                    'Pratica'                                   | 'Practice'
practice_format_mixed:             'Misto'                                     | 'Mixed'
practice_format_matching:          'Abbina'                                    | 'Match'
practice_format_multiple_choice:   'Scelta multipla'                           | 'Multiple choice'
practice_format_sentence_reorder:  'Riordina la frase'                         | 'Reorder the sentence'
practice_format_typed_cloze:       'Scrivi la parola'                          | 'Type the word'
practice_desc_mixed:               'Un po\' di tutto'                          | 'A bit of everything'
practice_desc_matching:            'Collega parole e significati'              | 'Link words to meanings'
practice_desc_multiple_choice:     'Scegli il significato giusto'              | 'Pick the right meaning'
practice_desc_sentence_reorder:    'Rimetti le parole in ordine'               | 'Put the words in order'
practice_desc_typed_cloze:         'Completa la frase scrivendo'               | 'Complete the sentence by typing'
practice_need_words:               'Salva qualche parola per iniziare a praticare.' | 'Save a few words to start practising.'
practice_need_four:                'Servono almeno 4 parole salvate.'          | 'You need at least 4 saved words.'
practice_nothing:                  'Nessuna parola adatta a questo esercizio.' | 'No saved word fits this exercise.'
practice_done:                     'Pratica completata! 💪'                    | 'Practice complete! 💪'
practice_again:                    'Ancora'                                    | 'Again'
```

---

## Tests (write FIRST, see them fail)

`practice.test.ts` (pure; fixture cards with `partOfSpeech` etc. as in `exerciseFormats.test.ts`, real bank words for multiple choice)
- `parsePracticeFormat`: each valid value; `undefined`, `''`, `'bogus'`, `['matching','x']` → `'matching'`, `42` → `'mixed'`.
- `practiceConfig`: for a **strong** card `typed_cloze`/`sentence_reorder`/`multiple_choice` configs yield exactly that kind via `pickExercise(card, cfg.registry)`
  (tier-independent), a **new** card likewise; `matching` has one group definition that accepts `learning` cards (4 learning cards → one round via `createSession(cards, { groups })`);
  `mixed` yields all three single kinds across `rng` values 0, 0.5, 0.9 for a card that supports them.
- `canPractice`: per format on a card with/without example, with 3-token example, without part of speech.
- `selectPracticeCards`: respects `count`; no duplicates; only applicable cards (a reorder session over cards where only 3 of 6 have sentences returns ≤ 3, all with sentences);
  `matching` with 3 usable → `[]`, with 4 → the 4; deterministic for a seeded rng; **weak words favoured** — over 400 seeded draws of `count = 1` from a 0.1-retention and a 0.95-retention card the weak one wins > 70 %; returns `[]` for an empty vault.
- `practiceAvailability`: empty vault → all false; 2 words → matching false, mixed true; 4 words with distinct meanings → matching true; words without sentences → reorder false.

`practiceGrading.test.ts` (sqlite mock; same setup as `reviewGrading.test.ts`)
- `fetchVaultCards` returns every saved word (due or not) with bank fields.
- pass (`1`, `0.5`, `true`) → vocabulary row and `review_log` identical before/after.
- miss on a word set to retention 0.95 and `next_review_at` +20 days: retention equals `updateRetentionScore(0.95, q, times_seen)`; `next_review_at` strictly earlier;
  `times_seen`, `times_used` unchanged; no `review_log` row.
- miss on an already-due word: `next_review_at` unchanged (never later); retention still drops.
- miss where the recomputed date would be later than the stored one: stored date kept.
- `false` counts as a miss; unknown id ignored; `learner_profile.streak_days` / `last_active_at` unchanged by practice.

`PracticeScreens.test.tsx` (mock `reviewService`: `fetchVaultCards`, `gradePractice`; mock `expo-router` with `useRouter` and a mutable `useLocalSearchParams`)
- Menu: five formats rendered; with 2 words matching is disabled with the reason, others enabled; empty vault → `practice_need_words`; pressing "Scelta multipla" pushes `{ pathname: '/(app)/practice-session', params: { format: 'multiple_choice' } }`; a disabled row does not navigate; load error → `console.error` + empty-vault state.
- Session (multiple choice, 4 well-known words, each `timesSeen 6`, `retentionScore 0.95` — i.e. *strong*): shows the "Pratica" badge and multiple-choice options (tier-independent); answering correctly grades `gradePractice(id, 0.8)`; the finish screen shows `practice_done`, the summary, `practice_note` and "Ancora".
- "Ancora" calls `fetchVaultCards` again and starts a new session.
- `format = 'typed_cloze'` on a strong card shows the typing input; unknown/missing format behaves as Mixed; nothing suitable (reorder with no sentences) → `practice_nothing`; fetch failure → `console.error` and `practice_nothing`, no raw text.
- Matching format with 5 words: one round; a clean round grades each card 0.7 through `gradePractice`.

`VaultScreen.test.tsx`: "Pratica" visible with words (and navigates to `/(app)/practice`), hidden for an empty vault; "Ripassa" still depends on the due count.

---

## Definition of Done
- [ ] AC1–AC9 checked; all new and existing tests green; `tsc --noEmit` clean
- [ ] No hard-coded strings; accessibility role + label on touchables; errors via `console.error`, generic strings in the UI
- [ ] Manual check on a phone: Pratica is available with no due words; each format starts; a wrong answer makes the word appear in "Ripassa" sooner; a right answer changes nothing
- [ ] Conventional commit: `feat(TASK-021): free practice mode`
- [ ] Status → `done`

---

## Implementation notes and review fixes

Review findings, each reproduced by a failing test first:
- **Mixed became two matching rounds and nothing else.** With 10 words the planner formed a round of 5, then another of 5.
  `mixed` now uses single-card formats only (`groups: []`); matching is available as its own format.
- **The Match format showed flip-cards.** Words left over after the rounds (e.g. 7 words → 5 in a round) fell back to flip-cards.
  Added `PracticeConfig.groupsOnly` / `SessionOptions.groupsOnly` / `ExerciseSession groupsOnly`: leftovers are dropped and `total` counts the cards in rounds.
- **Slow session start.** `canPractice('multiple_choice')` built a full question for every saved word (237 ms for 400 words in Node, a second or more on a phone).
  It now only checks part of speech, both translations and `distractorSupply(pos) > 3` (new in `distractors.ts`); the rare card whose distractors then clash falls back to a flip-card.
  Guarded by a test that fails if the check consumes the rng.
- Smaller: menu rows carry the description as `accessibilityHint`; the `useMemo` in `ExerciseSession` depends on `[entry, registry]` instead of a lint-disable.

---

## Notes for Product Owner (Tech Lead's rationale)

- **Why misses-only:** a right answer straight after practising says little about next week, so rewarding it would let anyone push words weeks ahead by repeating easy exercises. A miss is real evidence the word is weaker than the schedule thinks.
  A miss moves the review to *tomorrow at the earliest*, not instantly — the schedule's own shortest interval.
- **Why tiers are ignored in practice:** the review ladder protects the schedule's evidence; in free practice the learner chooses the difficulty.
- **Why the vault only:** practising unsaved words would need a separate path (no row to grade). Out of scope.
- **Risk — small vaults:** a young vault has few words, so sessions repeat. The menu says so by disabling what cannot be built.
- **Next:** a "weakest words" shortcut, topic filter, or the "find the mistake" and compound-builder formats.
