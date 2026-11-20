# TASK-040 — Listen to whole sentences (examples, exercises, AI examples)

**Status:** `done` (phone check skipped by the PO; released as 1.0.20)
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-035 (word speech: `lib/speech.ts`, `useSpeech`, `SpeakButton`)

## Context
PO request: extend the 🔊 feature from single words to German sentences "for example in exercises or AI-generated examples". Same on-device Android TTS (`expo-speech`), no network code of ours, nothing new leaves the app (privacy policy already covers text handed to the phone's speech engine: it says "the single word"; **the wording must be widened to "a word or sentence"**, see Files).

## Scope
In (a sentence gets a speaker button wherever its German text is fully shown):
- **WordDetail:** the word's saved example (`exampleDe`) and each AI example (`insight.examples[i].de`); the AI exercise sentence only once its answer is revealed (blank filled with `answer`).
- **WordCard** (`components/ui/WordCard.tsx`, today's word): the example sentence.
- **Exercises, only after the learner has answered** (a button before would give the answer away or teach the wrong form):
  - typed cloze: full sentence `before + card.word + after`, shown with the result (exact/close/wrong/"don't know").
  - sentence reorder: `solution.join(' ')` once the result is shown.
  - find the mistake: the **corrected** sentence (wrong token replaced by `correctToken`), once the step is done. The wrong sentence is never spoken.
  - multiple choice, matching, flip-card: unchanged (word level, or no sentence).
- One utterance at a time across the screen (`useSpeech`), tapping the active one stops it; leaving a card/screen stops speech (hook cleanup already does).

- **Setting (PO approved):** Settings switch "Leggi la frase dopo la risposta" (default **off**). When on, the sentence is read automatically at the moment the answer is revealed in the three exercise formats. It never auto-plays in WordDetail/WordCard (tap only). Stored in its own MMKV store `speech-settings` (not part of backups; a preference).

Out: speed control (fixed 0.9 like words), voice choice, speaking the native-language text, a "listen to the sentence" exercise type, any bundled audio.

## Acceptance Criteria
- [ ] Speaker button next to each sentence listed above; absent before the answer in the three exercise formats; present right after.
- [ ] Text spoken is the clean sentence: no `___`, no markup, the corrected form for find-mistake; punctuation kept.
- [ ] Tapping starts, tapping again stops; starting another sentence/word replaces the current one; the icon follows (🔊/⏹).
- [ ] Buttons have `accessibilityRole="button"` and a sentence-specific label (`speech_sentence_play_a11y` / `speech_sentence_stop_a11y`), min 44x44 touch target, a `testID`.
- [ ] Grading, SRS, retries, session flow unchanged (buttons are not part of any result).
- [ ] The unavailable-voice alert (existing) appears once per screen on failure; no `e.message` shown.
- [ ] Auto-play switch in Settings (default off, `accessibilityLabel`); when on, the exercise sentence is spoken once when it is revealed; off = tap only.
- [ ] 13 languages (5 new keys); `tsc` clean; `npm test` green; no new dependency.
- [ ] `germanbuddy-support/privacy-policy.html` text-to-speech paragraph and table row say "word or sentence" (separate repo, PO approves the push).

## Technical Spec

### Files to create
```
mobile/src/lib/sentenceSpeech.ts          pure helpers (see below)
mobile/__tests__/sentenceSpeech.test.ts
mobile/__tests__/SentenceSpeech.test.tsx  views/screens behaviour
```
### Files to modify
```
mobile/src/components/ui/SpeakButton.tsx            optional `kind?: 'word'|'sentence'` (labels); keep props backward compatible
mobile/src/screens/WordDetailScreen.tsx             example, AI examples, revealed AI exercise
mobile/src/components/ui/WordCard.tsx               example (needs the speak state from its screen, or its own useSpeech)
mobile/src/components/exercises/TypedClozeView.tsx, SentenceReorderView.tsx, FindMistakeView.tsx
mobile/src/i18n/*.ts (13)                           4 keys
mobile/__tests__/uiStringsParity.test.ts            only if a key is identical across languages
germanbuddy-support/privacy-policy.html             widen wording
CONTEXT.md, CLAUDE.md §12 (scope: "text-to-speech of a word or sentence")
```
### Implementation notes
`lib/sentenceSpeech.ts` (pure, no I/O):
```ts
export function clozeSentence(before: string, word: string, after: string): string   // trims, collapses spaces
export function reorderSentence(solution: string[]): string                           // join(' ')
export function correctedSentence(tokens: string[], wrongIndex: number, correctToken: string): string
export function filledExercise(sentenceWithBlank: string, answer: string): string      // replaces the first "___"
```
- Each view/screen calls `useSpeech()` itself (ids like `sentence:example`, `sentence:ai-0`) and renders `<SpeakButton kind="sentence" word={sentence} …/>`; `word` is only used in the a11y label so pass a short form for sentences? **No:** sentence labels do not include the text (`speech_sentence_play_a11y`: "Ascolta la frase"), so the label stays short for screen readers.
- Exercise views show the button only when their result state is non-null (cloze `result !== null`, reorder `result` set, find-mistake `done`).
- Keep views state-driven; no timers.

i18n (it.ts):
```
speech_sentence_play_a11y: "Ascolta la frase"
speech_sentence_stop_a11y: "Ferma la lettura della frase"
```
`settings_speech_section` "Pronuncia", `settings_speech_autoplay` "Leggi la frase dopo la risposta", `settings_speech_autoplay_hint` "Negli esercizi la frase corretta viene letta ad alta voce appena vedi il risultato" (5 keys in total with the two above). They differ from Italian in every other language, so no whitelist is needed.

## Tests (write first, watch them fail)
- `sentenceSpeech.test.ts`: cloze joins without double spaces; reorder join; corrected sentence replaces exactly the wrong index and keeps punctuation; filled exercise replaces only the first `___`; none returns text containing `___`.
- `SentenceSpeech.test.tsx` (expo-speech mock): cloze — no `speak-sentence` button before answering, present after typing an answer and after "Non lo so", pressing it calls `Speech.speak` with `before word after`; reorder — absent, then present after the result, speaks the solution; find-mistake — absent until done, speaks the corrected sentence (never the wrong token); WordDetail — example and 3 AI examples each have a button, speaking one then another stops the first (`Speech.stop` before the second `speak`); AI exercise button appears only after reveal and speaks the filled sentence; WordCard example button; unavailable voice alerts once; unmount stops speech.
- Guard check: make the cloze button show before the answer and confirm its test goes red.

## Definition of Done
- [ ] Criteria checked; tests written first; checked on the phone (screenshots: one exercise after answering, WordDetail with AI examples)
- [ ] `CONTEXT.md` (new test count, TASK-040 row), `CLAUDE.md` §12 updated; commit `feat(TASK-040): listen to whole sentences`
- [ ] Privacy-policy wording pushed in `germanbuddy-support/` after PO OK

## Notes for Tech Lead (remove before handing over)
- Rejected: buttons before the answer (leak or teach the error); auto-play (surprising in public places, needs a setting); a dedicated listening exercise (own task, needs new quality ceilings).
- Open question for the PO (default chosen: tap only): auto-play the sentence when the answer is revealed, behind a Settings switch.
