# TASK-033 — Restore on a fresh install reports "couldn't restore" (database is locked)

**Status:** `done`
**Assigned to:** Developer — Product Owner reported it and asked for the whole cycle
**Written by:** Tech Lead
**Depends on:** TASK-030

## Bug report
Restoring a backup from the welcome screen of a freshly installed app showed "impossibile importare il backup", every time, from Drive or from local storage.
Phone log: `[Welcome] restore failed: NativeDatabase.execAsync has been rejected → database is locked`. The data WAS restored (the transaction had committed:
step log showed began → wiped → committed, then the error 36 ms later); only the report was wrong. A second try on an existing database file happened to work.

## Cause
`restoreBackup` ended with `resetDbHandle()`, which closed the old connection in the background. The welcome screen then called `rehydrateAfterRestore()` →
`getDb()` → a NEW connection (`useNewConnection: true`, TASK-030) whose first statement, `PRAGMA journal_mode = WAL`, hit SQLITE_BUSY while the old connection was
still closing and checkpointing the WAL of the just-restored data.

## Fix
- `resetDbHandle()` returns a promise that resolves after the old connection is closed (never rejects); `restoreBackup` awaits it before throwing `RESTART_REQUIRED`.
- `openRaw` retries the WAL pragma and the migrations up to 5 times (150 ms × attempt) while SQLite says "database is locked" / SQLITE_BUSY; other errors are not retried;
  a failed open is still not cached.

## Tests (written first, red before the fix)
`dbRestoreRace.test.ts` (retry then success, give up with the original error, no retry of other errors, resetDbHandle resolves after close, and when nothing is open),
`backup.test.ts` ("restore waits for the old connection to close…").

## Note
Auto-backup to a Google Drive folder is a separate problem (TASK-032): it never wrote, and its cause is still unknown.
