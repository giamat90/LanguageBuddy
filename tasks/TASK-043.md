# TASK-043 — UI strings that belong to the app or to the target language

**Status:** `ready`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-042 (pushed, `92e645f`)

## Context
The 13 UI string files still say "GermanBuddy" and "tedesco/German", the placement quiz is a list of German sentences, the grammar rules explain German cases, and `backup.ts` throws Italian sentences that Settings shows as they are. A second app cannot reuse them. This task sorts every string into three kinds and gives each a home, with **no visible change in GermanBuddy**:

1. **Shared** (everything else): stays in `src/i18n/<ui>.ts`.
2. **App name**: `%{app}` placeholder, filled automatically from `pack.app.name`.
3. **Target-language strings** (about 30 keys: the welcome line, the "how do you say it in …" prompt, the voice-unavailable alert, the quiz sentences, the grammar-rule explanations): move to a per-language overlay `src/languages/<code>/strings/<ui>.ts`, one file per UI language, bundled with the pack.

Also: the pack decides which UI languages are offered (SpanishBuddy will not offer Spanish), and backup errors become codes that the UI turns into translated text.

Plan: 041, 042 done; 043 (this); 044–046 Spanish; 047 variants and build scripts; 048 store/legal; 049 QA.

## Scope

### In
1. `t()` injects `app` (from the active pack) into every call; strings use `%{app}`.
2. Target-string overlays (German moved, not rewritten), merged over the base strings for the active pack.
3. `pack.quiz` (which options are correct) and `pack.uiLanguages` (which UI languages the picker offers).
4. `BackupError` codes replacing Italian `Error` messages; 8 new keys in 13 languages.
5. Parity tests extended; `CLAUDE.md` §13 updated; `CONTEXT.md`.

### Out
- Any Spanish text (TASK-044/045).
- A German UI language (`de.ts`) for SpanishBuddy's native-language list (a later task; `uiLanguages` only makes room).
- `app.config.js` name, notification channel names, store listing (TASK-047/048).
- Rewording any string; translations are moved as they are. New keys are the only new text.

## Acceptance Criteria
- [ ] No base string file (`src/i18n/*.ts`) contains the text `GermanBuddy`, and `it.ts`/`en.ts` contain none of `tedesc`, `German`, `Deutsch` (case-insensitive) outside the keys that moved to the overlay. Check with the new test.
- [ ] `t('notif_word_body')` reads "…in GermanBuddy." in German mode and "…in SpanishBuddy." when the test pack is active; the same for `welcome_restore_incompatible`, `notif_test_body`.
- [ ] The overlay keys are gone from the 13 base files and present in the 13 overlay files of `de`, with **the same text as before** (a test pins ten of them in Italian and English).
- [ ] `t(...)` for an overlay key returns the active pack's text, in the current UI language, and falls back to English when that language has no entry.
- [ ] The quiz uses `pack.quiz`; German scores exactly as before; the test pack with other `correctIndex` values scores by its own.
- [ ] `LanguagePicker` lists only `pack.uiLanguages`; `coerceNativeLanguage` maps a language outside the list to the default.
- [ ] No Italian literal remains in `backup.ts`; Settings and Welcome show a translated, generic message (never `e.message`).
- [ ] 13 languages: the 8 new backup keys in every file; parity tests (base and overlay) green; `tsc` clean; `npm test` green.
- [ ] `CONTEXT.md`, `CLAUDE.md` updated.

## Technical Spec

### Which keys move to the overlay (German pack)
Exact list (verify each exists in `it.ts` before moving; if a name differs, move the equivalent and list it in the commit message):
```
welcome_subtitle
review_mc_prompt_german            → renamed review_mc_prompt_target
speech_unavailable_title, speech_unavailable_body
quiz_q1 … quiz_q5, quiz_q1_a … quiz_q5_b   (15 keys: the question text mentions the German sentence)
grammar_rule_NOUN_GENDER, grammar_rule_ACCUSATIVE_MASC, grammar_rule_ACCUSATIVE_PREP,
grammar_rule_DATIV_PREP, grammar_rule_DATIV_INDIRECT_OBJ, grammar_rule_GENITIV_CASE
```
Also move any other key whose text names the German language or shows German grammar words (`der/die/das`, "tedesco", "German", …): search all 13 files; the acceptance test is the source of truth. `welcome_title` is deleted: the screen shows `pack.app.name`.

Keys that name the app become `%{app}` **in place** (no move): `welcome_restore_incompatible`, `notif_word_body`, `notif_test_body`, and any other hit of "GermanBuddy" in the 13 files (including `settings_autobackup_hint` if it has one). Translate nothing: only replace the word.

### Files to create
```
mobile/src/languages/de/strings/{it,en,fr,es,pt,ru,uk,pl,tr,zh,ja,hi,ar}.ts   — default export Record<string,string>, the moved texts
mobile/src/languages/targetStrings.ts                                         — REQUIRED_TARGET_KEYS and types
mobile/__tests__/targetStrings.test.ts, backupErrors.test.ts, uiLanguages.test.tsx, quizPack.test.tsx
```

### Files to modify
```
mobile/src/i18n/index.ts                   — merge overlay; t() injects { app }; StringKey type; refresh on pack change
mobile/src/i18n/language.ts                — coerceNativeLanguage respects pack.uiLanguages (type-only import of the pack)
mobile/src/i18n/{it,en,fr,es,pt,ru,uk,pl,tr,zh,ja,hi,ar}.ts  — keys removed/templated
mobile/src/languages/types.ts              — add quiz, uiLanguages, strings
mobile/src/languages/de.ts                 — quiz, uiLanguages (all 13), strings (imports the 13 overlays)
mobile/src/languages/index.ts              — notify listeners when the active pack changes (tests)
mobile/src/screens/QuizScreen.tsx          — questions from pack.quiz
mobile/src/screens/WelcomeScreen.tsx       — title from pack.app.name; backup error codes
mobile/src/screens/SettingsScreen.tsx      — backup error codes; no e.message
mobile/src/components/ui/LanguagePicker.tsx — pack.uiLanguages
mobile/src/components/exercises/MultipleChoiceView.tsx — review_mc_prompt_target
mobile/src/data/backup.ts                  — BackupError(code); no Italian literals; dialog title via t()
mobile/test-support/testPack.ts            — quiz, uiLanguages (12, without 'es'), strings (it, en only)
mobile/__tests__/uiStringsParity.test.ts   — base parity + new rules below
CLAUDE.md (§13 strings rule), CONTEXT.md
```

### Implementation notes

**Pack additions (`languages/types.ts`)**
```ts
export interface QuizItem { n: 1 | 2 | 3 | 4 | 5; correctIndex: 0 | 1 }   // keys: quiz_q<n>, quiz_q<n>_a, quiz_q<n>_b
export type TargetStrings = Record<string, string>;
// in LanguagePack:
quiz: readonly QuizItem[];                                  // German: n1:0, n2:0, n3:0, n4:1, n5:0 (as QuizScreen has them)
uiLanguages: readonly NativeLanguage[];                     // German: all 13
strings: Partial<Record<NativeLanguage, TargetStrings>>;    // overlay per UI language
```
`REQUIRED_TARGET_KEYS` (in `targetStrings.ts`) = the generic ones every pack must supply: `welcome_subtitle`, `review_mc_prompt_target`, `speech_unavailable_title`, `speech_unavailable_body`, `quiz_q1`…`quiz_q5` and their `_a`/`_b`. `grammar_rule_<CODE>` keys are extra and depend on the language's rule codes.

**`i18n/index.ts`**
```ts
export type StringKey = keyof typeof it | RequiredTargetKey | `grammar_rule_${string}`;
export const t = (key: StringKey, opts?: object) => i18n.t(key, { app: getActivePack().app.name, ...opts });
```
Translations: for each UI language `{ ...base[ui], ...(pack.strings[ui] ?? {}) }`, built by `applyTargetStrings(pack)`, called at init and whenever the active pack changes (`languages/index.ts` keeps a tiny listener list; `setActivePackForTests` calls it). A key missing in the overlay of a language falls back to English (`enableFallback`, as today), then to the key text. Existing call sites with a literal key keep compiling because their keys are in `StringKey`; fix the few that pass a `keyof typeof it` to something typed `keyof typeof it` only.

**Overlay files** are plain `export default { key: 'text', … }` in the same quoting style as the source. Moving is a cut/paste per language; do not retranslate. `review_mc_prompt_german` becomes `review_mc_prompt_target`.

**Picker and coercion.** `LanguagePicker` maps over `getActivePack().uiLanguages` (order of `LANGUAGES`). `coerceNativeLanguage(v)` = `v` if it is a supported language **and** in `pack.uiLanguages`, else `DEFAULT_NATIVE_LANGUAGE`; if the default itself is not offered, the first offered one. The `languages/types.ts` import of `NativeLanguage` is `import type` (no cycle).

**Backup errors (`data/backup.ts`)**
```ts
export type BackupErrorCode = 'invalid' | 'not_this_app' | 'unreadable' | 'corrupt' | 'incomplete' | 'newer' | 'cannot_restore';
export class BackupError extends Error { constructor(readonly code: BackupErrorCode) { super(code); } }
```
Mapping of the current Italian messages: invalid → "Il file di backup non è valido."; not_this_app → "Questo file non è un backup di GermanBuddy."; unreadable → "Impossibile leggere il file selezionato."; corrupt → "Il file di backup è danneggiato."; incomplete → "Il backup è incompleto o danneggiato."; newer → "…creato da una versione più recente di GermanBuddy. Aggiorna l'app."; cannot_restore → "Questo backup non può essere ripristinato.". `RestorePreview.reason?: string` becomes `reasonCode?: BackupErrorCode`. `RESTART_REQUIRED` stays as it is (control flow, not shown). Share dialog title: `t('backup_dialog_title', …)` evaluated at call time.
New keys (it.ts, then 13 languages; translate, `%{app}` where shown): `backup_err_invalid`, `backup_err_not_this_app` (`%{app}`), `backup_err_unreadable`, `backup_err_corrupt`, `backup_err_incomplete`, `backup_err_newer` (`%{app}`), `backup_err_cannot_restore`, `backup_dialog_title` (`%{app}`). Italian = the texts above with `%{app}`. Screens: `backupErrorText(err): string` helper in `data/backup.ts` returns `t('backup_err_<code>')` for a `BackupError`, and the existing generic string for anything else; Settings/Welcome use it and never `e.message`. Keep `console.error` at the point of failure.

**Quiz.** `QuizScreen` builds its questions from `getActivePack().quiz` (`questionKey: 'quiz_q'+n`, option keys with `_a`/`_b`, `correctIndex`). Scoring and level mapping are unchanged.

**Parity tests**
- Base (13 files): same keys, placeholders, non-empty (today's tests) **and** none contains a `REQUIRED_TARGET_KEYS` key or `grammar_rule_*`; none contains "GermanBuddy"; `it.ts`/`en.ts` contain no `tedesc|german|deutsch` (case-insensitive).
- Overlay (per target language folder found under `src/languages/*/strings/`): every UI language file exists, has exactly the keys of its `it.ts`, same placeholders, non-empty; required keys present; "not left in Italian" rule as for base (quiz option sentences and the target-language examples are in `SAME_EVERYWHERE`).
- `SAME_EVERYWHERE` no longer lists `welcome_title` (deleted) and keeps the quiz option pattern.

## Tests (write first, watch them fail)
`targetStrings.test.ts`: the base/overlay parity rules above; ten pinned moved texts (Italian and English) equal the old ones (copy the literals from the current `it.ts`/`en.ts` before moving them); `t('welcome_subtitle')` in `it` and `en`; with the test pack and locale `en`, `t('welcome_subtitle')` returns the test pack's English text and a UI language missing in the test pack falls back to English; `t('notif_word_body')` contains `GermanBuddy` / `SpanishBuddy` per pack; `applyTargetStrings` reacts to `setActivePackForTests`.
`quizPack.test.tsx`: German answers `[A,A,A,B,A]` give the same result as the current quiz test; with a test pack whose `correctIndex` are `[1,1,0,0,1]`, those answers score full marks.
`uiLanguages.test.tsx`: the picker shows 13 buttons for German and 12 (no Spanish) for the test pack; `coerceNativeLanguage('es')` is `'it'` under the test pack and `'es'` under German; a stored `es` preference under the test pack is shown in the default language.
`backupErrors.test.ts`: each error path throws `BackupError` with the right code (file of another app, not JSON, missing tables, newer format, unreadable file); `backupErrorText` returns the translated text with the app name; Settings and Welcome never show `err.message` (a thrown `Error('SQLITE secret')` shows the generic string and logs with `console.error`); no Italian literal in `backup.ts` (the test greps the file for `/[àèéìòù]/`).
Existing suites (`QuizScreen`/onboarding, `WelcomeRestore`, `languagePicker`, `languageIntegration`, `notifications`, `speech`) green.
Guard checks: let `t()` skip the `app` injection and confirm the notification test goes red; let the picker ignore `uiLanguages` and confirm the picker test goes red.

## Definition of Done
- [ ] Criteria checked; tests written first, red then green
- [ ] `npx tsc --noEmit`, `npm test` green from `mobile/`
- [ ] Spot-check on a phone: welcome screen, quiz, one review with the multiple-choice prompt, a notification test, the language picker, an export and a restore of a backup (needs a phone)
- [ ] Review of the diff: no retranslated text, no unrelated files
- [ ] Conventional commit: `refactor(TASK-043): app name and target-language strings out of the shared UI strings`
- [ ] `CONTEXT.md` and `CLAUDE.md` updated, status `done`

## Notes for Tech Lead (remove before handing over)
- Rejected: inserting the language name as `%{language}` into one sentence ("in %{language}"): it breaks in Russian, Ukrainian, Polish, Turkish, Arabic and Hindi, which inflect or reorder. A per-language overlay lets each sentence be written (and reviewed) whole. Cost: each new target language needs about 30 keys × 13 UI languages, machine-drafted and reviewed like the word content (TASK-045/046).
- The quiz moves wholesale because its question text translates a German sentence (`Come si dice "Spengo la luce"?`). A level quiz for Spanish needs five Spanish sentence pairs and their correct indices; `pack.quiz` makes that data, not code.
- `grammar_rule_*` keys are overlay but not in `REQUIRED_TARGET_KEYS`: the set depends on the language's rule codes (TASK-044 defines Spanish's).
- If a UI language file is missing from an overlay, the app falls back to English silently; the parity test is what forbids it for shipped languages.
- Possible surprise: `setActivePackForTests` now triggers a rebuild of all translations. If tests slow down, rebuild only the current locale.
