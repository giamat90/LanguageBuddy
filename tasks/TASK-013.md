# TASK-013 — Expo Router Migration: File-based Routing

**Status:** `ready`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Depends on:** TASK-012 (all prior tasks merged; this is a full-app restructure — must start from a clean, working state)

---

## Context

The app currently uses React Navigation 6 with a manually-managed `AppNavigator.tsx` stack. As screens multiply (onboarding flow, profile, push notification deep links), manual stack navigation grows brittle and hard to extend. GreenThumb uses Expo Router's file-based routing — grouped routes `(auth)/` and `(app)/`, typed `router.push()` calls, and layout files that gate entire groups on auth state — and it handles all the complexity we will face cleanly.

This task migrates GermanBuddy's navigation from React Navigation to Expo Router. It is a **structural refactor only** — no new features, no new screens, no business logic changes. Every screen keeps its existing component code; only how screens are mounted and how navigation calls are made changes.

**Expo SDK version:** The current SDK is 51. Expo Router's file-based `app/` convention is stable on SDK 51 (introduced in SDK 49). No SDK upgrade is required for this task.

---

## Scope

### In scope
- Install `expo-router` and its peer dependencies (`expo-linking`, `expo-constants` — likely already installed)
- Configure `app.json` to use `expo-router` scheme
- Create the `mobile/app/` directory with file-based route structure
- Move screen components from `mobile/src/screens/` into `mobile/app/` (or keep components in `src/screens/` and re-export from route files — see implementation notes)
- Replace all `navigation.navigate()` / `navigation.goBack()` calls with `router.push()` / `router.back()` from `expo-router`
- Replace `useNavigation()` and `useRoute()` hooks with `useRouter()` and `useLocalSearchParams()` from `expo-router`
- Auth gate: `(app)/_layout.tsx` redirects unauthenticated users to `/onboarding` using `<Redirect>` from `expo-router`
- Remove `mobile/src/navigation/AppNavigator.tsx` and all React Navigation dependencies
- Update `mobile/App.tsx` entry point to use Expo Router's `<ExpoRoot>` (or remove `App.tsx` entirely if Expo Router uses `expo-router/entry`)

### Out of scope
- Expo SDK upgrade (stay on SDK 51)
- Any screen UI changes
- New screens
- Tab navigation (the app uses a stack, not tabs — do not introduce tab layout)
- Deep link configuration beyond what Expo Router provides automatically
- Web support

---

## Acceptance Criteria

- [ ] AC1: App launches and shows the correct screen based on auth state — unauthenticated users land on `/onboarding`, authenticated users land on `/(app)/` (word card)
- [ ] AC2: The full user flow works end-to-end: Onboarding → WordCard → Paywall → Chat → Recap → Vault → back to WordCard
- [ ] AC3: The back button / `router.back()` works correctly on every screen that previously used `navigation.goBack()`
- [ ] AC4: `AppNavigator.tsx` is deleted; `react-navigation` packages are removed from `package.json`
- [ ] AC5: TypeScript compiles with no errors (`npx tsc --noEmit` from `mobile/`)
- [ ] AC6: `npm test -- --runInBand` passes

---

## Technical Spec

### New directory structure
```
mobile/
├── app/
│   ├── _layout.tsx              — root layout: AppErrorBoundary + OfflineBanner + auth listener
│   ├── onboarding.tsx           — public route (no auth required)
│   ├── (app)/
│   │   ├── _layout.tsx          — auth guard: redirects to /onboarding if !uid
│   │   ├── index.tsx            — WordCardScreen (home)
│   │   ├── chat.tsx             — ChatScreen
│   │   ├── vault.tsx            — VaultScreen
│   │   ├── recap.tsx            — RecapScreen
│   │   └── paywall.tsx          — PaywallScreen
├── src/                         — all existing source files stay here (stores, services, components, hooks, theme, types)
│   ├── screens/                 — screen component implementations remain here
│   │   ├── WordCardScreen.tsx
│   │   ├── ChatScreen.tsx
│   │   └── ...
│   └── ...
└── App.tsx                      — DELETED (Expo Router uses expo-router/entry)
```

Route files in `app/` are thin wrappers that import and re-export from `src/screens/`. This keeps screen logic in `src/` unchanged and minimises diff size.

### Files to create
```
mobile/app/_layout.tsx              — root layout
mobile/app/onboarding.tsx           — public route wrapper
mobile/app/(app)/_layout.tsx        — auth guard layout
mobile/app/(app)/index.tsx          — word card route wrapper
mobile/app/(app)/chat.tsx           — chat route wrapper
mobile/app/(app)/vault.tsx          — vault route wrapper
mobile/app/(app)/recap.tsx          — recap route wrapper
mobile/app/(app)/paywall.tsx        — paywall route wrapper
```

### Files to delete
```
mobile/App.tsx
mobile/src/navigation/AppNavigator.tsx
```

### Files to modify
```
mobile/app.json                         — add expo-router plugin + scheme
mobile/package.json                     — add expo-router; remove @react-navigation/* packages
mobile/babel.config.js                  — add expo-router/babel plugin
mobile/index.js (if exists)             — point to expo-router/entry
mobile/src/screens/WordCardScreen.tsx   — replace navigation calls
mobile/src/screens/ChatScreen.tsx       — replace navigation calls
mobile/src/screens/VaultScreen.tsx      — replace navigation calls (if any)
mobile/src/screens/RecapScreen.tsx      — replace navigation calls
mobile/src/screens/PaywallScreen.tsx    — replace navigation calls
mobile/src/components/AppErrorBoundary.tsx  — verify it still wraps correctly (no changes expected)
mobile/src/components/OfflineBanner.tsx     — verify it still works (no changes expected)
```

---

### Implementation notes

**1 — Install expo-router**

```bash
cd mobile
npx expo install expo-router expo-linking expo-constants
```

Remove React Navigation:
```bash
npm uninstall @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context
```

Verify none of the remaining packages import from `@react-navigation/*` after removal.

---

**2 — app.json: enable Expo Router**

```json
{
  "expo": {
    "scheme": "germanbuddy",
    "web": { "bundler": "metro" },
    "plugins": [
      "expo-router"
    ]
  }
}
```

The `scheme` is required for Expo Router to handle deep links. Use `"germanbuddy"` (lowercase, no spaces).

---

**3 — babel.config.js**

Add the Expo Router Babel plugin:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['expo-router/babel'],  // ADD THIS
  };
};
```

---

**4 — Entry point**

Expo Router uses `expo-router/entry` as the app entry point. In `package.json`:

```json
{
  "main": "expo-router/entry"
}
```

Delete `mobile/App.tsx`. All root-level logic (auth listener, NetInfo listener, AppErrorBoundary) moves into `mobile/app/_layout.tsx`.

---

**5 — app/_layout.tsx (root layout)**

This replaces `App.tsx`. It must:
- Run the Firebase `onAuthStateChanged` listener (from TASK-010)
- Run the `NetInfo` listener (from TASK-012)
- Wrap the tree with `AppErrorBoundary`
- Show `SplashScreen` while `!authReady`
- Render `<OfflineBanner />` above `<Slot />`

```tsx
// mobile/app/_layout.tsx
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Slot } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import auth from '@react-native-firebase/auth';
import AppErrorBoundary from '../src/components/AppErrorBoundary';
import OfflineBanner from '../src/components/OfflineBanner';
import SplashScreen from '../src/components/SplashScreen';
import { useUserStore } from '../src/store/useUserStore';
import { useNetworkStore } from '../src/store/useNetworkStore';

export default function RootLayout() {
  const { setUser, setAuthReady, authReady } = useUserStore();
  const { setIsOnline } = useNetworkStore();

  useEffect(() => {
    const unsubscribeAuth = auth().onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser.uid, firebaseUser.email ?? '');
      } else {
        useUserStore.setState({ uid: null, email: null, isPro: false });
      }
      setAuthReady(true);
    });
    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    NetInfo.fetch().then((s) => setIsOnline(s.isConnected ?? true));
    const unsubscribeNet = NetInfo.addEventListener((s) => setIsOnline(s.isConnected ?? true));
    return unsubscribeNet;
  }, []);

  if (!authReady) return <SplashScreen />;

  return (
    <AppErrorBoundary>
      <View style={{ flex: 1 }}>
        <OfflineBanner />
        <Slot />
      </View>
    </AppErrorBoundary>
  );
}
```

`<Slot />` renders the matched child route.

---

**6 — app/(app)/_layout.tsx (auth guard)**

Redirects unauthenticated users before any `(app)` route renders:

```tsx
// mobile/app/(app)/_layout.tsx
import { Redirect, Slot } from 'expo-router';
import { useUserStore } from '../../src/store/useUserStore';

export default function AppLayout() {
  const uid = useUserStore((s) => s.uid);
  if (!uid) return <Redirect href="/onboarding" />;
  return <Slot />;
}
```

---

**7 — Route wrapper files**

Each route file is a one-liner re-export. Example for the word card (home):

```tsx
// mobile/app/(app)/index.tsx
export { default } from '../../src/screens/WordCardScreen';
```

```tsx
// mobile/app/(app)/chat.tsx
export { default } from '../../src/screens/ChatScreen';
```

```tsx
// mobile/app/(app)/vault.tsx
export { default } from '../../src/screens/VaultScreen';
```

```tsx
// mobile/app/(app)/recap.tsx
export { default } from '../../src/screens/RecapScreen';
```

```tsx
// mobile/app/(app)/paywall.tsx
export { default } from '../../src/screens/PaywallScreen';
```

```tsx
// mobile/app/onboarding.tsx
export { default } from '../src/screens/OnboardingScreen';
```

---

**8 — Replace navigation calls in screen components**

Find every `useNavigation()`, `navigation.navigate()`, `navigation.goBack()`, `useRoute()` and replace with Expo Router equivalents. The full mapping:

| React Navigation | Expo Router |
|---|---|
| `import { useNavigation } from '@react-navigation/native'` | `import { useRouter } from 'expo-router'` |
| `const navigation = useNavigation()` | `const router = useRouter()` |
| `navigation.navigate('Chat')` | `router.push('/(app)/chat')` |
| `navigation.navigate('Recap', { sessionId })` | `router.push({ pathname: '/(app)/recap', params: { sessionId } })` |
| `navigation.navigate('Vault')` | `router.push('/(app)/vault')` |
| `navigation.navigate('Paywall')` | `router.push('/(app)/paywall')` |
| `navigation.goBack()` | `router.back()` |
| `import { useRoute } from '@react-navigation/native'` | `import { useLocalSearchParams } from 'expo-router'` |
| `const { sessionId } = route.params` | `const { sessionId } = useLocalSearchParams<{ sessionId: string }>()` |

**Important:** `RecapScreen` receives `sessionId` as a navigation param. After migration it will receive it as a URL search param via `useLocalSearchParams`. Verify the `sessionId` is correctly passed from `ChatScreen` and read in `RecapScreen`.

Remove `RootStackParamList` type from the codebase entirely — it is a React Navigation concept.

---

**9 — Type declarations**

Expo Router provides typed routes via `expo-router`'s type generation. After running the app once, typed routes are available via `href` in `router.push()`. For now, use string literals for paths — type generation can be enabled post-migration.

---

## Tests

No new tests are required for this task — it is a structural refactor with no business logic changes.

Existing tests must all pass:
```bash
cd mobile
npm test -- --runInBand
```

If any test imports from `@react-navigation/*` or `AppNavigator`, update the import path to the new location. Do not rewrite test logic.

---

## Definition of Done

- [ ] All acceptance criteria checked (AC1–AC6)
- [ ] `npx tsc --noEmit` from `mobile/` exits with no errors
- [ ] `npm test -- --runInBand` passes (all existing tests)
- [ ] `mobile/App.tsx` deleted
- [ ] `mobile/src/navigation/AppNavigator.tsx` deleted
- [ ] `@react-navigation/*` packages absent from `package.json` `dependencies`
- [ ] `expo-router` present in `package.json` `dependencies`
- [ ] No screen component imports from `@react-navigation/*`
- [ ] Conventional commit: `refactor(TASK-013): migrate to Expo Router file-based routing`
- [ ] TASK status updated to `done`

---

## Notes for Tech Lead

Risks to watch for in the next task:
- Push notification deep links: Expo Router handles deep links automatically via the `scheme` in `app.json`. When push notifications are added (future task), link targets should use Expo Router's `href` format (`/(app)/chat`), not React Navigation route names.
- If the Developer reports module resolution errors with `expo-router/entry`, check that `babel.config.js` has the `expo-router/babel` plugin and Metro cache is cleared (`npx expo start --clear`).
- SDK 51's Expo Router may require `metro.config.js` to include `resolver.sourceExts` with `'mjs'` for ESM compatibility — check the Expo Router SDK 51 release notes if module resolution fails.
