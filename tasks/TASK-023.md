# TASK-023 — Automatic backup to a user-chosen folder (ported from GymDiary TASK-006)

**Status:** `done` for the code and tests (uncommitted); the on-device checklist below is still to do
**Assigned to:** Developer
**Written by:** Tech Lead
**Depends on:** none (builds on `src/data/backup.ts`, TASK-018's opt-in key handling). Source design: `C:\Workspace\GiaMat90\GymDiary\tasks\TASK-006.md` and `lib/autoBackup.ts` — proven on a real device.

---

## Context

GermanBuddy has a manual backup (JSON via the share sheet) and, without anyone having planned it, Android's own cloud backup. Between manual
exports a lost phone loses everything learned since. GymDiary solved this with an **automatic backup to a folder the user picks once**, through Android's
Storage Access Framework (SAF). The folder picker lists every document provider on the phone — internal storage, SD card, and Google Drive / Dropbox when
their apps are installed. GermanBuddy only writes a file there; **if the folder is cloud-synced, that other app moves it off the phone. Our code never
touches a network, a token or a cloud SDK.** This task ports that design and adapts three things that differ here:

1. **What counts as a change.** GymDiary backs up when a workout is finished. GermanBuddy changes its data constantly (every review answer, saved word,
   grammar answer…), in ~16 places. The trigger is the database itself (a native change listener), and writes are **coalesced** (debounce) so a review session
   makes one backup, not twenty.
2. **The AI key never goes into an automatic backup.** The chosen folder may be synced to a cloud by another app.
3. **Android's own cloud backup is already on and is too broad** (see Part B).

---

## Scope

### In scope
- **Part A — the feature:** Settings section "Backup automatico" (switch, folder, "Back up now", last backup, error banner); SAF write + rotation; change tracking
  with debounce / max-wait / flush-on-background / persisted "dirty" flag; startup validation of a stale folder.
- **Part B — Android cloud-backup rules (recommended hardening, Product Owner may strike it before implementation):** an Expo config plugin that gives Android's
  own backup an allowlist, so the **AI API key and device-specific settings are no longer copied to the user's Google account**.
- i18n (it + en), tests, and the privacy-policy text changes (drafted, not published — see "Compliance").

### Out of scope
- Restoring from the folder inside the app (restore keeps using the existing "Ripristina da un backup" file picker, which can open files in Drive etc.).
- Encrypting backup files; incremental backups; any Drive/Dropbox SDK, OAuth or network call. **If the implementation needs any of those, stop and flag it** — the design has drifted.
- iOS (the SAF API is Android-only; the section is hidden and everything is a no-op there).
- A backup history browser; changing the manual export.

---

## Acceptance Criteria

**Part A**
- [ ] AC1: Settings → "I tuoi dati" (`settings_data_section`) gets a "Backup automatico" block (Android only) with: a switch (default **off**), a "Cartella di backup" row (shows "Cartella scelta" or "Non impostata"; tapping it opens the picker), a "Esegui backup ora" button, a "Ultimo backup" row (date and time, or "Mai"), and a hint that cloud-synced folders are carried off the phone by *their* app.
- [ ] AC2: The switch and the button are **independent**: the button works with the switch off and never changes it; enabling the switch is not needed to press it.
- [ ] AC3: Turning the switch on with no folder opens the picker; **cancelling leaves the switch off**. With a folder (picked now or earlier) it turns on and **immediately writes a first backup** (busy indicator; an Alert only if it fails).
- [ ] AC4: "Esegui backup ora" with no folder opens the picker first (cancel → nothing written, no error). With a folder it writes immediately: busy indicator, an Alert on success or failure; success updates "Ultimo backup" and clears the error flag.
- [ ] AC5: While the switch is on, **any change to backed-up data** (tables `learner_profile`, `daily_items`, `vocabulary_items`, `review_log`, `grammar_mastery`) is detected by the database change listener. Changes to `ai_word_notes` and `schema_meta` are ignored.
- [ ] AC6: Writes are coalesced: a burst of changes produces **one** backup 30 s after the last change; during continuous activity a backup still happens at most **5 min** after the first unsaved change; when the app goes to the background a pending backup is written immediately.
- [ ] AC7: A "dirty" flag is persisted. If the app is killed with unsaved changes, the next start (switch on, folder valid) writes a backup ~10 s after launch. The flag is cleared only by a successful write **that started after the last change**; a change that arrives mid-write schedules another backup.
- [ ] AC8: The file is byte-for-byte what `buildBackup()` produces — **without** the AI key or provider settings, even when the user has set them (the manual export's opt-in prompt is unchanged).
- [ ] AC9: File names are `germanbuddy-auto-YYYYMMDD-HHMMSS` (local time, sortable; the provider adds `.json` from the MIME type). At most **10** automatic files are kept; the oldest are deleted from a **list of URIs this feature wrote itself** (SAF listings are opaque), so manual exports and anything else in the folder are never touched. A failed delete stays tracked and is retried.
- [ ] AC10: All writes go through one queue (automatic, flush and manual never interleave).
- [ ] AC11: A failed automatic write never throws into the app, shows no alert, sets an error flag (and keeps the dirty flag). Settings then shows a non-blocking banner "Il backup automatico non funziona…" with "Scegli di nuovo la cartella"; choosing a folder clears the error and writes a backup.
- [ ] AC12: Turning the switch off cancels any pending timer and stops writes; files already written stay. Changing the folder starts a fresh rotation list (old files untouched) and marks data dirty so the new folder gets a copy.
- [ ] AC13: At every app start (Android), a saved folder that is no longer accessible (e.g. after reinstall, when Android's own backup restores the setting but the SAF grant is gone) is **silently reset** to switch off / "Non impostata", with no error banner. Startup is never blocked by it.
- [ ] AC14: The database opens with `enableChangeListener: true`; migrations and bootstrap writes are not counted (the listener is attached after bootstrap).
- [ ] AC15: No network call, no new dependency, no new Android permission. Errors are logged with `console.error` (names only, no learner content or keys); the UI shows generic i18n strings.

**Part B**
- [ ] AC16: A config plugin `plugins/withAndroidBackupRules.js` sets `allowBackup="true"`, `dataExtractionRules` and `fullBackupContent` so Android's cloud backup and device-to-device transfer include **only** the database (`SQLite/`) and the MMKV stores `app-meta`, `user-store`, `word-store`, `vault-store` — and **exclude** the stores `ai` (API keys), `notifications-store` and `auto-backup`.
- [ ] AC17: The XML is produced by exported pure functions, covered by unit tests; after a prebuild the generated `AndroidManifest.xml` references both XML files.

**Both**
- [ ] AC18: All existing tests pass; new tests green; `tsc --noEmit` clean; no hard-coded strings; role + label on every touchable; i18n keys identical in both languages.

---

## Technical Spec

### SDK note (differs from GymDiary)
GermanBuddy is on Expo SDK 51 (`expo-file-system` 17): import SAF from the **main entry**:
```ts
import * as FileSystem from 'expo-file-system';
const { StorageAccessFramework } = FileSystem;
```
(GymDiary uses `expo-file-system/legacy` because it is on a newer SDK; that subpath does not exist here.) `releasePersistableUriPermission` is not available — turning the switch off just stops writes.
Available: `requestDirectoryPermissionsAsync()` → `{ granted, directoryUri }`, `createFileAsync(parentUri, name, mime)`, `writeAsStringAsync`, `readDirectoryAsync`, `deleteAsync`.

### Files to create
```
mobile/src/lib/autoBackup/helpers.ts       — constants, autoBackupFileName(), filesToPrune()   (pure)
mobile/src/lib/autoBackup/scheduler.ts     — createBackupScheduler()                           (pure, injectable timers)
mobile/src/lib/autoBackup/index.ts         — SAF + glue: folder, write queue, run, validate, tracking
mobile/src/store/useAutoBackupStore.ts     — Zustand store persisted in MMKV (id 'auto-backup')
mobile/plugins/withAndroidBackupRules.js   — Part B (exports pure builders for tests)
mobile/__tests__/autoBackupHelpers.test.ts
mobile/__tests__/autoBackupScheduler.test.ts
mobile/__tests__/autoBackup.test.ts        — SAF write/rotate/run/validate/tracking with mocks
mobile/__tests__/AutoBackupSettings.test.tsx
mobile/__tests__/backupRulesPlugin.test.ts
```
### Files to modify
```
mobile/src/data/db.ts                  — openDatabaseAsync('germanbuddy.db', { enableChangeListener: true })
mobile/src/data/backup.ts              — export BACKUP_TABLES (= ALL_TABLES)
mobile/__mocks__/expo-sqlite.js        — addDatabaseChangeListener + automatic change events (see "Mocks")
mobile/src/screens/SettingsScreen.tsx  — the new section
mobile/app/_layout.tsx                 — startup: validate folder, start tracking, flush on background, retry if dirty
mobile/src/i18n/it.ts, en.ts           — strings
mobile/app.config.js                   — register the plugin (Part B)
CLAUDE.md                              — one rule line in §6 (automatic backups never contain AI keys)
```
(`CONTEXT.md` is updated in the same push, as always.)

### Constants and helpers (`helpers.ts`)
```ts
export const AUTO_BACKUP_KEEP = 10;          // more than GymDiary's 5: changes are far more frequent than workouts
export const DEBOUNCE_MS = 30_000;
export const MAX_WAIT_MS = 5 * 60_000;
export const STARTUP_RETRY_MS = 10_000;
export function autoBackupFileName(now: Date): string        // 'germanbuddy-auto-20261008-153045'
export function filesToPrune(uris: readonly string[], keep: number): string[]   // oldest first; uris.slice(0, length - keep) when length > keep
```

### Store (`useAutoBackupStore.ts`)
Zustand + MMKV (`new MMKV({ id: 'auto-backup' })`), hydrated synchronously at creation. Fields and setters:
`enabled: boolean (false)`, `folderUri: string | null`, `fileUris: string[]` (oldest first), `lastRunAt: string | null` (ISO), `error: boolean`, `dirty: boolean`.
Every setter writes through to MMKV. This store is **device-specific state, never part of a backup file**.

### Scheduler (`scheduler.ts`) — pure
```ts
export interface SchedulerDeps {
  run: () => Promise<void>;                       // performs one backup attempt (may reject)
  now?: () => number;                              // default Date.now
  setTimer?: (fn: () => void, ms: number) => unknown;   // default setTimeout
  clearTimer?: (id: unknown) => void;              // default clearTimeout
  debounceMs?: number; maxWaitMs?: number;         // defaults from helpers
}
export interface BackupScheduler {
  notifyChange(): void;      // a relevant change happened
  flush(): void;             // run now if something is pending (app going to background)
  cancel(): void;            // drop everything pending (switch turned off)
  isPending(): boolean;
}
export function createBackupScheduler(deps: SchedulerDeps): BackupScheduler
```
Semantics: `notifyChange` records `firstChangeAt` (if none) and (re)arms one timer for `min(debounceMs, firstChangeAt + maxWaitMs − now)` (never negative). When the timer fires, `run()` is called once. If a change arrives **while `run` is in progress**, one more run follows after it settles. A rejected `run` must not stop the scheduler (it is the caller's job to record the error). `flush()` cancels the timer and runs immediately if pending; with nothing pending it does nothing. `cancel()` clears the timer and pending state.

### SAF and glue (`index.ts`)
```ts
export async function requestAutoBackupFolder(): Promise<string | null>          // picker; null on cancel
export function commitAutoBackupFolder(folderUri: string): void                  // set uri, fileUris = [], error = false, dirty = true
export async function ensureAutoBackupFolder(): Promise<string | null>          // existing folder, else picker+commit, else null
export function writeBackupToFolder(folderUri: string): Promise<void>           // queued; throws on failure
export async function runAutoBackupIfEnabled(): Promise<void>                   // silent; never throws
export async function validateAutoBackupFolder(): Promise<void>                 // startup, never blocks
export function startAutoBackupTracking(): () => void                           // returns a stop function; idempotent
export function setAutoBackupEnabled(enabled: boolean): void                    // store + cancels the scheduler when turned off
```
**`writeBackupToFolder`** (module-level promise queue like GymDiary; a rejected write must not poison the queue):
1. `seq = changeSeq` (module counter incremented on every relevant change event).
2. `buildBackup()` — **never** `includeAiKey`.
3. `createFileAsync(folderUri, autoBackupFileName(new Date()), 'application/json')` → `writeAsStringAsync(fileUri, JSON.stringify(backup))`.
4. `uris = [...store.fileUris, fileUri]`; delete `filesToPrune(uris, AUTO_BACKUP_KEEP)` one by one; a failed delete stays in the list.
5. On success: `fileUris`, `lastRunAt = now ISO`, `error = false`, and `dirty = false` **only if `seq === changeSeq`**.
**`runAutoBackupIfEnabled`**: no-op unless `enabled && folderUri`; try `writeBackupToFolder`; on failure `console.error('[autoBackup] write failed', err?.name)`, `error = true`, keep `dirty`.
**Tracking** (`startAutoBackupTracking`, called once after bootstrap): subscribe with `addDatabaseChangeListener(e => …)`; for events whose `tableName ∈ BACKUP_TABLES`, if `enabled`: `changeSeq++`, `dirty = true` (set only when it was false — no MMKV write per row), `scheduler.notifyChange()`.
Also `AppState.addEventListener('change', s => s === 'background' → scheduler.flush())`. The scheduler's `run` is `runAutoBackupIfEnabled`.
**Startup retry:** after tracking starts, if `enabled && folderUri && dirty`, call `setTimeout(runAutoBackupIfEnabled, STARTUP_RETRY_MS)`.
**`validateAutoBackupFolder`**: if a folder is saved, `readDirectoryAsync(folderUri)`; on rejection reset `enabled=false, folderUri=null, fileUris=[], error=false, dirty=false` silently.
**`setAutoBackupEnabled(false)`**: store update and `scheduler.cancel()`.
Everything is a no-op unless `Platform.OS === 'android'`.

### `_layout.tsx`
After `bootstrapLocalData()`: on Android, `await validateAutoBackupFolder()` (wrapped in try/catch, never blocks), then `startAutoBackupTracking()` (store the stop function and call it in the effect cleanup).

### Settings UI (`SettingsScreen.tsx`)
A new section below the existing backup/restore card, **Android only**, same visual patterns as the AI section (rows in a card). Flat i18n keys, prefix `settings_autobackup_`:
- Switch row: label `settings_autobackup_toggle`, hint `settings_autobackup_toggle_hint`; `disabled` while busy.
  `onValueChange(true)`: `ensureAutoBackupFolder()`; `null` → leave off; else `setAutoBackupEnabled(true)`, then `writeBackupToFolder` with `busy='autobackup'` (failure → Alert `settings_autobackup_failed`; no success alert). `onValueChange(false)`: `setAutoBackupEnabled(false)`.
- "Cartella di backup" row: value `settings_autobackup_folder_set` / `settings_autobackup_folder_unset`; tap → `requestAutoBackupFolder()` → `commitAutoBackupFolder` → (if enabled) `runAutoBackupIfEnabled()`.
- "Esegui backup ora" row: `ensureAutoBackupFolder()`; `null` → nothing; else `writeBackupToFolder` with `busy`, Alert `settings_autobackup_success` / `settings_autobackup_failed`.
- "Ultimo backup" row: `new Date(lastRunAt).toLocaleString(nativeLanguage === 'en' ? 'en-US' : 'it-IT')` or `settings_autobackup_never`.
- Error banner when `error`: text `settings_autobackup_error`, action `settings_autobackup_error_action` (opens the picker, commits, writes).
- Footnote `settings_autobackup_hint`: any folder works; if it is kept in sync by Google Drive/Dropbox, *that app* — not GermanBuddy — keeps a cloud copy; the AI key is never included.

### i18n (add to both; keys identical)
```
settings_autobackup_section:      'Backup automatico'                      | 'Automatic backup'
settings_autobackup_toggle:       'Salva automaticamente'                  | 'Back up automatically'
settings_autobackup_toggle_hint:  'Scrive una copia nella cartella scelta poco dopo ogni modifica dei tuoi dati'
                                  | 'Writes a copy to the chosen folder shortly after your data changes'
settings_autobackup_folder:       'Cartella di backup'                     | 'Backup folder'
settings_autobackup_folder_set:   'Cartella scelta'                        | 'Folder selected'
settings_autobackup_folder_unset: 'Non impostata'                          | 'Not set'
settings_autobackup_now:          'Esegui backup ora'                      | 'Back up now'
settings_autobackup_success:      'Backup salvato'                         | 'Backup saved'
settings_autobackup_failed:       'Backup non riuscito'                    | 'Backup failed'
settings_autobackup_picker_failed:'Impossibile aprire la selezione della cartella' | "Couldn't open the folder picker"
settings_autobackup_last:         'Ultimo backup'                          | 'Last backup'
settings_autobackup_never:        'Mai'                                    | 'Never'
settings_autobackup_error:        'Il backup automatico non funziona. La cartella potrebbe essere stata spostata o eliminata.'
                                  | "Automatic backup isn't working. The folder may have been moved or removed."
settings_autobackup_error_action: 'Scegli di nuovo la cartella'            | 'Choose folder again'
settings_autobackup_hint:         'Scegli una cartella qualsiasi. Se è sincronizzata da Google Drive, Dropbox o simili, è quell\'app — non GermanBuddy — a tenerne una copia anche online. La chiave API dell\'AI non è mai inclusa.'
                                  | 'Pick any folder. If it is kept in sync by Google Drive, Dropbox or similar, that app — not GermanBuddy — also keeps a copy online. The AI API key is never included.'
```

### Mocks (`__mocks__/expo-sqlite.js`)
Export `addDatabaseChangeListener(listener)` (returns `{ remove() }`); the in-memory DB emits `{ databaseName: 'main', databaseFilePath: name, tableName, rowId: 0 }` after every `INSERT`/`UPDATE`/`DELETE` it runs (table name parsed from the statement) so tests can prove that **real service writes** reach the tracker; export `__emitChange(tableName)` for direct use; record the `options` argument of `openDatabaseAsync` (`__lastOpenOptions`) so a test can assert `enableChangeListener: true`; `__reset` clears the listeners.
Tests set `Platform.OS = 'android'` explicitly (jest-expo defaults to iOS) and mock `expo-file-system`'s `StorageAccessFramework` (picker result, files created, written content, deletes, directory reads).

### Part B — `plugins/withAndroidBackupRules.js`
Adapt GymDiary's `plugins/withAndroidBackupRules.js` (pattern: write two XML files under `android/app/src/main/res/xml/`, then set the three `<application>` attributes). Export `buildDataExtractionRules()` and `buildFullBackupContent()` returning the XML strings:
```xml
<!-- data-extraction-rules (API 31+): the same <include>/<exclude> inside <cloud-backup> and <device-transfer> -->
<include domain="file" path="SQLite/" />
<include domain="file" path="mmkv/" />
<exclude domain="file" path="mmkv/ai" />
<exclude domain="file" path="mmkv/ai.crc" />
<exclude domain="file" path="mmkv/notifications-store" />
<exclude domain="file" path="mmkv/notifications-store.crc" />
<exclude domain="file" path="mmkv/auto-backup" />
<exclude domain="file" path="mmkv/auto-backup.crc" />
<!-- full-backup-content (API <= 30): the same entries -->
```
(MMKV keeps each store as `files/mmkv/<id>` plus `<id>.crc` — `react-native-mmkv` roots at `getFilesDir()/mmkv`; the Developer confirms the names once on a device with a debuggable build or `adb shell run-as`.) Register `'./plugins/withAndroidBackupRules'` in `app.config.js` `plugins`.

---

## Tests (write FIRST, see them fail)

`autoBackupHelpers.test.ts`: file name format and zero-padding (`new Date(2026, 9, 8, 5, 3, 9)` → `…-20261008-050309`); names sort chronologically; `filesToPrune`: none / fewer than keep / exactly keep / more than keep (oldest first) / empty.

`autoBackupScheduler.test.ts` (fake timers and a fake clock): a burst of 5 changes → one run, 30 s after the last; a change at 29 s resets the timer; continuous changes every 20 s for 6 min → a run at ≤ 5 min after the first, then again; `flush()` runs now and cancels the timer; `flush()` with nothing pending does nothing; a change during a run → exactly one follow-up run; a rejected run does not stop later runs; `cancel()` drops a pending run; `isPending()`.

`autoBackup.test.ts` (SAF mocked, store reset, sqlite mock):
- `writeBackupToFolder`: creates `germanbuddy-auto-…` with MIME `application/json`; the written JSON equals `buildBackup()`; **does not contain the AI key even when `anthropic`/`openai` keys are set**; tracks the URI; with 12 successive writes only 10 URIs remain tracked and the 2 oldest were deleted; a failed delete stays tracked and is retried on the next write; two concurrent writes never interleave (createFile calls are sequential); success sets `lastRunAt`, clears `error`.
- `dirty`: cleared by a success with no change in between; kept when a change event arrives during the write.
- `runAutoBackupIfEnabled`: disabled → no SAF call; no folder → no call; failure → `error=true`, `dirty` kept, no throw, logs only the error name.
- `ensureAutoBackupFolder`: existing / picks and commits / cancel → `null`. `commitAutoBackupFolder` resets `fileUris`, clears `error`, sets `dirty`.
- `validateAutoBackupFolder`: unreadable folder → silent reset (switch off, folder null, no error flag); readable → unchanged; no folder → no call.
- Tracking: with the switch on, a **real** `saveWord()` and a `gradeReview()` (through the sqlite mock) call the scheduler; writes to `ai_word_notes` / `schema_meta` do not; with the switch off nothing is tracked; `AppState` `background` flushes; the returned stop function unsubscribes; calling `startAutoBackupTracking` twice does not double-subscribe; startup with `dirty` schedules a run after `STARTUP_RETRY_MS`.
- `getDb()` opens with `{ enableChangeListener: true }`.
- Everything is a no-op when `Platform.OS !== 'android'`.

`AutoBackupSettings.test.tsx` (Android): the section shows the three states ("Non impostata"/"Mai", folder set, last backup date); switch on with no folder → picker; cancel → switch stays off and nothing is written; granted → switch on and a first backup is written; the button works with the switch off and does not change it; the button with no folder opens the picker, cancel writes nothing and shows no alert; failure shows the Alert; the error banner appears when `error` and its action re-picks and clears it; the section is absent on iOS; switch turned off cancels pending work.

`backupRulesPlugin.test.ts`: both XML strings contain the includes and every exclude from Part B, are well-formed, and the data-extraction XML has both `<cloud-backup>` and `<device-transfer>`; a stub manifest gets the three attributes.

### Manual checklist on the phone (cannot be automated)
- [ ] Enable → pick a plain folder (e.g. Downloads) → a first `germanbuddy-auto-….json` appears; "Ultimo backup" updates
- [ ] Save a word / answer a review → ~30 s later a new file appears; a burst of answers produces one file
- [ ] Change something, then switch apps within 30 s → the file is written at once
- [ ] Switch off, change data → no file; "Esegui backup ora" still writes
- [ ] Make 12+ backups → exactly 10 auto files remain; a manual export in the same folder is untouched
- [ ] Open the file → no AI key or provider; restore it with "Ripristina da un backup" → data comes back
- [ ] Pick a folder inside the Google Drive app (installed, signed in) → file lands there
- [ ] Delete/move the folder, change data → no crash, no alert, banner appears; "Scegli di nuovo" fixes it
- [ ] Install a build over the previous one (no uninstall) → existing data intact, new section present, switch off
- [ ] Uninstall + reinstall → the setting comes back off/"Non impostata"; old backup files still in the folder
- [ ] Part B: after a prebuild the manifest references `data_extraction_rules` and `full_backup_content`

---

## Compliance (do alongside the code)
- **Support site (`germanbuddy-support/`, a separate repo — draft only, the Product Owner publishes):** the privacy policy §5 says backups are "entirely user-initiated"; it must say that an **optional automatic backup** writes a copy to a folder the user chooses after changes, that if the folder is synced by a cloud app that app (not us) uploads it, that the file never contains the AI key, and that **Android's own device backup (if the user has it enabled in the phone settings) may copy the app's database and settings to the user's Google account, which we neither control nor receive** (and that with this release the AI key is excluded from it). The delete-account page should say backup files already written to a chosen folder stay there until the user deletes them.
- **Play Data safety form:** no change expected — GermanBuddy still collects and shares nothing; re-check at release time.
- **`CLAUDE.md` §6:** add one line: automatic backups never contain AI keys or provider settings.

---

## Definition of Done
- [ ] AC1–AC18 checked; all new and existing tests green; `tsc --noEmit` clean
- [ ] Manual checklist done on the phone (Part A at least; Part B after the next prebuild)
- [ ] Support-site text drafted and handed to the Product Owner
- [ ] `CONTEXT.md` updated in the same push; conventional commit `feat(TASK-023): automatic backup to a chosen folder`
- [ ] Status → `done`

---

## Implementation notes and review fixes

- **Result:** 442 tests pass in 37 suites (the feature adds about 90); `tsc --noEmit` clean. AC17 was verified on a real `expo prebuild`: the manifest has `allowBackup="true"`, `dataExtractionRules` and `fullBackupContent`, and the generated XML has the includes and the `ai`, `notifications-store` and `auto-backup` excludes. Nothing here was run on a phone yet.
- **Decisions made while implementing (not in the original spec):**
  - A manual "Esegui backup ora" that fails also raises the error flag, so the banner offers "Scegli di nuovo la cartella" (as in GymDiary). The first backup after enabling does the same.
  - The scheduler's follow-up run after a change that arrived mid-write waits the normal debounce, except when the app is going to the background (flush), which runs it immediately.
  - The silent path (`runAutoBackupIfEnabled`) does nothing when nothing is unsaved (`dirty` false), so the startup retry and a scheduled run cannot write the same data twice. "Esegui backup ora" and the first backup on enabling always write.
  - If creating the file works but writing its content fails, the empty file is deleted (otherwise rotation, which only knows files we recorded, would never find it).
- **Review findings, each reproduced by a failing test first:**
  1. *Slow folder check delayed change tracking.* The layout awaited the folder check before tracking, so a slow provider (Drive offline) meant changes in that window were never marked unsaved. Now `initAutoBackup()` starts tracking immediately and checks the folder in the background.
  2. *Duplicate backups after a restart with unsaved changes* (startup retry at 10 s plus a scheduled run at 30 s). Fixed by the `dirty` gate above.
- **Test-infrastructure notes:** the jest MMKV mock shares one dictionary across store ids (so the new store's keys are uniquely prefixed `autoBackup…`); the SQLite mock now emits change events on writes and exposes `__emitChange`, `__listenerCount`, `__lastOpenOptions`; jest-expo defaults to iOS, so tests use `jest.replaceProperty(Platform, 'OS', …)`.
- **Support site:** the privacy-policy §5 and third-party table and the delete-account page are drafted in the local `germanbuddy-support/` repo, **uncommitted and unpublished**.
- **Still to do:** the manual checklist on a phone (real folder, a Google Drive folder, deleted folder, install-over, reinstall, and Part B after the next prebuild), and the Product Owner's decision to publish the support-site text.

---

## Notes for Product Owner (Tech Lead's rationale)

- **What was ported from GymDiary and why it is trusted:** the two independent controls (switch + "Back up now"), the SAF folder, rotation by tracked URIs (SAF listings are opaque), a serialized write queue, silent failure with a banner, and startup validation of a stale folder. All six bugs its code review found are designed out here (stale folder after reinstall, leaked files on failed delete, concurrent writes, toggle without busy/error handling, duplicated picker logic, dead test stubs).
- **What is different:** the trigger (native SQLite change events instead of one call site), coalescing (a review session of 10 answers is one backup, not ten, so a 10-file history covers days, not minutes), the first backup on enable, a persisted dirty flag, and **no AI key in automatic files**.
- **Finding for you — Android's cloud backup is already on and too broad.** `AndroidManifest.xml` has `allowBackup="true"` with no rules, so Android may already copy the whole app data (database and every MMKV store, **including the one that holds the AI API key**) to the user's Google account. It is Google's feature, encrypted and tied to the account, but it contradicts the "the key stays on this phone" wording and the new device-specific folder setting would travel with it. Part B fixes that with an allowlist. Trade-off: after reinstalling or moving to a new phone the AI key is **not** restored automatically; the learner enters it again. Strike Part B if you prefer the old behaviour.
- **Honest limits:** cloud-synced folders upload on their app's schedule; Android may kill a background write (the persisted flag retries at the next start); each write is a full dump (fine at this size); a restored backup replaces data and, being a change, produces a fresh backup on the next start.
- **Plan B if the native change listener misbehaves on the phone:** replace its source with a thin wrapper that reports writes from `getDb()`; the scheduler API is the seam, so nothing else changes.
- **Numbering:** the compound-noun builder, previously pencilled in as TASK-023, becomes the next free number when it is written.
