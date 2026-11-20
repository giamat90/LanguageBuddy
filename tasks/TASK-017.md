# TASK-017 — Support English as a second native/UI language

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Depends on:** TASK-016 (standalone/offline architecture) — merged

---

## Context

GermanBuddy's UI and word content are hardcoded to Italian: `src/i18n/index.ts` builds
a single-locale `I18n` instance (`it` only), and the word bank / SQLite schema bake
"Italian" into field names (`meaning_it`, `example_it`, `translation_it`) rather than
treating the learner's native language as a variable. `meaning_en` already exists on
every word-bank entry and in the DB (unused by any screen) — it's the only part of
this that's already half-built.

The Product Owner wants English added as a second selectable native/UI language, and
wants the mechanism built so a third language later is "add a translation file + one
array entry + word-bank content," not another schema change. This does **not** change
who the app teaches (German stays the target language) — it changes who can comfortably
read the surrounding UI and translations while learning it.

---

## Scope

### In scope
- A `NativeLanguage` concept (`'it' | 'en'`, extensible array) persisted per install.
- A language picker on first launch (`WelcomeScreen`) and a "Language" setting in
  `SettingsScreen` to change it later.
- Full English UI translation (`src/i18n/en.ts`), parity-checked against `it.ts` by
  the type system.
- English content (`example_en`, a translated `cultural_note_en`) added to all 2,194
  word-bank entries across `A1`–`C2`, alongside the `meaning_en` that already exists.
- Additive SQLite migration: `learner_profile.native_language`,
  `daily_items.example_en`, `daily_items.cultural_note_en`. No destructive changes,
  no data loss for existing installs.
- Every screen that currently reads an `_it`-suffixed field switches to a
  language-aware accessor that falls back gracefully when a language's content is
  missing for a given row.
- The opt-in "Chiedi a Lena" AI feature (`lib/ai/wordInsight.ts`) generates its note
  and asks its question in the learner's chosen native language, not hardcoded Italian.
- Backup/restore (`data/backup.ts`) round-trips the language choice.

### Out of scope
- Any language beyond Italian/English (the mechanism supports adding one; content
  for a third language is a separate task).
- Auto-detecting the device's system language (CLAUDE.md's target user is
  Italian-first; the picker defaults to Italian and requires an explicit tap — no
  silent behavior change for existing users).
- Translating `session_scenario` (English internal metadata for the deferred Lena
  chat feature — not rendered anywhere in the standalone app; leave as-is).
- A live, no-remount language switch mid-session. Changing language from Settings
  remounts the `(app)` navigator (see Technical Spec) and returns the user to the
  home screen — an accepted, one-time cost for a rare action, not a bug to fix here.
- Native-speaker QA of the new English word-bank content — same caveat CONTEXT.md
  already carries for the C1/C2 Italian content: flag it for a Product Owner
  spot-check before release, don't block the task on it.

---

## Acceptance Criteria

- [ ] AC1: On a fresh install, `WelcomeScreen` shows an Italiano/English toggle
      (defaulting to Italiano); tapping English immediately re-renders the Welcome
      screen's own text in English, and the choice carries through Quiz → Topics →
      `submitOnboarding` → `learner_profile.native_language`.
- [ ] AC2: `SettingsScreen` has a Language row that switches between Italiano and
      English for an existing profile, persists it, and re-arms scheduled
      notifications (`scheduleWordReadyReminder`, `refreshReviewReminder`) so their
      text matches the new language.
- [ ] AC3: With English selected, WordCard, WordDetailScreen, VaultScreen, and
      ReviewScreen show English meanings/examples/cultural notes for every word bank
      entry (all 6 CEFR levels) — no blank fields, no Italian leaking through.
- [ ] AC4: A `daily_items`/`vocabulary_items` row saved *before* this migration (no
      `example_en`/`cultural_note_en` value) still renders correctly under English —
      it falls back to the Italian content rather than showing nothing.
- [ ] AC5: "Chiedi a Lena" (`generateWordInsight`) produces its note and examples in
      English when the learner's native language is English, in Italian otherwise.
- [ ] AC6: Exporting a backup under English and restoring it (including on a fresh
      install) restores the English selection.
- [ ] AC7: `npm run validate:wordbank` enforces that `example_en` and
      `cultural_note_en` are present (non-empty) on every entry, same as the existing
      Italian fields.
- [ ] AC8: `npm test` green (existing suite + new tests below);
      `npx tsc --noEmit` clean.
- [ ] AC9: No regressions for an existing installed user defaulting to Italian — a
      profile with no stored `native_language` behaves exactly as today.

---

## Technical Spec

### Files to create
```
mobile/src/i18n/en.ts               — English mirror of it.ts, same key set
mobile/src/i18n/language.ts         — NativeLanguage type, SUPPORTED_NATIVE_LANGUAGES,
                                       DEFAULT_NATIVE_LANGUAGE, pickLocalized() helper
```

### Files to modify
```
mobile/src/i18n/index.ts                    — multi-locale registry, setAppLocale/getAppLocale
mobile/src/store/useUserStore.ts            — nativeLanguage state + setNativeLanguage()
mobile/src/types/domain.ts                  — add *_en fields to DailyWord/VaultItem/VaultWordDetail
mobile/src/data/schema.ts                   — additive ALTER TABLE migrations
mobile/src/data/wordbank/index.ts           — WordBankEntry: example_en, cultural_note_en
mobile/scripts/build-wordbank.mjs           — COLS: example_en, cultural_note_en
mobile/scripts/validate-wordbank.mjs        — STRING_FIELDS: example_en, cultural_note_en
mobile/scripts/wordbank/A1.tsv … C2.tsv     — +2 columns of English content, all entries
mobile/src/services/profileService.ts       — native_language read/write, setNativeLanguage()
mobile/src/services/wordService.ts          — carry example_en/cultural_note_en through
mobile/src/services/vaultService.ts         — carry translation_en/example_en/cultural_note_en
mobile/src/components/ui/WordCard.tsx       — use pickLocalized() instead of raw .meaningIt/.exampleIt
mobile/src/screens/WelcomeScreen.tsx        — language toggle
mobile/src/screens/QuizScreen.tsx           — forward nativeLanguage param
mobile/src/screens/TopicsScreen.tsx         — forward nativeLanguage param into submitOnboarding
mobile/src/screens/SettingsScreen.tsx       — Language section + locale-aware date formatting
mobile/src/screens/VaultScreen.tsx          — pickLocalized() instead of raw .translationIt
mobile/src/screens/ReviewScreen.tsx         — pickLocalized() instead of raw .translationIt
mobile/src/screens/WordDetailScreen.tsx     — pickLocalized() + locale-aware date + pass language to AI
mobile/src/lib/ai/wordInsight.ts            — parameterize prompt/response by native language
mobile/src/data/backup.ts                   — BackupKv.nativeLanguage, collect + restore
mobile/app/(app)/_layout.tsx                — key={nativeLanguage} on the Stack (remount boundary)
```

### Implementation notes

**1 — `src/i18n/language.ts` (new, no dependencies on i18n-js):**
```ts
export type NativeLanguage = 'it' | 'en';
export const SUPPORTED_NATIVE_LANGUAGES: readonly NativeLanguage[] = ['it', 'en'];
export const DEFAULT_NATIVE_LANGUAGE: NativeLanguage = 'it';

/** Returns the value for `lang`, falling back to the other supported language,
 *  then null, if the requested one is missing (e.g. a pre-migration DB row). */
export function pickLocalized(
  lang: NativeLanguage,
  it: string | null | undefined,
  en: string | null | undefined,
): string | null {
  const primary = lang === 'en' ? en : it;
  const fallback = lang === 'en' ? it : en;
  return primary || fallback || null;
}
```
This is the one seam every screen goes through — do not inline `lang === 'en' ? x : y`
ternaries elsewhere. When a third language is added later, this function's signature
necessarily changes (or generalizes to a `Partial<Record<NativeLanguage, string>>`
map) — that generalization is explicitly deferred; two positional args is fine for two
languages and keeps every call site readable.

**2 — `src/i18n/en.ts` (new):**
Mirror every key in `it.ts` with a natural English translation. Enforce completeness
at compile time:
```ts
import it from './it';
const en: Record<keyof typeof it, string> = {
  welcome_title: 'GermanBuddy',
  welcome_subtitle: 'One German word a day, learned properly.',
  // ...every key from it.ts, English wording...
};
export default en;
```
If a key is missing, TypeScript fails the build — that's the intended parity check.
Interpolated keys (`{{count}}`, `{{date}}`, `{{vocab}}`, etc. — check `it.ts` for
every `i18n.t(key, {...})` call site with options) must keep the same placeholder
names as the Italian string.

**3 — `src/i18n/index.ts`:**
```ts
import { I18n } from 'i18n-js';
import it from './it';
import en from './en';
import type { NativeLanguage } from './language';
import { DEFAULT_NATIVE_LANGUAGE } from './language';

const i18n = new I18n({ it, en });
i18n.enableFallback = true;
i18n.defaultLocale = DEFAULT_NATIVE_LANGUAGE;
i18n.locale = DEFAULT_NATIVE_LANGUAGE;

export function setAppLocale(lang: NativeLanguage): void {
  i18n.locale = lang;
}
export function getAppLocale(): NativeLanguage {
  return i18n.locale as NativeLanguage;
}

export default i18n;
export const t = (key: keyof typeof it, opts?: object) => i18n.t(key, opts);
```
`t()`'s call sites are unchanged — they keep reading whatever `i18n.locale` currently
is. Reactivity (making already-mounted screens re-render after a change) is handled
at the navigator level, not inside `t()` — see note 6.

**4 — `useUserStore.ts`:** add, following the exact pattern `cefrLevel` already uses
(MMKV mirror on the same `user-store` instance, for zero-latency access before the
SQLite profile has loaded):
```ts
import { setAppLocale, type NativeLanguage } from '../i18n'; // re-export or import from language.ts — avoid a cycle: import NativeLanguage from './i18n/language', setAppLocale from './i18n'
import { DEFAULT_NATIVE_LANGUAGE } from '../i18n/language';

// in UserState:
nativeLanguage: NativeLanguage;
setNativeLanguage: (lang: NativeLanguage) => void;

// in create():
nativeLanguage: (storage.getString('nativeLanguage') as NativeLanguage) ?? DEFAULT_NATIVE_LANGUAGE,
setNativeLanguage: (lang) => {
  storage.set('nativeLanguage', lang);
  setAppLocale(lang);
  set({ nativeLanguage: lang });
},
```
Also clear `nativeLanguage` back to the default in `resetProfile()`'s storage deletes
(delete the MMKV key; don't leave a stale language after a wipe).

**5 — Onboarding flow (`WelcomeScreen` → `QuizScreen` → `TopicsScreen`):**
- `WelcomeScreen` gets two pill buttons rendered with their own language's *native
  name* — literal `"Italiano"` / `"English"`, not translation keys (a user who
  doesn't yet read the current UI language still needs to recognize their own).
  Local `useState<NativeLanguage>('it')`; tapping a pill calls `setAppLocale(lang)`
  (immediate re-render of Welcome's own `t()` text) and updates local state.
  `welcome_cta`'s `onPress` forwards the choice: `router.push({ pathname: '/quiz',
  params: { nativeLanguage: lang } })`.
- `QuizScreen` reads `nativeLanguage` via `useLocalSearchParams` and forwards it
  the same way `cefrLevel` already gets threaded through to `/topics`.
- `TopicsScreen` reads both params, includes `native_language: nativeLanguage ??
  'it'` in the `submitOnboarding()` payload, and after a successful submit calls
  `useUserStore.getState().setNativeLanguage(nativeLanguage ?? 'it')` (mirrors the
  existing `setCefrLevel(...)` call right below it).
- Because these are freshly-mounted screens (not already on-screen), no remount
  trick is needed here — `i18n.locale` is already correct by the time each one
  renders.

**6 — Changing language later, from `SettingsScreen`:**
Add a "Lingua" / "Language" section (two-option row, same visual pattern as the
existing card rows) that calls a new `setUserNativeLanguage(lang)` in
`profileService.ts`:
```ts
export async function setUserNativeLanguage(lang: NativeLanguage): Promise<void> {
  const db = await getDb();
  const profile = await fetchProfile();
  if (!profile) return;
  await db.runAsync('UPDATE learner_profile SET native_language = ? WHERE id = ?', [lang, profile.id]);
}
```
The Settings handler: `await setUserNativeLanguage(lang); useUserStore.getState().setNativeLanguage(lang);`
then best-effort re-arm notifications: `scheduleWordReadyReminder().catch(...)` and
`refreshReviewReminder().catch(...)` (same fire-and-forget pattern already used
elsewhere in this file) so their previously-scheduled text updates.

`app/(app)/_layout.tsx`'s `<Stack>` gets `key={useUserStore((s) => s.nativeLanguage)}`.
Changing the store value remounts the whole `(app)` navigator fresh — every screen
in it re-evaluates `t()` under the new locale — and lands the user back on its first
declared screen (`index`). This is a deliberate, scoped choice (see "Out of scope"):
it avoids threading a `useT()`-style reactive hook through every screen for a change
users make once in a great while.

**7 — DB schema (`data/schema.ts`):** `CREATE TABLE IF NOT EXISTS` doesn't add
columns to a table that already exists, so add an idempotent column-adder and call
it after the existing `STATEMENTS` loop in `runMigrations`:
```ts
async function ensureColumn(db: SQLiteDatabase, table: string, column: string, ddl: string) {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  for (const sql of STATEMENTS) await db.execAsync(sql);
  await ensureColumn(db, 'learner_profile', 'native_language', "native_language TEXT NOT NULL DEFAULT 'it'");
  await ensureColumn(db, 'daily_items', 'example_en', 'example_en TEXT');
  await ensureColumn(db, 'daily_items', 'cultural_note_en', 'cultural_note_en TEXT');
}
```
`vocabulary_items.translation_en` already exists and is already populated by
`wordService.saveWord()` — no schema change needed there.

**8 — Word bank content (`WordBankEntry`, TSV, build/validate scripts):**
Add `example_en` and `cultural_note_en` as the two new trailing TSV columns (update
the `COLS` array and the doc comment at the top of `build-wordbank.mjs` to match),
and the same two names to `STRING_FIELDS` in `validate-wordbank.mjs`. Regenerate all
six `A1.json`–`C2.json` via `npm run build:wordbank` after editing the TSVs — do not
hand-edit the JSON files directly, they're generated output.

Author the English `example_en` (a natural English sentence using the word — it
does not need to be a translation of `example_it`, the same way `example_it` isn't a
translation of `example_de`) and `cultural_note_en` (translate/adapt the existing
Italian cultural note) for all 2,194 entries across the six TSVs. This is bulk
content authoring, same shape as the original word bank build in TASK-016 — flag it
in your commit/PR notes for a Product Owner spot-check before release, don't block
the task on getting a native speaker to review it first.

**9 — Wiring content through to the domain layer:**
- `types/domain.ts`: add `exampleEn: string | null` and `culturalNoteEn: string |
  null` to `DailyWord` and `VaultWordDetail`; add `translationEn: string | null` to
  `VaultItem`.
- `wordService.ts`: `DailyItemRow` gains `example_en`, `cultural_note_en`; `mapRow`
  maps them; the `INSERT INTO daily_items` statement and its `entry.*` value list
  both gain the two new columns (from `WordBankEntry.example_en` /
  `.cultural_note_en`).
- `vaultService.ts`: `VocabRow`/`mapRow` add `translation_en` → `translationEn`
  (column already exists, just wasn't selected). `DailyDetailRow` and the
  `fetchVaultWord` query add `example_en`, `cultural_note_en`; the returned object's
  fallback chain (`daily?.x ?? bank?.x ?? null`) gets the same treatment for the two
  new fields that `exampleIt`/`culturalNote` already have.

**10 — Screen changes:** replace every direct `.meaningIt` / `.exampleIt` /
`.translationIt` / `.culturalNote` read used for on-screen text with
`pickLocalized(lang, itValue, enValue)`, where `lang` comes from
`useUserStore((s) => s.nativeLanguage)`. `culturalNote`/`culturalNoteEn` follow the
same helper even though the Italian field lacks the `_it` suffix (historical — don't
rename `cultural_note` to `cultural_note_it`, that's a bigger, unrelated churn for no
functional gain). `WordCard.tsx`, `VaultScreen.tsx`, `ReviewScreen.tsx`,
`WordDetailScreen.tsx` all need this swap; grep the exact list from Technical Spec
"Files to modify" above.

Also: `SettingsScreen.tsx:90` and `WordDetailScreen.tsx:158` call
`new Date(...).toLocaleDateString('it-IT')` — make this
`toLocaleDateString(lang === 'en' ? 'en-US' : 'it-IT')`.

**11 — `lib/ai/wordInsight.ts`:** the system prompt and JSON schema are hardcoded to
Italian. Parameterize by native language:
```ts
interface WordInsightInput {
  word: string;
  article: string | null;
  meaningNative: string | null;   // renamed from meaningIt
  cefrLevel: string;
  nativeLanguage: NativeLanguage;
}

const LANGUAGE_NAME: Record<NativeLanguage, string> = { it: 'Italian', en: 'English' };

function buildSystem(lang: NativeLanguage): string {
  return `You are an assistant for learning German, for ${LANGUAGE_NAME[lang]}-speaking
students. Give short, practical explanations in ${LANGUAGE_NAME[lang]}. Respond ONLY
with valid JSON, no text before or after, no markdown.`;
}
```
Rewrite `buildPrompt` similarly (English instructions, still asking for German
example sentences), and rename the response shape's `it` field to `native` in
`InsightExample` (`{ de: string; native: string }`) — update
`WordDetailScreen.tsx`'s two `insight.examples[i].it` reads to `.native` accordingly.
The system/user prompt text itself can be authored in English regardless of
`nativeLanguage` (it's an instruction to Claude, not learner-facing) — only the
*requested output language* needs to vary.

**12 — `data/backup.ts`:** add `nativeLanguage?: NativeLanguage` to `BackupKv`;
`collectKv()` reads `userStore.getString('nativeLanguage')`; `restoreBackup()`
writes it back with `if (kv.nativeLanguage) userStore.set('nativeLanguage',
kv.nativeLanguage); else userStore.delete('nativeLanguage');` alongside the existing
`cefrLevel` handling. No `DATA_TABLES`/`BACKUP_FORMAT` bump needed — `native_language`
lives in `learner_profile`, already covered by the existing `SELECT *` dump.

---

## Tests

*This project's test suite is Jest (`jest-expo` preset) — there is no pytest/JUnit
here despite the CLAUDE.md template listing those; write Jest tests.*

- `pickLocalized` (new unit test file, e.g. `src/i18n/__tests__/language.test.ts`):
  requested language present → returns it; requested missing, other present →
  falls back; both missing → null; both empty string → null.
- `en.ts` has the same key set as `it.ts` (a runtime test asserting
  `Object.keys(en).sort()` equals `Object.keys(it).sort()` — belt-and-suspenders on
  top of the compile-time check).
- `runMigrations` (extend existing schema/db tests if present, else add one): running
  it twice is a no-op (no duplicate-column error); a DB created before this task's
  columns existed (simulate by running only the original `STATEMENTS`) still passes
  after `ensureColumn` runs — `native_language` defaults to `'it'`.
- `wordService.fetchTodayWord` / `saveWord`: a generated `daily_items` row carries
  `example_en`/`cultural_note_en` through to the mapped `DailyWord`.
- `vaultService.fetchVaultWord`: a `VaultWordDetail` for a word saved *before* the
  migration (row has `example_en = NULL`) falls back to the word bank's English
  content rather than returning null (AC4).
- `wordInsight.buildPrompt`/`buildSystem` (or the exported surface, whichever is
  testable): given `nativeLanguage: 'en'`, the system prompt requests English output;
  given `'it'`, Italian — same as current behavior.
- `validate-wordbank.mjs`: run it after the TSV/JSON updates and confirm it passes
  with zero errors (this is also just AC7 — don't skip actually running it).

---

## Definition of Done

- [ ] All acceptance criteria checked
- [ ] All specified tests written and green
- [ ] `npm run validate:wordbank` passes
- [ ] `npx tsc --noEmit` clean
- [ ] No hardcoded user-facing strings added outside `i18n/it.ts` / `i18n/en.ts`
- [ ] No API keys or secrets in code
- [ ] Conventional commit: `feat(TASK-017): short description`
- [ ] TASK status updated to `done`
- [ ] Commit directly to `main` (no feature branch — see CLAUDE.md §0 permissions
      note / Product Owner's standing branch policy)

---

## Notes for Tech Lead

- Considered a fully generic `Record<NativeLanguage, string | null>` content shape
  (replacing `meaning_it`/`meaning_en` with a single `meaning: {it, en}` map)
  instead of parallel `_it`/`_en` columns. Rejected for this task: it would force a
  destructive rewrite of the word bank JSON, the TSV pipeline, and every existing
  column name in SQLite for a benefit (an N-language-ready shape) that only matters
  once a third language is actually planned. `pickLocalized()` gives most of that
  ergonomic benefit today at a fraction of the diff; revisit the generic shape if/when
  a third language is scheduled.
- Considered auto-selecting the device's system language via `expo-localization`
  instead of an explicit onboarding tap. Rejected: CLAUDE.md's target user is
  Italian-first, and a silent default change based on device locale risks an existing
  design decision changing behavior for users who never asked for it. An explicit,
  reversible-in-Settings choice is safer and is exactly what was asked for.
- The Settings-time "remount `(app)` and land on `index`" behavior (note 6) is the
  one piece of this task most likely to feel like a rough edge to the Product Owner
  in review. If it feels too jarring after trying it, the fallback is a `useT()`
  hook that every screen subscribes to instead of importing `t` directly — a bigger,
  mechanical refactor across every screen, deliberately deferred here. Flag this
  trade-off explicitly when handing off for review rather than silently reworking it
  mid-implementation.
