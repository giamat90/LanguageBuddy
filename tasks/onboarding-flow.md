# TASK-015 — Mobile Onboarding Flow: CEFR Quiz + Topic Preferences

**Status:** `ready`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Depends on:** TASK-014 (POST /profile/onboarding is live ✓), TASK-013 (Expo Router ✓)

---

## Context

`OnboardingScreen.tsx` only handles Google Sign-In. After the user authenticates, it
immediately navigates to `/(app)/` with no CEFR quiz and no topic preferences — so
`POST /profile/onboarding` is never called, grammar_weaknesses are never seeded, and the
nightly word generator has no learner profile to personalise against. This task adds the
two missing screens (CEFR quiz, topic preferences), a `hasProfile` routing flag to
`useUserStore`, and a `profileService.ts` that calls the backend. No backend changes.

---

## Scope

### In scope
- `SignInScreen.tsx`: rename from `OnboardingScreen.tsx`, remove `router.replace` call
  (navigation handled by layout)
- `QuizScreen.tsx`: 5 hardcoded placement questions, scores → CEFR level
- `TopicsScreen.tsx`: 8 topic cards in 2×4 grid, min 2 selections, weight mapping
- `profileService.ts`: `fetchProfile()` + `submitOnboarding()`
- `useUserStore`: add `hasProfile: boolean` + `setHasProfile()`, MMKV-persisted
- Root layout (`app/_layout.tsx`): after `onAuthStateChanged` fires, check profile if
  `hasProfile` not already cached; keeps splash screen until resolved
- `(app)/_layout.tsx`: add `hasProfile` guard → redirect to `/quiz` if false
- New route files: `app/quiz.tsx`, `app/topics.tsx`
- Update `app/onboarding.tsx` to re-export `SignInScreen`
- i18n strings for quiz and topics (Italian)
- API types for `ProfileResponse` and `OnboardingRequest`
- Unit tests: `inferCefrLevel()` scoring + topic weight mapping
- UI test: Continua button disabled state

### Out of scope
- C2 level inference (B2 is the ceiling — quiz only distinguishes A1/A2/B1/B2)
- Persona settings customisation (Lena's name/style is fixed at default)
- Back navigation from quiz/topics to sign-in
- Fetching quiz questions from the API
- Animated transitions between quiz questions
- Profile edit screen (post-v1.0)

---

## Acceptance Criteria

- [ ] AC1: New user (no DB profile) flow: Sign-In → Quiz → Topics → `/(app)/`
- [ ] AC2: Returning user (profile exists): Sign-In or relaunch → `/(app)/` directly, no quiz shown
- [ ] AC3: `POST /profile/onboarding` fires exactly once on Topics screen "Continua", with correct
  `cefr_level` and `topic_preferences` payload
- [ ] AC4: "Continua" button on Topics screen is disabled until at least 2 topics are selected
- [ ] AC5: `useUserStore.hasProfile` is persisted in MMKV — killing and reopening the app
  does not re-show the quiz for a user who completed it
- [ ] AC6: `npx tsc --noEmit` from `mobile/` passes with no errors
- [ ] AC7: `npm test -- --runInBand` from `mobile/` passes

---

## Technical Spec

### Files to create
```
mobile/src/screens/SignInScreen.tsx         — renamed OnboardingScreen (sign-in only)
mobile/src/screens/QuizScreen.tsx           — CEFR placement quiz
mobile/src/screens/TopicsScreen.tsx         — topic preference grid
mobile/src/services/profileService.ts       — fetchProfile() + submitOnboarding()
mobile/app/quiz.tsx                         — route wrapper
mobile/app/topics.tsx                       — route wrapper
mobile/__tests__/onboarding.test.ts         — unit tests (scoring + weights)
```

### Files to modify
```
mobile/src/store/useUserStore.ts            — add hasProfile + setHasProfile
mobile/src/i18n/it.ts                       — add quiz + topics strings
mobile/src/types/api.ts                     — add ProfileResponse, OnboardingRequest
mobile/app/onboarding.tsx                   — re-export SignInScreen instead of OnboardingScreen
mobile/app/(app)/_layout.tsx                — add hasProfile guard
mobile/app/_layout.tsx                      — profile check after onAuthStateChanged
```

### Files to delete
```
mobile/src/screens/OnboardingScreen.tsx     — replaced by SignInScreen.tsx (same content, new name)
```

---

### Implementation notes

**1 — useUserStore: add hasProfile**

Add to the `UserState` interface and the `create()` call:

```typescript
// In interface UserState:
hasProfile: boolean;
setHasProfile: (v: boolean) => void;

// In create():
hasProfile: storage.getBoolean('hasProfile') ?? false,
setHasProfile: (v) => {
  storage.set('hasProfile', v);
  set({ hasProfile: v });
},

// In clearUser():
storage.clearAll();
set({ uid: null, email: null, isPro: false, hasProfile: false });
```

`hasProfile` is MMKV-persisted so returning users skip the quiz even without a network call.

---

**2 — profileService.ts**

```typescript
import { apiClient } from './apiClient';
import { ProfileResponse, OnboardingRequest } from '../types/api';

export async function fetchProfile(): Promise<ProfileResponse | null> {
  try {
    const { data } = await apiClient.get<ProfileResponse>('/profile');
    return data;
  } catch (e: any) {
    if (e.message?.includes('complete onboarding first') || e.message?.includes('404')) {
      return null;
    }
    throw e;
  }
}

export async function submitOnboarding(payload: OnboardingRequest): Promise<ProfileResponse> {
  const { data } = await apiClient.post<ProfileResponse>('/profile/onboarding', payload);
  return data;
}
```

---

**3 — api.ts: new types**

Add to `mobile/src/types/api.ts`:

```typescript
export interface OnboardingRequest {
  cefr_level: string;
  topic_preferences: Record<string, number>;
}

export interface ProfileResponse {
  cefr_level: string;
  topic_preferences: Record<string, number>;
  persona_settings: Record<string, string>;
  total_sessions: number;
  total_words_seen: number;
  weak_rules: {
    rule_code: string;
    rule_label: string;
    cefr_band: string;
    mastery_score: number;
  }[];
  vocabulary_due: {
    id: string;
    word: string;
    article: string | null;
    translation_it: string | null;
    retention_score: number;
    next_review_at: string;
  }[];
}
```

---

**4 — app/_layout.tsx: profile check after auth**

After `onAuthStateChanged` fires with a signed-in user, check the profile only if
`hasProfile` is not already `true` in the store (i.e. not MMKV-cached from a previous
session). The splash screen stays visible until `setAuthReady(true)` — keeping it up
through the profile check avoids a flash to the wrong route.

```tsx
useEffect(() => {
  const unsubscribeAuth = auth().onAuthStateChanged(async (firebaseUser) => {
    if (firebaseUser) {
      setUser(firebaseUser.uid, firebaseUser.email ?? '');
      const alreadyKnown = useUserStore.getState().hasProfile;
      if (!alreadyKnown) {
        try {
          const profile = await fetchProfile();
          setHasProfile(profile !== null);
        } catch {
          // Network error: default to quiz (safe — submitOnboarding is idempotent)
          setHasProfile(false);
        }
      }
    } else {
      useUserStore.setState({ uid: null, email: null, isPro: false, hasProfile: false });
    }
    setAuthReady(true);
  });
  return unsubscribeAuth;
}, []);
```

Import `fetchProfile` from `../src/services/profileService` and destructure
`setHasProfile` from `useUserStore`.

---

**5 — app/(app)/_layout.tsx: hasProfile guard**

```tsx
import { Redirect, Slot } from 'expo-router';
import { useUserStore } from '../../src/store/useUserStore';

export default function AppLayout() {
  const uid        = useUserStore((s) => s.uid);
  const hasProfile = useUserStore((s) => s.hasProfile);
  if (!uid)        return <Redirect href="/onboarding" />;
  if (!hasProfile) return <Redirect href="/quiz" />;
  return <Slot />;
}
```

---

**6 — SignInScreen.tsx**

Copy `OnboardingScreen.tsx` verbatim, rename the component to `SignInScreen`, and
**replace** `router.replace('/(app)/')` with `router.replace('/(app)/')` — no change
needed here because the `(app)/_layout.tsx` will redirect to `/quiz` if `hasProfile`
is false. The sign-in screen does not need to know about the profile state.

Wait — `router.replace('/(app)/')` is already the correct target. The guard in
`(app)/_layout.tsx` handles the quiz redirect. No change to navigation logic.

---

**7 — QuizScreen.tsx**

The quiz is a step-by-step screen: one question visible at a time, two answer options,
no progress bar, no right/wrong feedback, no back button. After answering all 5, call
`inferCefrLevel(score)` and navigate to `/topics` passing `cefrLevel` as a URL param.

**Quiz questions** — hardcoded via i18n keys (see i18n section below). The correct option
index (0 or 1) is embedded in the question definition alongside the display strings:

```typescript
// Inside QuizScreen.tsx (not exported — screen-local)
interface Question {
  questionKey: keyof typeof translations;
  optionAKey:  keyof typeof translations;
  optionBKey:  keyof typeof translations;
  correctIndex: 0 | 1;
}

const QUESTIONS: Question[] = [
  { questionKey: 'quiz_q1',    optionAKey: 'quiz_q1_a', optionBKey: 'quiz_q1_b', correctIndex: 0 },
  { questionKey: 'quiz_q2',    optionAKey: 'quiz_q2_a', optionBKey: 'quiz_q2_b', correctIndex: 0 },
  { questionKey: 'quiz_q3',    optionAKey: 'quiz_q3_a', optionBKey: 'quiz_q3_b', correctIndex: 0 },
  { questionKey: 'quiz_q4',    optionAKey: 'quiz_q4_a', optionBKey: 'quiz_q4_b', correctIndex: 1 },
  { questionKey: 'quiz_q5',    optionAKey: 'quiz_q5_a', optionBKey: 'quiz_q5_b', correctIndex: 0 },
];
```

**CEFR scoring function** — export this so it can be unit-tested:

```typescript
export function inferCefrLevel(correctCount: number): string {
  if (correctCount <= 1) return 'A1';
  if (correctCount === 2) return 'A2';
  if (correctCount === 3) return 'B1';
  return 'B2';
}
```

**Component state:**
```typescript
const [step, setStep]   = useState(0);  // 0–4
const [score, setScore] = useState(0);
```

**On option tap:**
```typescript
const handleAnswer = (selectedIndex: 0 | 1) => {
  const correct = QUESTIONS[step].correctIndex === selectedIndex;
  const newScore = correct ? score + 1 : score;
  if (step < QUESTIONS.length - 1) {
    setStep(step + 1);
    setScore(newScore);
  } else {
    const level = inferCefrLevel(newScore);
    router.push({ pathname: '/topics', params: { cefrLevel: level } });
  }
};
```

No `useLocalSearchParams` needed here — the quiz is always entered fresh.

**UI layout:** full-screen white card, question text centred, two tappable option cards
stacked vertically below. Use `colors.primary` for selected state. No back button in
header.

---

**8 — TopicsScreen.tsx**

Receives `cefrLevel` from URL params. On completion, calls `submitOnboarding()`, sets
`hasProfile(true)`, navigates to `/(app)/`.

**Topic definitions** — hardcoded, screen-local:

```typescript
interface Topic {
  key: string;
  emoji: string;
  labelKey: keyof typeof translations;
}

const TOPICS: Topic[] = [
  { key: 'food',     emoji: '🍕', labelKey: 'topic_food'     },
  { key: 'travel',   emoji: '✈️',  labelKey: 'topic_travel'   },
  { key: 'work',     emoji: '💼', labelKey: 'topic_work'     },
  { key: 'culture',  emoji: '🎭', labelKey: 'topic_culture'  },
  { key: 'home',     emoji: '🏠', labelKey: 'topic_home'     },
  { key: 'leisure',  emoji: '🎮', labelKey: 'topic_leisure'  },
  { key: 'health',   emoji: '🏃', labelKey: 'topic_health'   },
  { key: 'shopping', emoji: '🛍️', labelKey: 'topic_shopping' },
];
```

**Weight mapping function** — export for unit tests:

```typescript
export function buildTopicPreferences(
  allKeys: string[],
  selectedKeys: string[]
): Record<string, number> {
  return Object.fromEntries(
    allKeys.map((k) => [k, selectedKeys.includes(k) ? 0.8 : 0.3])
  );
}
```

**Component state:**
```typescript
const [selected, setSelected] = useState<string[]>([]);
const [loading,  setLoading]  = useState(false);
const [error,    setError]    = useState<string | null>(null);
```

**Toggle logic:**
```typescript
const toggle = (key: string) => {
  setSelected((prev) =>
    prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
  );
};
```

**"Continua" button:** disabled when `selected.length < 2 || loading`.

**On submit:**
```typescript
const handleSubmit = async () => {
  setLoading(true);
  setError(null);
  try {
    const { cefrLevel } = useLocalSearchParams<{ cefrLevel: string }>();
    const prefs = buildTopicPreferences(TOPICS.map((t) => t.key), selected);
    await submitOnboarding({ cefr_level: cefrLevel, topic_preferences: prefs });
    setHasProfile(true);
    router.replace('/(app)/');
  } catch (e: any) {
    setError(e.message ?? t('topics_error'));
  } finally {
    setLoading(false);
  }
};
```

**UI layout:** page title, 2×4 grid of topic cards (`FlatList` with `numColumns={2}`).
Each card: centred emoji (32pt) above Italian label. Selected state: `colors.primary`
border + light tinted background. Below the grid: "Continua" button (same style as sign-in
button) + `ErrorBanner` if `error` is set. No back button.

---

**9 — Route wrappers**

```tsx
// mobile/app/quiz.tsx
export { default } from '../src/screens/QuizScreen';

// mobile/app/topics.tsx
export { default } from '../src/screens/TopicsScreen';

// mobile/app/onboarding.tsx  (update re-export)
export { default } from '../src/screens/SignInScreen';
```

---

**10 — i18n strings**

Add to `mobile/src/i18n/it.ts`:

```typescript
// Quiz
quiz_title:    'Qual è il tuo livello?',
quiz_subtitle: 'Scegli la frase che ti sembra più naturale.',
quiz_q1:       'Come suona meglio?',
quiz_q1_a:     'Ich trinke jeden Morgen Kaffee.',
quiz_q1_b:     'Ich jeden Morgen Kaffee trinke.',
quiz_q2:       'Quale frase è corretta?',
quiz_q2_a:     'Ich sehe den Mann.',
quiz_q2_b:     'Ich sehe der Mann.',
quiz_q3:       'Come si dice "Spengo la luce"?',
quiz_q3_a:     'Ich mache das Licht aus.',
quiz_q3_b:     'Ich ausmache das Licht.',
quiz_q4:       'Quale suona come un madrelingua?',
quiz_q4_a:     'Ich fahre mit der Bus.',
quiz_q4_b:     'Ich fahre mit dem Bus.',
quiz_q5:       'Come si esprime un desiderio educato?',
quiz_q5_a:     'Ich hätte gern einen Kaffee.',
quiz_q5_b:     'Ich will gern einen Kaffee.',

// Topics
topics_title:    'Cosa ti interessa?',
topics_subtitle: 'Seleziona almeno 2 argomenti.',
topics_cta:      'Continua',
topics_error:    'Errore durante il salvataggio. Riprova.',
topic_food:      'Cibo',
topic_travel:    'Viaggi',
topic_work:      'Lavoro',
topic_culture:   'Cultura',
topic_home:      'Casa',
topic_leisure:   'Tempo libero',
topic_health:    'Salute',
topic_shopping:  'Shopping',
```

**Correct answers (for Developer reference, not displayed in UI):**
- Q1: A (verb-second word order — WORD_ORDER_V2)
- Q2: A (accusative masculine — ACCUSATIVE_MASC)
- Q3: A (separable verb — SEPARABLE_VERB)
- Q4: B (dative preposition — DATIV_PREP)
- Q5: A (natural native form — KONJUNKTIV_II adjacent)

---

## API Contract

```
POST /profile/onboarding
Authorization: Bearer <firebase_jwt>

Request body:
{
  "cefr_level": "A1" | "A2" | "B1" | "B2",
  "topic_preferences": {
    "food": 0.8 | 0.3,
    "travel": 0.8 | 0.3,
    "work": 0.8 | 0.3,
    "culture": 0.8 | 0.3,
    "home": 0.8 | 0.3,
    "leisure": 0.8 | 0.3,
    "health": 0.8 | 0.3,
    "shopping": 0.8 | 0.3
  }
}

Response 200: ProfileResponse (see types/api.ts)
Response 422: invalid cefr_level
```

---

## Database Changes

None. `POST /profile/onboarding` already exists and handles everything server-side.

---

## Tests

### Mobile (Jest)

**`mobile/__tests__/onboarding.test.ts`**

```typescript
import { inferCefrLevel } from '../src/screens/QuizScreen';
import { buildTopicPreferences } from '../src/screens/TopicsScreen';

// inferCefrLevel
test('0 correct → A1', () => expect(inferCefrLevel(0)).toBe('A1'));
test('1 correct → A1', () => expect(inferCefrLevel(1)).toBe('A1'));
test('2 correct → A2', () => expect(inferCefrLevel(2)).toBe('A2'));
test('3 correct → B1', () => expect(inferCefrLevel(3)).toBe('B1'));
test('4 correct → B2', () => expect(inferCefrLevel(4)).toBe('B2'));
test('5 correct → B2', () => expect(inferCefrLevel(5)).toBe('B2'));

// buildTopicPreferences
const ALL_KEYS = ['food', 'travel', 'work', 'culture', 'home', 'leisure', 'health', 'shopping'];

test('selected topics get weight 0.8', () => {
  const prefs = buildTopicPreferences(ALL_KEYS, ['food', 'travel']);
  expect(prefs.food).toBe(0.8);
  expect(prefs.travel).toBe(0.8);
});

test('unselected topics get weight 0.3', () => {
  const prefs = buildTopicPreferences(ALL_KEYS, ['food', 'travel']);
  expect(prefs.work).toBe(0.3);
  expect(prefs.culture).toBe(0.3);
});

test('all 8 keys present regardless of selection', () => {
  const prefs = buildTopicPreferences(ALL_KEYS, ['food']);
  expect(Object.keys(prefs)).toHaveLength(8);
});
```

**Button disabled state** — tested via the existing RN testing approach used in this
project. Assert `selected.length < 2` logic in a pure function unit test rather than a
component render test, since the project does not currently use React Native Testing Library.
If RNTL is available, add one render test for the disabled button state.

---

## Definition of Done

- [ ] All acceptance criteria checked (AC1–AC7)
- [ ] All specified tests written and green (`npm test -- --runInBand`)
- [ ] `npx tsc --noEmit` from `mobile/` exits clean
- [ ] `OnboardingScreen.tsx` deleted; `SignInScreen.tsx` exists in its place
- [ ] `app/quiz.tsx` and `app/topics.tsx` exist as route wrappers
- [ ] `useUserStore` has `hasProfile` persisted in MMKV
- [ ] `POST /profile/onboarding` fires on Topics "Continua" with correct payload
- [ ] No hardcoded strings — all UI text via `t()` from `it.ts`
- [ ] No API keys or secrets in code
- [ ] Conventional commit: `feat(TASK-015): onboarding flow — CEFR quiz + topic preferences`
- [ ] TASK status updated to `done`

---

## Notes for Tech Lead

- The `quiz_q4` correct answer is **B** (`mit dem Bus` — dative), not A. The `QUESTIONS`
  array above has `correctIndex: 1` for Q4. Double-check this when reviewing the commit.
- `router.push({ pathname: '/topics', params: { cefrLevel: level } })` passes the level as
  a string URL param. In `TopicsScreen`, read it with
  `useLocalSearchParams<{ cefrLevel: string }>()`. This is the same pattern used in
  `RecapScreen` for `sessionId`.
- The `hasProfile` MMKV flag is cleared by `clearUser()` — so signing out and signing in
  with a different account will re-trigger the profile check. This is correct behaviour.
- Next task candidate: verify `GET /word/today` returns a word for a freshly onboarded user
  (the nightly job needs to have run, or a test word needs to be seeded manually). If the
  smoke test shows an empty word card after onboarding, the manual seed path or a
  "generate word on first sign-in" trigger may be needed as TASK-016.
