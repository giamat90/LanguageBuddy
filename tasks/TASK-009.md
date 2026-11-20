# TASK-009 — Firebase Project Setup & Google Sign-In Fix

**Status:** `ready`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Depends on:** TASK-008 (done)

---

## Context

After TASK-008 the Expo app builds and launches on Android, but tapping "Accedi con Google" returns a `DEVELOPER_ERROR` (Google Sign-In error code 10). Root cause: the `mobile/google-services.json` copied from `android_legacy/` is a placeholder with fake project IDs, an empty `oauth_client` array, and the wrong package name (`com.wortschatz` instead of `com.germanbuddy`). Additionally, the debug SHA-1 keystore fingerprint has never been registered with Firebase, and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is unset.

---

## Scope

### In scope
- Create a real Firebase project (if one doesn't already exist) with package name `com.germanbuddy`
- Register the debug SHA-1 fingerprint with Firebase
- Download and commit the real `google-services.json` to `mobile/`
- Set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `mobile/.env`
- Verify Google Sign-In works end-to-end on device/emulator
- Add `mobile/.env` to `.gitignore` (never commit secrets)

### Out of scope
- Apple Sign-In (iOS only, deferred)
- Production SHA-1 / release keystore (deferred to EAS Build setup)
- FCM push notifications
- Any backend changes

---

## Acceptance Criteria

> The task is done when ALL of these are true.

- [ ] AC1: Tapping "Accedi con Google" completes without `DEVELOPER_ERROR`
- [ ] AC2: After sign-in, the app navigates past OnboardingScreen (user is authenticated)
- [ ] AC3: `mobile/google-services.json` contains real project IDs and a non-empty `oauth_client` array
- [ ] AC4: `mobile/.env` exists locally with `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` set (not committed)
- [ ] AC5: `mobile/.env` is listed in `.gitignore`
- [ ] AC6: Existing jest test suite still passes (`npm test -- --runInBand` from `mobile/`)

---

## Technical Spec

### Files to create / replace
```
mobile/google-services.json    — replace placeholder with real file downloaded from Firebase console
mobile/.env                    — new file, not committed; holds EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
```

### Files to modify
```
.gitignore                     — add mobile/.env entry if not already present
```

### Implementation notes

**Step 1 — Firebase project**

If no Firebase project exists yet:
1. Go to https://console.firebase.google.com → "Add project"
2. Name: `GermanBuddy` (or `germanbuddy-dev`)
3. Disable Google Analytics (not needed for v1.0)

**Step 2 — Register the Android app**

In Firebase Console → Project Settings → Your apps → Add app → Android:
- Android package name: `com.germanbuddy` (must match `mobile/app.json` exactly)
- App nickname: `GermanBuddy Android`
- Debug signing certificate SHA-1:
  ```
  D4:88:5A:23:AD:78:61:F3:2D:EF:39:69:92:09:55:B3:66:47:8D:98
  ```
- Click "Register app"
- Download `google-services.json` and save to `mobile/google-services.json` (replace existing placeholder)

**Step 3 — Enable Google Sign-In**

Firebase Console → Authentication → Sign-in method → Google → Enable → Save.

**Step 4 — Get the Web Client ID**

Firebase Console → Authentication → Sign-in method → Google → expand "Web SDK configuration":
- Copy the **Web client ID** (looks like `XXXXXXXXXX-xxxx.apps.googleusercontent.com`)

Create `mobile/.env`:
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<paste-web-client-id-here>
```

**Step 5 — .gitignore**

Ensure `.gitignore` at repo root (or `mobile/.gitignore`) contains:
```
mobile/.env
```

**Step 6 — Rebuild and test**

Since `google-services.json` is a native config file, a full rebuild is required:
```bash
cd mobile
npx expo run:android
```

Tap "Accedi con Google" and verify sign-in completes successfully.

**Step 7 — Commit**

Commit only:
- `mobile/google-services.json` (the real one — verify it contains no private keys, only config)
- `.gitignore` update

Do NOT commit `mobile/.env`.

---

## API Contract

*Not applicable — no backend changes.*

---

## Database Changes

*Not applicable.*

---

## Tests

No new tests required for this task. Run existing suite to confirm no regressions:

```bash
cd mobile
npm test -- --runInBand
```

All 17 tests must pass.

---

## Definition of Done

- [ ] All acceptance criteria checked
- [ ] `npm test -- --runInBand` passes (17 tests green)
- [ ] `mobile/.env` is NOT committed (only exists locally)
- [ ] `mobile/google-services.json` is committed and contains real Firebase project data
- [ ] Conventional commit: `fix(TASK-009): configure real Firebase project, fix Google Sign-In`
- [ ] TASK status updated to `done`
