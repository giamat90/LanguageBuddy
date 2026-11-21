# TASK-050 — Remove the Android permissions the apps do not use

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-049

## Context
TASK-049's prebuild check found four permissions in the generated manifest beyond the three declared in `app.config.js`, in both apps:

| Permission | Source | Needed? |
|---|---|---|
| `INTERNET` | RN/Expo template | **Yes**: the optional AI call (`lib/ai/`). Keep. |
| `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` | the library manifest of `expo-file-system` (not the template) | **No** (see below) |
| `SYSTEM_ALERT_WINDOW` | Expo template (development overlay) | **No**; does nothing in a release build |

Why storage is not needed: export writes to the app's own cache folder and opens the share sheet; import uses the system document picker; automatic backup writes through the Storage Access Framework (`StorageAccessFramework.requestDirectoryPermissionsAsync`) to a folder the learner picks. None of these needs a storage permission; on Android 10+ the two permissions are ignored for them anyway, and nothing in `src/` or `app/` uses `PermissionsAndroid`, `MediaLibrary` or external paths. Play's permission declarations ask about all three, so removing them shortens the review of both apps. This changes the **German app** too, so it is a deliberate task, with a phone check before release.

## Scope
### In
1. Block the three permissions through `android.blockedPermissions` in `buildExpoConfig` (`scripts/lib/variants.js`), for every variant. (Expo writes `tools:node="remove"` entries, which also removes the ones that `expo-file-system`'s library manifest merges in.)
2. `scripts/lib/prebuildCheck.js`: the allow-list of extras shrinks to `['android.permission.INTERNET']`; the three blocked ones become explicit **forbidden** permissions with their own message.
3. A phone checklist for the German app and the Spanish one's existing checklist updated.
4. `CONTEXT.md`, spec status.

### Out
Removing `INTERNET` (needed), changing backup behaviour, any release or upload, adding permissions.

## Acceptance Criteria
- [ ] `buildExpoConfig` output has `android.blockedPermissions` equal to the three, for de and es; the declared `permissions` list is unchanged.
- [ ] **The merged manifest really lacks them.** `expo prebuild` only writes the app manifest; the library merge happens in Gradle. So the check cannot rely on the prebuild alone: the Developer must (a) run `verify-prebuild` and see the blocked entries (`tools:node="remove"`) in the app manifest, and (b) if the Android toolchain is present, build once and read the merged manifest (`app/build/intermediates/merged_manifests/release/**/AndroidManifest.xml`, or `aapt dump permissions` on the AAB/APK) and report the permission list. If no toolchain: say so; the phone/AAB check below then covers it.
- [ ] `checkPrebuild` accepts a project whose manifest has the three as `tools:node="remove"` and **rejects** one that still declares them as plain `<uses-permission>`; unknown permissions still fail.
- [ ] Both `verify-prebuild.mjs de` and `… es` pass; their output is in the report.
- [ ] `npx tsc --noEmit`, `npm test`, `npm run test:app -- es` green; seams unchanged.

## Technical Spec
### Files to modify
```
mobile/scripts/lib/variants.js        add blockedPermissions to the android block
mobile/scripts/lib/prebuildCheck.js   KNOWN_EXTRA_PERMISSIONS = [INTERNET]; FORBIDDEN_PERMISSIONS; accept tools:node="remove" lines
mobile/__tests__/variants.test.ts     config test
mobile/__tests__/prebuildCheck.test.ts  fixtures: removed entries pass; plain declarations fail; update the good manifest
store/es/qa-checklist.md              add rows (below)
CONTEXT.md, tasks/TASK-050.md (status)
```
```js
// variants.js, android block
blockedPermissions: [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.SYSTEM_ALERT_WINDOW',
],
```
In `checkPrebuild`, a permission counts as **declared** only for a `<uses-permission>` element **without** `tools:node="remove"`. Forbidden ones that are declared produce `forbidden permission <name>`; the same names with `tools:node="remove"` are fine. Look at a real prebuild's manifest first and match what Expo actually writes (do not guess the attribute order).

### Phone checklist rows (add to `store/es/qa-checklist.md`, and run the same on GermanBuddy)
Section 8 (Backup), new rows: 8.5 export, share to Drive/Gmail/Files; 8.6 import the exported file through the document picker (also from Downloads); 8.7 automatic backup to a folder in phone storage (create, change, files appear); 8.8 app info → Permissions shows no storage permission. Run on the **oldest Android the Product Owner has** (ideally 9 or lower, where the storage permissions used to matter) and on a current one. Any failure here means: revert the three entries (keep the check change), report, stop.

## Tests (write first, see them red)
- `variants.test.ts`: the config of every variant blocks exactly the three and still declares the three originals.
- `prebuildCheck.test.ts`: good manifest now has the three as removed entries; mutation "plain READ_EXTERNAL_STORAGE" → `forbidden permission`; mutation "unknown permission" still fails; the old "INTERNET only extra" case passes.
- Guard: remove `blockedPermissions` from the config once and watch `verify-prebuild` fail on the real project.

## Definition of Done
- [ ] Criteria checked, red before green, guard done
- [ ] Report: both `verify-prebuild` outputs; the merged-manifest permission list if a toolchain exists; the exact line Expo writes for a blocked permission
- [ ] Diff review: only the files above changed
- [ ] `CONTEXT.md` updated (050 done; "phone check of backup on an old and a new Android pending" under what is manual); commit `feat(TASK-050): drop unused Android permissions`

## Notes for Tech Lead (remove before handing over)
- Rejected: dropping only `SYSTEM_ALERT_WINDOW` (leaves the two storage ones, which Play also asks about); setting `permissions` to a closed list (Expo still merges library manifests, so only `blockedPermissions` removes them).
- Risk: Android 7–9 (minSdk 24) still honours the storage permissions. The three flows above never use external paths, but this is the one thing the code reading cannot prove, hence the phone rows. If a flow fails there, the fallback is to keep only the two storage entries (`maxSdkVersion` is not settable through config; would need a plugin: a separate task).
- The German app is on Play already: ship this with the next German release and mention the permission reduction in the release notes only if Play's form changes.
