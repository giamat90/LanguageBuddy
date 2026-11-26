# TASK-070 — ChineseBuddy: learning design and roadmap (A1; Italian and English)

**Status:** `ready` (design; the Product Owner accepted the §2 defaults with "go on" on 2026-11-26. Split into TASK-071 …; TASK-071 is written)
**Assigned to:** nobody yet (planning only)
**Written by:** Tech Lead
**Depends on:** none

## Context
Chinese is the next language of the family. First version: **A1 only**, interface and word meanings in **Italian and English only**. The open question: is "a word a day" still right, or should the app be driven by characters?

## 1. Answer: word first, character aware

The **word stays the unit** that is shown daily, saved, scheduled and graded. **Characters become a second layer, derived from the words**, visible on every card, trained by dedicated exercises and counted in the statistics. There is no second SRS.

| Option | What it means | Verdict |
|---|---|---|
| A. Words only, pinyin added | The French app with another script | Cheap, but learners read the pinyin and skip the characters |
| **B. Words + character layer** | A, plus decomposition, pinyin that fades, character and tone exercises, character progress | **Recommended** |
| C. Character driven | Character is the daily item and SRS unit; words hang off it | New data model for vault, catalog, stats, backup; teaches shapes before usage |

Why B:
- A character is one syllable with a form, a sound and usually a meaning; a word is what is said and understood. A word's meaning is often not the sum of its characters (东西 "thing", not "east-west").
- Characters pay off through reuse: 电 (electricity) opens 电脑, 电话, 电视, 电影. A card that shows this teaches four words' worth of structure.
- At A1 the two approaches overlap: many beginner words are single characters (我, 人, 大, 好, 书).
- A 2024 study with beginner learners (Chen, Xu, Perfetti) found that teaching characters (pronunciation) together with words (meaning) matched word-only teaching on word learning and did better on character pronunciation and on learning new words. One study, so supporting evidence, not proof.
- B keeps one codebase and the schedule untouched. Option C can still be added later (the character data would already exist).

## 2. Decisions for the Product Owner (defaults apply unless changed)

| # | Question | Default |
|---|---|---|
| 1 | Learning unit | Option B |
| 2 | What "A1" covers | HSK 1 of the 2025 syllabus as the coverage reference: ≈300 words, ≈250 characters (≈10 months of daily words; other apps have 311–375 words at A1). Alternative: a European list (EBCL A1, 320 characters) |
| 3 | Handwriting | None in v1. Recognising and picking characters only. Stroke order in a later version |
| 4 | Typed pinyin | Hanzi or fully correct pinyin = 1.0; correct syllables with **no** tones = 0.7 (like a missing accent); a **wrong** tone = wrong, with a message saying so |
| 5 | Variety | Mainland Mandarin, simplified characters only |
| 6 | Identity (the package name is permanent once on Play) | ChineseBuddy, `com.giamat90.chinesebuddy`, code `zh`, jade green (red belongs to SpanishBuddy), icon: word card with 字, no flag |

Assumed: "Italian and English" means `uiLanguages: ['it','en']`; there is no other translation table.

## 3. Scope of v1
**In:** A1 bank; pinyin layer; character layer; tone choice and character picking; pinyin input; measure words; particle drills; pinyin and tones primer; A1-only support in the engine.
**Out:** A2+, other UI languages, handwriting, stroke-order animation, a listening format (v1.1), traditional characters, a separate character SRS, speech recognition.

## 4. Learning design

### 4.1 Word card
```
一台电脑                       measure word
电脑                    [speak]
diànnǎo
computer

CHARACTERS
电  diàn  electricity     also in: 电话 · 电视 · 电影
脑  nǎo   brain           contains 月 (flesh, body)

EXAMPLE
他(tā) 有(yǒu) 一(yì) 台(tái) 电脑(diànnǎo)。      [speak]
He has a computer.
```
Pinyin sits above each word of the sentence (a wrapping row of two-line cells; React Native has no ruby text).

### 4.2 Pinyin fades as the word matures
Setting "Pinyin": **Automatic** (default) · Always · Only on tap.
- Reading screens (card, detail, catalog, vault): shown.
- Exercises, Automatic: `new` tier shows it; `learning` and `strong` hide it behind a tap. A tap is a hint: quality capped at 0.6 (the existing hint rule), so a word that still needs pinyin comes back sooner.
- Never shown for the target where it would give away the answer.

This is where the app becomes symbol driven: gradually, per word.

### 4.3 Character layer
- Per character: readings, meaning (it, en), components, look-alikes, optional memory trick.
- "Also in": computed from the bank.
- Statistics: "characters met / known" out of the A1 set, derived from the vault (known = in a mastered word). No new table.
- Components are facts. A story is labelled as a memory trick, never presented as etymology.

### 4.4 Exercises
| Format | Tiers | Ceiling | For Chinese |
|---|---|---|---|
| Multiple choice (hanzi ↔ meaning) | new | 0.8 | pinyin by tier |
| Matching | new | 0.7 | unchanged |
| **Tone choice** (new): hear or see the word, pick the pinyin | new | 0.8 | wrong options change one tone; never another valid reading |
| Sentence reorder | learning, strong | 0.9 | tiles are the data's word segments |
| Find the mistake | learning, strong | 0.9 | measure word and particle slots |
| Typed cloze | learning, strong | 1.0 | type pinyin (`v` = ü, tone marks or numbers) or hanzi; hint = first initial + syllable count |
| **Pick the characters** (new): meaning and audio, tap the characters among look-alikes | learning, strong | 0.9 | the way to produce the written form without a Chinese keyboard (大 / 太 / 天) |
| Flip card | fallback | as today | pinyin on the back |

Tone choice is new-tier only so that a clean answer never lowers a score. Both new formats get practice-menu entries.

### 4.5 Grammar
- **Measure words** take the place of the article drill: 一 __ 书 (本 / 张 / 件). 个 is never offered as a wrong answer (often acceptable), nor is any form listed as also correct for that noun.
- **Choice rules** (existing mechanism): `SHI_ZAI_YOU` 是/在/有, `QUESTION_PARTICLE` 吗/呢, `ER_LIANG` 二/两, `BU_MEI` 不/没. Exactly one member per tagged sentence, only where one answer is right; capped like the Spanish rules.
- Metadata tags: `MEASURE_WORD, QUESTION_WORDS, DE_POSSESSIVE, ADJ_HEN, LE_COMPLETION, MODAL_VERBS, PROGRESSIVE_ZAI, NUMBERS_TIME, WORD_ORDER`.

### 4.6 Onboarding and order
- One level: the level quiz is skipped. A short **Pinyin and tones** primer takes its place (four tones and the neutral tone, the initials hard for Italian and English speakers, tap to hear example characters); reachable later from Grammar.
- Daily word order: random order would put 图书馆 on day 1. Each word gets a `stage` (1–4); the next word comes from the lowest unfinished stage, chosen topics first, shuffled per install.

## 5. What the code does with Chinese today (read, not run)

| Finding | Where | Effect |
|---|---|---|
| A language needs all six levels | `mobile/scripts/lib/active-language.mjs:26` | An A1-only app cannot be activated |
| The quiz can assign A2–B2; an empty level has no `ordered[0]` | `QuizScreen.tsx:29`, `dailyWord.ts:73` | Crash on the word of the day |
| Sentences are split on letter runs and spaces | `cloze.ts:27`, `grammar.ts:32`, `reorder.ts:14`, `mistake.ts:63` | Unspaced Chinese: reorder and find-the-mistake never build, cloze cannot match the word; learned words get mostly flip cards |
| Nouns must have an article; with example rules on, a sentence must start upper-case and end in `. ? !` | `validate-wordbank.mjs:195`, `:90` | Chinese nouns and sentences rejected |
| Fixed 14 TSV columns | `build-wordbank.mjs:33` | No place for segments, measure word, stage |
| The typed hint shows the first character | `TypedClozeView.tsx:35` | Gives away half the answer |
| An unoffered phone language that the family knows (fr, es, zh …) falls back to **Italian** | `language.ts:70` | With two UI languages, those phones start in Italian instead of English |
| All six levels listed | `filterSections.ts:20`, `stats.ts:75` | Empty A2–C2 rows |
| Pronunciation is wrapped in `/ /` | `WordHero.tsx:22` | Wrong for pinyin |
| Six levels and five quiz questions assumed by tests | `appExpectations.ts`, `targetStrings.ts` | The QA suite needs to read the pack's levels |

What comes free:
- Italian and English are **base columns** of the bank: **no translation pipeline** (the other apps carry 10–11 tables).
- Review cards and word screens can look up the bank by word, so segments and characters need **no database migration and no backup format change**.
- Scheduling, streak, backup, reminders and the AI plumbing are unchanged. No new permission, nothing new leaves the device.

## 6. Technical direction (details belong to each task)
- **Pack capabilities**, `null` for the other languages, no `if (code === 'zh')`: `levels`; `reading` (pinyin grading, tone variants); `classifiers`; sentence segmentation and joiner (`''`); characters.
- **Segmentation comes from the data**, never guessed on the phone. One function returns a sentence's parts (the same shape `split(pack.letters)` gives today) and replaces the split at the call sites above.
- **Bank format:** the 14 columns stay; the `ipa` column holds the word's pinyin (no rename, no DB change; the pack says how to show it). `example` is written segmented (`他|有|一|台|电脑|。`). Extra columns declared in `language.json`: `example_pinyin`, `measure`, `measure_also`, `stage`. The build joins the sentence and keeps the segments.
- **`characters.tsv`** (≈250 rows) → generated `characters.json`, exposed through the wordbank seam (empty for other languages).
- **Validator** (config driven), which catches the likeliest machine-drafting errors: one pinyin syllable per character (erhua excepted); each syllable is a reading of its character (neutral tone and 一/不 sandhi allowed); segments rebuild the sentence and contain the headword exactly once; sentences use A1 headwords plus a small allowlist; every character has a row; nouns have a listed measure word; 4–10 words ending in 。？！; one entry per written form.
- **One entry per written form** (长 cháng / zhǎng): `vocabulary_items.word` is unique and lookups are by word. The note mentions the other reading.
- **Pinyin spelling:** written by word (péngyou); 一 and 不 marked as pronounced (yì, bú), both spellings accepted when typed.
- **Strings:** features only Chinese shows go in the pack overlay (it, en) with a test that requires them, not in all 13 shared files.
- Catalog and lists sort by **pinyin from the bank**, not by the device's collator. Speech `zh-CN`, rate ≈0.8. The AI prompt asks for simplified characters and pinyin.

## 7. Content (A1)
- ≈300 words and their characters. The HSK list is a coverage reference only (check it against the official syllabus); meanings, examples and notes are written for this app. The listing claims no HSK affiliation. HSK ↔ CEFR is approximate.
- Character readings are checked against Unihan (Unicode licence), downloaded by hand and gitignored like the frequency lists. No CC-CEDICT text (share-alike). Later stroke data (Hanzi Writer, Arphic Public License) needs its licence file and a NOTICE entry.
- Machine drafted → validator → native-agent checks (CLAUDE.md §14) → **human native reader before the Play release**.

## 8. Roadmap

| Task | Content | Size | Needs |
|---|---|---|---|
| 071 | Engine: partial levels, skip quiz, segmented sentences, phone-language fallback, a Chinese-like test pack; German, Spanish, French unchanged | M | — |
| 072 | Chinese pack (draft), strings it/en, bank and character formats, validator rules | M | 071 |
| 073 | **Pilot:** 50 words and their characters; draft flag removed and a minimal variant so it runs on a phone | S | 072 |
| 074 | Pinyin layer: display, fading, typed pinyin, tone choice | M | 073 |
| 075 | Character layer: card section, statistics, pick the characters | M | 073 |
| — | **Gate:** the Product Owner uses the pilot for about a week; adjust fading, formats, order | — | 074, 075 |
| 076 | Measure words, particle drills, stage order, primer | M | gate |
| 077 | Full A1 bank and characters with native-agent checks | L | gate |
| 078 | Variant, icon, palette, store (it, en), QA row, CI, QA checklist, CLAUDE.md | S | 076, 077 |
| 079 | Owner: native Chinese reader, phone QA, support site, Play app | — | 078 |

The pilot comes before the full bank because a format change after 300 rows is expensive.

## 9. Risks (phone QA unless noted)
- A phone may lack a Chinese TTS voice; detect it and say how to install one. A single character with two readings may be spoken with the wrong one.
- Playfair and Inter have no hanzi (system fallback expected): check glyphs, line height and tone marks (ǚ, ǜ) in both fonts.
- Content: Italian notes about Chinese are the part no validator can check.
- "Only comprehensible sentences" is hard with 300 words; the pilot shows how large the allowlist must be.

## Sources (checked 2026-11-26)
- HSK 2025 syllabus (third party): https://mandarinmosaic.com/blog/hsk-3-0-changes — HSK 1: 300 words, 246 characters, no separate handwriting list; first new-format exam reported for 2026-12-13. Verify on the official site.
- EBCL A1 character list (320, from search results; the repository page did not load): https://refubium.fu-berlin.de/handle/fub188/15346
- Chen, Xu, Perfetti, *Bilingualism: Language and Cognition* 28(4), abstract: https://doi.org/10.1017/S1366728924000920
- Hanzi Writer licence: https://hanziwriter.org/license.html
