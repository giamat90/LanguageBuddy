# TASK-030 — Database handle dies: self-healing `getDb()` and generic load errors

**Status:** `done`
**Assigned to:** Developer — Product Owner reported the bug and asked for the whole cycle
**Written by:** Tech Lead
**Depends on:** none

## Bug report
The learner saved the word of the day, later tapped the daily-word notification: the app showed its error screen, "Riprova" kept
returning to it, and after closing and reopening the home screen showed
`Call to function 'NativeDatabase.prepareAsync' has been rejected. → Caused by: java.lang.NullPointerException`.

## Root cause (read in `expo-sqlite` 15.2.14 / `expo-modules-core`, not reproduced on a device)
- `NativeDatabase` is a shared object; `sharedObjectDidRelease()` calls `ref.close()`, after which every JNI call throws a bare NPE.
- Opening the same database a second time in a process (the restore flow calls `resetDbHandle()`, then `getDb()` again) returns the module-cached
  native object wrapped in a NEW JS object. Garbage-collecting the OLD wrapper releases the shared handle and kills the new one. Timing = GC.
- Our `getDb()` cached that dead handle (and any rejected open) for the life of the process, so Retry could never recover; the process survives
  "closing" the app, so the error survived reopening.
- `VaultScreen` printed `e.message` (the native text on the screenshot), against CLAUDE.md §13.

## Scope
In: `data/db.ts` (own connection per open, no cached failure, replace a dead handle once + retry, no retry mid-transaction, close on reset),
`VaultScreen` and `TopicsScreen` generic errors. Out: `SettingsScreen` backup alerts and `AppErrorBoundary` text, notification-tap routing, schema.

## Acceptance Criteria
- [x] AC1: a failed open is not cached; the next `getDb()` retries.
- [x] AC2: every open uses `useNewConnection: true` and keeps `enableChangeListener: true`.
- [x] AC3: a dead handle (NPE / "Access to closed resource") is replaced and the query succeeds; concurrent failures cause ONE reopen; a failure that survives a fresh connection is reported, not looped; other SQL errors are not retried.
- [x] AC4: a handle that dies inside a transaction is never continued on another connection; one dead before the transaction began is replaced.
- [x] AC5: `resetDbHandle()` closes the old connection.
- [x] AC6: Vault and Topics screens show a generic i18n error and `console.error` the cause.
- [x] AC7: `tsc` clean, `npm test` green.

## Tests
`dbRecovery.test.ts` (new, 10), `dbDeadHandle.integration.test.tsx` (new, 3: restore then a dead handle with real services; Today screen with a dead handle; "Riprova" when the replacement also fails once), `VaultScreen.test.tsx` (+1), `TopicsScreen.test.tsx` (new, 1). Guards verified by removing each once (retry-in-transaction, handle identity check, failed-open caching): each turned a test red.

Not testable in Jest: the native release of a shared handle on garbage collection (the mock is JS). Needs the phone test listed in CONTEXT.md.
