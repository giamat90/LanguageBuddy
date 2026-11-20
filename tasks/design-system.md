# TASK-DS — Design System: Warm & Editorial UI Redesign

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Depends on:** `onboarding-flow.md` (CEFR quiz + topics screens must exist before redesign)

---

## Context

All mobile screens were built with a minimal utility theme (flat greens, system fonts,
no editorial hierarchy). The product direction requires a warm & editorial visual language:
Playfair Display for German words and titles, Inter for all UI chrome, a paper-toned palette
with ink/forest/gold accents. This task replaces `theme/colors.ts` and `theme/typography.ts`
entirely, adds a `components/ui/` folder with 10 purpose-built components, and applies
the system to every screen. Developer makes zero design decisions — every value is specified
below.

---

## Scope

### In scope
- `package.json` — add two font packages
- `app/_layout.tsx` — add font loading (splash screen held until fonts ready)
- `theme/colors.ts` — full replacement with named semantic tokens
- `theme/typography.ts` — full replacement with named styles using custom fonts
- `components/ui/` — 10 new components (see list below)
- Delete superseded files from `components/` (see list below)
- Update `MessageBubble.tsx`, `PlanCard.tsx`, `RecapStatCard.tsx` — swap old token names for new ones
- Full visual redesign of: `WordCardScreen`, `SignInScreen`, `QuizScreen`, `TopicsScreen`,
  `ChatScreen`, `RecapScreen`, `VaultScreen`, `PaywallScreen`
- `i18n/it.ts` — add missing strings for new design elements
- Snapshot tests for all 10 UI components
- Color-correctness tests for `ArticleBadge` (der / die / das)
- Dot-count test for `StreakRow`

### Out of scope
- Backend changes of any kind
- Navigation logic changes
- Zustand store changes
- Any screen not listed above
- Animations or transitions
- Dark mode

---

## Acceptance Criteria

- [ ] AC1: `npx expo start` runs; both custom fonts render on device/simulator (no fallback)
- [ ] AC2: `npm test -- --runInBand` from `mobile/` passes — all snapshot + logic tests green
- [ ] AC3: `npx tsc --noEmit` from `mobile/` exits clean — zero type errors
- [ ] AC4: No hex literals, no `fontFamily` string literals, no hardcoded Italian strings
  in any screen file or `components/ui/` file — all values from `colors.ts`, `typography.ts`,
  or `i18n/it.ts`
- [ ] AC5: Every screen has `flex: 1, backgroundColor: colors.paper` as its root view style
- [ ] AC6: Every interactive element has a minimum height/width of 44 on the touch target
- [ ] AC7: `ArticleBadge` renders `derBlueBg` background + `derBlue` text for `der`,
  `diePinkBg` + `diePink` for `die`, `dasGrayBg` + `dasGray` for `das`
- [ ] AC8: `StreakRow` with `count=3` renders exactly 3 filled (gold) dots and 4 empty dots

---

## Technical Spec

---

### 1 — Package installation

Add to `mobile/package.json` `dependencies`:

```json
"@expo-google-fonts/playfair-display": "^0.3.0",
"@expo-google-fonts/inter": "^0.3.0"
```

Run `npm install` after editing `package.json`.

No other dependency changes.

---

### 2 — Font loading in `mobile/app/_layout.tsx`

Add font loading at the top of the root layout. The splash screen must stay visible until
fonts are loaded; if a font error occurs, continue anyway (fonts unavailable beats
indefinitely stuck splash).

Add these imports at the top of the existing `_layout.tsx`:

```typescript
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
} from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
```

Call `SplashScreen.preventAutoHideAsync()` once at module level (outside the component,
after the imports):

```typescript
SplashScreen.preventAutoHideAsync();
```

Inside the root layout component, add before any return:

```typescript
const [fontsLoaded, fontError] = useFonts({
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  Inter_400Regular,
  Inter_500Medium,
});

useEffect(() => {
  if (fontsLoaded || fontError) {
    SplashScreen.hideAsync();
  }
}, [fontsLoaded, fontError]);

if (!fontsLoaded && !fontError) {
  return null;
}
```

All existing logic in `_layout.tsx` (auth listener, profile check, store calls) remains
unchanged — the font block is prepended before those effects.

---

### 3 — `mobile/src/theme/colors.ts` (full replacement)

Replace the entire file with exactly this:

```typescript
export const colors = {
  // Backgrounds
  paper:        '#F5F2EB',
  mist:         '#E8E5DC',
  cream:        '#EDE9DF',

  // Text
  ink:          '#1A1A18',
  muted:        '#6B6B5F',

  // Primary action
  forest:       '#1D9E75',
  forestLight:  '#E1F5EE',

  // Accent
  gold:         '#C9A84C',
  goldLight:    '#FAEEDA',

  // Borders
  border:       'rgba(26,26,24,0.12)',

  // Article gender — text (dark)
  derBlue:      '#0C447C',
  diePink:      '#72243E',
  dasGray:      '#444441',

  // Article gender — backgrounds (light tint)
  derBlueBg:    '#E6F1FB',
  diePinkBg:    '#FBEAF0',
  dasGrayBg:    '#EDE9DF',
} as const;

export type ColorKey = keyof typeof colors;
```

Delete all previous token names (`primary`, `background`, `surface`, `onBackground`,
`textSecondary`, `textTertiary`, `cardDivider`, `cardSectionBg`, `savedButtonBg`,
`articleDer`, `articleDie`, `articleDas`, `articleNone`). They no longer exist.

---

### 4 — `mobile/src/theme/typography.ts` (full replacement)

Replace the entire file with exactly this:

```typescript
import { TextStyle } from 'react-native';

const PLAYFAIR = 'PlayfairDisplay_400Regular';
const PLAYFAIR_ITALIC = 'PlayfairDisplay_400Regular_Italic';
const INTER = 'Inter_400Regular';
const INTER_MEDIUM = 'Inter_500Medium';

export const typography: Record<string, TextStyle> = {
  // German words and screen titles — Playfair Display
  wordHero: {
    fontFamily: PLAYFAIR,
    fontSize: 36,
    lineHeight: 44,
  },
  wordHeroItalic: {
    fontFamily: PLAYFAIR_ITALIC,
    fontSize: 36,
    lineHeight: 44,
  },

  // Example sentences in German — Playfair Display italic
  exampleDe: {
    fontFamily: PLAYFAIR_ITALIC,
    fontSize: 15,
    lineHeight: 22,
  },

  // Section headers — Inter uppercase tracked
  sectionLabel: {
    fontFamily: INTER_MEDIUM,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  // Body text — Inter regular
  body: {
    fontFamily: INTER,
    fontSize: 14,
    lineHeight: 20,
  },

  // Article, IPA, metadata — Inter small
  articleMeta: {
    fontFamily: INTER,
    fontSize: 12,
    lineHeight: 16,
  },

  // Buttons, badges, small UI labels — Inter small
  uiSmall: {
    fontFamily: INTER,
    fontSize: 12,
    lineHeight: 16,
  },

  // Button labels — Inter medium
  uiButton: {
    fontFamily: INTER_MEDIUM,
    fontSize: 13,
    lineHeight: 18,
  },
} as const;
```

Delete all previous style names (`wordHeading`, `ipa`, `meaning`, `exampleIt`,
`culturalNote`, `badge`, `streak`, `bodyLarge`, `bodyMedium`, `headlineLarge`). They no
longer exist.

---

### 5 — UI components — `mobile/src/components/ui/`

Create this directory. Create each file below exactly as specified. No file in `components/ui/`
may contain any hex literal, any raw font family string, or any hardcoded Italian string.

---

#### 5a — `ArticleBadge.tsx`

```typescript
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface Props {
  article: 'der' | 'die' | 'das' | string | null | undefined;
  word?: string;   // used for accessibilityLabel only
  style?: ViewStyle;
}

const GENDER_STYLE: Record<string, { bg: string; text: string }> = {
  der: { bg: colors.derBlueBg,  text: colors.derBlue  },
  die: { bg: colors.diePinkBg,  text: colors.diePink  },
  das: { bg: colors.dasGrayBg,  text: colors.dasGray  },
};

export default function ArticleBadge({ article, word, style }: Props) {
  if (!article) return null;
  const genderStyle = GENDER_STYLE[article] ?? { bg: colors.mist, text: colors.muted };
  return (
    <View
      style={[styles.pill, { backgroundColor: genderStyle.bg }, style]}
      accessibilityLabel={word ? `${article} ${word}` : article}
    >
      <Text style={[typography.uiSmall, { color: genderStyle.text }]}>{article}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
});
```

---

#### 5b — `CefrBadge.tsx`

```typescript
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface Props {
  level: string;
  style?: ViewStyle;
}

export default function CefrBadge({ level, style }: Props) {
  return (
    <View style={[styles.pill, style]}>
      <Text style={[typography.uiSmall, { color: colors.cream }]}>{level}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.forest,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
});
```

---

#### 5c — `StreakRow.tsx`

Shows 7 dots (gold if within current streak, else `mist`) and an Italian count label.
Filled dot count = `Math.min(count, 7)`. If `count === 0`, all dots are `mist`.

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { t } from '../../i18n';

interface Props {
  count: number;
}

export default function StreakRow({ count }: Props) {
  const filled = Math.min(count, 7);
  return (
    <View style={styles.row} accessibilityLabel={t('streak_label', { count })}>
      <View style={styles.dots}>
        {Array.from({ length: 7 }, (_, i) => (
          <View
            key={i}
            style={[styles.dot, { backgroundColor: i < filled ? colors.gold : colors.mist }]}
          />
        ))}
      </View>
      <Text style={[typography.uiSmall, styles.label]}>{t('streak_label', { count })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    color: colors.muted,
  },
});
```

---

#### 5d — `CulturalNote.tsx`

```typescript
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface Props {
  text: string;
  style?: ViewStyle;
}

export default function CulturalNote({ text, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <Text style={[typography.exampleDe, { color: colors.ink }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.goldLight,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
});
```

---

#### 5e — `WordHero.tsx`

Layout (top to bottom):
1. `ArticleBadge` (only rendered when article is non-null)
2. Word text in `wordHero` Playfair style, `ink` color, `marginTop: 6`
3. IPA text in `articleMeta` Inter style, `muted` color, `marginTop: 4`

```typescript
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ArticleBadge from './ArticleBadge';

interface Props {
  word: string;
  article: string | null | undefined;
  ipa: string | null | undefined;
  style?: ViewStyle;
}

export default function WordHero({ word, article, ipa, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      {article ? (
        <ArticleBadge article={article} word={word} style={styles.badge} />
      ) : null}
      <Text style={[typography.wordHero, styles.word]}>{word}</Text>
      {ipa ? (
        <Text style={[typography.articleMeta, styles.ipa]}>{`/${ipa}/`}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  badge: {
    marginBottom: 6,
  },
  word: {
    color: colors.ink,
  },
  ipa: {
    color: colors.muted,
    marginTop: 4,
  },
});
```

---

#### 5f — `PrimaryButton.tsx`

```typescript
import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export default function PrimaryButton({ label, onPress, disabled, loading, style }: Props) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      style={[styles.button, isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator color={colors.cream} />
      ) : (
        <Text style={[typography.uiButton, { color: colors.cream }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.forest,
    borderRadius: 14,
    height: 56,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    backgroundColor: colors.muted,
  },
});
```

---

#### 5g — `SecondaryButton.tsx`

```typescript
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export default function SecondaryButton({ label, onPress, disabled, style }: Props) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      activeOpacity={0.75}
    >
      <Text
        style={[typography.uiButton, { color: disabled ? colors.muted : colors.forest }]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: colors.forest,
    borderRadius: 14,
    height: 48,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  disabled: {
    borderColor: colors.muted,
  },
});
```

---

#### 5h — `SectionLabel.tsx`

```typescript
import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface Props {
  label: string;
  style?: TextStyle;
}

export default function SectionLabel({ label, style }: Props) {
  return (
    <Text style={[typography.sectionLabel, styles.text, style]}>{label}</Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: colors.muted,
  },
});
```

---

#### 5i — `Divider.tsx`

```typescript
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  style?: ViewStyle;
}

export default function Divider({ style }: Props) {
  return <View style={[styles.line, style]} />;
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
```

---

#### 5j — `WordCard.tsx`

Full card component. Used by `WordCardScreen` and snapshot tests. Receives the `DailyWord`
domain object plus action callbacks. Handles all internal layout — the screen only provides
the data and handlers.

```typescript
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { DailyWord } from '../../types/domain';
import { SaveState } from '../../store/useWordStore';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { t } from '../../i18n';
import WordHero from './WordHero';
import ArticleBadge from './ArticleBadge';
import CefrBadge from './CefrBadge';
import StreakRow from './StreakRow';
import CulturalNote from './CulturalNote';
import SectionLabel from './SectionLabel';
import Divider from './Divider';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

interface Props {
  word: DailyWord;
  saveState: SaveState;
  streakDays: number;
  onSave: () => void;
  onSkip: () => void;
}

export default function WordCard({ word, saveState, streakDays, onSave, onSkip }: Props) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Word hero */}
      <WordHero word={word.word} article={word.article} ipa={word.ipa} />

      <Divider style={styles.divider} />

      {/* Meaning */}
      <SectionLabel label={t('word_section_meaning')} />
      {word.meaningIt ? (
        <Text style={[typography.body, styles.bodyText]}>{word.meaningIt}</Text>
      ) : null}

      <Divider style={styles.divider} />

      {/* Example */}
      <SectionLabel label={t('word_section_example')} />
      {word.exampleDe ? (
        <Text style={[typography.exampleDe, styles.exampleDe]}>{word.exampleDe}</Text>
      ) : null}
      {word.exampleIt ? (
        <Text style={[typography.uiSmall, styles.exampleIt]}>{word.exampleIt}</Text>
      ) : null}

      {/* Cultural note */}
      {word.culturalNote ? (
        <CulturalNote text={word.culturalNote} style={styles.cultural} />
      ) : null}

      {/* Badges row */}
      <View style={styles.badgesRow}>
        {word.cefrBand ? <CefrBadge level={word.cefrBand} /> : null}
      </View>

      {/* Streak */}
      <StreakRow count={streakDays} style={styles.streak} />

      {/* Actions */}
      <PrimaryButton
        label={saveState === 'saved' ? t('word_card_saved') : t('word_card_save')}
        onPress={onSave}
        loading={saveState === 'saving'}
        disabled={saveState === 'saved'}
        style={styles.primaryButton}
      />
      <SecondaryButton
        label={t('word_card_skip')}
        onPress={onSkip}
        style={styles.secondaryButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
  },
  divider: {
    marginVertical: 20,
  },
  bodyText: {
    color: colors.ink,
    marginTop: 8,
  },
  exampleDe: {
    color: colors.ink,
    marginTop: 8,
  },
  exampleIt: {
    color: colors.muted,
    marginTop: 4,
  },
  cultural: {
    marginTop: 20,
  },
  badgesRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 8,
  },
  streak: {
    marginTop: 24,
  },
  primaryButton: {
    marginTop: 32,
  },
  secondaryButton: {
    marginTop: 12,
  },
});
```

---

### 6 — Delete superseded files from `mobile/src/components/`

Remove these files (they are replaced by `components/ui/` equivalents):

```
mobile/src/components/ArticleBadge.tsx   — replaced by components/ui/ArticleBadge.tsx
mobile/src/components/CefrBadge.tsx      — replaced by components/ui/CefrBadge.tsx
mobile/src/components/StreakBadge.tsx    — replaced by components/ui/StreakRow.tsx
mobile/src/components/SaveButton.tsx     — replaced by components/ui/PrimaryButton.tsx + SecondaryButton.tsx
mobile/src/components/WordCard.tsx       — replaced by components/ui/WordCard.tsx
```

Keep in `mobile/src/components/` (update theme token names only, see §7):

```
mobile/src/components/MessageBubble.tsx
mobile/src/components/PlanCard.tsx
mobile/src/components/RecapStatCard.tsx
```

---

### 7 — Update kept components to new token names

Old token → new token mapping for `MessageBubble.tsx`, `PlanCard.tsx`, `RecapStatCard.tsx`:

| Old token | New token |
|-----------|-----------|
| `colors.primary` | `colors.forest` |
| `colors.background` | `colors.paper` |
| `colors.surface` | `colors.cream` |
| `colors.onBackground` | `colors.ink` |
| `colors.textSecondary` | `colors.muted` |
| `colors.textTertiary` | `colors.muted` |
| `colors.cardDivider` | `colors.border` |
| `colors.cardSectionBg` | `colors.cream` |
| `colors.savedButtonBg` | `colors.forestLight` |
| `colors.articleDer` | `colors.derBlue` |
| `colors.articleDie` | `colors.diePink` |
| `colors.articleDas` | `colors.dasGray` |
| `colors.articleNone` | `colors.muted` |

Also update typography token names in these files:

| Old token | New token |
|-----------|-----------|
| `typography.bodyMedium` | `typography.body` |
| `typography.bodyLarge` | `typography.body` |
| `typography.headlineLarge` | `typography.wordHero` |
| `typography.badge` | `typography.uiSmall` |
| `typography.sectionLabel` | `typography.sectionLabel` |

**`MessageBubble.tsx` additional changes (design spec):**
- User bubble: `backgroundColor: colors.forest`, text `color: colors.cream`
- Lena (assistant) bubble: `backgroundColor: colors.cream`, text `color: colors.ink`
- Lena bubble text uses `typography.exampleDe` (Playfair italic) — apply to the `Text`
  element that renders the message content for `role === 'assistant'` messages
- User bubble text uses `typography.body` (Inter)

**`RecapStatCard.tsx` additional changes:**
- Card background: `colors.mist`
- Value text: `typography.wordHero` (Playfair, large number)
- Label text: `typography.uiSmall`, `color: colors.muted`

---

### 8 — i18n additions to `mobile/src/i18n/it.ts`

Add these keys (merge into the existing object — do not remove existing keys):

```typescript
// Section labels (SectionLabel component applies textTransform uppercase via typography)
word_section_meaning:  'Significato',
word_section_example:  'Esempio',
word_section_cultural: 'Curiosità culturale',

// Streak
streak_label: '%{count} giorni di fila',

// Quiz redesign labels
quiz_progress: 'Domanda %{current} di %{total}',

// Vault items
vault_review_chip_today: 'Oggi',
vault_review_chip_days:  '%{count} gg',

// Paywall — plan selection
paywall_popular_badge: 'PIÙ POPOLARE',

// Chat — Lena label
chat_lena_label: 'Lena',

// Recap — section headers
recap_section_strengths: 'Punti di forza',
recap_section_focus:     'Da migliorare',
recap_section_errors:    'Errori grammaticali',
```

---

### 9 — Screen redesigns

Every screen must begin with:

```typescript
<SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
```

or, if using a plain `View` root:

```typescript
<View style={{ flex: 1, backgroundColor: colors.paper }}>
```

`SafeAreaView` is preferred for all top-level screens.

---

#### 9a — `WordCardScreen.tsx`

**Remove** the existing inline layout. Replace with:

```typescript
export default function WordCardScreen() {
  // existing fetch + store logic unchanged

  // Replace the return block:
  if (isLoading) return <LoadingView />;
  if (error || !word)  return <ErrorView onRetry={...} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <WordCard
        word={word}
        saveState={saveState}
        streakDays={streakDays}
        onSave={handleSave}
        onSkip={() => navigation.navigate('Vault')}
      />
    </SafeAreaView>
  );
}
```

Import `WordCard` from `../components/ui/WordCard`.
Import `SafeAreaView` from `react-native-safe-area-context`.
All existing save / navigation logic remains intact — only the render block changes.

**`LoadingView`** (inline in the file, not exported):
```typescript
function LoadingView() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.forest} size="large" />
    </View>
  );
}
```

**`ErrorView`** (inline, not exported):
```typescript
function ErrorView({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={[typography.body, { color: colors.muted, textAlign: 'center', marginBottom: 24 }]}>
        {t('word_card_error')}
      </Text>
      <PrimaryButton label={t('word_card_retry')} onPress={onRetry} style={{ width: '100%' }} />
    </View>
  );
}
```

---

#### 9b — `SignInScreen.tsx`

Replace the return block. All sign-in logic (Google, Apple) remains unchanged.

Layout — centred flex column, `padding: 40`:
1. `Text` — `typography.wordHero`, `color: colors.ink`, value: `t('onboarding_title')` ("GermanBuddy")
2. `Text` — `typography.body`, `color: colors.muted`, `marginTop: 8`, value: `t('onboarding_subtitle')`
3. `View` spacer — `marginTop: 56`
4. Google sign-in button:
   ```
   <TouchableOpacity style={styles.googleButton} onPress={signInWithGoogle} disabled={loading}>
     <Text style={[typography.uiButton, { color: colors.ink }]}>
       {t('onboarding_cta_google')}
     </Text>
   </TouchableOpacity>
   ```
   Style `googleButton`:
   ```typescript
   googleButton: {
     borderWidth: 1,
     borderColor: colors.border,
     borderRadius: 14,
     height: 56,
     width: '100%',
     alignItems: 'center',
     justifyContent: 'center',
     backgroundColor: colors.cream,
   }
   ```
5. Apple Sign-In button (iOS only, existing code) — `marginTop: 12`
6. `ActivityIndicator` (while loading) — `color: colors.forest`, centered
7. Error text — `typography.body`, `color: colors.diePink`, `marginTop: 16`

---

#### 9c — `QuizScreen.tsx`

Replace the return block. All quiz logic (`handleAnswer`, `inferCefrLevel`) remains unchanged.

Layout — `SafeAreaView` → `View` with `padding: 24`:

1. **Progress row** (top, `marginBottom: 32`):
   A row of 5 dots:
   ```typescript
   {Array.from({ length: 5 }, (_, i) => (
     <View
       key={i}
       style={{
         width: 8, height: 8, borderRadius: 4,
         backgroundColor: i <= step ? colors.forest : colors.mist,
         marginHorizontal: 4,
       }}
     />
   ))}
   ```
   Below the dots: `SectionLabel` with `t('quiz_progress', { current: step + 1, total: 5 })`

2. **Question text** (`marginTop: 32`):
   `Text` — `typography.wordHero`, `color: colors.ink`, value: `t(QUESTIONS[step].questionKey)`

3. **Option cards** (`marginTop: 40`, `gap: 12`):
   Each option is a `TouchableOpacity` with:
   ```typescript
   {
     borderWidth: 1.5,
     borderColor: selectedIndex === optionIdx ? colors.forest : colors.border,
     backgroundColor: selectedIndex === optionIdx ? colors.forestLight : colors.cream,
     borderRadius: 14,
     padding: 18,
     minHeight: 60,
     justifyContent: 'center',
   }
   ```
   Text inside: `typography.body`, `color: colors.ink`.

   There is no persistent `selectedIndex` state — on tap, `handleAnswer(i)` is called
   immediately (no confirm step). Do not add a selected visual state beyond a brief
   `activeOpacity={0.75}` flash.

---

#### 9d — `TopicsScreen.tsx`

Replace the return block. All topic logic (`toggle`, `handleSubmit`, `buildTopicPreferences`)
remains unchanged.

Layout — `SafeAreaView` → `View` with `padding: 24`:

1. `Text` — `typography.wordHero`, `color: colors.ink`, value: `t('topics_title')`
2. `Text` — `typography.body`, `color: colors.muted`, `marginTop: 8`,
   value: `t('topics_subtitle')`
3. **Topic grid** (`marginTop: 28`):
   `FlatList` with `numColumns={2}`, `columnWrapperStyle={{ gap: 12 }}`,
   `ItemSeparatorComponent` returns `<View style={{ height: 12 }} />`.

   Each topic card (`TouchableOpacity`):
   ```typescript
   {
     flex: 1,
     borderWidth: 1.5,
     borderColor: selected.includes(item.key) ? colors.forest : colors.border,
     backgroundColor: selected.includes(item.key) ? colors.forestLight : colors.cream,
     borderRadius: 16,
     paddingVertical: 20,
     alignItems: 'center',
     justifyContent: 'center',
     minHeight: 88,
   }
   ```
   Content inside each card (top to bottom, centred):
   - Emoji `Text` — `fontSize: 28`
   - Label `Text` — `typography.uiSmall`, `color: colors.ink`, `marginTop: 6`

4. `PrimaryButton` (below grid, `marginTop: 28`):
   - `label: t('topics_cta')`
   - `disabled: selected.length < 2 || loading`
   - `loading: loading`
   - `onPress: handleSubmit`

5. Error text (if `error`): `typography.body`, `color: colors.diePink`, `marginTop: 12`,
   `textAlign: 'center'`

---

#### 9e — `ChatScreen.tsx`

Replace the return block. All SSE / session / store logic remains unchanged.

Layout — `SafeAreaView`, flex column:

1. **Header** (`height: 56`, `backgroundColor: colors.cream`, `borderBottomWidth: StyleSheet.hairlineWidth`, `borderBottomColor: colors.border`):
   Row: Back `TouchableOpacity` (left, min 44×44), centred title column, empty right spacer (44px).
   - Back: `←` icon or `Text` arrow, `color: colors.forest`
   - Title: `Text` `typography.body` `color: colors.ink` value: `t('chat_lena_label')`; `Text` `typography.uiSmall` `color: colors.muted` value: anchor word from `useChatStore` (`word`)

2. **Message list** (`flex: 1`):
   `FlatList` of `MessageBubble` components (already updated in §7). `contentContainerStyle={{ padding: 16, gap: 10 }}`. Auto-scroll to bottom on new message via `FlatList.scrollToEnd()` in `useEffect` watching `messages.length`.

3. **Session-ended banner** (visible only when `isSessionEnded`):
   `View` `backgroundColor: colors.forestLight`, `padding: 16`, `alignItems: 'center'`:
   - `Text` `typography.body` `color: colors.forest` value: `t('chat_session_ended')`
   - `PrimaryButton` `label: t('chat_view_recap')` `onPress: () => navigation.navigate('Recap', { sessionId })` `style: { marginTop: 12, width: '100%' }`

4. **Input row** (`backgroundColor: colors.cream`, `borderTopWidth: StyleSheet.hairlineWidth`, `borderTopColor: colors.border`, `paddingHorizontal: 16`, `paddingVertical: 10`):
   Row: `TextInput` (flex 1, `typography.body`, `color: colors.ink`, `backgroundColor: colors.mist`, `borderRadius: 12`, `padding: 12`, `minHeight: 44`) + Send button (`TouchableOpacity`, min 44×44, `disabled: isStreaming`, `backgroundColor: colors.forest`, `borderRadius: 22`, centered icon or `Text` "→" `color: colors.cream`).

---

#### 9f — `RecapScreen.tsx`

Replace the return block. All data-fetching and `fetchRecap` logic remains unchanged.

Layout — `SafeAreaView` → `ScrollView` `paddingHorizontal: 20` `paddingBottom: 40`:

1. **Title** (`marginTop: 24`): `Text` `typography.wordHero` `color: colors.ink`
   value: `t('recap_title')`

2. **Stat row** (`marginTop: 24`, `flexDirection: 'row'`, `gap: 12`):
   Three `RecapStatCard` (already updated in §7) side by side:
   - Fluidità: `value: recap.fluencyScore != null ? Math.round(recap.fluencyScore * 100) + '%' : '–'`, `label: t('recap_fluency')`
   - XP: `value: String(recap.newWordsCount * 10)`, `label: t('recap_xp')`
   - Parole nuove: `value: String(recap.newWordsCount)`, `label: t('recap_new_words')`

3. **Strengths section** (`marginTop: 28`):
   `SectionLabel label: t('recap_section_strengths')`
   `View` `backgroundColor: colors.forestLight` `borderRadius: 12` `padding: 16` `marginTop: 10`:
   If errors array is empty: single bullet `Text` `typography.body` `color: colors.forest` value "Buona fluidità"
   Else: one bullet per unique `ruleLabel` from `errors` where `wasCorrected === true`

4. **Focus section** (`marginTop: 20`):
   `SectionLabel label: t('recap_section_focus')`
   `View` `backgroundColor: colors.goldLight` `borderRadius: 12` `padding: 16` `marginTop: 10`:
   One bullet per unique `ruleLabel` from `errors` where `wasCorrected === false`.
   If none: one bullet `Text` value "Ottimo lavoro, nessun errore!"

5. **Errors section** (only if `errors.length > 0`, `marginTop: 20`):
   `SectionLabel label: t('recap_section_errors')`
   Map each error to a card (`marginTop: 10`):
   ```
   View:
     borderLeftWidth: 3
     borderLeftColor: colors.gold
     backgroundColor: colors.cream
     borderRadius: 8
     padding: 14
   Content (top to bottom):
     Text  typography.body  color: colors.ink   "{error.userText} → {error.correctForm}"
     Text  typography.uiSmall  color: colors.muted  marginTop: 4  error.ruleLabel
     if wasCorrected: Text typography.uiSmall color: colors.forest  "✓ Corretto"
   ```

6. **Done button** (`marginTop: 32`):
   `PrimaryButton label: t('recap_done') onPress: () => navigation.navigate('WordCard')`

---

#### 9g — `VaultScreen.tsx`

Replace the return block. All pagination / store / MMKV cache logic remains unchanged.

Layout — `SafeAreaView` flex column:

1. **Header** (`paddingHorizontal: 20`, `paddingTop: 20`, `paddingBottom: 12`):
   `Text` `typography.wordHero` `color: colors.ink` value: `t('vault_title')`

2. `Divider`

3. **Item list** (`flex: 1`):
   `FlatList` `contentContainerStyle={{ paddingHorizontal: 20 }}`.
   `ItemSeparatorComponent`: `<Divider />`.
   `onEndReached`: existing pagination call.
   `ListEmptyComponent`: centered `Text` `typography.body` `color: colors.muted` value: `t('vault_empty')`.

   Each vault item row (`paddingVertical: 16`, `flexDirection: 'row'`, `alignItems: 'center'`):

   **Left column** (flex 1):
   - Row: `ArticleBadge article={item.article} style={{ marginRight: 8 }}` + `Text` `typography.exampleDe` `color: colors.ink` (the word, Playfair)
   - `Text` `typography.uiSmall` `color: colors.muted` `marginTop: 2` (item.translationIt)
   - Retention bar (`marginTop: 6`, `height: 3`, `borderRadius: 2`, `backgroundColor: colors.mist`):
     Inner `View` width `${Math.round(item.retentionScore * 100)}%` `backgroundColor: colors.forest` `borderRadius: 2`

   **Right column** (`marginLeft: 12`):
   Review chip — `View` `backgroundColor: colors.goldLight` `borderRadius: 6`
   `paddingHorizontal: 8` `paddingVertical: 4`:
   - If `new Date(item.nextReviewAt) <= new Date()`: `Text` `typography.uiSmall` `color: colors.gold` value: `t('vault_review_chip_today')`
   - Else: compute days diff → `Text` value: `t('vault_review_chip_days', { count: daysUntil })`

---

#### 9h — `PaywallScreen.tsx`

Replace the return block. All RevenueCat / purchase logic remains unchanged.

Layout — `SafeAreaView` → `ScrollView` `paddingHorizontal: 24` `paddingBottom: 40`:

1. **Dismiss** (top-right absolute `TouchableOpacity`, `44×44`, `alignItems: 'flex-end'`, `marginTop: 8`):
   `Text` `typography.uiButton` `color: colors.muted` "✕" → `navigation.navigate('Vault')`

2. **Headline** (`marginTop: 40`):
   `Text` `typography.wordHero` `color: colors.ink` value: `t('paywall_headline')` (multiline)

3. **Subhead** (`marginTop: 8`):
   `Text` `typography.body` `color: colors.muted` value: `t('paywall_subhead')`

4. **Feature list** (`marginTop: 28`, `gap: 10`):
   Four rows — each: `View flexDirection:'row' alignItems:'center' gap:10`:
   - `View width:20 height:20 borderRadius:10 backgroundColor:colors.forestLight alignItems:'center' justifyContent:'center'`:
     `Text` `typography.uiSmall` `color: colors.forest` "✓"
   - `Text` `typography.body` `color: colors.ink` feature label

   Features (in order):
   - `t('paywall_feature_chat')`
   - `t('paywall_feature_recap')`
   - `t('paywall_feature_progress')`
   - `t('paywall_feature_srs')`

5. **Plan cards** (`marginTop: 28`, `gap: 12`):
   Two cards (annual first, monthly second). Annual is pre-selected (`selectedPkg` state).

   Each `PlanCard` (already updated via §7 token rename). Additional styling applied by
   the screen — wrap each in a `TouchableOpacity` with:
   ```
   borderWidth: 2
   borderColor: selected ? colors.forest : colors.border
   backgroundColor: colors.cream
   borderRadius: 16
   padding: 18
   ```
   Annual card gets `SectionLabel label: t('paywall_popular_badge')` badge in top-right
   corner (absolute, `backgroundColor: colors.forest`, `paddingHorizontal: 8`,
   `paddingVertical: 3`, `borderRadius: 4`).

6. **CTA button** (`marginTop: 28`):
   `PrimaryButton label: t('paywall_cta') onPress: handlePurchase loading: isPurchasing`

7. **Dismiss TextButton** (`marginTop: 16`, `alignSelf: 'center'`):
   `TouchableOpacity` `minHeight: 44` → `Text` `typography.body` `color: colors.muted`
   value: `t('paywall_dismiss')`

8. **Legal** (`marginTop: 12`, `textAlign: 'center'`):
   `Text` `typography.uiSmall` `color: colors.muted` value: `t('paywall_legal')`

9. **Error** (if `error`): `Text` `typography.body` `color: colors.diePink` `marginTop: 8`

---

### 10 — Absolute rules (Developer must enforce)

1. **No hex literals in screens or `components/ui/`** — all colour values from
   `import { colors } from '../../theme/colors'` (adjust relative path as needed).
2. **No raw `fontFamily` strings in screens or `components/ui/`** — all font styles
   from `import { typography } from '../../theme/typography'`.
3. **No hardcoded Italian strings** — all user-visible text via `t('key')`.
4. **Paper background on every screen** — root view must have
   `backgroundColor: colors.paper`.
5. **Minimum touch target 44** — every `TouchableOpacity` must have `minHeight: 44`
   (or an explicit `height ≥ 44`) and `minWidth: 44` if icon-only.
6. **Accessibility** — every interactive element requires `accessibilityRole` and, where
   state is implied, `accessibilityState`.

---

## API Contract

None. This task is client-only.

---

## Database Changes

None.

---

## Tests

All tests live in `mobile/__tests__/`. Use `@testing-library/react-native`. Mock Firebase,
Zustand stores, and all service functions. Do not make real network calls in tests.

### Snapshot tests — `__tests__/ui-components.test.tsx`

One `it` block per component. Each renders the component with representative props and
calls `expect(toJSON()).toMatchSnapshot()`. If snapshots already exist from a prior run,
delete the snapshot file before implementing so fresh ones are generated.

```
it('ArticleBadge der')    — article="der" word="Hund"
it('ArticleBadge die')    — article="die" word="Katze"
it('ArticleBadge das')    — article="das" word="Kind"
it('ArticleBadge null')   — article={null}
it('CefrBadge')           — level="B1"
it('StreakRow zero')       — count=0
it('StreakRow partial')    — count=3
it('StreakRow full')       — count=7
it('StreakRow overflow')   — count=14
it('CulturalNote')         — text="Ein langer Text über die Kultur."
it('WordHero with article') — word="Krankenhaus" article="das" ipa="ˈkʁaŋkənˌhaʊs"
it('WordHero no article')   — word="fahren" article={null} ipa="ˈfaːʁən"
it('PrimaryButton idle')    — label="Salva" onPress={jest.fn()}
it('PrimaryButton loading') — label="Salva" onPress={jest.fn()} loading
it('PrimaryButton disabled')— label="Salva" onPress={jest.fn()} disabled
it('SecondaryButton')       — label="Salta" onPress={jest.fn()}
it('SectionLabel')          — label="significato"
it('Divider')               — (no props)
it('WordCard')              — full mock DailyWord object, saveState="idle", streakDays=3,
                              onSave={jest.fn()}, onSkip={jest.fn()}
```

### Color correctness — `__tests__/ArticleBadge.test.tsx`

```
test_der_correct_colors — render ArticleBadge article="der"; query pill View;
  assert backgroundColor === colors.derBlueBg; assert Text color === colors.derBlue

test_die_correct_colors — article="die"; assert bg=colors.diePinkBg, text=colors.diePink

test_das_correct_colors — article="das"; assert bg=colors.dasGrayBg, text=colors.dasGray

test_null_renders_nothing — article={null}; assert component output is null
```

Use `@testing-library/react-native` `render` + `toJSON()` traversal or `getByRole` to
extract the style objects and assert token values. Assert against `colors.derBlueBg` (the
imported token), not the raw hex string.

### Dot count — `__tests__/StreakRow.test.tsx`

```
test_zero_dots_all_empty — count=0; query all dot Views; assert none have
  backgroundColor === colors.gold; assert all 7 have backgroundColor === colors.mist

test_three_dots_filled — count=3; assert exactly 3 dots have backgroundColor === colors.gold;
  assert exactly 4 dots have backgroundColor === colors.mist

test_seven_dots_full — count=7; assert all 7 dots have backgroundColor === colors.gold

test_overflow_capped — count=20; assert all 7 dots have backgroundColor === colors.gold
  (no 8th dot rendered)
```

---

## Definition of Done

- [ ] All acceptance criteria (AC1–AC8) checked off
- [ ] All snapshot tests pass and snapshots committed
- [ ] All color-correctness tests pass
- [ ] All dot-count tests pass
- [ ] `npx tsc --noEmit` clean
- [ ] `npm test -- --runInBand` green
- [ ] Zero hex literals in `screens/` and `components/ui/`
- [ ] Zero raw font family strings in `screens/` and `components/ui/`
- [ ] Zero hardcoded Italian strings in `screens/` and `components/`
- [ ] All 5 superseded `components/` files deleted
- [ ] Font loading in `_layout.tsx` holds splash until fonts ready
- [ ] Conventional commit: `feat(TASK-DS): design system — warm editorial UI redesign`
- [ ] Task status updated to `done`
