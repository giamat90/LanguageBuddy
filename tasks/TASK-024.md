# TASK-024 — More app languages: platform, UI strings, RTL

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Depends on:** none. **Followed by:** TASK-025 (word-content translations).

---

## Context

The app UI exists only in Italian and English. The Product Owner wants the *app* language (never the language being
studied, which stays German) extended to every major language: French, Spanish, Portuguese, Russian, Ukrainian, Polish,
Turkish, Chinese (Simplified), Japanese, Hindi and Arabic. The Italian/English assumption is hard-wired in about 25 files
(`NativeLanguage = 'it' | 'en'`, `pickLocalized(lang, it, en)`, two-entry label maps, `'en' ? 'en-US' : 'it-IT'`, the AI
`LANGUAGE_NAME`). This task makes the language list data-driven, translates all UI strings, adds Arabic right-to-left
support, and builds the lookup seam through which TASK-025 later plugs in translated word content. Until TASK-025 ships,
word content (meaning, example, cultural note) in the new languages **falls back to English**, so this task is shippable alone.

---

## Scope

### In scope
- One registry of app languages (`src/i18n/language.ts`): code, native label, date locale, English name (for AI prompts), `rtl`.
- 11 new UI string files, key-for-key identical to `it.ts`, placeholders preserved.
- `NativeLanguage` widened to 13 codes; every consumer driven by the registry (pickers, date formatting, AI prompt).
- A reusable `LanguagePicker` (13 options do not fit a single row) used by Welcome and Settings.
- Input hardening: an unknown language code from a backup file, route param or MMKV never reaches the UI (`coerceNativeLanguage`).
- First-launch preselection from the device locale when it is supported (no new dependency).
- Arabic RTL: layout direction applied from the chosen language, with a restart notice when it must change.
- Word-content lookup seam (`src/i18n/wordContent.ts`) with an empty loader table; `pickLocalized` gets an optional 4th argument.
- Fallback order for non-it/en languages: own content → English → Italian.

### Out of scope
- Translating word-bank meanings, examples and cultural notes (TASK-025).
- Translating the German grammar-rule explanations' *German* examples (they are German by design); only the explanation prose in `*.ts` strings.
- Localizing the Play Store listing and the public support site (Product Owner / separate repo).
- Device-language-driven *automatic* switching after install (the learner's choice in Settings wins).
- Pluralization rules per language (existing strings use `%{count}` without plural forms; keep it that way).

---

## Acceptance Criteria

- [ ] AC1: `SUPPORTED_NATIVE_LANGUAGES` is `it, en, fr, es, pt, ru, uk, pl, tr, zh, ja, hi, ar` (this order), derived from one registry.
- [ ] AC2: Each new `src/i18n/<code>.ts` has exactly the key set of `it.ts`, and each value contains exactly the same `%{…}` placeholders as the `it.ts` value.
- [ ] AC3: Switching language in Welcome or Settings changes every visible UI string; no key is missing in any language.
- [ ] AC4: Welcome and Settings show all 13 languages in a wrapping picker, each labelled in its own language, with `accessibilityRole="radio"` and a selected state.
- [ ] AC5: `coerceNativeLanguage` maps unknown/non-string input to `it` (the data default); restoring a backup with `nativeLanguage: "xx"` leaves the app on a valid language (store, MMKV and `learner_profile` row).
- [ ] AC6: Dates (word detail, settings restore preview, welcome restore preview, auto-backup last run) use the language's `locale` from the registry.
- [ ] AC7: The AI prompt names the learner's language by its English name for every language (no `undefined`).
- [ ] AC8: A new install on a device whose locale is supported preselects that language; unsupported locales preselect English.
- [ ] AC9: Selecting Arabic calls `I18nManager.allowRTL(true)` + `forceRTL(true)` and, when the effective direction changes, shows a localized "restart the app" notice; selecting a non-RTL language afterwards restores LTR the same way. At app start the persisted language's direction is applied.
- [ ] AC10: For a non-it/en language with no translated word content, the meaning/example/note shown is the English one (Italian only when English is missing).
- [ ] AC11: i18n falls back to English (not Italian) for a missing key in a non-Italian language.
- [ ] AC12: `npx tsc --noEmit` clean; full `npm test` green; existing tests unchanged in intent.
- [ ] AC13: `CONTEXT.md` updated (languages, test count, decisions, known issues); `CLAUDE.md` §1/§3 mention the 13 app languages.

---

## Technical Spec

### Files to create
```
src/i18n/<fr|es|pt|ru|uk|pl|tr|zh|ja|hi|ar>.ts   — UI strings (`export default {...} satisfies Record<keyof typeof it, string>`)
src/i18n/wordContent.ts                           — localizedText(), getWordContent(), loader table (empty until TASK-025)
src/i18n/direction.ts                             — applyLayoutDirection(lang): { changed: boolean }
src/components/ui/LanguagePicker.tsx              — wrapping radio pills over the registry
__tests__/languageRegistry.test.ts, uiStringsParity.test.ts, wordContent.test.ts, direction.test.ts,
__tests__/languagePicker.test.tsx, languageHardening.test.ts
```

### Files to modify
```
src/i18n/language.ts   — registry + helpers (below); pickLocalized gains optional 4th arg
src/i18n/index.ts      — register all dictionaries; defaultLocale 'en'; keep t()
src/store/useUserStore.ts, src/services/profileService.ts, src/data/backup.ts, src/services/restoreService.ts,
src/screens/TopicsScreen.tsx, QuizScreen.tsx   — coerceNativeLanguage at every read of an external value
src/screens/WelcomeScreen.tsx, SettingsScreen.tsx — LanguagePicker, dateLocale(), direction notice
src/screens/WordDetailScreen.tsx                — dateLocale()
src/lib/ai/wordInsight.ts                       — languageEnglishName()
every `pickLocalized(lang, …)` call site (WordCard, WordDetailScreen, VaultScreen, GrammarScreen, the 6 exercise views) — localizedText()
app/_layout.tsx (or app/(app)/_layout.tsx)       — applyLayoutDirection(persisted language) once, before first render
src/i18n/{it,en}.ts   — only if a key is added (e.g. language_restart_notice); add to ALL 13 files
```

### Implementation notes

**Registry (`language.ts`):**
```ts
export const LANGUAGES = [
  { code: 'it', label: 'Italiano',   english: 'Italian',            locale: 'it-IT', rtl: false },
  { code: 'en', label: 'English',    english: 'English',            locale: 'en-US', rtl: false },
  { code: 'fr', label: 'Français',   english: 'French',             locale: 'fr-FR', rtl: false },
  { code: 'es', label: 'Español',    english: 'Spanish',            locale: 'es-ES', rtl: false },
  { code: 'pt', label: 'Português',  english: 'Brazilian Portuguese', locale: 'pt-BR', rtl: false },
  { code: 'ru', label: 'Русский',    english: 'Russian',            locale: 'ru-RU', rtl: false },
  { code: 'uk', label: 'Українська', english: 'Ukrainian',          locale: 'uk-UA', rtl: false },
  { code: 'pl', label: 'Polski',     english: 'Polish',             locale: 'pl-PL', rtl: false },
  { code: 'tr', label: 'Türkçe',     english: 'Turkish',            locale: 'tr-TR', rtl: false },
  { code: 'zh', label: '简体中文',     english: 'Simplified Chinese', locale: 'zh-CN', rtl: false },
  { code: 'ja', label: '日本語',       english: 'Japanese',           locale: 'ja-JP', rtl: false },
  { code: 'hi', label: 'हिन्दी',       english: 'Hindi',              locale: 'hi-IN', rtl: false },
  { code: 'ar', label: 'العربية',    english: 'Arabic',             locale: 'ar-AE', rtl: true  },
] as const;
export type NativeLanguage = (typeof LANGUAGES)[number]['code'];
```
Helpers: `isNativeLanguage(x): x is NativeLanguage`, `coerceNativeLanguage(x: unknown): NativeLanguage` (→ `DEFAULT_NATIVE_LANGUAGE`
`'it'`, which is the existing DB default and must not change), `languageLabel`, `languageEnglishName`, `dateLocale`, `isRtl`,
`detectDeviceLanguage(identifier?: string | null): NativeLanguage` (takes `I18nManager.getConstants().localeIdentifier`,
splits on `_`/`-`, lower-cases the primary subtag, `zh` any region → `zh`, returns `'en'` when unsupported or missing).
`ar-AE` is used so digits stay Latin and the calendar Gregorian (`ar-SA` would print Hijri dates).

**`pickLocalized(lang, it, en, local?)`:** `it` → it‖en; `en` → en‖it; any other → local‖en‖it; empty string counts as missing; null when nothing.
Existing 3-argument calls and tests keep working.

**Word content seam (`wordContent.ts`):**
```ts
export type WordField = 'meaning' | 'example' | 'note';
type Triple = [meaning: string, example: string, note: string];
const LOADERS: Partial<Record<NativeLanguage, () => Record<string, Triple>>> = {}; // TASK-025 fills this
export function getWordContent(lang, word, level?): Triple | null   // key `${LEVEL}:${word.toLowerCase().replace(/\s+/g,'-')}`; when level unknown, first level that has the word
export function localizedText(lang, field, ref: { word: string; level?: string | null }, it, en): string | null
```
Keys deliberately reuse `entryId()` from `data/wordbank/index.ts` (four words, e.g. `essen`, exist in two levels, so the key
**must** carry the level). Loader results are memoized per language. `localizedText` never throws: a loader failure is
`console.error`-ed once and treated as "no content".

**Direction (`direction.ts`):** `applyLayoutDirection(lang)` → `I18nManager.allowRTL(true)`; if `I18nManager.isRTL !== isRtl(lang)`
call `forceRTL(isRtl(lang))` and return `{ changed: true }`. Settings/Welcome show `t('language_restart_notice')` when `changed`.
Android applies `forceRTL` only after a restart, which is why the notice exists. No new dependency (no restart library).
RN's `doLeftAndRightSwapInRTL` mirrors `row`, margins and paddings; review the code for hard-coded `textAlign: 'left'|'right'`
and absolute `left`/`right` (grep found none at spec time) and for icon glyphs that imply direction (back arrows, chevrons).

**i18n index:** register all 13 dictionaries; `defaultLocale = 'en'`, `enableFallback = true`; the *active* locale still starts at
`DEFAULT_NATIVE_LANGUAGE`. `t`'s key type stays `keyof typeof it`.

**LanguagePicker:** `{ value: NativeLanguage; onChange(lang): void; disabled?: boolean }`, `flexWrap: 'wrap'`, three per row,
each pill `accessibilityRole="radio"`, `accessibilityState={{ selected }}`, `accessibilityLabel={label}`, `testID={`lang-${code}`}`.
Replaces the two copies of `LANGUAGE_LABEL` and the inline pill styles.

**Strings (the translation brief):** natural, friendly, concise, same register as `it.ts`; keep emoji, `\n`, `%{vars}`,
quotation marks style local to the language; **do not translate** "GermanBuddy" or German example sentences/words (they are
the content); keep the German article words (der/die/das) as is. Avoid grammar that depends on the number in `%{count}`
(no plural forms exist) — prefer a label form ("Streak: %{count}") where the language needs agreement. Arabic: Modern
Standard Arabic; Chinese: Simplified; Portuguese: Brazilian; Spanish: neutral Latin-American/Castilian-safe wording.
All strings are first-pass machine translations: **flagged in CONTEXT.md as needing native review before store listing.**

---

## Database Changes

None. `learner_profile.native_language` is free `TEXT` (default `'it'`); new codes are plain values. No migration.

---

## Tests (write first, watch them fail)

- `languageRegistry.test.ts`: codes/order; labels unique and non-empty; every `locale` accepted by `Intl.DateTimeFormat`; only `ar` is RTL; `detectDeviceLanguage` (`fr_FR`→fr, `zh-Hans-CN`→zh, `de_DE`→en, `null`→en, `pt_PT`→pt, `PT`→pt); `coerceNativeLanguage('xx'|null|42|{})` → `it`.
- `uiStringsParity.test.ts`: for all 13 languages × all keys: key set equals `it`; values non-empty strings; `%{…}` placeholder multiset equals `it`'s; no value is still byte-identical to the `it` value except keys on an explicit allow-list (brand, German examples, emoji-only).
- `language.test.ts` (extend): `pickLocalized` 4th-arg cases (local present, local empty → en, en missing → it, both missing → null).
- `wordContent.test.ts`: empty loader table → `localizedText('fr',…)` returns the English text, then Italian when English missing; with an injected loader (test seam `__setLoaderForTests`) returns the local text; level disambiguation (`A1:essen` vs `A2:essen`); a throwing loader is swallowed and logged once.
- `direction.test.ts`: mocked `I18nManager`: ar from LTR → `forceRTL(true)`, `changed: true`; ar when already RTL → `changed: false`; it from RTL → `forceRTL(false)`.
- `languagePicker.test.tsx`: renders 13 radios with native labels, selecting calls `onChange`, selected state, disabled.
- `languageHardening.test.ts`: `restoreBackup` with `nativeLanguage: 'xx'` and a profile row `native_language: 'xx'` → store/MMKV/row hold `it`; Topics/Quiz route param `nativeLanguage=xx` → `it`.
- AI: `ai.test.ts` extended: system and user prompt contain the registry English name for every language.
- Existing screen tests (Welcome, Settings, WordCard, Vault) keep passing; update only where a pill selector changed.

---

## Definition of Done

- [ ] All acceptance criteria checked
- [ ] All specified tests written first, seen red, then green; `npx tsc --noEmit` and `npm test` clean
- [ ] No hard-coded UI strings; every new key is in all 13 files
- [ ] No keys/secrets; nothing new sends data off the device
- [ ] `CONTEXT.md` and `CLAUDE.md` updated; conventional commit `feat(TASK-024): app UI in 13 languages` (only when asked)
- [ ] Status → `done`

---

## Notes for Tech Lead

- **Why a registry instead of per-language ifs:** each added language was a ~25-file edit; with a registry it is one entry + one string file.
- **Why content is a separate lookup, not new DB columns:** the word bank is bundled and immutable per version; `daily_items`/`vocabulary_items` copy only it/en and would need 11×3 new columns plus data migration of saved words. A bank-keyed lookup keeps the schema untouched, needs no migration for existing vaults and makes a later language a data-only change.
- **Rejected:** `expo-localization` (new native dependency for one string); `react-native-restart` (same); translating at runtime through the optional AI (breaks "offline, no key needed").
- **Risks:** Arabic RTL cannot be verified in Jest — needs a device pass (mirrored row layouts, the exercise tiles, German text inside RTL paragraphs). CJK/Devanagari/Arabic glyphs fall back to the system font because Playfair/Inter do not cover them. Machine-translated strings need native review.

---

## Implementation notes and review fixes

- **Result:** 589 tests pass in 46 suites (the task adds 47); `tsc --noEmit` clean; word bank validates. `expo prebuild` was run once to confirm the manifest: it carries `android:supportsRtl="true"` after the plugin and did **not** before. Nothing here was run on a phone.
- **Decisions made while implementing (not in the spec):**
  - New plugin `plugins/withRtlSupport.js` (+ test): the generated manifest had no `supportsRtl`, so `forceRTL` would have had no effect on Android.
  - The persisted language was never applied to `i18n` at startup (only the store was restored, so the UI came back in Italian). `useUserStore` now calls `setAppLocale` on creation; test `languageStartup.test.ts`.
  - `VaultWordDetail` gained `meaningEn`; the word detail previously showed the Italian meaning to English learners.
  - `MultipleChoiceOption` and `GrammarQuestion` carry the bank level so translated content finds the right row for the four words that exist in two levels.
  - Cognates identical to Italian (e.g. Spanish "Cultura") are allow-listed per language in the parity test; an entry there is a hand-checked claim.
- **Review findings, each with a failing test first or a mutation check:**
  1. *Last pill stretched full width* with 13 languages (flexGrow). Fixed with a fixed width.
  2. *Layout direction not applied after restoring an Arabic backup* from the welcome screen. `rehydrateAfterRestore` now calls `applyLayoutDirection` (`welcomeRestore.test.tsx`).
  3. Guards verified by mutation (fallback locale, `coerceNativeLanguage`, startup locale): each made its test go red.
- **Still to do:** native-speaker review of all 11 string files; a phone pass for Arabic mirroring, glyph fallback and the picker at 320 dp; TASK-025.
