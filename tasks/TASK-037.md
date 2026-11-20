# TASK-037 — Start learning a word by tapping it in any word list

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-036 (the catalog and the shared `CatalogRow`; implemented, not yet committed — commit it first or together)

## Context
User story: "As a GermanBuddy user I want the possibility to start learning a word by clicking on it from any word list."
TASK-036 shows every bank word with the status "Da iniziare", but an unsaved word is not tappable and the only way into the vault is the daily word. This task lets the learner add a word to the vault from the lists. It **deliberately lifts one rule of TASK-036** ("unsaved words are not tappable") and adds a second way into the vault; the streak rule stays.

## Scope
In:
- Tapping an unsaved ("Da iniziare") row — in the catalog and in the level/topic lists of the Statistics screen — asks for confirmation and, on "Aggiungi", saves the word to the vault (`vocabulary_items`) exactly like today's word is saved: retention 0.5, seen once, first review due in 1 day. The row then shows its new status ("Nuova") and the counts update.
- `wordService.startLearning(level, word)`: the one function that does it.
- Saved rows keep opening the word detail.
- Strings in 13 languages; accessibility (role, label, hint) for the now-tappable rows.

Out:
- **The streak.** Starting a word from a list never touches `streak_days`, `last_active_at` or `total_words_seen` (CLAUDE.md §7: only saving the word of the day moves the streak). Say so in the confirmation text? No — keep the text short; document it in CONTEXT.md.
- Removing a word from the vault, a bulk "add all", adding from the tier lists (they only contain saved words), search, a word preview sheet.
- The Vault list (its words are already saved) and the daily-word screen.
- Schema changes (the `source` column already exists; the new value is `'catalog'`).

## Acceptance Criteria
- [ ] Tapping an unsaved row opens a confirmation (`Alert`) naming the word (with article) and its meaning; "Annulla" does nothing, "Aggiungi" saves.
- [ ] After "Aggiungi": a row appears in `vocabulary_items` (`source = 'catalog'`, `times_seen = 1`, `times_used = 0`, `retention_score = 0.5`, `next_review_at` = now + 1 day via `nextReviewDate(0.5)`, article/translations/part of speech from the bank entry); the row in the list flips to "Nuova" (slate marker) without leaving the screen; the status chip counts move from "Da iniziare" to "Nuove".
- [ ] The word is in the vault list and is offered by review once due; the daily word never picks it again (`usedWords` already covers `vocabulary_items`; assert it in a test).
- [ ] Streak, `last_active_at`, `total_words_seen` unchanged (test with a profile that has `streak_days = 5`).
- [ ] Already saved (also: saved from another list a moment ago, or the same word at two levels, or different letter case): no duplicate row, no error shown, the list simply shows the saved state. `startLearning` returns `{ added: false }`.
- [ ] Double tap / two rows pressed quickly: one confirmation at a time; one insert per word (guard in the hook **and** `INSERT OR IGNORE`-style idempotence in the service).
- [ ] The review reminder is refreshed after an add (`refreshReviewReminder`, failure only logged).
- [ ] Failure (DB error): generic i18n alert; `console.error('[Catalog] start learning failed:', e)`; the row stays "Da iniziare".
- [ ] Unsaved rows are buttons now: `accessibilityRole="button"`, label `"<article> <word>, Da iniziare"`, hint `catalog_start_hint`; a visible "＋" at the right of unsaved rows. Saved rows unchanged.
- [ ] The automatic backup change listener fires (the table is a backed-up table; nothing to add — assert only that the insert goes through `getDb()`).
- [ ] 13 languages, parity green; `tsc` clean; `npm test` green; `CONTEXT.md` and `CLAUDE.md` updated.

## Technical Spec

### Files to create
```
mobile/src/hooks/useStartLearning.ts        — confirmation + in-flight guard + error alert
mobile/__tests__/startLearning.test.ts      — service tests
mobile/__tests__/useStartLearning.test.tsx  — hook tests
```

### Files to modify
```
mobile/src/services/wordService.ts          — startLearning(level, word)
mobile/src/components/ui/CatalogRow.tsx     — unsaved rows become buttons, "＋" affordance, onStart prop
mobile/src/screens/CatalogScreen.tsx        — use the hook; reload saved states after an add
mobile/src/screens/StatsWordsScreen.tsx     — same, for the level/topic (bank) lists
mobile/src/i18n/*.ts (13)                   — new keys
mobile/__tests__/CatalogScreen.test.tsx, StatsWordsScreen.test.tsx — update the "unsaved is not a button" cases
CLAUDE.md                                   — §1/§5/§7 (a second way into the vault; streak unchanged)
CONTEXT.md                                  — same push
```

### Implementation notes

**`wordService.startLearning`**
```ts
export interface StartLearningResult { added: boolean; id: string | null }

export async function startLearning(level: CefrLevel, word: string): Promise<StartLearningResult>
```
- Look the entry up in `WORD_BANK[level]` by exact `word` (the UI passes only `level` and `word`; **never** trust translations/article from the screen). Not found → throw `Error('unknown word')` (cannot happen from the UI; stays a loud failure).
- Existing check: `SELECT id FROM vocabulary_items WHERE lower(word) = lower(?)`. Found → `{ added: false, id }`, no write.
- Otherwise insert, mirroring `saveWord`'s insert but with `source = 'catalog'` and `first_seen_at = now`:
  `INSERT OR IGNORE INTO vocabulary_items (id, word, article, translation_en, translation_it, part_of_speech, source, times_seen, times_used, retention_score, first_seen_at, next_review_at) VALUES (?, ?, ?, ?, ?, ?, 'catalog', 1, 0, 0.5, ?, ?)` with `entry.meaning_en/meaning_it/part_of_speech` (use `uid('vocab_')` for the id). `word` is UNIQUE, so a concurrent insert of the exact same word is ignored; then re-select the id and return `added` = whether this call's insert changed a row (`result.changes === 1`).
- After a real insert: `refreshReviewReminder().catch(err => console.warn('[wordService] refreshReviewReminder after start failed:', err))`.
- **Does not** touch `learner_profile`, `daily_items` or `review_log`.
- Pure bank lookup helper kept in the service file (no new module).

**`useStartLearning(onChanged: () => void | Promise<void>)`**
```ts
const { start, busy } = useStartLearning(onChanged);
start(entry: CatalogEntry)   // entry.level is non-null here (bank rows)
```
- `Alert.alert(t('catalog_start_title'), t('catalog_start_body', { word: withArticle, meaning }), [{ text: t('common_cancel'), style: 'cancel' }, { text: t('catalog_start_confirm'), onPress: confirm }])`.
- `meaning` via `localizedText(lang, 'meaning', { word, level }, it, en)` (same as the row).
- In-flight guard: a `useRef<boolean>` set while an alert is open or a save runs; `start` is a no-op while it is set. Clear it when the alert is dismissed (`onDismiss`) or cancelled, and when the save finishes. (The Alert `onDismiss` prop exists on Android; also clear it in the Cancel button's `onPress`.)
- `confirm`: `await startLearning(entry.level, entry.word)`; then `await onChanged()` (the screens reload `fetchSavedStates()`); on throw → `console.error('[Catalog] start learning failed:', e)` and `Alert.alert(t('catalog_start_error_title'), t('catalog_start_error_body'))`. Never show `e.message`.
- Do not use timers.

**`CatalogRow`**: new optional prop `onStart?: (entry: CatalogEntry) => void`. Row logic:
- `savedId` → opens detail (unchanged).
- no `savedId` and `onStart` → `TouchableOpacity`, `accessibilityRole="button"`, `accessibilityLabel` as before, `accessibilityHint={t('catalog_start_hint')}`, and a trailing `＋` glyph (`colors.forest`, 20 px) after the status text.
- no `savedId` and no `onStart` → plain `View` as today (kept so the component stays reusable).
- Fixed row height must not change (`CATALOG_ROW_HEIGHT`).

**Screens**: both screens pass `onStart={start}`; `onChanged` = reload saved states (`load()` — it already refreshes the map; keep the previous map while loading so rows do not flicker). In `StatsWordsScreen`, pass `onStart` only when `loaded.kind === 'bank'`.

**i18n keys** (it.ts):
```
catalog_start_title:       "Inizia a imparare"
catalog_start_body:        "Aggiungere «%{word}» (%{meaning}) al tuo vocabolario? Lo ripasserai a partire da domani."
catalog_start_confirm:     "Aggiungi"
catalog_start_hint:        "Tocca per iniziare a imparare questa parola"
catalog_start_error_title: "Parola non aggiunta"
catalog_start_error_body:  "Non è stato possibile aggiungere la parola. Riprova."
```
Reuse `common_cancel`. If `meaning` is empty, build the body from a second key `catalog_start_body_nomeaning`: "Aggiungere «%{word}» al tuo vocabolario? Lo ripasserai a partire da domani." (7 keys in total.)

**Docs**: CLAUDE.md §7 "Streak": add "starting a word from a word list adds it to the vault but never touches the streak"; §5 Catalog row; CONTEXT.md decisions: second way into the vault, `source = 'catalog'`.

## Tests (write first, watch them fail)

`startLearning.test.ts` (in-memory `expo-sqlite` mock; also assert real schema columns where it matters)
- adds a bank word: row has `source 'catalog'`, article/translations/pos from the bank, `times_seen 1`, `times_used 0`, `retention_score 0.5`, `next_review_at` ≈ now + 1 day; returns `{ added: true, id }`.
- profile with `streak_days = 5`, `last_active_at`, `total_words_seen` set: all unchanged after the call; `daily_items` and `review_log` untouched.
- second call, and a call with different letter case of an existing row (`'tisch'` vs `'Tisch'`): `{ added: false }`, exactly one row.
- two parallel calls for the same word: one row, exactly one of them reports `added: true`.
- unknown word throws.
- `refreshReviewReminder` is called once after an add and not at all after `added: false`; a rejecting `refreshReviewReminder` does not fail the call.
- after adding, `pickNextWord`/`usedWords` never returns that word as the daily word (use the real picker with a level that has the word).
- a word added here is later saved as the daily word: `saveWord` takes the existing-vocab branch (`times_seen + 1`), no duplicate (regression for the interplay).

`useStartLearning.test.tsx` (mock `Alert` and the service)
- `start` shows the confirmation with the word and meaning; Cancel → service not called; Confirm → called with `(level, word)` and `onChanged` awaited after it.
- second `start` while the first alert is open or saving is ignored; after Cancel/dismiss it works again.
- service rejection → `console.error` + generic alert, no `e.message` anywhere in the alert args; guard released afterwards.

`CatalogScreen.test.tsx` / `StatsWordsScreen.test.tsx`
- an unsaved row is a button with the hint; pressing it opens the confirmation; confirming calls `startLearning` and the row becomes the "Nuova" row (mock `fetchSavedStates` to return the word on the second call); chip counts move.
- a saved row still navigates to the detail and never shows the confirmation.
- tier/“saved” lists (saved-only) have no start affordance.
- `uiStringsParity.test.ts` green with the 7 new keys.
- Guard check: remove the in-flight guard once and confirm the double-tap test goes red; make `startLearning` update the streak once and confirm the streak test goes red.

## Definition of Done
- [ ] All acceptance criteria checked; listed tests written first and green
- [ ] No hard-coded UI strings; no new dependency; no schema change
- [ ] Review checklist (CLAUDE.md §13): double taps and stale state, concurrency (two inserts), schedule side effects (a new word is due in 1 day, never today), the backup file now contains `source: 'catalog'` rows (restore inserts only existing columns — fine), unneeded files in the diff
- [ ] Conventional commit: `feat(TASK-037): start learning a word from any word list`
- [ ] `CONTEXT.md` updated in the same push; status set to `done`

## Notes for Tech Lead (remove before handing over)
- Rejected: tapping saves immediately with an undo toast (needs a delete path, which the app does not have and §4 says never drop data); a bottom sheet with the full word card (nice, bigger task — natural follow-up, and could host the speaker button of TASK-035); letting list-starts count for the streak (it would make the daily habit meaningless: one could bulk-add words to keep a streak, and the streak metric of §14 would stop measuring "opens the app for the word of the day").
- Product point to watch after release: learners may bulk-add hundreds of words and then face a large review queue 1 day later. If that shows up, consider a cap on new reviews per day (a separate task; not specced now).
- The first review is due in 1 day like the daily word. A "review right away" option would be a different product decision.
