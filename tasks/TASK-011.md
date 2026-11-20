# TASK-011 — Error Handling Infrastructure: ErrorBanner + Global Error Boundary

**Status:** `ready`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Depends on:** TASK-010 (auth bootstrap must be merged first)

---

## Context

The app currently has no systematic error handling. API failures silently drop, unexpected component throws produce a white screen with a red RN debug overlay in dev and a blank screen in production. GreenThumb ships an `ErrorBanner` component for inline recoverable errors and a root-level React error boundary for unrecoverable throws — both are small, high-value additions that apply directly to GermanBuddy. This task ports those patterns, adapted to GermanBuddy's Italian locale and existing theme tokens.

---

## Scope

### In scope
- `ErrorBanner` component: inline, dismissible, shows a user-facing error string
- `AppErrorBoundary` component: React class component wrapping the entire tree in `App.tsx`; catches unhandled JS throws and shows a full-screen recovery UI
- A shared `errorHandling.ts` utility: classifies `AxiosError` / `FirebaseError` / network errors into a small enum and returns a localised Italian message string
- Wire `AppErrorBoundary` into `App.tsx` as the outermost wrapper
- Add `ErrorBanner` usage to `WordCardScreen` and `ChatScreen` (the two screens that make API calls and currently have no error UI)

### Out of scope
- Sentry integration (separate task, post-launch)
- Retry-with-backoff logic (deferred)
- Error states on `VaultScreen`, `RecapScreen`, `PaywallScreen` — these already handle errors via existing conditional rendering; do not touch
- Any backend changes

---

## Acceptance Criteria

- [ ] AC1: Throwing inside any screen's render method shows the `AppErrorBoundary` fallback UI (full-screen message + "Riprova" button that calls `resetError`) instead of a blank screen
- [ ] AC2: A network error on `WordCardScreen` (e.g. API offline) renders an `ErrorBanner` below the header with the Italian error message; dismissing it hides the banner
- [ ] AC3: A network error on `ChatScreen` (e.g. SSE connection fails) renders an `ErrorBanner`; user can dismiss and retry manually
- [ ] AC4: `classifyError` returns the correct `AppErrorType` and message for: Axios timeout, Axios 401, Axios 500, Firebase auth error, generic JS Error
- [ ] AC5: No existing functionality is changed — `WordCardScreen`, `ChatScreen`, and others render identically when no error is present
- [ ] AC6: `npm test -- --runInBand` from `mobile/` passes

---

## Technical Spec

### Files to create
```
mobile/src/components/ErrorBanner.tsx       — inline dismissible error strip
mobile/src/components/AppErrorBoundary.tsx  — React class error boundary (root level)
mobile/src/lib/errorHandling.ts             — classifyError utility + AppErrorType enum
```

### Files to modify
```
mobile/App.tsx                              — wrap tree with <AppErrorBoundary>
mobile/src/screens/WordCardScreen.tsx       — add errorMsg state + <ErrorBanner>
mobile/src/screens/ChatScreen.tsx           — add errorMsg state + <ErrorBanner>
```

---

### Implementation notes

**1 — errorHandling.ts**

```ts
// mobile/src/lib/errorHandling.ts
import { AxiosError } from 'axios';

export type AppErrorType = 'network' | 'auth' | 'server' | 'unknown';

export interface ClassifiedError {
  type: AppErrorType;
  message: string;  // Italian, user-facing
}

export function classifyError(error: unknown): ClassifiedError {
  if (error instanceof AxiosError) {
    if (!error.response) {
      return { type: 'network', message: 'Nessuna connessione. Controlla Internet e riprova.' };
    }
    if (error.response.status === 401) {
      return { type: 'auth', message: 'Sessione scaduta. Accedi di nuovo.' };
    }
    if (error.response.status >= 500) {
      return { type: 'server', message: 'Errore del server. Riprova tra poco.' };
    }
  }
  // FirebaseError: code is a string like 'auth/network-request-failed'
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    if (code.startsWith('auth/')) {
      return { type: 'auth', message: 'Errore di autenticazione. Prova ad accedere di nuovo.' };
    }
  }
  return { type: 'unknown', message: 'Qualcosa è andato storto. Riprova.' };
}
```

---

**2 — ErrorBanner component**

Renders a coloured strip with the error message and an "×" dismiss button. Accepts `message: string | null` — renders nothing when `message` is null, so callers can bind it directly to state.

```tsx
// mobile/src/components/ErrorBanner.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  message: string | null;
  onDismiss: () => void;
}

export default function ErrorBanner({ message, onDismiss }: Props) {
  if (!message) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
      <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.dismiss}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error ?? '#D32F2F',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  text: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  dismiss: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 12,
  },
});
```

If `colors.error` is not defined in `mobile/src/theme/colors.ts`, add it as `error: '#D32F2F'`.

---

**3 — AppErrorBoundary component**

A React class component — function components cannot be error boundaries. Catches any unhandled throw in the component tree and shows a full-screen fallback. The "Riprova" button calls `resetError` which resets state so the tree tries to re-render.

```tsx
// mobile/src/components/AppErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  resetError = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Qualcosa è andato storto</Text>
          <Text style={styles.body}>L'app ha incontrato un errore inatteso.</Text>
          <TouchableOpacity style={styles.button} onPress={this.resetError}>
            <Text style={styles.buttonText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text ?? '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: colors.textSecondary ?? '#666666',
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

---

**4 — App.tsx: wrap with AppErrorBoundary**

`AppErrorBoundary` goes outside everything — including the `SplashScreen` guard added in TASK-010:

```tsx
// mobile/App.tsx  (diff only)
import AppErrorBoundary from './src/components/AppErrorBoundary';

export default function App() {
  // ... existing auth listener setup ...

  return (
    <AppErrorBoundary>
      {!authReady ? <SplashScreen /> : <AppNavigator />}
    </AppErrorBoundary>
  );
}
```

---

**5 — WordCardScreen: add ErrorBanner**

Add `errorMsg: string | null` to local component state. Wrap the existing `fetchWord()` call in a try/catch, classify the error, set `errorMsg`. Render `<ErrorBanner>` just below the screen header, above the word content.

```tsx
// Illustrative additions to WordCardScreen.tsx
import ErrorBanner from '../components/ErrorBanner';
import { classifyError } from '../lib/errorHandling';

// Inside component:
const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

const loadWord = async () => {
  try {
    // ... existing fetch logic ...
  } catch (err) {
    setErrorMsg(classifyError(err).message);
  }
};

// In JSX, just below the top-level ScrollView/View header:
<ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />
```

---

**6 — ChatScreen: add ErrorBanner**

Same pattern. The SSE hook (`useSseStream`) already accepts an `onError` callback — wire it to `setErrorMsg(classifyError(err).message)` instead of a console.log.

Verify `useSseStream` exposes an `onError` prop; if not, add one. Signature:
```ts
useSseStream({ ..., onError?: (err: unknown) => void })
```

---

## Tests

### Unit tests (Jest, `mobile/`)
- `test_classifyError_axios_timeout` — `classifyError(axiosTimeoutError)` returns `{ type: 'network', message: '...' }`
- `test_classifyError_axios_401` — returns `{ type: 'auth', ... }`
- `test_classifyError_axios_500` — returns `{ type: 'server', ... }`
- `test_classifyError_firebase_auth` — returns `{ type: 'auth', ... }`
- `test_classifyError_generic` — returns `{ type: 'unknown', ... }`
- `test_ErrorBanner_renders_null_when_no_message` — renders nothing when `message={null}`
- `test_ErrorBanner_renders_message` — renders message text when provided
- `test_ErrorBanner_calls_onDismiss` — pressing ✕ calls `onDismiss`

All tests live in `mobile/src/__tests__/` or colocated. Use `@testing-library/react-native`.

---

## Definition of Done

- [ ] All acceptance criteria checked (AC1–AC6)
- [ ] All 8 unit tests written and green
- [ ] `npm test -- --runInBand` passes (all existing tests + new ones)
- [ ] `colors.error` defined in `mobile/src/theme/colors.ts`
- [ ] No hardcoded Italian strings outside component JSX (all in component, not in `errorHandling.ts` comments)
- [ ] No new API keys or secrets
- [ ] Conventional commit: `feat(TASK-011): add ErrorBanner and AppErrorBoundary`
- [ ] TASK status updated to `done`
