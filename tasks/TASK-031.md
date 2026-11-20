# TASK-031 — Do not require the portrait screen feature (Play device availability)

**Status:** `done`
**Assigned to:** Developer — Product Owner asked for the whole cycle
**Written by:** Tech Lead
**Depends on:** none

## Context
Play Console warns that `android.hardware.screen.portrait` is a required hardware feature and hides the app from landscape-only
devices (Android XR, some tablets, ChromeOS, TV). The requirement is implied by `orientation: 'portrait'` (activity
`screenOrientation="portrait"`). The app stays locked to portrait; the feature just must not be *required*.

## Scope
### In scope
- Config plugin `plugins/withOptionalPortrait.js` adding `<uses-feature android:name="android.hardware.screen.portrait" android:required="false"/>` to the manifest.
- Register it in `app.config.js`.
### Out of scope
- Changing `orientation`, supporting landscape layouts, any other `uses-feature`.
- The Data safety form (separate, done in Play Console).

## Acceptance Criteria
- [ ] AC1: after prebuild the manifest contains exactly one `uses-feature` for `android.hardware.screen.portrait` with `android:required="false"`.
- [ ] AC2: an existing entry (e.g. `required="true"`) is overridden, not duplicated; other `uses-feature` entries are untouched; idempotent.
- [ ] AC3: the plugin is registered in `app.config.js`; `orientation` stays `'portrait'`.
- [ ] AC4: `npx tsc --noEmit` and `npm test` green.

## Technical Spec
Files to create: `mobile/plugins/withOptionalPortrait.js` (exports the plugin plus pure `setPortraitOptional(manifest)` operating on the xml2js
manifest object, `manifest['uses-feature']` array), `mobile/__tests__/optionalPortraitPlugin.test.ts`.
Files to modify: `mobile/app.config.js` (register the plugin; leave the versionCode fallback alone, the release flow bumps it after checking Play).

## Tests (write first)
- adds the entry when `uses-feature` is missing
- overrides `required="true"`, no duplicate
- keeps other features
- idempotent
- registered in `app.config.js` and orientation still `portrait`

## Definition of Done
- [ ] ACs checked, tests green, `CONTEXT.md` updated, commit `feat(TASK-031): …` (only when asked)

## Notes
Landscape-only devices will run the app in a portrait window; acceptable and untested on such hardware.
