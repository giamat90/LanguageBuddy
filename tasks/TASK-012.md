# TASK-012 — Network Awareness: Offline Store + OfflineBanner

**Status:** `ready`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Depends on:** TASK-011 (ErrorBanner must exist; OfflineBanner shares the same visual language)

---

## Context

When the device has no internet connection, the app currently makes API calls that fail silently or show a generic error after a long timeout. GreenThumb ships a `networkStore` (Zustand + `@react-native-community/netinfo`) and a persistent `OfflineBanner` that appears at the top of every screen whenever connectivity is lost. This is a small, self-contained addition that significantly improves UX during offline or flaky network conditions. It also prevents redundant API calls when we know the device is offline.

---

## Scope

### In scope
- Install `@react-native-community/netinfo` (already in Expo SDK 51 default dependencies, verify before adding)
- `useNetworkStore` Zustand store with `isOnline: boolean` and `setIsOnline()`
- `NetInfo` listener wired in `App.tsx` — same place as the auth listener
- `OfflineBanner` component: a persistent yellow strip shown when `!isOnline`, no dismiss button (it auto-hides when connectivity returns)
- Mount `OfflineBanner` inside `AppNavigator` so it overlays all screens

### Out of scope
- Message queuing / retry when coming back online (deferred)
- Caching API responses for offline read (MMKV cache already handles vault — do not touch)
- Any backend changes
- Per-screen offline behaviour beyond showing the banner

---

## Acceptance Criteria

- [ ] AC1: With WiFi/data off, a yellow `OfflineBanner` reading "Sei offline. Controlla la connessione." appears at the top of every screen within 2 seconds
- [ ] AC2: When connectivity is restored, the banner disappears automatically (no user interaction required)
- [ ] AC3: `useNetworkStore.getState().isOnline` reflects the true device state on app launch (not hardcoded `true`)
- [ ] AC4: No API calls are blocked or retried by this task — the banner is informational only
- [ ] AC5: The banner does not appear on the `SplashScreen` (which renders before `AppNavigator`)
- [ ] AC6: `npm test -- --runInBand` passes

---

## Technical Spec

### Files to create
```
mobile/src/store/useNetworkStore.ts        — Zustand store for isOnline
mobile/src/components/OfflineBanner.tsx    — persistent offline indicator strip
```

### Files to modify
```
mobile/App.tsx                             — add NetInfo listener
mobile/src/navigation/AppNavigator.tsx     — mount <OfflineBanner> at top of root view
mobile/package.json                        — add @react-native-community/netinfo if not present
```

---

### Implementation notes

**1 — Check if netinfo is already installed**

Before modifying `package.json`, check `mobile/package.json` for `@react-native-community/netinfo`. Expo SDK 51 includes it as a peer dependency — it may already be installed. If it is, skip `npm install`; if not, add it.

---

**2 — useNetworkStore**

```ts
// mobile/src/store/useNetworkStore.ts
import { create } from 'zustand';

interface NetworkState {
  isOnline: boolean;
  setIsOnline: (v: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: true,   // optimistic default; real state set before first render via NetInfo
  setIsOnline: (v) => set({ isOnline: v }),
}));
```

No MMKV persistence — network state is always live.

---

**3 — App.tsx: NetInfo listener**

Add the listener alongside the existing Firebase `onAuthStateChanged` listener. Both can coexist in the same `useEffect` or in separate `useEffect` calls — use separate ones for clarity.

```tsx
// mobile/App.tsx  (additions only)
import NetInfo from '@react-native-community/netinfo';
import { useNetworkStore } from './src/store/useNetworkStore';

export default function App() {
  const { setUser, clearUser, setAuthReady, authReady } = useUserStore();
  const { setIsOnline } = useNetworkStore();

  // Existing Firebase auth listener (unchanged)
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(/* ... existing ... */);
    return unsubscribe;
  }, []);

  // New: NetInfo listener
  useEffect(() => {
    // fetchWithTimeout sets initial state immediately on mount
    NetInfo.fetch().then((state) => setIsOnline(state.isConnected ?? true));

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });

    return unsubscribe;
  }, []);

  if (!authReady) return <SplashScreen />;
  return (
    <AppErrorBoundary>
      <AppNavigator />
    </AppErrorBoundary>
  );
}
```

---

**4 — OfflineBanner component**

No dismiss button — it auto-hides when `isOnline` returns true. Uses a warning yellow that is visually distinct from `ErrorBanner`'s red.

```tsx
// mobile/src/components/OfflineBanner.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStore } from '../store/useNetworkStore';

export default function OfflineBanner() {
  const isOnline = useNetworkStore((s) => s.isOnline);
  if (isOnline) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Sei offline. Controlla la connessione.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F57C00',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
});
```

---

**5 — AppNavigator: mount OfflineBanner**

`AppNavigator` renders the React Navigation `<NavigationContainer>`. Wrap its return in a `<View style={{ flex: 1 }}>`, place `<OfflineBanner />` at the top, then the `<NavigationContainer>` below:

```tsx
// mobile/src/navigation/AppNavigator.tsx  (diff only)
import { View, StyleSheet } from 'react-native';
import OfflineBanner from '../components/OfflineBanner';

export default function AppNavigator() {
  // ... existing uid/isPro selectors ...

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <NavigationContainer>
        {/* ... existing navigator ... */}
      </NavigationContainer>
    </View>
  );
}
```

This positions the banner above the navigation chrome on every screen without modifying individual screens.

---

## Tests

### Unit tests (Jest, `mobile/`)
- `test_useNetworkStore_default_isOnline_true` — store initialises with `isOnline: true`
- `test_useNetworkStore_setIsOnline_false` — calling `setIsOnline(false)` updates state
- `test_OfflineBanner_hidden_when_online` — renders null when `isOnline === true`
- `test_OfflineBanner_visible_when_offline` — renders banner text when `isOnline === false`

Mock `useNetworkStore` via jest module mock — do not mock `NetInfo` itself (that is tested via the store integration).

---

## Definition of Done

- [ ] All acceptance criteria checked (AC1–AC6)
- [ ] All 4 unit tests written and green
- [ ] `npm test -- --runInBand` passes (all existing + new tests)
- [ ] `@react-native-community/netinfo` present in `package.json` (installed or confirmed already present)
- [ ] No hardcoded strings — banner text is in JSX, not extracted (single-use string, extraction not warranted)
- [ ] No new API keys or secrets
- [ ] Conventional commit: `feat(TASK-012): add network awareness store and OfflineBanner`
- [ ] TASK status updated to `done`
