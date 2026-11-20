# TASK-038 — Level filter inside a topic list, topic filter inside a level list

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-036/037 (committed together; the working tree also holds the "Nuova" wording fix and the chip-height fix, to be committed with this)

## Context
User story: "As a GermanBuddy user I'd like a filter based on level in the word list when opened from 'Per argomento', and a filter based on topic when the list is opened from 'Per livello'."
`StatsWordsScreen` opened on a topic (e.g. Cibo) lists that topic across A1–C2, and opened on a level (e.g. A2) lists the level across all topics; today the learner can only narrow by status. This adds the other dimension.

## Scope
In:
- Topic list (`kind: 'topic'`): a row of level chips — "Tutti i livelli", A1…C2 — each with the number of the topic's words at that level.
- Level list (`kind: 'level'`): a row of topic chips — "Tutti gli argomenti", then the 8 topics (emoji + label) — each with the number of the level's words in that topic.
- The new filter combines (AND) with the existing status chips. Choosing the selected chip again, or the "all" chip, clears it.
- Header counts follow the narrowed scope: "N parole" = words in scope before the status filter, "x di N" = saved among them (so with level A1 chosen inside Cibo it reads "1 di 24"-style numbers).
- 3 new i18n keys in 13 languages.

Out:
- The Catalog screen (it already has level × topic chips), the saved-only tier/"saved" lists, persisting the choice between visits, multi-select.

## Acceptance Criteria
- [ ] Topic list shows the level chip row; level list shows the topic chip row; tier/"saved" lists show neither.
- [ ] Each new chip shows its word count (words of that level/topic within the fixed bucket, **ignoring the status filter and the other new filter**, so the numbers do not jump around); counts of all level chips sum to the bucket total.
- [ ] Choosing a level inside Cibo lists only Cibo words of that level; with a status chip also chosen, both apply. Status chip counts and the header update to the narrowed scope.
- [ ] A chip with 0 words stays selectable and shows the empty state (`stats_words_empty`).
- [ ] Rows still open saved words / start learning unsaved ones as before.
- [ ] Chips have `accessibilityRole="button"`, `accessibilityState={{ selected }}`, labels with counts; the chip rows do not get clipped (`flexGrow: 0, flexShrink: 0`, same as the other chip rows).
- [ ] The secondary filter resets when another bucket is opened (new screen instance; no stored state).
- [ ] 13 languages, parity green, `tsc` clean, `npm test` green, `CONTEXT.md` updated.

## Technical Spec

### Files to modify
```
mobile/src/lib/catalog.ts                   — scopeCounts() helper
mobile/src/components/ui/CatalogRow.tsx     — export a generic ChipRow (horizontal, non-shrinking) used by the new rows
mobile/src/screens/StatsWordsScreen.tsx     — state + chip rows + scope wiring
mobile/src/i18n/*.ts (13)                   — 3 new keys
mobile/__tests__/catalog.test.ts, StatsWordsScreen.test.tsx
CONTEXT.md                                  — same push
```

### Implementation notes

**`lib/catalog.ts`**
```ts
/** Words per level (or per topic) inside a fixed bucket, ignoring status; keys are CEFR levels or topic keys. */
export function scopeCounts(
  by: 'level' | 'topic',
  fixed: { level: CefrLevel | null; topic: string | null },   // the bucket the screen was opened on
  saved: ReadonlyMap<string, SavedState>,
  bank = WORD_BANK,
): Record<string, number>
```
Implement with `buildCatalog` per key (`by: 'level'` → for each `CEFR_ORDER` level `buildCatalog({ level, topic: fixed.topic }, null, saved, bank).total`; `by: 'topic'` → for each `TOPIC_KEYS` topic `buildCatalog({ level: fixed.level, topic }, …).total`). Cheap (≤ 8 passes over ≤ 2,200 entries), memoized in the screen.

**`StatsWordsScreen`**
- New state `secondary: string | null` (a level key in topic lists, a topic key in level lists), default null.
- Scope for `buildCatalog`: topic list → `{ level: secondary as CefrLevel | null, topic: filter.key }`; level list → `{ level: filter.key, topic: secondary }`.
- Chip rows rendered only when `loaded.kind === 'bank'`, between the header and the status chips, using `Chip` and the new `ChipRow`. Labels: all-chip `t('stats_words_all_levels')` / `t('stats_words_all_topics')`, then `A1 (n)` … or `🍕 Cibo (n)` …; a11y: `catalog_filter_level_a11y` + count for levels is not enough, so use `stats_words_filter_a11y`: `"%{name}, %{count} parole"` for both rows. testIDs: `stats-filter-level-<A1>` / `stats-filter-topic-<food>`, `stats-filter-all`.
- Header count and progress use the narrowed `view.total` and saved count (already computed from the view; nothing else to change).
- Tapping the selected chip clears it.

**i18n keys** (it.ts):
```
stats_words_all_levels:  "Tutti i livelli"
stats_words_all_topics:  "Tutti gli argomenti"
stats_words_filter_a11y: "%{name}, %{count} parole"
```
(The last has only placeholders in front of a common noun — translate "parole" in each language; it is not a SAME_EVERYWHERE key.)

## Tests (write first, watch them fail)
`catalog.test.ts`: `scopeCounts('level', { level: null, topic: 'food' }, …)` sums to the food total and matches `buildCatalog` per level; `scopeCounts('topic', { level: 'A1', topic: null }, …)` sums to `WORD_BANK.A1.length`; ignores saved status (same numbers with an empty and a full saved map).
`StatsWordsScreen.test.tsx`:
- topic list: level chips A1…C2 + all chip with counts; pressing `A1` shows only A1 food words (Apfel present, a B1 food word absent) and the header count equals the A1 food total; pressing it again restores all.
- level list: topic chips; pressing "Cibo" within A1 shows only A1 food words; combined with status chip "Da iniziare" both apply (a saved food word disappears).
- chip with 0 words → empty state text.
- tier list and "saved" list: no `stats-filter-*` chips.
- the chip-row wrapper has `flexShrink: 0` (same guard as `StatusChips`).
- parity test green.
- Guard check: let the status counts ignore the new filter once and confirm a test goes red.

## Definition of Done
- [ ] Criteria checked; tests written first and green; no hard-coded strings; no new dependency
- [ ] Conventional commit: `feat(TASK-038): level filter in topic lists, topic filter in level lists`
- [ ] `CONTEXT.md` updated (also mentions the "Nuova"/"Padroneggiata" row wording and the chip-clipping fix found on the phone), status `done`

## Notes for Tech Lead (remove before handing over)
- Rejected: reusing the Catalog screen with preset params (it would drop the "x di y" header, the CEFR badge on topic rows and the start-learning flow already wired in `StatsWordsScreen`); persisting the filter (surprising on the next visit).
- Cost: two chip rows + status chips = three rows above the list on a phone. If it feels crowded on the device, the follow-up is a collapsible filter bar.
