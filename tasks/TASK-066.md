# TASK-066 — FrenchBuddy: app variant, store files, QA expectations, CI

**Status:** `ready`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-063, TASK-064, TASK-065 (French pack, bank and translations exist). Uses the machinery of TASK-047 (variants), 048 (store), 049 (QA suite), 050 (permissions).

## Context
Adding a language to the family should be **data, not code**. TASK-047/048/049 were built so that a new app is a variant file, a store folder and one row of QA expectations. This task adds French that way, and fixes whatever is still Spanish/German-specific in the machinery (the test suite will say where: it fails with a pointer when a row is missing).

## Scope
### In
1. `mobile/variants/fr.json` (values below) and the icon files it names.
2. `mobile/test-support/appExpectations.ts`: the `fr` row.
3. `store/fr/`: `support.json`, `listing/<UI>.json` for the 12 UI languages (status `draft`), `play-checklist.md`, `qa-checklist.md`, `screenshots.md`, `graphics-brief.md`, generated from the Spanish ones with the language swapped; the support-site pages are rendered by `npm run build:store -- fr`.
4. `release-android.yml` accepts `app=fr` (check the input list / choice); `ci.yml` runs `npm run test:app -- fr` (only if it already runs es; follow what it does for es); `build_*.bat`/`deploy_*.bat` helpers for `fr` if the es ones exist.
5. `npm run test:app -- fr` green, `npm test` (German) and `test:app -- es` unchanged.
6. `CONTEXT.md`, `CLAUDE.md` mention (apps list), spec status.

### Out
Final art for the icon and feature graphic (owner/designer, TASK-067: the Developer generates a placeholder from the brief so the build works), the support repo, Formspree, Play Console, screenshots (need a phone), any content change to the bank, activating French in the committed seams.

## Decisions (made here)
- **Name and package:** FrenchBuddy, `com.giamat90.frenchbuddy`, slug and scheme `frenchbuddy`, iOS id `com.frenchbuddy`.
- **Icon colours:** adaptive-icon background `#0055A4` (French blue); placeholder art from the same generator the Spanish placeholder used (a script or the copied German art with the new background, as TASK-047 did for Spanish); the real art arrives with TASK-067.
- **Version:** `versionMajor 1`, `versionMinor 0`, `localFallbackVersionCode 1` (first upload `1.0.1`); release tag `fr-v<version>`.
- **Support site:** a new repo `giamat90/frenchbuddy-support` by the Product Owner (TASK-067); here only `supportUrl` in `support.json` (`https://giamat90.github.io/frenchbuddy-support/`) and `contactFormId: null` (the build fails without `--allow-placeholder`, as for Spanish).
- **Listing languages:** the 12 UI languages of the French pack (it en es pt ru uk pl tr zh ja hi ar); product name stays Latin "FrenchBuddy". All files `"status": "draft"`.
- **Truth over marketing:** claims true of the code (free, offline, no account, no ads, optional AI only with the learner's own key, word count and language count taken from the bank and pack through tokens). Nothing that says "native-reviewed". The French privacy text is the generated one; any change in what data leaves the device needs its own task.

## `variants/fr.json`
```json
{
  "code": "fr",
  "name": "FrenchBuddy",
  "slug": "frenchbuddy",
  "scheme": "frenchbuddy",
  "androidPackage": "com.giamat90.frenchbuddy",
  "iosBundleId": "com.frenchbuddy",
  "icon": "./assets/icon-fr.png",
  "adaptiveIcon": { "foreground": "./assets/adaptive-icon-fr.png", "background": "#0055A4" },
  "versionMajor": 1,
  "versionMinor": 0,
  "localFallbackVersionCode": 1
}
```
`appExpectations.ts` row for `fr`: `appName FrenchBuddy`, `dbFile frenchbuddy.db`, `backupTag FrenchBuddy`, `packageName com.giamat90.frenchbuddy`, `speechLocale fr-FR`, `wordsPerLevel` = the real counts of the French bank, `uiLanguages` = the 12 (ALL_13 without `fr`), `translatedLanguages` = `['es','pt','ru','uk','pl','tr','zh','ja','hi','ar']`, `articleForms ['le','la']`, `choiceRules ['AUXILIARY_AVOIR_ETRE','DIRECT_OBJECT_PRONOUN','RELATIVE_QUI_QUE']`, `hasCases false`, one real `sampleWord` per level (pick words that exist and are not dual-level), `aiLanguageName French`, a `collationSample` of three real French words that `fr` collation orders differently from code points (e.g. a word with `é`, `è`, `ê` between `e` and `f`; verify with `Intl.Collator('fr')`), `specialCharacters 'éèêàçœîôù'`.

## Acceptance Criteria
- [ ] `variants.test.ts` lists `de`, `es`, `fr`, validates `fr.json` (icon files exist, package valid, versions sane); `buildExpoConfig('fr')` has package, scheme, `blockedPermissions` (TASK-050) and no German/Spanish name.
- [ ] `npm run test:app -- fr` (the shared suites with the real French bank in a temp activation, seams restored afterwards) is green; without the `fr` row in `appExpectations.ts` it fails with the pointer message (guard).
- [ ] `node scripts/verify-prebuild.mjs fr` passes (needs the toolchain-free prebuild as for es); output in the report. The generated project has package `com.giamat90.frenchbuddy`, name FrenchBuddy, the backup rules slugged `frenchbuddy`, the three blocked permissions removed, nothing of the other apps.
- [ ] `bundleIsolation` (TASK-047): a French build's bundle graph contains no German/Spanish bank, translated table or pack, and the other builds contain no French one; extend the test to include `fr`.
- [ ] `npm run build:store -- fr --out <tmp> --allow-placeholder` writes the four pages, `icon.png`, 12 listing folders and `STATUS.txt`; rendered pages contain "FrenchBuddy" and "French", no "German"/"Spanish"; same section headings and links as `es`; no leftover `{{`; `contactFormId: null` without the flag fails naming the field.
- [ ] Listing limits for all 12 files (title ≤ 30, short ≤ 80, full ≤ 4000, script checks, app name in title and full text, privacy URL token); `{{WORDS}}` = the real bank size.
- [ ] `store/fr/*.md` checklists complete (copy of the Spanish ones with French text; QA checklist rows: French voice `fr-FR` present on the test phone and what happens without it, **NBSP rendering** of `Comment ça va ?` in the reorder tiles (one tile, no line break between `va` and `?`), accent typing on the phone keyboard for the typed cloze, apostrophe headwords, `l'ami` blank rendering).
- [ ] `release-android.yml` accepts `fr` (a text test as `releaseWorkflow.test.ts` does for `es`); the version check script reads `fr`.
- [ ] `npx tsc --noEmit`, `npm test`, `npm run test:app -- es`, `npm run test:app -- fr` green; German and Spanish outputs unchanged.
- [ ] `CONTEXT.md` (066 done; French app ready for QA and store setup; what is manual: TASK-067), `CLAUDE.md` repo structure/apps list.

## Technical Spec
### Files to create
```
mobile/variants/fr.json
mobile/assets/icon-fr.png, mobile/assets/adaptive-icon-fr.png        (placeholders)
store/fr/{support.json, play-checklist.md, qa-checklist.md, screenshots.md, graphics-brief.md}
store/fr/listing/{it,en,es,pt,ru,uk,pl,tr,zh,ja,hi,ar}.json
```
### Files to modify
```
mobile/test-support/appExpectations.ts        the fr row
mobile/__tests__/variants.test.ts, bundleIsolation.test.ts, releaseWorkflow.test.ts, storeSupport/storeListing tests  list fr
.github/workflows/release-android.yml          app input
.github/workflows/ci.yml                       only if es has a step
build_*.bat, deploy_*.bat                      only if es ones exist (copy, replace es→fr)
CONTEXT.md, CLAUDE.md, tasks/TASK-066.md (status)
```
Everything language-specific that the suites still hard-code to `de`/`es` is fixed by reading the pack or the expectations row (a test for each fix); do not add `if (code === 'fr')`.

## Tests (write first, see them red)
- `variants.test.ts`: `fr` listed; fixture rejection of a `fr.json` with a missing icon; `buildExpoConfig('fr')` fields.
- `appExpectations`: removing the `fr` row makes `test:app -- fr` fail with the pointer message (guard check done once by hand and noted).
- Store tests: listing limits, scripts, tokens and the `contactFormId` failure for `fr`; privacy page of `fr` equals the `es` page after swapping the names (the Developer diffs and reports: the only expected differences are the app name, the language name and tokens).
- Collation: the sample triple is ordered as `Intl.Collator('fr')` orders it in the pack's `collation` test.

## Definition of Done
- [ ] Criteria checked, tests first
- [ ] `npx tsc --noEmit`, `npm test`, `npm run test:app -- es`, `npm run test:app -- fr` green
- [ ] Diff review: seams unchanged (still German), no bank changes, no secrets (`release.properties`, keystores), only the files above
- [ ] **Native-agent check** (standing rule): French agent reads `store/fr/listing/en.json`/`it.json` and the French strings of the QA checklist; per-language agents skim the 12 listing titles/short texts; fixes applied, results noted; listings stay `draft`
- [ ] Conventional commit: `feat(TASK-066): FrenchBuddy app variant, store files and QA`
- [ ] `CONTEXT.md` updated, status `done`

## Notes for Tech Lead (remove before handing over)
- If the suites reveal German/Spanish assumptions outside the pack (a hard-coded `es` in a script, a Spanish-only fixture), the fix belongs here, with a test, because the third language is the one that proves the machinery is generic.
- Play requires a new package and a new store listing: that is the Product Owner's work (TASK-067), nothing here uploads anything.
- The icon placeholders are not shippable; TASK-067 replaces them (a designer or the Product Owner), then bumps nothing in code except the asset files.
