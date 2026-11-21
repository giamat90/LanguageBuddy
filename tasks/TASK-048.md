# TASK-048 — Store listing and legal pages per app

**Status:** `ready`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-047 (pushed, `4b02ed5`)

## Context
GermanBuddy's public pages (privacy policy, terms, contact, delete-your-data) live in a separate repo, `germanbuddy-support`, as four hand-written HTML files that name "GermanBuddy" and "German" in many places. A second app cannot reuse them as they are, and Google Play requires, per app: a public privacy-policy URL that describes *that* app, a Data safety form, and a listing (title, short and full description) in every language the listing is offered in. This task makes all of that **reproducible from the repo**: templates for the four pages, a per-app description file, listing texts for the 12 UI languages of SpanishBuddy, a build script that renders them, and the checklist the Product Owner follows in Play Console. Everything outward-facing (creating the support repo, enabling GitHub Pages, creating a Formspree form, filling Play Console, uploading) stays with the Product Owner.

## Scope
### In
1. `store/support-template/`: the four pages as templates (`privacy-policy.html`, `terms-of-service.html`, `contact.html`, `delete-account.html`), derived once from the current German pages in `C:\Workspace\GiaMat90\GermanBuddy\germanbuddy-support\` (sibling, outside this repo), with every app- or language-specific fact turned into a token.
2. `store/<code>/support.json` for `de` and `es` (tokens' values) and `store/es/listing/<ui>.json` (12 files) with the SpanishBuddy listing texts.
3. `mobile/scripts/lib/store.js` (pure: render, validate) and `mobile/scripts/build-store.mjs <code> [--out dir]` (`npm run build:store -- es`): renders the support site and the listing texts into `store/<code>/dist/` (gitignored).
4. `store/es/play-checklist.md` (every Play Console form with the answer and where it comes from), `store/es/screenshots.md` (the shot list), `store/es/graphics-brief.md` (icon and feature graphic brief).
5. Tests, `.gitignore`, `CONTEXT.md`, spec status.

### Out
Creating the `spanishbuddy-support` repo or enabling Pages, creating the Formspree form, Play Console work, capturing real screenshots (needs a phone: TASK-049), drawing the real icon and feature graphic (brief only), migrating the German pages onto the templates (the generator can render `de`, but the German repo stays hand-maintained until a third app makes the drift painful), reviewing the machine-drafted listing translations, any app code.

## Decisions (made here, do not revisit)
- **Where the Spanish pages are published:** a new repo `giamat90/spanishbuddy-support` (Product Owner creates it and enables Pages), mirroring the German one. The build writes the four pages plus `icon.png` into `store/es/dist/support/`; the Product Owner copies that folder into the repo.
- **Contact form:** the German contact page currently carries the placeholder `REPLACE_WITH_GERMANBUDDY_FORMSPREE_ID` in the repo copy (a form that cannot work; the Product Owner should check the live page). For Spanish the Formspree id is a **required** value of `support.json` (`contactFormId`): while it is `null` the build **fails** with a message saying what to do, unless `--allow-placeholder` is passed (then the page is rendered with `REPLACE_WITH_<SLUG>_FORMSPREE_ID` and the build prints a warning). The Developer must not invent an id. No e-mail address is added anywhere.
- **Truth over marketing:** listing claims must be true of the code: free, offline, no account, no ads, optional AI only with the learner's own key, word count from the real bank, language count from the pack. No superlatives, no "official", no claims about native-speaker review.
- **Status of translations:** all listing files carry `"status": "draft"`; the build writes `STATUS.txt` listing each language's status, and prints a reminder that only `reviewed` languages should be published. (CONTEXT already records that machine translations need a native reader before the store mentions them.)
- **Number format:** `{{WORDS}}` is the plain integer (no thousands separator) so the output does not depend on the ICU build.
- **The listing is offered in the app's UI languages** (`pack.uiLanguages`, 12 for Spanish: it en fr pt ru uk pl tr zh ja hi ar). The product name stays Latin ("SpanishBuddy") in every language.

## Tokens
Templates and listing files may use only these (anything else makes the build fail):

| Token | Value (es) | Source |
|-------|-----------|--------|
| `{{APP}}` | SpanishBuddy | variant `name` |
| `{{TARGET}}` | Spanish | pack `name` |
| `{{CODE}}` | es | variant `code` |
| `{{SLUG}}` | spanishbuddy | variant `slug` |
| `{{SLUG_UPPER}}` | SPANISHBUDDY | uppercased slug (placeholder id only) |
| `{{DEV}}` | Giacomo Matzeu | `support.json` (`developer`, as in the current German policy) |
| `{{UPDATED}}` | e.g. `November 21, 2026` | `support.json` `lastUpdated` |
| `{{YEAR}}` | 2026 | `support.json` `year` |
| `{{FORM_ID}}` | Formspree id | `support.json` `contactFormId` (see Decisions) |
| `{{UI_LANGS}}` | 12 | `pack.uiLanguages.length` |
| `{{WORDS}}` | 1739 | total entries of the active bank |
| `{{SUPPORT_URL}}` | `https://giamat90.github.io/spanishbuddy-support/` | `support.json` `supportUrl` |
| `{{PRIVACY_URL}}` | `{{SUPPORT_URL}}privacy-policy.html` | derived |

## Acceptance Criteria
- [ ] The four templates exist; **no literal** "German", "Spanish", "GermanBuddy", "SpanishBuddy" (any case) remains in them outside a token, and every app-specific number (languages, words) is a token. Anything the Developer cannot classify with certainty is listed in the report instead of guessed.
- [ ] `npm run build:store -- es --out <tmp>` (with a test form id) writes the four pages, `icon.png`, the 12 listing folders (`title.txt`, `short.txt`, `full.txt`) and `STATUS.txt`; the same for `de` writes the support pages only (no listing folder exists for `de`; the script says so and exits 0).
- [ ] Rendered `es` pages contain "SpanishBuddy" and "Spanish", and **no** "German"; rendered `de` pages the reverse. Both have identical section headings, the same internal links (all resolve to a rendered page), no leftover `{{`.
- [ ] The privacy-policy text still states exactly what the German one states about data, with only the names/language swapped: no account, no server, on-device storage, optional AI (word, level, native language only), local notifications + the Firebase Cloud Messaging component, backup/restore, text-to-speech, Google Fonts, deleting data. The Developer diffs the rendered `de` privacy page against the current German file **in the report** (expected differences: tokenised dates/ids only) and says so.
- [ ] Listing limits hold for all 12 files: title ≤ 30 characters, short ≤ 80, full ≤ 4000; all tokens resolved; script checks (ru/uk Cyrillic, zh Han, ja kana/Han, hi Devanagari, ar Arabic) pass on title, short and full; the app name appears in the title and in the full text; the full text links the privacy URL via `{{PRIVACY_URL}}`; title ≠ short.
- [ ] Building `es` with `contactFormId: null` fails (exit ≠ 0) and names the field; with `--allow-placeholder` it renders `REPLACE_WITH_SPANISHBUDDY_FORMSPREE_ID` and warns.
- [ ] `store/es/play-checklist.md`, `screenshots.md`, `graphics-brief.md` exist and are complete (below).
- [ ] `npx tsc --noEmit` clean, `npm test` green; no change to app code, seams, banks or `variants/`.
- [ ] `CONTEXT.md` updated; spec status `done`.

## Technical Spec

### Files to create
```
store/support-template/privacy-policy.html, terms-of-service.html, contact.html, delete-account.html
store/de/support.json
store/es/support.json
store/es/listing/{it,en,fr,pt,ru,uk,pl,tr,zh,ja,hi,ar}.json
store/es/play-checklist.md, store/es/screenshots.md, store/es/graphics-brief.md
mobile/scripts/lib/store.js
mobile/scripts/build-store.mjs
mobile/__tests__/storeSupport.test.ts
mobile/__tests__/storeListing.test.ts
```
### Files to modify
```
mobile/package.json      "build:store": "node scripts/build-store.mjs"
.gitignore               store/*/dist/
CONTEXT.md, tasks/TASK-048.md (status)
```

### `support.json`
```json
{
  "developer": "Giacomo Matzeu",
  "year": "2026",
  "lastUpdated": "November 21, 2026",
  "supportUrl": "https://giamat90.github.io/spanishbuddy-support/",
  "contactFormId": null
}
```
`de/support.json` carries the German values (`supportUrl` is the German support site's URL as found in the German files/CONTEXT; if it cannot be determined from the repo, use `https://giamat90.github.io/germanbuddy-support/` and say so in the report; `contactFormId` null, rendered only with `--allow-placeholder`, which the German tests use). `lastUpdated` is a hand-edited value that must be changed whenever policy text changes; the templates keep their "Last updated" line from it.

### Listing file
```json
{ "status": "draft", "title": "SpanishBuddy: Learn Spanish", "short": "…", "full": "…" }
```
Text rules (the Developer writes `en` first, then the others as translations of it; `it` is written independently as the native language of the Product Owner):
- title ≤ 30; short ≤ 80; full ≤ 4000, plain text with blank-line paragraphs and `•` bullets (no HTML, no emoji, no markdown).
- Content of `full` (each claim must be checked against the code and the bank, and the report lists the check): a daily Spanish word at the learner's CEFR level (A1–C2, `{{WORDS}}` words) with article, pronunciation, meaning, example and a cultural note; a vault with spaced repetition; the exercise formats that really exist for Spanish today (read `src/lib/exercises/registry.ts` and `src/languages/es.ts`; mention a format only if it can be built for Spanish); free practice; grammar drills for what the Spanish pack really offers (read `pack.choices`/articles; name only those); listening to words with the phone's text-to-speech; reminders; backup/restore to a file; works fully offline; no account, no ads, free; optional AI "Approfondisci"-style usage notes **only with the learner's own provider key**, sending only the word, its level and the app language; the app is available in `{{UI_LANGS}}` languages; Android only. Close with the privacy line and `{{PRIVACY_URL}}`.
- Forbidden: superlatives and rankings ("best", "#1", "the only"), "official", guarantees ("fluent in 30 days"), claims of native-speaker review, mention of other store apps or of Google/Anthropic/OpenAI by name as endorsement, any price other than "free".

### `scripts/lib/store.js` (CommonJS)
```js
TOKENS                                  // the list above
tokenValues({ variant, pack, support, wordCount, uiLangCount })   // -> { '{{APP}}': ..., ... }  (PRIVACY_URL derived)
render(text, values)                    // replaces every known token; throws "unknown token {{X}} in <name>" and "unresolved ..." 
validateListing(listing, { lang })      // -> string[] problems (limits, scripts, empty, banned phrases, status)
loadSupport(code, { root? })            // reads store/<code>/support.json, validates the fields
```
The banned-phrase check is applied to the **English** text only (a case-insensitive list: `best`, `#1`, `number one`, `official`, `the only`, `guarantee`, `fluent in`); other languages are covered by review. Script checks reuse the regexes from `wordbank-i18n-lib.cjs` (`SCRIPT` is not exported: export it there as `SCRIPT_BY_LANG` in an additive change, and keep the existing API untouched).

### `scripts/build-store.mjs`
`node scripts/build-store.mjs <code> [--out <dir>] [--allow-placeholder] [--root <repo root>]`
1. Load the variant (`loadVariant`). The script is plain Node and must not import TypeScript, and the seams stay untouched, so it reads the pack facts from `scripts/wordbank/<code>/language.json`: add an additive `"name"` key (`"Spanish"` in `es/language.json`, `"German"` in `de/language.json`; confirm the build and validator ignore unknown keys, and say so in the report). The UI languages of an app are `i18nLanguages` plus `it` and `en` (es: 12; de: 11 + 2 = 13, which includes `es`). A test pins both the name and the count against `pack.name` and `pack.uiLanguages` for the two packs.
2. `wordCount` = sum of entries over `src/data/wordbank/<code>/{A1..C2}.json`.
3. Render each template with the values into `<out>/support/`; copy `mobile/assets/icon.png` as `icon.png`.
4. If `store/<code>/listing/` exists: validate and render each file (the three fields) into `<out>/listing/<ui>/{title,short,full}.txt`; any validation problem is printed and the exit code is 1 (nothing partial left: write only after everything validated). Write `<out>/STATUS.txt` (`<ui>: draft|reviewed`) and print the reminder.
5. Default `--out` is `store/<code>/dist`. Exit codes: 0 ok, 1 validation/contact-form problem, 2 usage.

### Play checklist content (`store/es/play-checklist.md`)
A table per Play Console section, each row = field, answer, source (policy section, code or `variants/`). Sections: App access (no login), Ads (none), Content rating questionnaire (education, no violence/…; the German app's answers are the reference — say "copy from GermanBuddy's questionnaire"), Target audience (18+, like the policy), Data safety (**same declarations as the German app**: no data shared; "Device or other IDs" collected for app functionality because of the Firebase Cloud Messaging component of `expo-notifications`, optional AI call described as data sent only on the learner's action to the learner's own provider; encryption in transit for that call; users can request deletion → delete page), Privacy policy URL (`{{PRIVACY_URL}}`), App category (Education), Contact details (the developer account's; no address added here), Store listing (title, short, full per language from `dist/listing`), Graphics (icon 512×512, feature graphic 1024×500, phone screenshots from `screenshots.md`), Release (package `com.giamat90.spanishbuddy`, first upload manual or `release-android.yml -f app=es`, a **new** Play app, so versionCode 1 is valid; run `check:play-version` first), Permissions declarations (`POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE` as for German). Every row the Developer cannot verify from the repo is marked `Product Owner to confirm in the console`; none is guessed.

`screenshots.md`: 5 shots in the German order (vault, today, review, matching, reorder) for each UI language, taken with SpanishBuddy on a phone; names `<n>-<screen>-<ui>.png`; which sample words to have saved (3 A1 words with different articles, one due review); what to avoid (real learner data, notification panel). `graphics-brief.md`: icon 512×512 (current art is the German one with a red adaptive background, a placeholder), feature graphic 1024×500, palette from `src/theme/colors.ts`, the name stays Latin script, no flags, no claims.

## Tests (write first, see them red)

### `storeSupport.test.ts`
- Templates contain none of `german|spanish|germanbuddy|spanishbuddy` (case-insensitive) outside `{{…}}`; every `{{X}}` in them is in `TOKENS`.
- Render with `de` and `es` values (`contactFormId` given): no leftover `{{`; `es` contains "SpanishBuddy" and "Spanish" and not "German"/"GermanBuddy"; `de` the reverse; the h2/h3 heading list is identical between them; every local `href="*.html"` points to one of the four rendered pages; `icon.png` is referenced and exists in the build output (CLI test).
- The policy keeps its substance (substring checks on the rendered `es` policy): "no account", "Firebase Cloud Messaging", "text-to-speech", "Spanish word", "your own key" (use the phrases the template really contains; adapt to the text, do not weaken the assertion to something trivial).
- `loadSupport` rejects a missing field; `render` throws on an unknown token and on an unresolved one.
- `contactFormId: null`: the CLI exits 1 naming `contactFormId`; with `--allow-placeholder` it exits 0, the contact page contains `REPLACE_WITH_SPANISHBUDDY_FORMSPREE_ID` and stderr warns. With an id, the id is in the `fetch` URL and no placeholder remains.
- UI-language count: `uiLangCount(language.json)` equals `pack.uiLanguages.length` for `de` and `es` (import the packs).
- CLI: unknown code → exit 2; `de` builds support only and says there is no listing; the output folder is exactly the expected file set.

### `storeListing.test.ts`
- The 12 files exist and their names equal the set of `pack.uiLanguages` of the Spanish pack.
- Each validates with `validateListing` (limits, scripts, non-empty, title ≠ short, app name in title and full, `{{PRIVACY_URL}}` in full, all tokens known) and `status` is `draft` or `reviewed`.
- English text has none of the banned phrases; guard: a copy with "the best app" fails; a 31-character title fails; a Cyrillic file whose short text is Latin fails.
- Rendered `en` full text contains the real word count of the Spanish bank (read from the JSON) and `12`.
- Every exercise-format or grammar claim has a matching assertion: the test lists the formats the `en` text names (a small table `claim → predicate`, e.g. "matching" → `registry` has a matching format that can be built for a Spanish word) so a claim cannot outlive the feature. Keep the table short and honest; if a claim cannot be tied to code, drop the claim from the text.

## Definition of Done
- [ ] Criteria checked; tests written first and seen red; guards checked (remove one check, see red)
- [ ] `npx tsc --noEmit`, `npm test` green
- [ ] Report includes: the diff of rendered-`de` privacy vs the current German file, the list of anything unclassified in the templates, the claim → evidence table for the listing, and the contact-form finding for the German page
- [ ] Diff review: no app code touched; no personal data, e-mail address, key or id invented
- [ ] `CONTEXT.md` updated (048 done; owner steps: create `spanishbuddy-support`, Formspree id, Play app + forms, screenshots; translations draft; 049 next); conventional commit `feat(TASK-048): store listing and legal pages per app`

## Notes for Tech Lead (remove before handing over)
- Rejected: editing the German pages in place to be language-neutral (the German repo is live and separate; a tokenised copy is safer and the diff against the live file proves nothing drifted); one multi-app support site (Play wants a policy URL per app and the policy names the app); putting the pages inside `mobile/` (they are not app code).
- Open for TASK-049: the manual QA also covers the rendered pages in a browser (fonts, links) and the contact form with a real id.
- Watch: if Play insists the policy URL be on the developer's own domain, only `supportUrl` changes.
