# TASK-029 — Drill down from statistics to the words

**Status:** `done`
**Assigned to:** Developer — Product Owner asked for the whole cycle in one session
**Written by:** Tech Lead
**Depends on:** TASK-027

## Context
The statistics screen shows counts only. The learner wants to tap a count and see the words behind it:
the Saved / Mastered ("learned") / Learning / New widgets, and each topic and level row.

## Scope
### In scope
- Pure, whitelisted word filter in `src/lib/stats.ts`: `parseWordFilter(kind, value)`, `selectStatRows(rows, filter, bank?)`.
- `fetchStatWords(filter)` in `statsService.ts`: saved words matching the filter, with tier.
- Route `/(app)/stats-words` + `StatsWordsScreen`: title of the filter, count, list (article, word, meaning, tier label), tap opens `/(app)/word`.
- Widgets (saved, mastered, learning, new), topic rows and level rows become buttons; a zero count is disabled.
- Strings in 13 languages, tests, CONTEXT.md.

### Out of scope
Combining filters (e.g. topic AND tier), sorting options, search, changing the existing counts or tier rules, schema changes.

## Acceptance Criteria
- [ ] AC1: Tapping Saved lists every saved word; Mastered / Learning / New list exactly the words `computeStats` counts in that tier (same `tierOf` rules).
- [ ] AC2: Tapping a topic or level row lists exactly the saved words `computeStats` counts in that group; the list length equals the count shown.
- [ ] AC3: Route params are untrusted: an unknown kind/value shows a generic "nothing to show" state, never throws, never reaches SQL.
- [ ] AC4: Zero-count widgets/rows are not pressable (`accessibilityState.disabled`).
- [ ] AC5: Rows open the word detail; failure shows a generic i18n error with retry (no `e.message`); empty state exists.
- [ ] AC6: Meaning is shown in the learner's language like the Vault (`localizedText`).
- [ ] AC7: `npx tsc --noEmit` clean; `npm test` green incl. `uiStringsParity`.

## Technical Spec
```ts
type StatTier = 'mastered' | 'learning' | 'new';
type WordFilter =
  | { kind: 'all' } | { kind: 'tier'; tier: StatTier }
  | { kind: 'topic'; key: string } | { kind: 'level'; key: CefrLevel };
parseWordFilter(kind: unknown, value: unknown): WordFilter | null   // whitelist; params may be string | string[]
statTierOf(row): StatTier
selectStatRows<T extends VocabStatRow>(rows: readonly T[], f: WordFilter, bank?): T[]
// service
fetchStatWords(f: WordFilter): Promise<StatWord[]>   // StatWord = VaultItem + tier, ordered by first_seen_at DESC
```
`computeStats` is refactored to share the bank lookup and tier mapping with `selectStatRows`, so counts and lists cannot diverge.
Route params: `kind`, `value`. Files: `lib/stats.ts`, `services/statsService.ts`, `screens/StatsWordsScreen.tsx`,
`app/(app)/stats-words.tsx`, `app/(app)/_layout.tsx`, `screens/StatsScreen.tsx`, `i18n/*.ts`.

## Tests (first)
`stats.test.ts` (parse, select ≡ computeStats for every group over the real bank), `topicsAndStatsService.test.ts`
(`fetchStatWords` on the in-memory DB), `StatsScreen.test.tsx` (navigation, disabled zero), `StatsWordsScreen.test.tsx`.
