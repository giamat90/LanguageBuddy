# TASK-073 — Chinese pilot: 50 words, their characters, and an app that runs on a phone

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-072 (design: TASK-070 §7, §8)

## Context
Before writing ≈300 words, try the format and the engine with 50 on a real phone. A format change is cheap now.

## Scope
### In
1. `scripts/wordbank/zh/A1.tsv` (50 words) and `characters.tsv` (every character the words, sentences and measure words use), with the `allow` list; `draft` removed; generated JSON; `WORDBANK_VERSION` bumped.
2. Native-agent quality check (CLAUDE.md §14) and fixes.
3. The smallest app variant: `variants/zh.json`, placeholder icons, the `appExpectations` row.
4. Build the release APK and install it on the connected phone.

### Out
Everything of TASK-074 … 078: pinyin above sentences and fading, typed pinyin, tone choice, character screens, drills, stage order, primer, full bank, final icon, store files, CI, release workflow.

## Content rules
- 50 words from the beginner range of HSK 1 (a coverage reference only; no affiliation claimed): pronouns, everyday verbs, nouns, adjectives and the particle 吗. All eight topics appear; stages 1–4 are used.
- Meanings, examples and notes in Italian and English, written for this app. One example of 4–10 words per word, natural mainland Mandarin, simplified characters.
- Sentences use pilot headwords and the `allow` list only; every entry of `allow` is used.
- Pinyin by word, 一 and 不 as pronounced, third-tone changes not written; capitals for the sentence start and proper names.
- `grammar_angle` describes the sentence; a choice code only where one member is the only right answer.
- Character rows: readings, meaning, components only where they are plainly visible facts, look-alikes, a memory trick only where useful (never presented as etymology).
- Everything is **machine-drafted** and recorded as such in `CONTEXT.md`.

## Acceptance Criteria
- [x] `npm run build:wordbank` and `validate:wordbank` accept `zh` (50 entries) with no draft flag.
- [x] For all 50 words a sentence reorder and a typed cloze can be built; the reorder tiles join back to the example.
- [x] Native agents (Chinese, Italian, English readers) reported; every real finding is fixed or listed as open.
- [x] `npm run test:app -- zh` green; `node scripts/verify-prebuild.mjs zh` passes.
- [x] `npx tsc --noEmit`, `npm test`, `npm run test:app -- es`, `-- fr` green; German seams committed.
- [x] ChineseBuddy `com.giamat90.chinesebuddy` is installed on the phone next to the other apps and opens: onboarding without a quiz, today's word with pinyin, saving it, the vault without a Grammar button, practice.

## Technical Spec
```
Create  scripts/wordbank/zh/A1.tsv, characters.tsv; src/data/wordbank/zh/A1.json, characters.json (generated)
        variants/zh.json; assets/icon-zh.png, adaptive-icon-zh.png (512×512, word card with 字 on #0F6B50, no flag; placeholder)
        __tests__/chineseBank.test.ts
Modify  scripts/wordbank/zh/language.json (no draft; allow; measure words), src/data/wordbank/index.ts (version)
        test-support/appExpectations.ts (zh row), __tests__/activeApp/platform.test.ts (no noun with article when the language has none),
        __tests__/variants.test.ts, frenchPack/segmentedBank tests only if they assume the old state
        CONTEXT.md, tasks/TASK-073.md
```
`variants/zh.json`: ChineseBuddy, slug and scheme `chinesebuddy`, package `com.giamat90.chinesebuddy`, iOS `com.chinesebuddy`, background `#0F6B50`, version 1.0, fallback code 1.
`characters.json` is not imported by the app yet (TASK-075), so it adds nothing to the bundle.

## Tests (write first, watch them fail)
- `chineseBank.test.ts`: 50 entries with distinct words; every topic and stage present; reorder and cloze buildable for all; each `allow` word used; choice-tagged sentences have exactly one member word and a blank can be built with `testPackCjk`-style rule sets; characters table covers all and has no unused row.
- The QA suite with the new row (`test:app -- zh`) fails before the content exists.

## Definition of Done
- [x] Criteria checked; checks green; seams German
- [x] `CONTEXT.md` updated (machine-drafted, agent-checked, no human native review), status `done`. Commit only when asked. No store upload.
