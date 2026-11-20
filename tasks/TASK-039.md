# TASK-039 — One filter icon with a sheet of options instead of rows of chips

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-038 (pushed, `37c0213f`)

## Context
PO feedback after testing on the phone: the filters work but are too heavy — two or three chip rows plus a two-line legend take about a third of the screen before the first word. The PO prefers **an icon filter that shows the options when tapped**. This task replaces the chip rows with a compact filter button and a bottom sheet. No change to what can be filtered or to the counts; only where the controls live.

## Scope
In:
- A filter button (🎚 with a numeric badge = number of active filters) in the header of `StatsWordsScreen` (bank lists: topic and level) and of `CatalogScreen`.
- A bottom sheet (`FilterSheet`) with the options as rows with a radio-style mark and the word count:
  - `StatsWordsScreen`, topic list: "Livello" (Tutti + A1…C2) and "Stato" (Tutte + 4 statuses).
  - `StatsWordsScreen`, level list: "Argomento" (Tutti + 8 topics) and "Stato".
  - `CatalogScreen`: "Livello", "Argomento" and "Stato".
- Choosing an option applies at once and keeps the sheet open (so several filters can be combined); "Fatto" closes it; "Azzera" clears the optional filters (not the level of the catalog, which always has one value: it resets to the learner's level).
- A one-line summary under the title when something is active (e.g. `A2 · Da iniziare`), nothing when nothing is.
- The color legend leaves the list screen: each "Stato" option in the sheet shows its marker (dot / ring) and so acts as the legend. Rows already write the status as text.
- Strings in 13 languages.

Out:
- The saved-only lists (tier tiles, "Parole salvate"): no filters, no icon (unchanged).
- Persisting filters, multi-select inside a section, search.
- Any change to `buildCatalog`, `scopeCounts`, counts or statuses.

## Acceptance Criteria
- [ ] Bank lists and the catalog no longer show chip rows or the legend above the list; the first word is visible without scrolling on a 6" phone.
- [ ] Header has a filter button (`accessibilityRole="button"`, label `filter_open`); it shows a badge with the number of active filters (0 → no badge). It is absent on saved-only lists.
- [ ] Tapping it opens a bottom sheet (`Modal`, transparent, backdrop tap and Android back close it) with the sections above; each option row has role `button`, `accessibilityState.selected`, the label `"<name>, <count> parole"`, and shows its count; the "Stato" rows show the status marker.
- [ ] Selecting an option filters the list behind immediately; the counts in the sheet follow the same rules as the chips did (level/topic counts ignore status; status counts follow the narrowed scope); tapping the selected option again, or the first ("Tutti") row, clears that section.
- [ ] The summary line lists the active filters in the order level · topic · status, using the same labels; hidden when none.
- [ ] "Azzera" clears the optional filters and the summary; "Fatto" closes the sheet; both are buttons with labels.
- [ ] The list header count and "x di y" still follow the narrowed scope exactly as in TASK-038.
- [ ] Status colors and markers are unchanged; the sheet's status rows show all four.
- [ ] 13 languages; `tsc` clean; `npm test` green; `CONTEXT.md` updated.

## Technical Spec

### Files to create
```
mobile/src/components/ui/FilterSheet.tsx        — FilterButton (icon + badge), FilterSheet (Modal + sections)
mobile/__tests__/FilterSheet.test.tsx
```

### Files to modify
```
mobile/src/screens/StatsWordsScreen.tsx         — replace the ChipRow/StatusChips/StatusLegend block
mobile/src/screens/CatalogScreen.tsx            — same
mobile/src/components/ui/CatalogRow.tsx         — keep Chip/StatusMarker/statusLabel exports used elsewhere; remove StatusChips, StatusLegend, ChipRow if nothing else uses them (delete their tests: StatusChips.test.tsx)
mobile/src/i18n/*.ts (13)                       — new keys
mobile/__tests__/CatalogScreen.test.tsx, StatsWordsScreen.test.tsx — move the chip interactions to the sheet
CONTEXT.md
```

### Implementation notes

**`FilterSheet.tsx`** — presentational and generic so both screens share it:
```ts
export interface FilterOption { key: string | null; label: string; count: number; marker?: CatalogStatus; testID: string }
export interface FilterSection { id: string; title: string; options: FilterOption[]; selected: string | null; onSelect: (key: string | null) => void }

export function FilterButton({ activeCount, onPress }: { activeCount: number; onPress: () => void })
export function FilterSheet({ visible, sections, onClose, onReset, title }: {...})
```
- `FilterButton`: 44×44 touch target, glyph `🎚`, badge (a 18 px forest-navy circle with the number) when `activeCount > 0`; `testID="filter-button"`, `accessibilityLabel={t('filter_open')}`; the active count is also in the label when > 0 (`filter_open_active`: "Filtri (%{count} attivi)").
- `FilterSheet`: `Modal` (`transparent`, `animationType="slide"`, `onRequestClose={onClose}`), a full-screen backdrop `Pressable` (role `button`, label `filter_close`) and a panel at the bottom with rounded top corners, `maxHeight: '75%'`, a header (`title` + "Azzera" button `testID="filter-reset"` + "Fatto" button `testID="filter-done"`), and a `ScrollView` of sections. Each option row is a `TouchableOpacity` (role `button`, `accessibilityState={{ selected }}`, label `filter_option_a11y`: `"%{name}, %{count} parole"` — reuse `stats_words_filter_a11y`), min height 48, left: radio mark (ring; filled dot when selected) or the status marker for status options **next to** the radio, right-aligned count in `colors.muted`. No timers, no animation library.
- "Tutti" option has `key: null`; selecting the already-selected key calls `onSelect(null)`.

**Screens**
- Remove the chip rows, `StatusChips`, `StatusLegend`. Add `FilterButton` to the header (right side), `useState(false)` for `sheetOpen`.
- Build the sections from the data the screens already compute: `secondaryCounts` (TASK-038) for the level/topic section, `view.counts` + `view.total` for the status section; the catalog uses `scopeCounts('level', { level: null, topic }, saved)` and `scopeCounts('topic', { level, topic: null }, saved)` — note: for the catalog, level counts must respect the chosen topic and topic counts the chosen level (same as `scopeCounts` already does), status counts follow the narrowed scope.
- `activeCount` = number of non-null optional filters (secondary, status) — for the catalog also topic; the level is not counted (always set).
- Summary line: `t` labels joined with ` · `; `testID="filter-summary"`; `typography.uiSmall`, muted.
- Remove the legend from the list header; the sheet's "Stato" rows carry the markers.
- "Azzera": `StatsWordsScreen` → `setSecondary(null); setStatus(null)`; `CatalogScreen` → topic null, status null, level back to the learner's own level.

**i18n keys** (it.ts):
```
filter_open:         "Filtri"
filter_open_active:  "Filtri (%{count} attivi)"
filter_close:        "Chiudi i filtri"
filter_done:         "Fatto"
filter_reset:        "Azzera"
filter_section_level:  "Livello"
filter_section_topic:  "Argomento"
filter_section_status: "Stato"
```
Reuse `stats_words_all_levels`, `stats_words_all_topics`, `catalog_all`, `stats_words_filter_a11y`, `topic_*`, status labels.

## Tests (write first, watch them fail)
`FilterSheet.test.tsx`: button shows no badge at 0 and the count otherwise, label includes the count; sheet hidden until visible; options render with counts, radio selected state reflected in `accessibilityState`; pressing an option calls `onSelect(key)`, pressing the selected one calls `onSelect(null)`, "Tutti" calls `onSelect(null)`; "Fatto" and backdrop and `onRequestClose` call `onClose`; "Azzera" calls `onReset`; status options render the status marker (`status-marker-todo` etc.).
`StatsWordsScreen.test.tsx` / `CatalogScreen.test.tsx`: move the TASK-038 / TASK-036 chip interactions to the sheet (open with `filter-button`, press the option testIDs); assert that no `stats-filter-all` / `catalog-status-all` chip and no `status-legend` exist; the summary reads `A1` after choosing A1 in Cibo and `A1 · Da iniziare` after adding the status; badge count follows; tier and "saved" lists have no `filter-button`; "Azzera" clears the filters; the catalog's reset returns to the learner's own level; header counts and "x di y" unchanged from TASK-038 tests.
`uiStringsParity.test.ts` green.
Guard check: let the badge count the catalog's level once and confirm the badge test goes red.

## Definition of Done
- [ ] Criteria checked; tests written first and green; no new dependency (`Modal`, `Pressable` are core)
- [ ] Checked on the phone (screenshots): list shows the first word under the header; sheet opens/closes; Android back closes it
- [ ] Conventional commit: `feat(TASK-039): filter icon with a sheet of options`
- [ ] `CONTEXT.md` updated, status `done`

## Notes for Tech Lead (remove before handing over)
- Rejected: a dropdown/popover anchored to the icon (positioning code, awkward on small screens, long topic list); a collapsible chip bar (still heavy when open, hides state when closed); removing the legend altogether (the sheet's status rows keep it discoverable; the rows already name the status in words).
- The sheet stays open after a choice on purpose: combining level + status takes one visit. If the PO prefers it to close after each tap, it is a one-line change in the screens.
