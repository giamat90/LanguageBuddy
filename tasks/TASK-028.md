# TASK-028 — Release guard: check Play's versionCode, tag every release

**Status:** `done`
**Assigned to:** Developer (Sonnet) — Product Owner asked for the whole cycle
**Written by:** Tech Lead
**Depends on:** none

---

## Context

On 2026-11-13 the release workflow was dispatched with versionCode 15, which Play had already used (an upload nobody recorded);
the build ran for minutes before Play rejected it. Earlier, 12 failed the same way. Rule from the Product Owner: **always check which
version is already on Play**. Releases are also not marked in git, so there is no way to tell which commit is on the store.

---

## Scope

### In scope
- `mobile/scripts/lib/playVersion.js` — pure helpers + a Play Developer API reader (injectable `fetch`, no new dependency).
- `mobile/scripts/check-play-version.js` (+ `npm run check:play-version`) — prints the codes Play holds; with a requested code, exits 1 unless it is higher.
- `release-android.yml`: (1) a guard step before the build, (2) a tag step after a successful publish, (3) `permissions: contents: write`.
- Release tags `v<versionName>` (e.g. `v1.0.16`), created by the workflow on the built commit, only after Play accepted the upload.
- Docs: CONTEXT.md release section.

### Out of scope
- Back-tagging old releases (their commits are unknown).
- GitHub Releases / changelog generation.
- Changing how the default versionCode (run number) is chosen.

---

## Acceptance Criteria

- [ ] AC1: `usedVersionCodes` merges codes from every track release and from the uploaded-bundles list (a bundle on no track still burns its code); strings and numbers both parsed; junk ignored.
- [ ] AC2: `assertNewVersionCode(requested, used)` throws a clear message unless `requested` is an integer > the highest used; empty `used` accepts any positive integer.
- [ ] AC3: `fetchPlayVersionCodes` signs a service-account JWT (RS256), exchanges it, opens an edit, lists tracks and bundles, **always deletes the edit** (also on error), and never puts the key or token in an error message.
- [ ] AC4: CLI exit codes: 0 ok, 1 requested code not higher, 2 usage/auth/API error. It prints the highest code and the requested one, no secrets.
- [ ] AC5: The workflow fails **before** prebuild/build when the code is not higher, and fails if tag `v<versionName>` already exists on the remote.
- [ ] AC6: After "Publish to Google Play" succeeds the workflow pushes tag `v<versionName>` pointing at `github.sha`; a failed publish creates no tag.
- [ ] AC7: Tag name derives from `app.config.js` (`expo.version` with `ANDROID_VERSION_CODE` set), never typed by hand.
- [ ] AC8: `tsc` clean, `npm test` green.

---

## Technical Spec

```
scripts/lib/playVersion.js          usedVersionCodes(tracks, bundles), assertNewVersionCode(req, used),
                                    releaseTag(version), fetchPlayVersionCodes({ serviceAccount, packageName, fetchImpl })
scripts/check-play-version.js       CLI wrapper (env GOOGLE_PLAY_SERVICE_ACCOUNT_JSON or --key <file>)
__tests__/playVersion.test.ts       unit tests (fetch mocked) + CLI spawn tests + workflow-file guards
.github/workflows/release-android.yml
```
API: `POST /androidpublisher/v3/applications/{pkg}/edits`, `GET .../edits/{id}/tracks`, `GET .../edits/{id}/bundles`, `DELETE .../edits/{id}`.
Token: `https://oauth2.googleapis.com/token`, scope `https://www.googleapis.com/auth/androidpublisher`.
Workflow tag step: `git tag <tag> $GITHUB_SHA && git push origin <tag>`; guard step uses `git ls-remote --tags origin`.

## Tests (first)
helpers (merge, junk, empty, strings), assert (equal, lower, non-integer, empty), fetch flow with a mocked `fetch` (call order, edit deleted on success **and** on failure, no secret in errors),
CLI via `spawnSync` with a missing key (exit 2) and with `--used` offline mode, `releaseTag`, workflow-file guards (guard step precedes build; tag step follows publish; `contents: write`).

## Notes
- The CLI has an offline `--used 12,13,14` switch so the comparison is testable without the network.
- Editing a Play "edit" without committing it changes nothing on the store; it is deleted at the end.
