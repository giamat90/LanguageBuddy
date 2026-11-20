# TASK-032 — Automatic backup to a Google Drive folder fails: diagnostics and honest message

**Status:** `done`
**Assigned to:** Developer — Product Owner asked for the whole cycle
**Written by:** Tech Lead
**Depends on:** TASK-023

## Bug report
A learner chose a Google Drive folder; "Esegui backup ora" shows "Backup non riuscito" and the banner "la cartella potrebbe essere stata spostata o eliminata".
The folder exists. The cause is unknown: the write (`createFileAsync` / `writeAsStringAsync`) fails, but only `err.name` is logged and every failure shows the same text.

## Scope
In: step-tagged failure log (`build` / `create` / `write`) with the error name and code, never the message; the banner text (`settings_autobackup_error`) no longer
claims the folder was moved or deleted (13 languages).
Out: the actual fix for Drive (needs the logged step/code from a phone first); any behaviour change of the writing or rotation.

## Acceptance Criteria
- [x] A failing write logs the step and the error code; never the error message.
- [x] The banner text blames neither a move nor a deletion, in all 13 files.
- [x] `tsc` clean, `npm test` green.

## Tests (written first)
`autoBackup.test.ts`: "failure diagnostics (TASK-032)" (step + code logged, message not; write step named) and "error banner wording".

## Next step
Get the log from a phone with a Drive folder (`adb logcat -s ReactNativeJS`, tap "Esegui backup ora": line `[autoBackup] step failed <step> <name> <code>`), then spec the real fix as TASK-033.
