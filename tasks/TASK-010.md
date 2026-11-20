# TASK-010 — Auth Bootstrap: Firebase onAuthStateChanged Root Listener

**Status:** `ready`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Depends on:** TASK-009 (Firebase project configured, Google Sign-In working)

---

## Context

The current auth flow has a structural flaw: `App.tsx` renders `AppNavigator` directly with zero auth bootstrapping. `AppNavigator` gates screens on `uid` from the Zustand store, which is seeded from MMKV on startup — but **no Firebase `onAuthStateChanged` listener exists anywhere in the app**. This means:

1. Firebase session validity is never checked on launch — a revoked or expired token silently appears as "authenticated"
2. After a successful Google Sign-In, `setUser()` writes to MMKV/Zustand correctly, but the app never listens to Firebase's own auth state, so session revocation or token expiry won't sign the user out
3. There is no loading state — the app flashes content before auth is determined
4. Sign-out must currently clear MMKV manually; there is no Firebase listener to react to `auth().signOut()`

The fix is to add the same pattern used in GreenThumb (a proven production auth system): a Firebase `onAuthStateChanged` listener at the root level, a bootstrapping `authReady` flag, and a loading screen while auth is being determined. The Zustand store (MMKV) becomes a cache for fast hydration, not the source of truth — Firebase is.

---

## Scope

### In scope
- Add `onAuthStateChanged` listener in `App.tsx`
- Add `authReady` boolean to `useUserStore` (false until first Firebase callback fires)
- Show a loading/splash screen while `!authReady`
- `AppNavigator` reads `uid` from Zustand (unchanged) but is only rendered after `authReady`
- `clearUser()` in Zustand calls `auth().signOut()` so Firebase and MMKV stay in sync
- `setUser()` remains called from `OnboardingScreen` after sign-in (unchanged)

### Out of scope
- Any changes to `OnboardingScreen` sign-in logic
- Multi-step onboarding flow (CEFR quiz, topic preferences — separate task)
- Push notification setup
- Any backend or API changes

---

## Acceptance Criteria

- [ ] AC1: On cold launch with a valid Firebase session, the app goes directly to `WordCard` without showing `Onboarding`
- [ ] AC2: On cold launch with no session, the app shows `Onboarding`
- [ ] AC3: A brief loading indicator (or splash) appears while `authReady === false` — no flash of wrong screen
- [ ] AC4: Calling `clearUser()` from any screen signs the user out of Firebase AND clears MMKV — `AppNavigator` returns to `Onboarding` without manual navigation
- [ ] AC5: After Google Sign-In completes in `OnboardingScreen`, `AppNavigator` immediately shows `WordCard` (no manual `navigation.navigate()` needed)
- [ ] AC6: Existing jest tests still pass (`npm test -- --runInBand` from `mobile/`)

---

## Technical Spec

### Files to modify
```
mobile/App.tsx                        — add onAuthStateChanged listener + authReady gate
mobile/src/store/useUserStore.ts      — add authReady state + update clearUser to call auth().signOut()
```

### Files to create
```
mobile/src/components/SplashScreen.tsx   — minimal loading screen shown while !authReady
```

---

### Implementation notes

**1 — useUserStore: add `authReady` + fix `clearUser`**

Add `authReady: boolean` to the store. It starts as `false` and is set to `true` after the first `onAuthStateChanged` callback fires (regardless of whether the user is signed in or not).

Fix `clearUser` to call `auth().signOut()` so Firebase session is actually terminated — currently it only clears MMKV/Zustand which leaves the Firebase token alive.

```ts
// mobile/src/store/useUserStore.ts
import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import auth from '@react-native-firebase/auth';

const storage = new MMKV({ id: 'user-store' });

interface UserState {
  uid: string | null;
  email: string | null;
  isPro: boolean;
  authReady: boolean;                         // NEW
  setUser: (uid: string, email: string) => void;
  setIsPro: (value: boolean) => void;
  clearUser: () => Promise<void>;             // now async
  setAuthReady: (v: boolean) => void;         // NEW
}

export const useUserStore = create<UserState>((set) => ({
  uid:       storage.getString('uid') ?? null,
  email:     storage.getString('email') ?? null,
  isPro:     storage.getBoolean('isPro') ?? false,
  authReady: false,                           // starts false

  setUser: (uid, email) => {
    storage.set('uid', uid);
    storage.set('email', email);
    set({ uid, email });
  },
  setIsPro: (value) => {
    storage.set('isPro', value);
    set({ isPro: value });
  },
  clearUser: async () => {
    await auth().signOut();                   // sign out of Firebase first
    storage.clearAll();
    set({ uid: null, email: null, isPro: false });
  },
  setAuthReady: (v) => set({ authReady: v }),
}));
```

---

**2 — App.tsx: onAuthStateChanged listener**

Move the auth listener here. It fires once immediately on mount (telling you the current session state) and again whenever the session changes. Call `setAuthReady(true)` after the first callback so the loading screen can disappear.

```tsx
// mobile/App.tsx
import React, { useEffect } from 'react';
import auth from '@react-native-firebase/auth';
import { useUserStore } from './src/store/useUserStore';
import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/components/SplashScreen';

export default function App() {
  const { setUser, clearUser, setAuthReady, authReady } = useUserStore();

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        // Firebase says we have a valid session — sync into Zustand/MMKV
        setUser(firebaseUser.uid, firebaseUser.email ?? '');
      } else {
        // No Firebase session (signed out, token revoked, or first launch)
        // clearUser() without signOut() call here to avoid double sign-out
        const storage = new (require('react-native-mmkv').MMKV)({ id: 'user-store' });
        storage.clearAll();
        useUserStore.setState({ uid: null, email: null, isPro: false });
      }
      setAuthReady(true);  // first callback fired — we now know the truth
    });

    return unsubscribe;  // cleanup on unmount
  }, []);

  if (!authReady) return <SplashScreen />;

  return <AppNavigator />;
}
```

> **Note on clearUser inside the listener:** Do NOT call `clearUser()` from inside `onAuthStateChanged` because `clearUser()` calls `auth().signOut()`, which would trigger `onAuthStateChanged` again → infinite loop. Instead, only update Zustand/MMKV directly when the listener fires a sign-out event. `clearUser()` is for user-initiated sign-out from a screen.

---

**3 — SplashScreen component**

Keep it minimal — just a centered activity indicator matching the app's primary color.

```tsx
// mobile/src/components/SplashScreen.tsx
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

---

**4 — AppNavigator: no changes needed**

`AppNavigator` already gates on `uid` from Zustand — this still works correctly. When `onAuthStateChanged` fires with a user, `setUser()` updates Zustand → `uid` becomes non-null → `AppNavigator` shows `WordCard`. When it fires without a user, Zustand `uid` is cleared → `AppNavigator` shows `Onboarding`. No manual navigation calls are needed anywhere.

---

**5 — OnboardingScreen: verify no manual navigation**

`OnboardingScreen` currently calls `setUser()` after sign-in and does NOT navigate manually. This is correct and must stay this way — the `onAuthStateChanged` listener in `App.tsx` will fire after `signInWithCredential` completes, update Zustand, and `AppNavigator` will re-render to `WordCard` automatically.

Verify that `OnboardingScreen` has no `navigation.navigate('WordCard')` call. If it does, remove it.

---

## Tests

No new unit tests required for this task (the listener wiring is React lifecycle logic, best verified by running the app). Confirm existing tests still pass:

```bash
cd mobile
npm test -- --runInBand
```

All existing tests must pass with no changes.

---

## Definition of Done

- [ ] All acceptance criteria checked (AC1–AC6)
- [ ] `npm test -- --runInBand` passes
- [ ] No hardcoded strings, no new API keys in code
- [ ] Conventional commit: `fix(TASK-010): add Firebase onAuthStateChanged root listener`
- [ ] TASK status updated to `done`
