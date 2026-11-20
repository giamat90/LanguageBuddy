# TASK-034 — Tell the learner when a backup folder cannot be written (Google Drive)

**Status:** `done`
**Assigned to:** Developer — Product Owner asked for the whole cycle
**Written by:** Tech Lead
**Depends on:** TASK-032

## Context
Diagnosed on a phone with TASK-032's log: a Google Drive folder fails at the `create` step with `Location '…' isn't writable` (expo-file-system's
`DocumentFile.canWrite()` is false for Drive's document provider); a folder in phone storage works. "Esporta backup" works with Drive only because the Drive app
uploads the shared file itself. So automatic backup cannot use Drive folders, and the app must say so instead of showing "the folder may have been moved".

## Scope
In: `writeNow` throws `FolderNotWritableError` (exported from `lib/autoBackup`) when the `create` step fails; Settings, on that error (switch on, "Esegui backup ora",
choosing a folder while the switch is on), turns the switch off, forgets the folder and the error flag, and shows a dedicated alert ("Cartella non utilizzabile",
body pointing to phone storage); other failures keep today's behaviour ("Backup non riuscito", banner). `settings_autobackup_hint` no longer claims a Drive-synced
folder works (13 languages); privacy policy wording in `germanbuddy-support/`.
Out: Drive API / OAuth / any network code, native modules, a write probe at pick time (the first real backup is the probe).

## Acceptance Criteria
- [ ] A failing `create` rejects with `FolderNotWritableError`; a failing `write` does not.
- [ ] Switch toggled on with an unwritable folder: alert shown, switch off, folder unset, no error banner.
- [ ] "Esegui backup ora" with an unwritable folder: same alert and reset; with a write failure: "Backup non riuscito" and banner as before.
- [ ] Choosing a new unwritable folder while the switch is on: same alert and reset.
- [ ] New keys and the new hint exist in all 13 languages (parity test).
- [ ] `tsc` clean, `npm test` green, `CONTEXT.md` updated, support-site text corrected.
