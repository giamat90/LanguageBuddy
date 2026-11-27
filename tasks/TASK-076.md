# TASK-076 — Measure words, particle drills, stage order, primer

**Status:** `in-progress` (implemented; phone check pending)
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-074 (design: TASK-070 §4.4–§4.6). TASK-070's gate (a week with the pilot) and TASK-075 were skipped on the Product Owner's request.

## Context
ChineseBuddy has no grammar practice, hands out words in random order and never explains pinyin.

## Scope
### In
Measure-word and choice drills (是/在/有, 吗/呢, 二/两, 不/没); the same two slots in "find the mistake"; daily words by `stage`; a pinyin-and-tones primer; two pinyin leaks found while designing.
### Out
Character layer (075), full bank (077), stroke order, new exercise formats.

## Design

### Pack (`languages/types.ts`)
```ts
export interface ClassifierSupport {
  rule: string;                        // 'MEASURE_WORD'
  number: string;                      // '一', written before the blank
  distractors: readonly string[];      // offered as wrong unless the noun lists them
  never: readonly string[];            // never offered as wrong: ['个']
  determiners: readonly string[];      // what may precede a measure word in a sentence
  readings: Readonly<Record<string, string>>;  // every measure word of the bank
}
export interface PrimerSection { id: string; examples: readonly { text: string; reading: string }[] }
// LanguagePack:
classifiers: ClassifierSupport | null;
primer: { sections: readonly PrimerSection[] } | null;
// ChoiceSupport gains: readings?: Readonly<Record<string, string>>
// ReadingSupport gains: citations: Readonly<Record<string, string>>   // { 一: 'yī', 不: 'bù' }
```
`null` for German, Spanish, French and the test packs. Chinese gets `choices` (rule sets `SHI_ZAI_YOU`, `QUESTION_PARTICLE`, `ER_LIANG`, `BU_MEI`), `classifiers` and `primer`.

### Drill (`lib/grammar.ts`, `grammarService.ts`, `GrammarScreen`)
- `buildMeasureQuestion(entry, rng, pack)`: a noun whose `measure` is set, not `none`, and has a reading. Sentence `一 ___ <noun>`; options = the measure word + 2 distractors outside `measure`, `measure_also`, `never`. Null when two cannot be found.
- Questions of a reading language carry `cells`, `blank` and `optionReadings`. Pinyin follows the reading-screen rule (shown unless "Only on tap", with **Show pinyin**); the blank never has it; no cap (mastery is right/wrong).
- `hasGrammarDrill` counts classifiers.

### Find the mistake
New `mistakeKind: 'measure'`: the card's noun directly preceded by one of its measure words, itself preceded by a determiner. The wrong form and the two other options are distractors outside the noun's list and `never`. Appended after the other kinds, so picks for other languages do not change. Tokens and options show pinyin by the exercise rule (peek caps at 0.6); the practice menu lists the format for a pack with classifiers.

### No tone leaks
一 and 不 are written as pronounced, so their pinyin tells the next word's tone. `neutralCells(cells, citations, at)` rewrites them to the citation form: in cloze and drill, the cell before the blank; in find-the-mistake and reorder, every such cell. The drill's own 一 is `yī`.

### Stage order (`data/dailyWord.ts`)
The seeded order is then sorted (stably) by `stage`. The next word is taken from the lowest stage with an unused word, a chosen topic first. `outsideTopics` stays true only when no unused word of the chosen topics is left in the level. Banks without stages behave as before.

### Primer (`/primer`, `PrimerScreen`)
Sections from the pack, texts from the overlay (`primer_title`, `primer_intro`, `primer_continue`, `primer_<id>_title`, `primer_<id>_text`); each example is a button that reads it aloud. Onboarding: welcome → primer (`/primer-intro`) → topics when the pack has a primer and no quiz. Later: a link on the Grammar screen to `/(app)/primer`, inside the app stack so the running drill is kept (the root layout is a `Slot`, which would remount it). Topics clears it from history as it does the quiz.

### Strings
Overlay only: `grammar_rule_<CODE>` for the five drilled codes, `grammar_prompt_measure`, primer keys. `requiredTargetKeys` asks for them when the pack has the capability.

## Technical Spec
```
Create  src/screens/PrimerScreen.tsx, app/primer-intro.tsx, app/(app)/primer.tsx
Modify  languages/{types,zh,de,es,fr,targetStrings}.ts, zh/strings/{it,en}.ts, test packs, test-support/appExpectations.ts
        lib/{grammar}.ts, lib/reading/{pinyin,ruby}.ts, lib/exercises/{types,mistake,practice}.ts
        services/{grammarService,reviewService}.ts, data/dailyWord.ts
        screens/{GrammarScreen,WelcomeScreen}.tsx, components/exercises/{FindMistake,TypedCloze,SentenceReorder}View.tsx
        CLAUDE.md (§3, §5, §6, §8, §9), CONTEXT.md
```

## Acceptance Criteria
- [ ] Chinese has a Grammar button, a drill with all five rules where the bank has sentences, and measure and choice slots.
- [ ] No drill or mistake question offers a second correct answer from the bank's own lists.
- [ ] No pinyin shown before an answer depends on the hidden form.
- [ ] The first daily words of a new install are stage 1.
- [ ] The primer appears once in onboarding and from Grammar.
- [ ] German, Spanish, French unchanged; all checks pass; German seams.

## Tests (write first)
`measureWords.test.ts` (builder, slot, bank property: every measure word has a reading; no distractor is acceptable), `stageOrder.test.ts`, `primer.test.tsx` (screen, onboarding route, grammar link), `grammarPinyin.test.tsx` (cells, citations, screen, mistake view), `activeApp` rows.

## Content
The primer texts and rule explanations are machine-drafted; native-agent check with TASK-077 (CLAUDE.md §14).
