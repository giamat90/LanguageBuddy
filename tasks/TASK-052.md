# TASK-052 — GermanBuddy 1.0.21: release with the permission reduction

**Status:** `ready`
**Assigned to:** Product Owner (Giacomo) — not a Developer task; Claude can help on request
**Written by:** Tech Lead
**Depends on:** TASK-050, TASK-051 (CI) or a local build

## Context
1.0.20 was built before TASK-050 dropped the unused storage and overlay permissions. The 1.0.20 AAB is not yet on Play. Decide: upload it as is, or rebuild so the reduction ships now.

## Steps
1. Check the highest versionCode on Play first (never trust CONTEXT.md).
2. Install a build of GermanBuddy on your oldest and newest phone and run `store/es/qa-checklist.md` rows 8.5–8.8 (backup export, import, automatic backup, app info → Permissions shows no storage permission).
3. If a backup flow fails on an old Android: revert the three `blockedPermissions` entries in `mobile/scripts/lib/variants.js`, keep the check change, tell Claude.
4. Build: `build_bundle_android_release.bat de` (needs `release.keystore`), or run `release-android.yml` with `app=de`. Bump the versionCode in `mobile/variants/de.json` first.
5. Upload to Play, fill release notes. Do not mention permissions unless Play's form changes.

## Done when
- [ ] AAB with the highest versionCode uploaded
- [ ] Backup rows 8.5–8.8 OK on an old and a new phone
- [ ] `CONTEXT.md` updated with the released version
