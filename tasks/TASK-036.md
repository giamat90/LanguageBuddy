# TASK-036 — Word catalog: every word by level and topic, colored by learning status

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** none (TASK-035 is already pushed; this task does not touch it)

## Context
User story: "As a GermanBuddy user I want to see the full list of words for each category, A1 to C2, from food to shopping, and every word's status — learnt, learning, new, or still to start — shown with its reference color."
Today the statistics screens list only **saved** words (`StatsWordsScreen`). The learner cannot see the words of the bank they have not met yet. This task adds a read-only **catalog** of the whole bundled word bank (6 levels × 8 topics, ~2,200 words), each word marked with one of four statuses.

## Scope
In:
- New route `/(app)/catalog` and `CatalogScreen`: level chips (A1…C2), topic chips (All + the 8 topics), status filter chips (All + 4 statuses, each with its count), a color legend, and a list of the matching words.
- Four statuses with fixed colors (see below). Color is never the only signal: every row also shows the status **text**.
- Entry points: a 📖 icon in the Vault header (next to 📊 and ⚙) and a "Sfoglia tutte le parole" link at the bottom of the Statistics screen.
- **Statistics buckets show every word of the bucket** (PO request): the clickable level rows and topic rows of the Statistics screen open the same word list (`StatsWordsScreen`), now populated with **all bank words** of that level/topic — saved or not — each with its status color. E.g. the topic "Cibo" lists Apfel (A1) as "Da iniziare" if it is not saved yet. The tier tiles ("Padroneggiate", "In apprendimento", "Nuove") and "Parole salvate" keep listing only saved words (an unsaved word has no tier).
- Tapping a **saved** word opens `/(app)/word?id=…`; an unsaved word is not tappable (nothing to open; saving stays the job of the daily word).
- 13-language strings.

Out:
- Saving, deleting or choosing words from the catalog (the daily-word flow stays the only way in — streak rules, §7).
- Search box, sorting options, pronunciation button in the catalog (follow-ups).
- Any change to the SRS, the stats numbers, the DB schema or the word bank.

## Statuses and colors
Computed from the vault row, exactly like the exercise engine / statistics (`statTierOf`, `tier.ts`), plus one for words not in the vault:

| Status key | Meaning | Label (it) | Color |
|------------|---------|-----------|-------|
| `mastered` | saved, `retention ≥ 0.85` and seen ≥ 4 times | Padroneggiata | `colors.forest` (navy) |
| `learning` | saved, otherwise | In apprendimento | `colors.gold` |
| `new` | saved, seen ≤ 1 time or `retention < 0.6` | Nuova | `colors.muted` (slate) |
| `todo` | in the word bank but **not** saved | Da iniziare | outline only: transparent fill, `colors.border` ring |

The user's "learnt / learning / new / still to start" map to these four. Reuse the existing labels `stats_mastered`, `stats_learning`, `stats_new`; add `catalog_status_todo`. Keep the Statistics bar chart as is, but put the three tier colors in one shared place, `src/theme/statusColors.ts` (`STATUS_COLORS: Record<CatalogStatus, string>`), and make `StatsScreen` import it (today it declares `TIER_COLORS` locally and uses `colors.border` for "new" in one place and `colors.muted` in another — the bars and legend must use the same constant; use `colors.muted` for `new`, which is the visible one).

## Acceptance Criteria
- [ ] Opening the catalog shows the learner's own CEFR level selected (fallback A1), topic "All", status "All", and lists that level's words alphabetically (German collation, case-insensitive, article ignored).
- [ ] Switching level or topic updates the list and the per-status counts; counts always add up to the number of words of that level+topic; the list length equals the active status filter's count.
- [ ] A saved word shows the color/label of its tier; a bank word that is not in the vault shows "Da iniziare" with the outline marker. Status text is always visible next to the marker.
- [ ] Matching saved ↔ bank is by `word.toLowerCase()` (the same rule as `lib/stats.ts`); a saved word that exists at two levels shows its status in both levels.
- [ ] Tapping a saved word navigates to its detail; tapping an unsaved word does nothing and is not announced as a button.
- [ ] Statistics → tap a **level** row (e.g. A2): the list holds every bank word of that level (all topics), with status marker + text; count in the header equals the bar's denominator (`bankTotal`) and the saved ones equal the bar's `total`.
- [ ] Statistics → tap a **topic** row (e.g. Cibo): every bank word of that topic across A1–C2, each row with a CEFR badge; unsaved words show "Da iniziare" (Cibo contains Apfel, level A1, as "Da iniziare" when not saved — test against the real bank).
- [ ] Statistics → tap a tier tile or "Parole salvate": unchanged behaviour (saved words only), but rows now use the same colored marker.
- [ ] Bucket lists have the status chips (with counts) so the learner can narrow to "Da iniziare" etc.; the legend is shown there too.
- [ ] Legend with the four colors and labels is visible above the list.
- [ ] Each chip and row has `accessibilityRole` and `accessibilityLabel` (row label: `"<article> <word>, <status>"`); selected chips set `accessibilityState={{ selected: true }}`.
- [ ] Load failure: generic i18n error + retry; `console.error('[Catalog] load failed:', e)`; no native text on screen.
- [ ] Opens from the Vault header and from the Statistics screen; back works.
- [ ] Reads only; no write to SQLite/MMKV; no network code.
- [ ] New keys exist in all 13 languages (parity test); `npx tsc --noEmit` clean; `npm test` green; `CONTEXT.md` updated.

## Technical Spec

### Files to create
```
mobile/app/(app)/catalog.tsx                    — `export { default } from '../../src/screens/CatalogScreen';`
mobile/src/screens/CatalogScreen.tsx            — screen (chips, legend, FlatList)
mobile/src/lib/catalog.ts                       — pure logic (below)
mobile/src/theme/statusColors.ts                — STATUS_COLORS
mobile/src/components/ui/CatalogRow.tsx         — row, StatusMarker, StatusLegend, StatusChips (shared)
mobile/__tests__/StatsWordsScreen.test.tsx
mobile/__tests__/catalog.test.ts, CatalogScreen.test.tsx
```

### Files to modify
```
mobile/app/(app)/_layout.tsx                    — <Stack.Screen name="catalog" />
mobile/src/services/statsService.ts             — add fetchSavedStates()
mobile/src/screens/VaultScreen.tsx              — 📖 header button (accessibilityLabel catalog_open)
mobile/src/screens/StatsWordsScreen.tsx         — level/topic buckets list the whole bank (see below)
mobile/src/screens/StatsScreen.tsx              — link to the catalog; import STATUS_COLORS instead of local TIER_COLORS
mobile/src/i18n/*.ts (13)                       — new keys (it.ts is the source)
CONTEXT.md                                      — same push
```

### Implementation notes

**Shared by both screens.** The catalog screen and the Statistics buckets use the same pure function and the same row component (`components/ui/CatalogRow.tsx`, `StatusMarker`, `StatusLegend`, `StatusChips`). Do not duplicate them.

**`lib/catalog.ts` (pure, no I/O, bank injectable like `computeStats`)**
```ts
export type CatalogStatus = 'mastered' | 'learning' | 'new' | 'todo';
export const CATALOG_STATUSES: readonly CatalogStatus[] = ['mastered', 'learning', 'new', 'todo'];

export interface SavedState { id: string; retentionScore: number; timesSeen: number }   // keyed by lowercased word

export interface CatalogEntry {
  key: string;                 // `${level}:${word}` — unique list key (a word can appear twice in the bank)
  level: CefrLevel;            // shown as a CEFR badge when the scope spans several levels
  word: string; article: string | null;
  translationIt: string; translationEn: string;   // from meaning_it / meaning_en
  status: CatalogStatus;
  savedId: string | null;      // vocabulary_items.id, null when status === 'todo'
}

export interface CatalogView { entries: CatalogEntry[]; counts: Record<CatalogStatus, number>; total: number }

export function buildCatalog(
  scope: { level: CefrLevel | null; topic: string | null },   // null = all levels / all topics
  status: CatalogStatus | null,               // null = all statuses
  saved: ReadonlyMap<string, SavedState>,
  bank = WORD_BANK,
): CatalogView
```
- `counts` and `total` are computed **before** the status filter (so the chips always show what each filter would give); `entries` are after it.
- Status for a saved word: `statTierOf({ retentionScore, timesSeen })` from `lib/stats.ts` (`'mastered' | 'learning' | 'new'`); not in the map → `'todo'`.
- Sort: by level first (A1…C2) when `scope.level` is null, then `a.word.localeCompare(b.word, 'de', { sensitivity: 'base' })`.
- Words are read straight from `bank[level]` (every level in `CEFR_ORDER` when `scope.level` is null); **do not** deduplicate across levels (this differs on purpose from the statistics lookup, which resolves a duplicate to its lowest level; note it in the code comment).
- `parseCatalogParams(level, topic)` is not needed: the screen holds level/topic in state, nothing comes from the route.

**Statistics buckets — `StatsWordsScreen` and `lib/stats.ts`**
- `WordFilter` keeps its shape. For `kind: 'level' | 'topic'` the screen no longer calls `fetchStatWords`; it calls `fetchSavedStates()` and `buildCatalog({ level: f.key, topic: null } | { level: null, topic: f.key }, status, saved)`. For `'all'` and `'tier'` it keeps `fetchStatWords(filter)` and maps each `StatWord.tier` to the same row/marker (a `CatalogEntry` with `savedId` set).
- The header count is `view.total` for level/topic buckets and its subtitle shows the saved share (`stats_progress`: "12 di 340").
- `selectStatRows` stays for the tier/all kinds and for `computeStats` consistency; its level/topic branches become unused by the screen — keep them (tested, and they define "what the bar counts"); add a comment saying the lists now use `buildCatalog`.
- Consistency note: a word present at two levels is counted once (lowest level) in the bars' saved counts but listed at both levels with its status. Accepted; the denominators `bankTotal` already count it at both levels.

**`statsService.fetchSavedStates()`**: `SELECT id, word, retention_score, times_seen FROM vocabulary_items` → `Map<lowercased word, SavedState>`. One query; if two rows had the same lowercase word the first wins.

**`CatalogScreen`**
- Local state: `level` (initial: `useUserStore(s => s.cefrLevel)` if it is one of `CEFR_ORDER`, else `'A1'`), `topic: string | null`, `status: CatalogStatus | null`, `saved` map, `failed`.
- Load with `useFocusEffect` (a word may have been saved meanwhile); keep the previous map while reloading to avoid flicker. Compute the view with `useMemo` over `[level, topic, status, saved]`.
- Layout, top to bottom: header (back, title `catalog_title`, count `catalog_count`), horizontally scrollable level chips, horizontally scrollable topic chips (emoji + label from `TOPICS`), status chips (`Tutte (n)`, `Padroneggiate (n)`, …), legend row, `FlatList`.
- Row: marker (12 px circle: filled with `STATUS_COLORS[status]`; for `todo` a 1.5 px ring in `colors.border`/`colors.muted` and no fill), `ArticleBadge` + word, the localized meaning via `localizedText(lang, 'meaning', { word }, it, en)`, and the status text on the right in the status color (`todo` in `colors.muted`). Saved rows are a `TouchableOpacity` (`accessibilityRole="button"`), unsaved rows a plain `View` (no role).
- `FlatList` with `keyExtractor = entry.key`, `initialNumToRender={20}`, `windowSize={10}`, rows as `React.memo`; fixed row height (56) and `getItemLayout`. Chips use `ScrollView horizontal` — no timers, no animation.
- Empty result (e.g. a status with 0 words): `catalog_empty`.
- Errors: generic `stats_error` string + retry (existing keys); cause to `console.error`.

**i18n keys** (it.ts text; translate to the other 12):
```
catalog_title:        "Tutte le parole"
catalog_count:        "%{count} parole"
catalog_open:         "Sfoglia tutte le parole"
catalog_all:          "Tutte"
catalog_status_todo:  "Da iniziare"
catalog_empty:        "Nessuna parola con questi filtri."
catalog_legend_a11y:  "Legenda dei colori: padroneggiata, in apprendimento, nuova, da iniziare"
catalog_row_a11y:     "%{word}, %{status}"
catalog_filter_level_a11y: "Livello %{level}"
catalog_filter_status_a11y: "%{status}, %{count} parole"
```
(`catalog_row_a11y` receives the article-prefixed word as `%{word}`.) Reuse `stats_mastered`, `stats_learning`, `stats_new`, `topic_*`, `nav_back`, `vault_retry`, `stats_error`.

**Edge cases**: a level with zero words for a topic (some levels have none for a topic — see `topicCountsForLevel`) → empty state, topic chips with 0 words stay selectable but show `0`; vault empty → every word is "Da iniziare"; native language outside the 13 → `localizedText` already falls back.

## Tests (write first, watch them fail)

`catalog.test.ts` (pure; inject a tiny bank and also run over the real `WORD_BANK`)
- saved map empty → every entry `todo`, `counts.todo === total`.
- saved word with `(0.9, 5)` → `mastered`; `(0.7, 3)` → `learning`; `(0.5, 3)` and `(0.9, 1)` → `new` (same rules as `statTierOf`).
- matching is case-insensitive (`'tisch'` key matches `'Tisch'`).
- topic filter keeps only that topic; `counts` ignore the status filter, `entries` obey it; `counts` sum equals `total`; `entries.length === counts[status]` when a status is set.
- sorted German-collation order (`Äpfel` sorts with A, not after Z); keys unique even when the same word is in two levels.
- property test over the real bank: for every level and topic, `total === bank[level].filter(topic).length`, and over all 6 levels × all topics the totals add up to the whole bank (2,194).
- `statusColors.test`: four distinct colors, `todo` is not a filled color constant used by the other three.

`catalog.test.ts` additions: `scope { level: 'A1', topic: 'food' }` over the real bank contains `Apfel` as `todo` when the saved map is empty, and as `learning` when saved with `(0.7, 3)`; `scope { level: null, topic: 'food' }` contains it too; `scope { level: null, topic: 'food' }` has words from several levels, sorted level-first, `total === bank totals of that topic`; `scope { level: 'A2', topic: null }` total equals `computeStats(...).byLevel[A2].bankTotal`; the same for every topic vs `byTopic[...].bankTotal`.

`StatsWordsScreen.test.tsx` (new or extended): level bucket lists unsaved words with "Da iniziare" and the saved ones with their tier text; topic bucket rows show a CEFR badge; tier bucket still lists only saved words; unknown route params still show "nothing to show".

`CatalogScreen.test.tsx` (mock `statsService.fetchSavedStates`, `expo-router`)
- starts on the learner's level; invalid/null level → A1.
- changing level/topic/status chips changes the rows and the header count.
- a row for a saved word is a button and navigates to `/(app)/word` with its saved id; an unsaved row has no button role and `router.push` is not called when pressed.
- every row shows its status text; the legend shows four labels.
- load failure shows the generic error, never the thrown message, logs with `console.error`, and Retry reloads.
- `VaultScreen` test: the 📖 button pushes `/(app)/catalog`. `StatsScreen` test: the link does too.
- `uiStringsParity.test.ts` passes with the new keys.
- Guard check: make `buildCatalog` compute `counts` after the status filter once and confirm a test goes red.

## Definition of Done
- [ ] All acceptance criteria checked, listed tests written first and green
- [ ] No hard-coded UI strings; no new dependency
- [ ] Review checklist (CLAUDE.md §13): untrusted input (none from route), performance on 365 rows × re-render on chip change, double taps, unneeded files in the diff
- [ ] Conventional commit: `feat(TASK-036): catalog of every word by level and topic with status colors`
- [ ] `CONTEXT.md` updated in the same push; status set to `done`

## Notes for Tech Lead (remove before handing over)
- Two screens, one list: the catalog is the free browser (level × topic × status chips); `StatsWordsScreen` is the same list pre-filtered by the bucket the learner tapped (plus the saved-only tier/all views). They share the pure function and the row components, not the screen.
- Rejected: showing the status as color only (accessibility; colorblind learners) and making unsaved words tappable (nothing to show yet, and it would invite a save path that bypasses the daily-word streak rule).
- Follow-ups: search box; "start learning this word" if the PO ever wants to bypass the daily word (needs a product decision — it touches §7 streak and the daily flow); speaker button reusing `useSpeech`.
