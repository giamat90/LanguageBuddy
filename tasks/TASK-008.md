# TASK-008 — React Native / Expo Migration (Android + iOS)

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Depends on:** TASK-007 (merged ✓) — backend is complete and unchanged
**Estimated sub-phases:** 8a → 8h (implement in order; each phase is one commit)

---

## Context

Strategic pivot: the product must ship on both Android and iOS before production. Rather than
maintaining two native codebases, we rewrite the client in React Native + Expo. The backend
(FastAPI, all 8 routes, all DB tables, all AI prompts) is **completely unchanged** — only the
client is replaced.

The Kotlin `android/` folder stays in the repo as reference until phase 8h. Do not delete or
modify any file inside `android/` during this task.

One new top-level folder `mobile/` contains the entire Expo app.

Backend change: `POST /billing/webhook` (Play Billing verification) is replaced by
`POST /revenuecat/webhook` (RevenueCat server-to-server notification). This is the only
backend file touched in this task.

---

## Scope

### In scope
- `mobile/` — full Expo SDK 51 app in TypeScript
- All 7 v1.0 screens: Onboarding, WordCard, Vault, Paywall, Chat, Recap, plus navigation shell
- Same business logic as Android: streak, save, paywall trigger, SSE chat, recap stats
- Zustand stores (one per domain)
- Axios API client with auth interceptor
- Custom `useSseStream` hook using `react-native-sse`
- MMKV for local persistence
- Firebase Auth (`@react-native-firebase/auth`) — Google Sign-In + Apple Sign-In (phase 8g)
- RevenueCat (`react-native-purchases`) — cross-platform billing
- Expo Notifications + FCM push
- i18n-js with Italian as default locale
- EAS Build configuration for both Android and iOS
- `POST /revenuecat/webhook` backend route (replaces `POST /billing/webhook`)

### Out of scope
- Deleting `android/` (phase 8h only archives it — rename to `android_legacy/`)
- Updating CLAUDE.md tech stack section (phase 8h)
- Any changes to backend routes other than the RevenueCat webhook
- CEFR level quiz / topic preferences onboarding (the onboarding screen in this task is
  sign-in only, same as the current Android stub — full quiz is a v1.1 task)
- Offline chat (word card is offline-capable via MMKV cache; chat requires network)
- Web version

---

## Acceptance Criteria

> ALL of the following must be true before marking TASK-008 done.

- [ ] `cd mobile && npx expo start` runs without errors on both Android and iOS simulators
- [ ] EAS build (`eas build --platform android --profile preview`) produces a working APK
- [ ] Google Sign-In works on Android; Apple Sign-In works on iOS (phase 8g)
- [ ] WordCard screen fetches and displays today's word from the live Railway backend
- [ ] Save button transitions Idle → Saving → Saved; streak counter updates
- [ ] PaywallScreen appears after Save; RevenueCat paywall loads product prices
- [ ] Chat screen streams SSE tokens from the live backend; session ends at message 10
- [ ] Recap screen displays fluency score, error list, XP after session ends
- [ ] Vault screen paginates saved vocabulary items
- [ ] All Italian strings go through i18n-js — zero hardcoded strings in component files
- [ ] All screens share the same color tokens and typography as specified below
- [ ] `POST /revenuecat/webhook` backend test passes
- [ ] All per-phase tests listed below pass
- [ ] No API keys or secrets committed to git

---

## Technical Spec

---

### Folder structure — `mobile/`

Create this exact structure. Every file listed must exist after phase 8f.

```
mobile/
├── app.json                          — Expo app config
├── eas.json                          — EAS build profiles
├── tsconfig.json
├── babel.config.js
├── package.json
├── .env.example                      — EXPO_PUBLIC_API_BASE_URL, etc.
└── src/
    ├── screens/
    │   ├── OnboardingScreen.tsx
    │   ├── WordCardScreen.tsx
    │   ├── VaultScreen.tsx
    │   ├── PaywallScreen.tsx
    │   ├── ChatScreen.tsx
    │   └── RecapScreen.tsx
    ├── components/
    │   ├── ArticleBadge.tsx
    │   ├── CefrBadge.tsx
    │   ├── StreakBadge.tsx
    │   ├── SaveButton.tsx
    │   ├── WordCard.tsx
    │   ├── MessageBubble.tsx
    │   ├── PlanCard.tsx
    │   └── RecapStatCard.tsx
    ├── hooks/
    │   ├── useSseStream.ts           — custom SSE hook
    │   └── useRevenueCat.ts          — paywall + purchase hook
    ├── services/
    │   ├── apiClient.ts              — Axios instance with auth interceptor
    │   ├── wordService.ts
    │   ├── sessionService.ts
    │   ├── vaultService.ts
    │   └── recapService.ts
    ├── store/
    │   ├── useUserStore.ts           — auth state, is_pro
    │   ├── useWordStore.ts           — daily word, streak, save state
    │   ├── useChatStore.ts           — session, messages, streaming state
    │   └── useVaultStore.ts          — vault items, pagination cursor
    ├── navigation/
    │   └── AppNavigator.tsx          — React Navigation stack
    ├── theme/
    │   ├── colors.ts
    │   └── typography.ts
    ├── i18n/
    │   ├── index.ts                  — i18n-js setup
    │   └── it.ts                     — Italian strings (all of them)
    └── types/
        ├── api.ts                    — API response types
        └── domain.ts                 — domain model types
```

---

### `app.json` — Expo config

```json
{
  "expo": {
    "name": "GermanBuddy",
    "slug": "germanbuddy",
    "version": "1.0.0",
    "orientation": "portrait",
    "scheme": "germanbuddy",
    "platforms": ["ios", "android"],
    "android": {
      "package": "com.germanbuddy",
      "googleServicesFile": "./google-services.json"
    },
    "ios": {
      "bundleIdentifier": "com.germanbuddy",
      "googleServicesFile": "./GoogleService-Info.plist"
    },
    "plugins": [
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      "expo-notifications"
    ],
    "extra": {
      "eas": { "projectId": "REPLACE_WITH_EAS_PROJECT_ID" }
    }
  }
}
```

---

### `eas.json` — EAS build profiles

```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

---

### `package.json` — exact dependency versions

```json
{
  "name": "germanbuddy",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "test": "jest --watchAll=false"
  },
  "dependencies": {
    "expo": "~51.0.0",
    "expo-status-bar": "~1.12.1",
    "expo-notifications": "~0.28.0",
    "react": "18.2.0",
    "react-native": "0.74.1",
    "@react-navigation/native": "^6.1.17",
    "@react-navigation/native-stack": "^6.9.26",
    "react-native-screens": "~3.31.1",
    "react-native-safe-area-context": "4.10.5",
    "@react-native-firebase/app": "^20.3.0",
    "@react-native-firebase/auth": "^20.3.0",
    "@react-native-google-signin/google-signin": "^12.2.1",
    "react-native-purchases": "^8.1.2",
    "react-native-sse": "^1.2.2",
    "axios": "^1.7.2",
    "zustand": "^4.5.2",
    "react-native-mmkv": "^2.12.2",
    "i18n-js": "^4.4.3",
    "@expo/vector-icons": "^14.0.2",
    "react-native-reanimated": "~3.10.1",
    "react-native-gesture-handler": "~2.16.1"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "typescript": "~5.3.3",
    "@types/react": "~18.2.79",
    "jest": "^29.7.0",
    "jest-expo": "~51.0.0",
    "@testing-library/react-native": "^12.5.0",
    "babel-jest": "^29.7.0"
  }
}
```

---

### Theme — `src/theme/colors.ts`

```typescript
export const colors = {
  primary:        '#1D9E75',
  background:     '#F5F2EB',
  surface:        '#FFFFFF',
  onBackground:   '#1A1A18',
  textSecondary:  '#6B6B68',
  textTertiary:   '#9E9E9A',
  cardDivider:    '#E0DDD6',
  cardSectionBg:  '#F0EDE6',
  savedButtonBg:  '#E8F5F0',
  // Article gender colours
  articleDer:     '#4A90D9',
  articleDie:     '#E8507A',
  articleDas:     '#F5A623',
  articleNone:    '#9E9E9A',
} as const;
```

### Theme — `src/theme/typography.ts`

```typescript
import { StyleSheet } from 'react-native';

export const typography = StyleSheet.create({
  wordHeading:      { fontSize: 40, fontWeight: '600', lineHeight: 44, letterSpacing: -0.5 },
  ipa:              { fontSize: 16, fontStyle: 'italic', lineHeight: 22 },
  meaning:          { fontSize: 22, fontWeight: '400', lineHeight: 28 },
  exampleDe:        { fontSize: 15, lineHeight: 22 },
  exampleIt:        { fontSize: 14, lineHeight: 20 },
  culturalNote:     { fontSize: 14, lineHeight: 20 },
  sectionLabel:     { fontSize: 11, fontWeight: '500', lineHeight: 16, letterSpacing: 0.8 },
  badge:            { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  streak:           { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  bodyLarge:        { fontSize: 16, lineHeight: 24 },
  bodyMedium:       { fontSize: 14, lineHeight: 20 },
  headlineLarge:    { fontSize: 32, fontWeight: '700', lineHeight: 40 },
});
```

---

### i18n — `src/i18n/it.ts`

All Italian strings used across every screen. Keys mirror the Android `strings.xml` names,
converted to camelCase. Developer must add every string referenced in the components below.
Minimum required keys:

```typescript
export default {
  // Onboarding
  onboarding_title:          'GermanBuddy',
  onboarding_subtitle:       'Impara il tedesco ogni giorno',
  onboarding_cta_google:     'Accedi con Google',
  onboarding_cta_apple:      'Accedi con Apple',
  onboarding_error:          'Accesso non riuscito',

  // Word Card
  word_card_meaning:         'Significato',
  word_card_example:         'Esempio',
  word_card_cultural:        'Curiosità culturale',
  word_card_save:            'Salva la parola',
  word_card_saved:           'Salvata',
  word_card_saving:          'Salvataggio in corso',
  word_card_skip:            'Salta per oggi',
  word_card_empty:           'Nessuna parola per oggi.\nTorna domani!',
  word_card_retry:           'Riprova',
  word_card_practice:        'Pratica con Lena',
  word_card_error:           'Errore di rete. Riprova.',

  // Paywall
  paywall_headline:          'Lena vuole praticare\nquesta parola con te →',
  paywall_subhead:           'Sblocca GermanBuddy Pro',
  paywall_feature_chat:      'Sessioni di chat illimitate',
  paywall_feature_recap:     'Riepilogo grammaticale',
  paywall_feature_progress:  'Tracciamento progressi',
  paywall_feature_srs:       'Ripetizione spaziata (SRS)',
  paywall_plan_monthly:      'Mensile',
  paywall_plan_annual:       'Annuale',
  paywall_plan_annual_badge: '★ RISPARMIA 41%',
  paywall_trial:             'Prova gratis 7 giorni',
  paywall_cta:               'Inizia la prova gratuita',
  paywall_dismiss:           'Forse più tardi',
  paywall_legal:             'Puoi annullare in qualsiasi momento',
  paywall_error:             'Acquisto non riuscito',

  // Chat
  chat_title:                'Lena',
  chat_input_hint:           'Scrivi in tedesco…',
  chat_send:                 'Invia',
  chat_session_ended:        'Sessione completata! 🎉',
  chat_back:                 'Torna alla parola del giorno',
  chat_error_start:          'Impossibile avviare la sessione',
  chat_view_recap:           'Vedi il riepilogo',

  // Recap
  recap_title:               'Riepilogo',
  recap_fluency:             'Fluidità',
  recap_xp:                  'XP',
  recap_new_words:           'Parole nuove',
  recap_strengths:           'Punti di forza',
  recap_focus:               'Da migliorare',
  recap_errors:              'Errori grammaticali',
  recap_corrected:           '✓ Corretto',
  recap_done:                'Torna alla parola del giorno',
  recap_error_load:          'Impossibile caricare il riepilogo',

  // Vault
  vault_title:               'Il mio vocabolario',
  vault_empty:               'Nessuna parola salvata.\nSalva la parola del giorno per iniziare!',
  vault_review_today:        'Oggi',
  vault_days_until_review:   '%{count} giorni',
  vault_error:               'Impossibile caricare il vocabolario',
  vault_retry:               'Riprova',
} as const;
```

### `src/i18n/index.ts`

```typescript
import { I18n } from 'i18n-js';
import it from './it';

const i18n = new I18n({ it });
i18n.locale = 'it';
i18n.enableFallback = true;
i18n.defaultLocale = 'it';

export default i18n;
export const t = (key: keyof typeof it, opts?: object) => i18n.t(key, opts);
```

---

### Types — `src/types/domain.ts`

```typescript
export interface DailyWord {
  id: string;
  word: string;
  article: string | null;
  partOfSpeech: string | null;
  ipa: string | null;
  meaningIt: string | null;
  meaningEn: string | null;
  exampleDe: string | null;
  exampleIt: string | null;
  culturalNote: string | null;
  grammarAngle: string | null;
  topicDomain: string | null;
  cefrBand: string | null;
  date: string;
  isSaved: boolean;
}

export interface VaultItem {
  id: string;
  word: string;
  article: string | null;
  translationIt: string | null;
  partOfSpeech: string | null;
  retentionScore: number;
  nextReviewAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export interface RecapData {
  sessionId: string;
  fluencyScore: number | null;
  errorsCount: number;
  newWordsCount: number;
  errors: RecapError[];
  strengths: string[];
  focusPoints: string[];
}

export interface RecapError {
  ruleCode: string;
  ruleLabel: string;
  userText: string;
  correctForm: string;
  wasCorrected: boolean;
}
```

### Types — `src/types/api.ts`

```typescript
export interface DailyWordResponse {
  id: string;
  word: string;
  article: string | null;
  part_of_speech: string | null;
  ipa: string | null;
  meaning_it: string | null;
  meaning_en: string | null;
  example_de: string | null;
  example_it: string | null;
  cultural_note: string | null;
  grammar_angle: string | null;
  topic_domain: string | null;
  cefr_band: string | null;
  date: string;
  is_saved: boolean;
}

export interface SaveWordResponse {
  streak_days: number;
  already_saved: boolean;
}

export interface VaultResponse {
  items: VaultItemResponse[];
  total: number;
  page: number;
  page_size: number;
}

export interface VaultItemResponse {
  id: string;
  word: string;
  article: string | null;
  translation_it: string | null;
  part_of_speech: string | null;
  retention_score: number;
  next_review_at: string;
}

export interface SessionStartResponse {
  session_id: string;
  word: string;
}

export interface RecapResponse {
  session_id: string;
  fluency_score: number | null;
  errors_count: number;
  new_words_count: number;
  errors: {
    rule_code: string;
    rule_label: string;
    user_text: string;
    correct_form: string;
    was_corrected: boolean;
  }[];
}
```

---

### API client — `src/services/apiClient.ts`

```typescript
import axios from 'axios';
import auth from '@react-native-firebase/auth';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://germanbuddy-production.up.railway.app/v1/';

export const apiClient = axios.create({ baseURL: BASE_URL });

// Auth interceptor: attach Firebase JWT to every request
apiClient.interceptors.request.use(async (config) => {
  const user = auth().currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Error interceptor: surface HTTP errors with detail message
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail ?? error.message;
    return Promise.reject(new Error(message));
  },
);
```

The `EXPO_PUBLIC_` prefix makes the variable available in Expo's bundler. Add to `.env.example`:
```
EXPO_PUBLIC_API_BASE_URL=https://germanbuddy-production.up.railway.app/v1/
```

---

### Service layer

Each service file is thin — just API calls + response mapping. No business logic.

**`src/services/wordService.ts`**
```typescript
import { apiClient } from './apiClient';
import { DailyWord, VaultItem } from '../types/domain';
import { DailyWordResponse, SaveWordResponse } from '../types/api';

function mapWord(r: DailyWordResponse): DailyWord {
  return {
    id: r.id, word: r.word, article: r.article, partOfSpeech: r.part_of_speech,
    ipa: r.ipa, meaningIt: r.meaning_it, meaningEn: r.meaning_en,
    exampleDe: r.example_de, exampleIt: r.example_it, culturalNote: r.cultural_note,
    grammarAngle: r.grammar_angle, topicDomain: r.topic_domain,
    cefrBand: r.cefr_band, date: r.date, isSaved: r.is_saved,
  };
}

export async function fetchTodayWord(): Promise<DailyWord> {
  const { data } = await apiClient.get<DailyWordResponse>('word/today');
  return mapWord(data);
}

export async function saveWord(): Promise<SaveWordResponse> {
  const { data } = await apiClient.post<SaveWordResponse>('word/save');
  return data;
}
```

**`src/services/sessionService.ts`**
```typescript
import { apiClient } from './apiClient';
import { SessionStartResponse } from '../types/api';

export async function startSession(): Promise<SessionStartResponse> {
  const { data } = await apiClient.post<SessionStartResponse>('session/start');
  return data;
}

export async function endSession(sessionId: string): Promise<void> {
  await apiClient.post('session/end', { session_id: sessionId });
}
```

**`src/services/vaultService.ts`**
```typescript
import { apiClient } from './apiClient';
import { VaultItem } from '../types/domain';
import { VaultResponse } from '../types/api';

export async function fetchVault(page: number, pageSize = 20): Promise<{ items: VaultItem[]; total: number }> {
  const { data } = await apiClient.get<VaultResponse>('vault', { params: { page, page_size: pageSize } });
  return {
    total: data.total,
    items: data.items.map((r) => ({
      id: r.id, word: r.word, article: r.article, translationIt: r.translation_it,
      partOfSpeech: r.part_of_speech, retentionScore: r.retention_score, nextReviewAt: r.next_review_at,
    })),
  };
}
```

**`src/services/recapService.ts`**
```typescript
import { apiClient } from './apiClient';
import { RecapData } from '../types/domain';
import { RecapResponse } from '../types/api';

export async function fetchRecap(sessionId: string): Promise<RecapData> {
  const { data } = await apiClient.get<RecapResponse>(`session/${sessionId}/recap`);
  return {
    sessionId: data.session_id,
    fluencyScore: data.fluency_score,
    errorsCount: data.errors_count,
    newWordsCount: data.new_words_count,
    errors: data.errors.map((e) => ({
      ruleCode: e.rule_code, ruleLabel: e.rule_label,
      userText: e.user_text, correctForm: e.correct_form, wasCorrected: e.was_corrected,
    })),
    strengths: [],    // v1.0: derived client-side from errors (empty if no errors)
    focusPoints: [],  // v1.0: derived client-side
  };
}
```

---

### Zustand stores

**`src/store/useUserStore.ts`**
```typescript
import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'user-store' });

interface UserState {
  uid: string | null;
  email: string | null;
  isPro: boolean;
  setUser: (uid: string, email: string) => void;
  setIsPro: (value: boolean) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  uid:    storage.getString('uid') ?? null,
  email:  storage.getString('email') ?? null,
  isPro:  storage.getBoolean('isPro') ?? false,

  setUser: (uid, email) => {
    storage.set('uid', uid);
    storage.set('email', email);
    set({ uid, email });
  },
  setIsPro: (value) => {
    storage.set('isPro', value);
    set({ isPro: value });
  },
  clearUser: () => {
    storage.clearAll();
    set({ uid: null, email: null, isPro: false });
  },
}));
```

**`src/store/useWordStore.ts`**
```typescript
import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import { DailyWord } from '../types/domain';

const storage = new MMKV({ id: 'word-store' });

export type SaveState = 'idle' | 'saving' | 'saved';

interface WordState {
  word: DailyWord | null;
  saveState: SaveState;
  streakDays: number;
  isLoading: boolean;
  error: string | null;
  setWord: (word: DailyWord) => void;
  setSaveState: (state: SaveState) => void;
  setStreak: (days: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useWordStore = create<WordState>((set) => ({
  word:       null,
  saveState:  'idle',
  streakDays: storage.getNumber('streakDays') ?? 0,
  isLoading:  false,
  error:      null,

  setWord:      (word) => set({ word, error: null }),
  setSaveState: (saveState) => set({ saveState }),
  setStreak:    (days) => { storage.set('streakDays', days); set({ streakDays: days }); },
  setLoading:   (isLoading) => set({ isLoading }),
  setError:     (error) => set({ error, isLoading: false }),
}));
```

**`src/store/useChatStore.ts`**
```typescript
import { create } from 'zustand';
import { ChatMessage } from '../types/domain';

interface ChatState {
  sessionId: string | null;
  word: string | null;
  messages: ChatMessage[];
  inputText: string;
  isStreaming: boolean;
  messageCount: number;
  isSessionEnded: boolean;
  error: string | null;

  setSession: (sessionId: string, word: string) => void;
  addMessage: (msg: ChatMessage) => void;
  appendToken: (token: string) => void;
  finaliseStream: () => void;
  setInput: (text: string) => void;
  setStreaming: (v: boolean) => void;
  endSession: () => void;
  setError: (e: string) => void;
  reset: () => void;
}

const INITIAL: Omit<ChatState, keyof ReturnType<typeof actions>> = {
  sessionId: null, word: null, messages: [], inputText: '',
  isStreaming: false, messageCount: 0, isSessionEnded: false, error: null,
};

function actions(set: any, get: any) {
  return {
    setSession: (sessionId: string, word: string) => set({ sessionId, word }),
    addMessage: (msg: ChatMessage) => set((s: ChatState) => ({
      messages: [...s.messages, msg], messageCount: s.messageCount + 1,
    })),
    appendToken: (token: string) => set((s: ChatState) => {
      const msgs = [...s.messages];
      const idx = msgs.findLastIndex((m) => m.isStreaming);
      if (idx < 0) return {};
      msgs[idx] = { ...msgs[idx], content: msgs[idx].content + token };
      return { messages: msgs };
    }),
    finaliseStream: () => set((s: ChatState) => ({
      messages: s.messages.map((m) => m.isStreaming ? { ...m, isStreaming: false } : m),
      isStreaming: false,
      messageCount: s.messageCount + 1,
    })),
    setInput: (inputText: string) => set({ inputText }),
    setStreaming: (isStreaming: boolean) => set({ isStreaming }),
    endSession: () => set({ isSessionEnded: true }),
    setError: (error: string) => set({ error, isStreaming: false }),
    reset: () => set({ ...INITIAL }),
  };
}

export const useChatStore = create<ChatState>((set, get) => ({
  ...INITIAL,
  ...actions(set, get),
}));
```

**`src/store/useVaultStore.ts`**
```typescript
import { create } from 'zustand';
import { VaultItem } from '../types/domain';

interface VaultState {
  items: VaultItem[];
  page: number;
  total: number;
  isLoading: boolean;
  error: string | null;
  appendItems: (items: VaultItem[], total: number) => void;
  nextPage: () => void;
  setLoading: (v: boolean) => void;
  setError: (e: string) => void;
  reset: () => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  items: [], page: 1, total: 0, isLoading: false, error: null,
  appendItems: (items, total) => set((s) => ({ items: [...s.items, ...items], total })),
  nextPage: () => set((s) => ({ page: s.page + 1 })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  reset: () => set({ items: [], page: 1, total: 0, isLoading: false, error: null }),
}));
```

---

### Custom hook — `src/hooks/useSseStream.ts`

```typescript
import { useRef } from 'react';
import EventSource from 'react-native-sse';
import auth from '@react-native-firebase/auth';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://germanbuddy-production.up.railway.app/v1/';

interface SseOptions {
  onToken: (token: string) => void;
  onDone: (messageId: string) => void;
  onError: (error: Error) => void;
}

export function useSseStream() {
  const esRef = useRef<EventSource | null>(null);

  const stream = async (
    sessionId: string,
    messages: { role: string; content: string }[],
    opts: SseOptions,
  ) => {
    cancel();

    const user = auth().currentUser;
    const token = user ? await user.getIdToken() : null;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

    esRef.current = new EventSource(`${BASE_URL}session/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ session_id: sessionId, message: lastUserMsg, messages }),
      pollingInterval: 0,
    });

    esRef.current.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data ?? '{}');
        if (data.type === 'token') opts.onToken(data.content);
        if (data.type === 'done')  opts.onDone(data.message_id);
      } catch (e) {
        opts.onError(e instanceof Error ? e : new Error('SSE parse error'));
      }
    });

    esRef.current.addEventListener('error', (event) => {
      opts.onError(new Error(`SSE error: ${JSON.stringify(event)}`));
    });
  };

  const cancel = () => {
    esRef.current?.close();
    esRef.current = null;
  };

  return { stream, cancel };
}
```

---

### Custom hook — `src/hooks/useRevenueCat.ts`

```typescript
import { useEffect, useState } from 'react';
import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { useUserStore } from '../store/useUserStore';

const RC_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';
const RC_API_KEY_IOS     = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';

export function useRevenueCat() {
  const { uid, setIsPro } = useUserStore();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { Platform } = require('react-native');
      const key = Platform.OS === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
      Purchases.configure({ apiKey: key });
      if (uid) await Purchases.logIn(uid);

      const { current } = await Purchases.getCustomerInfo();
      const isPro = Object.keys(current.entitlements.active).includes('pro');
      setIsPro(isPro);

      const offerings = await Purchases.getOfferings();
      const pkgs = offerings.current?.availablePackages ?? [];
      setPackages(pkgs);
    };
    init().catch(console.error);
  }, [uid]);

  const purchase = async (pkg: PurchasesPackage): Promise<boolean> => {
    setIsPurchasing(true);
    setError(null);
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const isPro = Object.keys(customerInfo.entitlements.active).includes('pro');
      setIsPro(isPro);
      return isPro;
    } catch (e: any) {
      if (!e.userCancelled) setError(e.message ?? 'Acquisto non riuscito');
      return false;
    } finally {
      setIsPurchasing(false);
    }
  };

  return { packages, isPurchasing, error, purchase };
}
```

Add to `.env.example`:
```
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=your_revenuecat_android_key
EXPO_PUBLIC_REVENUECAT_IOS_KEY=your_revenuecat_ios_key
```

---

### Navigation — `src/navigation/AppNavigator.tsx`

```typescript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useUserStore } from '../store/useUserStore';
import OnboardingScreen from '../screens/OnboardingScreen';
import WordCardScreen from '../screens/WordCardScreen';
import VaultScreen from '../screens/VaultScreen';
import PaywallScreen from '../screens/PaywallScreen';
import ChatScreen from '../screens/ChatScreen';
import RecapScreen from '../screens/RecapScreen';

export type RootStackParamList = {
  Onboarding: undefined;
  WordCard: undefined;
  Vault: undefined;
  Paywall: undefined;
  Chat: undefined;
  Recap: { sessionId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const uid = useUserStore((s) => s.uid);
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {uid == null ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="WordCard" component={WordCardScreen} />
            <Stack.Screen name="Vault"    component={VaultScreen} />
            <Stack.Screen name="Paywall"  component={PaywallScreen} />
            <Stack.Screen name="Chat"     component={ChatScreen} />
            <Stack.Screen name="Recap"    component={RecapScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

When `uid == null`, only `Onboarding` is visible. After sign-in, `setUser` is called in the
store, which triggers React Navigation to swap to the authenticated stack. No explicit
`navigate('WordCard')` call is needed — the navigator re-renders automatically.

---

---

## Phase specs — implement in order 8a → 8h

---

### Phase 8a — Expo scaffolding + Firebase Auth + Onboarding

**Files to create:**
```
mobile/package.json
mobile/app.json
mobile/eas.json
mobile/tsconfig.json
mobile/babel.config.js
mobile/.env.example
mobile/src/theme/colors.ts
mobile/src/theme/typography.ts
mobile/src/i18n/it.ts
mobile/src/i18n/index.ts
mobile/src/types/domain.ts
mobile/src/types/api.ts
mobile/src/services/apiClient.ts
mobile/src/store/useUserStore.ts
mobile/src/navigation/AppNavigator.tsx
mobile/src/screens/OnboardingScreen.tsx
mobile/src/screens/WordCardScreen.tsx        — stub (loading spinner only)
mobile/src/screens/VaultScreen.tsx           — stub
mobile/src/screens/PaywallScreen.tsx         — stub
mobile/src/screens/ChatScreen.tsx            — stub
mobile/src/screens/RecapScreen.tsx           — stub
```

**`babel.config.js`:**
```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

**`tsconfig.json`:**
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": { "strict": true }
}
```

**`OnboardingScreen.tsx`** — full implementation:

```typescript
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useUserStore } from '../store/useUserStore';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { t } from '../i18n';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

export default function OnboardingScreen() {
  const setUser = useUserStore((s) => s.setUser);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      await GoogleSignin.hasPlayServices();
      const { data } = await GoogleSignin.signIn();
      const credential = auth.GoogleAuthProvider.credential(data!.idToken);
      const result = await auth().signInWithCredential(credential);
      setUser(result.user.uid, result.user.email ?? '');
    } catch (e: any) {
      setError(e.message ?? t('onboarding_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[typography.headlineLarge, { color: colors.onBackground }]}>
        {t('onboarding_title')}
      </Text>
      <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 8 }]}>
        {t('onboarding_subtitle')}
      </Text>
      <View style={{ marginTop: 48 }}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <TouchableOpacity style={styles.button} onPress={signInWithGoogle}>
            <Text style={[typography.bodyLarge, { color: '#fff', fontWeight: '600' }]}>
              {t('onboarding_cta_google')}
            </Text>
          </TouchableOpacity>
        )}
        {error && (
          <Text style={[typography.bodyMedium, { color: 'red', marginTop: 16 }]}>{error}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  button: {
    backgroundColor: colors.primary, borderRadius: 14,
    height: 56, paddingHorizontal: 32,
    alignItems: 'center', justifyContent: 'center',
  },
});
```

Add to `.env.example`:
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_web_client_id_from_firebase_console
```

Stub screens (WordCard, Vault, Paywall, Chat, Recap): each file exports a default component
that renders `<View><Text>Coming soon</Text></View>` with `backgroundColor: colors.background`.
These are replaced in phases 8b–8f.

**Phase 8a acceptance criteria:**
- [ ] `npx expo start` launches without errors
- [ ] Google Sign-In button visible on Onboarding screen
- [ ] After sign-in, `useUserStore.uid` is set and navigator swaps to `WordCard` stub
- [ ] MMKV persists `uid` across app restarts (kill and reopen app — stays on WordCard stub)

**Phase 8a tests (`mobile/__tests__/OnboardingScreen.test.tsx`):**
```
test_renders_sign_in_button — render OnboardingScreen, assert "Accedi con Google" text visible
test_shows_error_on_failed_sign_in — mock signInWithGoogle to throw, assert error text visible
```

---

### Phase 8b — WordCard screen + save + streak

**Files to create/replace:**
```
mobile/src/screens/WordCardScreen.tsx       — full implementation
mobile/src/components/WordCard.tsx
mobile/src/components/ArticleBadge.tsx
mobile/src/components/CefrBadge.tsx
mobile/src/components/StreakBadge.tsx
mobile/src/components/SaveButton.tsx
mobile/src/services/wordService.ts
mobile/src/store/useWordStore.ts
mobile/__tests__/WordCardScreen.test.tsx
```

**`WordCardScreen.tsx`** — call `fetchTodayWord()` on mount, populate `useWordStore`,
render the card. On save, call `saveWord()`, update streak in store.

Exact layout mirrors the Android TASK-004 spec — same sections, same order, same spacing
constants (convert `dp` → `StyleSheet` numbers 1:1). Constants:

```typescript
const SCREEN_PADDING    = 16;
const CARD_PADDING      = 24;
const CARD_RADIUS       = 20;
const SECTION_SPACING   = 16;
const BUTTON_HEIGHT     = 56;
const BUTTON_RADIUS     = 14;
const CULTURAL_RADIUS   = 12;
```

**`ArticleBadge.tsx`** — receives `article: string | null`. Background colour from
`colors.articleDer/Die/Das/None`. Text white. `borderRadius: 8`, `paddingHorizontal: 10`,
`paddingVertical: 4`. Render nothing if `article == null`.

**`SaveButton.tsx`** — three states (`idle`, `saving`, `saved`), same visuals as Android:
- `idle`: Primary background, white text `t('word_card_save')`
- `saving`: Primary background, `ActivityIndicator` white
- `saved`: `colors.savedButtonBg` background, check icon + `t('word_card_saved')` in Primary

After a successful save (saveState transitions to `saved`), the navigator navigates to
`Paywall`. Use `useNavigation()` from `@react-navigation/native` inside `WordCardScreen`
and watch `saveState` with a `useEffect`.

**Paywall trigger:**
```typescript
useEffect(() => {
  if (saveState === 'saved') navigation.navigate('Paywall');
}, [saveState]);
```

**Vault button**: a TextButton "Salta per oggi" navigates to `Vault`.

**"Pratica con Lena" button**: visible only when `saveState === 'saved'` AND `isPro === true`.
Navigates to `Chat`.

**Phase 8b acceptance criteria:**
- [ ] Word card fetches and renders all fields (word, IPA, meaning, example, cultural note)
- [ ] Save transitions through idle → saving → saved; streak counter updates
- [ ] Navigator goes to Paywall after save
- [ ] Article badge shows correct gender colour
- [ ] Network error shows retry button

**Phase 8b tests (`mobile/__tests__/WordCardScreen.test.tsx`):**
```
test_renders_word — mock fetchTodayWord, assert word text is visible
test_save_transitions_to_saved — mock saveWord, tap Save, assert saved state
test_empty_state — mock fetchTodayWord to throw 404, assert empty text visible
```

---

### Phase 8c — Paywall + RevenueCat

**Files to create/replace:**
```
mobile/src/screens/PaywallScreen.tsx        — full implementation
mobile/src/components/PlanCard.tsx
mobile/src/hooks/useRevenueCat.ts
mobile/__tests__/PaywallScreen.test.tsx
```

**`PaywallScreen.tsx`** — uses `useRevenueCat()` hook to load packages and trigger purchase.

Layout mirrors Android TASK-005a — same order:
1. Dismiss X button (top right) → navigate to `Vault`
2. Headline text `t('paywall_headline')`
3. Subhead `t('paywall_subhead')`
4. Feature bullet list (4 items, check icon in Primary colour)
5. Two `PlanCard` components (monthly, annual) — annual pre-selected
6. CTA button `t('paywall_cta')` — calls `purchase(selectedPackage)`
7. Dismiss TextButton `t('paywall_dismiss')` → navigate to `Vault`
8. Legal text `t('paywall_legal')`

**`PlanCard.tsx`** — receives `pkg: PurchasesPackage, selected: boolean, onSelect: () => void`.
Shows product title and price string from `pkg.product.priceString`. Border Primary (2px) if
selected, `colors.cardDivider` (1px) if not.

RevenueCat `pro` entitlement drives `isPro` in `useUserStore`. After purchase, navigate to
`Vault`.

If user is already Pro when PaywallScreen mounts, navigate immediately to `Vault`.

**Backend change — `backend/app/routers/revenuecat.py`** (new file):
```python
import hmac, hashlib
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.db import User
from app.core.config import settings
import logging

router = APIRouter(prefix="/revenuecat", tags=["revenuecat"])
logger = logging.getLogger(__name__)

@router.post("/webhook")
async def revenuecat_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    # Verify RevenueCat signature
    raw_body = await request.body()
    auth_header = request.headers.get("Authorization", "")
    expected = f"Bearer {settings.revenuecat_webhook_secret}"
    if not hmac.compare_digest(auth_header, expected):
        raise HTTPException(status_code=401, detail="Invalid signature")

    payload = await request.json()
    event_type = payload.get("event", {}).get("type", "")
    app_user_id = payload.get("event", {}).get("app_user_id", "")  # = Firebase UID

    if event_type in ("INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE"):
        result = await db.execute(select(User).where(User.id == app_user_id))
        user = result.scalar_one_or_none()
        if user:
            user.is_pro = True
            await db.commit()
            logger.info("User %s set is_pro=True via RevenueCat event %s", app_user_id, event_type)

    elif event_type in ("CANCELLATION", "EXPIRATION"):
        result = await db.execute(select(User).where(User.id == app_user_id))
        user = result.scalar_one_or_none()
        if user:
            user.is_pro = False
            await db.commit()

    return {"ok": True}
```

Add to `app/core/config.py`:
```python
revenuecat_webhook_secret: str = ""
```

Add to `.env.example`:
```
REVENUECAT_WEBHOOK_SECRET=your_revenuecat_webhook_secret
```

Register in `backend/app/main.py`:
```python
from app.routers.revenuecat import router as revenuecat_router
app.include_router(revenuecat_router, prefix="/v1")
```

**Phase 8c acceptance criteria:**
- [ ] RevenueCat packages load on PaywallScreen (annual pre-selected)
- [ ] Purchase flow launches; on success `isPro` is set in store and navigator goes to `Vault`
- [ ] Already-Pro user is auto-dismissed to `Vault`
- [ ] `POST /v1/revenuecat/webhook` with valid signature updates `users.is_pro`
- [ ] `POST /v1/revenuecat/webhook` with invalid signature returns 401

**Phase 8c tests:**
```
mobile/__tests__/PaywallScreen.test.tsx:
  test_renders_plan_cards — mock useRevenueCat, assert plan titles visible
  test_dismiss_navigates_to_vault — tap dismiss, assert navigation called with 'Vault'

backend/tests/test_revenuecat_router.py:
  test_revenuecat_webhook_sets_is_pro — send INITIAL_PURCHASE event, assert user.is_pro=True
  test_revenuecat_webhook_invalid_signature — bad auth header → 401
  test_revenuecat_webhook_cancellation — send CANCELLATION event, assert user.is_pro=False
```

---

### Phase 8d — Chat screen + SSE streaming

**Files to create/replace:**
```
mobile/src/screens/ChatScreen.tsx           — full implementation
mobile/src/components/MessageBubble.tsx
mobile/src/hooks/useSseStream.ts
mobile/src/services/sessionService.ts
mobile/src/store/useChatStore.ts
mobile/__tests__/ChatScreen.test.tsx
```

**`ChatScreen.tsx`** — on mount, call `startSession()`, store result in `useChatStore`,
then stream the first bot message immediately (empty history). Uses `useSseStream` hook.

The screen is gated: if `!isPro`, navigate to `Paywall` immediately on mount.

Layout mirrors Android TASK-005b:
1. Header bar: back arrow, title "Lena", word badge (anchor word)
2. `FlatList` of messages, grows to fill available height, auto-scrolls to bottom on new message
3. Session-ended banner (Primary background, white text, "Vedi il riepilogo" button that navigates to `Recap`)
4. Input row: `TextInput` + Send `TouchableOpacity`; both disabled while `isStreaming`

**`MessageBubble.tsx`** — user messages right-aligned Primary background white text; bot
messages left-aligned `colors.cardSectionBg` background `colors.onBackground` text.
Streaming bot message shows "..." placeholder when `content === ''`.

**Session end:** when `messageCount >= 10` (5 user + 5 bot replies counted in store's
`finaliseStream`), call `endSession(sessionId)`, set `isSessionEnded = true` in store.
The "Vedi il riepilogo" button navigates to `Recap` with `{ sessionId }`.

**`useSseStream` integration:** call `stream(sessionId, messages, { onToken, onDone, onError })`.
In `onToken`: call `useChatStore.getState().appendToken(token)`.
In `onDone`: call `useChatStore.getState().finaliseStream()`, then check if session should end.
In `onError`: call `useChatStore.getState().setError(error.message)`.

Cancel the SSE stream when the component unmounts (use `useEffect` cleanup).

**Phase 8d acceptance criteria:**
- [ ] Bot's first message appears within 3 seconds on a live connection
- [ ] SSE tokens append in real time (visible streaming effect)
- [ ] Send disabled while streaming
- [ ] Session ends at message 10; recap button appears
- [ ] Free user is redirected to Paywall on mount

**Phase 8d tests (`mobile/__tests__/ChatScreen.test.tsx`):**
```
test_renders_messages — render with mock store containing 2 messages, assert both visible
test_send_disabled_while_streaming — set isStreaming=true, assert Send not pressable
test_session_end_banner_visible — set isSessionEnded=true, assert recap button visible
```

---

### Phase 8e — Recap screen

**Files to create/replace:**
```
mobile/src/screens/RecapScreen.tsx          — full implementation
mobile/src/components/RecapStatCard.tsx
mobile/src/services/recapService.ts
mobile/__tests__/RecapScreen.test.tsx
```

**`RecapScreen.tsx`** — receives `sessionId` from route params. On mount calls
`fetchRecap(sessionId)`. Displays:

1. Title `t('recap_title')`
2. Stat row: three `RecapStatCard` components — Fluidità (fluencyScore as %), XP
   (newWordsCount × 10 — simple formula, no server-side XP), Parole nuove (newWordsCount)
3. Section "Punti di forza" — bulleted list; if no errors, show one item "Buona fluidità"
4. Section "Da migliorare" — bulleted list of distinct `ruleLabel` values from errors
5. Section "Errori grammaticali" — each error as a card:
   `userText → correctForm` + `ruleLabel` + green "✓ Corretto" badge if `wasCorrected`
6. Button `t('recap_done')` → navigate back to `WordCard`

**`RecapStatCard.tsx`** — `value: string, label: string`. White card, centered, small shadow.

**XP formula:** `newWordsCount * 10`. This is client-side only for v1.0.

**Phase 8e acceptance criteria:**
- [ ] Recap screen loads and displays fluency score, XP, errors after a real session
- [ ] Error cards show user text, correct form, and rule label
- [ ] "Done" navigates to WordCard

**Phase 8e tests (`mobile/__tests__/RecapScreen.test.tsx`):**
```
test_renders_stats — mock fetchRecap, assert fluency % and XP visible
test_renders_errors — mock fetchRecap with one error, assert error card visible
test_done_navigates — tap done button, assert navigation to WordCard
```

---

### Phase 8f — Vault screen + offline cache

**Files to create/replace:**
```
mobile/src/screens/VaultScreen.tsx          — full implementation
mobile/src/services/vaultService.ts
mobile/src/store/useVaultStore.ts
mobile/__tests__/VaultScreen.test.tsx
```

**`VaultScreen.tsx`** — paginated list of saved vocabulary items. Load page 1 on mount;
load next page when user scrolls to bottom of list (use `FlatList.onEndReached`).

Each row: word (bold) + article, translation_it, retention badge (0–100% progress bar in
Primary colour), next review date ("Oggi" if `nextReviewAt <= now`, else "N giorni").

Header: title `t('vault_title')`, back arrow.

Empty state: `t('vault_empty')`.

**Offline cache:** on successful fetch, serialise `items` to MMKV under key `vault_cache`.
On mount, read from cache first (show immediately), then fetch fresh data and update.
Use key `vault_cache` in MMKV storage ID `vault-store`.

**Phase 8f acceptance criteria:**
- [ ] Vault loads and displays saved words with retention scores
- [ ] Pagination: new items load when scrolling to bottom
- [ ] Cached items display instantly on second open before network fetch completes
- [ ] Empty state shown when vault is empty

**Phase 8f tests (`mobile/__tests__/VaultScreen.test.tsx`):**
```
test_renders_items — mock fetchVault, assert first item word visible
test_empty_state — mock fetchVault returning empty, assert empty text visible
test_loads_next_page — simulate onEndReached, assert fetchVault called with page=2
```

---

### Phase 8g — iOS build via EAS + Apple Sign-In

**Files to modify:**
```
mobile/src/screens/OnboardingScreen.tsx     — add Apple Sign-In button (iOS only)
mobile/app.json                             — add expo-apple-authentication plugin
mobile/package.json                         — add expo-apple-authentication
```

Apple Sign-In is iOS-only. Render the button conditionally:
```typescript
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

// Inside OnboardingScreen, below the Google button:
{Platform.OS === 'ios' && (
  <AppleAuthentication.AppleAuthenticationButton
    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
    cornerRadius={14}
    style={{ width: 280, height: 56, marginTop: 12 }}
    onPress={signInWithApple}
  />
)}
```

`signInWithApple` implementation:
```typescript
const signInWithApple = async () => {
  setLoading(true);
  setError(null);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      ],
    });
    const { identityToken } = credential;
    const provider = new auth.OAuthProvider('apple.com');
    const oauthCredential = provider.credential({ idToken: identityToken! });
    const result = await auth().signInWithCredential(oauthCredential);
    setUser(result.user.uid, result.user.email ?? '');
  } catch (e: any) {
    if (e.code !== 'ERR_REQUEST_CANCELED') setError(e.message ?? t('onboarding_error'));
  } finally {
    setLoading(false);
  }
};
```

Add to `app.json` plugins: `"expo-apple-authentication"`.

**EAS iOS build:** run `eas build --platform ios --profile preview`. This requires:
- Apple Developer account enrolled
- Bundle ID `com.germanbuddy` registered in App Store Connect
- Provisioning profile managed by EAS (set `"credentialsSource": "remote"` in `eas.json`)

**Phase 8g acceptance criteria:**
- [ ] Apple Sign-In button visible only on iOS
- [ ] Apple Sign-In completes and sets `uid` in store
- [ ] `eas build --platform ios --profile preview` completes without errors
- [ ] `eas build --platform android --profile preview` produces installable APK

**Phase 8g tests:**
```
test_apple_button_ios_only — render OnboardingScreen on iOS mock, assert Apple button visible;
                              render on Android mock, assert Apple button absent
```

---

### Phase 8h — Cleanup + archive

**Actions (in order):**

1. Rename `android/` → `android_legacy/` at repo root:
   ```bash
   git mv android android_legacy
   ```

2. Update `CLAUDE.md` — Section §3 tech stack: replace Android Kotlin/Compose rows with:

   | Component | Choice | Reason |
   |-----------|--------|--------|
   | Language | TypeScript | Cross-platform, strict typing |
   | Framework | React Native + Expo SDK 51 | Android + iOS from one codebase |
   | Navigation | React Navigation 6 | Industry standard, native-stack |
   | State | Zustand | Lightweight, no boilerplate |
   | HTTP | Axios | Interceptor support for auth |
   | SSE | react-native-sse | Native SSE without polyfill hacks |
   | Local storage | MMKV | Faster than AsyncStorage, atomic writes |
   | Auth | @react-native-firebase/auth | Firebase JWT, Google + Apple Sign-In |
   | Billing | RevenueCat | Cross-platform, handles Play + StoreKit |
   | Push | Expo Notifications + FCM | Unified push API |
   | i18n | i18n-js | Lightweight, Italian default |
   | Builds | EAS Build | Cloud builds, OTA updates |

3. Update `CLAUDE.md` — Section §9: replace Android MVVM architecture with:
   ```
   Screen components (React Native + Expo)
       ↓ reads from / dispatches to
   Zustand stores (one per domain)
       ↓ calls
   Service layer (Axios API calls, SSE hook)
       ↓ hits
   Backend REST/SSE API (unchanged)
   ```

4. Update `CLAUDE.md` — Section §10 monetization: replace Play Billing paragraph with:
   > **RevenueCat** manages subscriptions on both platforms. Product IDs remain `pro_monthly`
   > and `pro_annual`. Server-to-server webhook: `POST /v1/revenuecat/webhook`. RevenueCat
   > user ID is mapped to Firebase UID via `Purchases.logIn(uid)`.

5. Add to CLAUDE.md Known Issues:
   > `android_legacy/` — kept for reference; delete after iOS launch is confirmed stable.

6. Commit with message: `chore(TASK-008h): archive android_legacy, update CLAUDE.md for RN stack`

**Phase 8h acceptance criteria:**
- [ ] `android/` directory no longer exists at repo root
- [ ] `android_legacy/` exists with all original files intact
- [ ] CLAUDE.md tech stack section reflects React Native / Expo
- [ ] CLAUDE.md monetization section reflects RevenueCat

---

## API Contract — new endpoint only

```
POST /v1/revenuecat/webhook
Authorization: Bearer <revenuecat_webhook_secret>
Content-Type: application/json

Body (RevenueCat server-to-server format, subset):
{
  "event": {
    "type": "INITIAL_PURCHASE" | "RENEWAL" | "CANCELLATION" | "EXPIRATION" | "PRODUCT_CHANGE",
    "app_user_id": "<firebase_uid>"
  }
}

Response 200:
{ "ok": true }

Response 401:
{ "detail": "Invalid signature" }
```

All other backend routes (8 existing) are unchanged.

---

## Backend Changes Summary

Only two backend files change:

| File | Change |
|------|--------|
| `backend/app/routers/revenuecat.py` | New file — RevenueCat webhook |
| `backend/app/core/config.py` | Add `revenuecat_webhook_secret: str = ""` |
| `backend/app/main.py` | Include `revenuecat_router` |
| `backend/.env.example` | Add `REVENUECAT_WEBHOOK_SECRET=` |

`backend/app/routers/billing.py` remains in place — do not delete it. The old
`POST /billing/webhook` continues to exist for any legacy Android client still in the field.

---

## Tests

### Backend
- `test_revenuecat_webhook_sets_is_pro` — INITIAL_PURCHASE event + valid auth → `user.is_pro = True`
- `test_revenuecat_webhook_cancellation_clears_is_pro` — CANCELLATION event → `user.is_pro = False`
- `test_revenuecat_webhook_invalid_signature` — wrong bearer → 401

### Mobile (Jest + React Native Testing Library)
Each phase lists its own tests above. Summary:

| Phase | Test file | Tests |
|-------|-----------|-------|
| 8a | `__tests__/OnboardingScreen.test.tsx` | 2 |
| 8b | `__tests__/WordCardScreen.test.tsx` | 3 |
| 8c | `__tests__/PaywallScreen.test.tsx` | 2 |
| 8d | `__tests__/ChatScreen.test.tsx` | 3 |
| 8e | `__tests__/RecapScreen.test.tsx` | 3 |
| 8f | `__tests__/VaultScreen.test.tsx` | 3 |
| 8g | `__tests__/OnboardingScreen.test.tsx` | +1 (Apple button) |

All tests use `@testing-library/react-native`. Mock Firebase auth, Zustand stores, and
service functions with `jest.mock()`. Do not make real network calls in tests.

---

## Definition of Done

- [ ] All acceptance criteria for phases 8a–8h checked
- [ ] All 19 mobile tests pass (`cd mobile && npm test`)
- [ ] All 3 backend tests pass (`cd backend && pytest tests/test_revenuecat_router.py -v`)
- [ ] `npx expo start` runs clean with no TypeScript errors
- [ ] `eas build --platform android --profile preview` produces installable APK
- [ ] Zero hardcoded Italian strings in component files — all go through `t()`
- [ ] Zero API keys or secrets committed to git
- [ ] `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
      `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, `EXPO_PUBLIC_REVENUECAT_IOS_KEY`,
      `REVENUECAT_WEBHOOK_SECRET` documented in `.env.example` only
- [ ] `android_legacy/` preserved intact; `android/` removed
- [ ] CLAUDE.md updated to reflect RN/Expo stack
- [ ] Conventional commits per phase:
      `feat(TASK-008a): expo scaffolding + firebase auth + onboarding`
      `feat(TASK-008b): word card screen + save + streak`
      `feat(TASK-008c): paywall + revenuecat + webhook`
      `feat(TASK-008d): chat screen + sse streaming`
      `feat(TASK-008e): recap screen`
      `feat(TASK-008f): vault screen + offline cache`
      `feat(TASK-008g): ios build + apple sign-in`
      `chore(TASK-008h): archive android_legacy + update claude.md`
- [ ] TASK status updated to `done`
