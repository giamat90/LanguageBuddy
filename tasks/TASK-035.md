# TASK-035 — Listen to a word's pronunciation from the vault

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** none

## Context
User story: "As a user I want to listen to the pronunciation of a word in my vocabulary list by tapping a button."
Today the learner only sees the IPA. CLAUDE.md §12 lists "voice/TTS/STT" as out of scope; this task deliberately lifts **text-to-speech only** (no microphone, no STT)
and uses the phone's own Android TTS engine through `expo-speech`. No audio files are bundled and our code makes no network call.

## Scope
In:
- Dependency `expo-speech` (`npx expo install expo-speech`, SDK 53 → `~13.1.x`). It is a native module: the next build must be a fresh `expo prebuild` + build.
- A small pure/thin helper `lib/speech.ts` that speaks German text and can stop it.
- A speaker button on each **vault row** (`VaultScreen`) and on **`WordDetailScreen`** (next to the IPA). Tapping speaks the word with its article ("der Tisch"); tapping again while speaking stops it.
- One utterance at a time: starting a new one stops the previous one. Leaving the screen (blur/unmount) stops speech.
- If speaking fails or no German voice is available: a generic i18n message, never the engine's text.
- i18n keys in all 13 languages; CLAUDE.md and privacy-policy wording updated (see below).

Out:
- Speaking example sentences, speech on Today's word card, in exercises, or auto-play (follow-ups; the helper is built to be reused).
- Speech-rate/voice settings, STT, bundled recordings, any network/cloud TTS of our own.
- Installing a German voice for the user (we only point them to the Android setting in the message).

## Acceptance Criteria
- [ ] Every vault row shows a speaker button; tapping it speaks `"<article> <word>"` (just `<word>` when `article` is null) with language `de-DE`; it does **not** navigate to the word detail.
- [ ] The same button exists on `WordDetailScreen` beside the IPA and speaks the same text.
- [ ] While an utterance is playing the button shows the "stop" state (different icon + label); tapping it stops playback. Only one row is in the playing state at any time.
- [ ] Tapping a second word while the first is playing stops the first and plays the second.
- [ ] Leaving the vault / detail screen stops playback.
- [ ] On engine error or no German voice, an `Alert` with generic text (`speech_unavailable_title/body`) appears; nothing from the error is shown; `console.error('[Speech] …')` logs the cause (without learner content beyond the word).
- [ ] Double tap does not queue two utterances.
- [ ] The speaker button has `accessibilityRole="button"` and a label that includes the word (`speech_play_a11y`, `speech_stop_a11y`), and a `testID`.
- [ ] All new keys exist with the same `%{}` placeholders in all 13 files (`uiStringsParity.test.ts` green).
- [ ] `npx tsc --noEmit` clean, `npm test` green, `CONTEXT.md` updated.

## Technical Spec

### Files to create
```
mobile/src/lib/speech.ts                    — German TTS helper (the only importer of expo-speech)
mobile/src/hooks/useSpeech.ts               — React hook: { speakingId, toggle(id, text) }, stops on unmount
mobile/src/components/ui/SpeakButton.tsx    — presentational speaker button
mobile/__mocks__/expo-speech.js             — in-memory mock (see Tests); register in package.json jest moduleNameMapper like expo-notifications
mobile/__tests__/speech.test.ts, useSpeech.test.tsx, SpeakButton.test.tsx
```

### Files to modify
```
mobile/package.json                         — expo-speech dependency; moduleNameMapper "^expo-speech$": "<rootDir>/__mocks__/expo-speech.js"
mobile/src/screens/VaultScreen.tsx          — SpeakButton in VaultRow; useSpeech in the screen; stop on blur
mobile/src/screens/WordDetailScreen.tsx     — SpeakButton next to the IPA
mobile/src/i18n/*.ts (13)                   — new keys (it.ts is the source)
mobile/__tests__/VaultScreen.test.tsx       — new cases
CLAUDE.md                                   — §1/§3/§12: TTS (on-device, expo-speech) is in scope; STT and bundled audio stay out. §9: "no network APIs outside lib/ai/" unchanged — expo-speech is local.
CONTEXT.md                                  — same push
germanbuddy-support/                        — privacy policy: word is read aloud by the device's own text-to-speech engine; the app sends nothing. (Separate repo; PO publishes — do not push it.)
```

### Implementation notes

**`lib/speech.ts`**
```ts
import * as Speech from 'expo-speech';

export function speechText(word: string, article: string | null): string {
  return article ? `${article} ${word}` : word;
}

/** Resolves when the utterance ends or is stopped; rejects with SpeechUnavailableError on engine error. */
export function speakGerman(text: string, handlers: { onDone(): void; onStopped(): void; onError(e: unknown): void }): void {
  Speech.stop();                                    // one at a time
  Speech.speak(text, { language: 'de-DE', rate: 0.9, onDone: handlers.onDone, onStopped: handlers.onStopped, onError: handlers.onError });
}
export function stopSpeaking(): void { Speech.stop(); }
```
- Rate 0.9 (slightly slower than default) is fixed, not a setting.
- `Speech.speak` does not throw for a missing voice on Android; it calls `onError`. Treat `onError` as "unavailable".
- Do not call `Speech.getAvailableVoicesAsync()` or `isSpeakingAsync()`; state lives in the hook (the `onDone/onStopped/onError` callbacks clear it).

**`hooks/useSpeech.ts`**
- State: `speakingId: string | null`. `toggle(id, text)`: if `speakingId === id` → `stopSpeaking()`, set null. Otherwise set `speakingId = id` and call `speakGerman`; the callbacks set it back to null **only if it is still this id** (guards against the stopped-callback of the previous utterance clearing the new one — Android fires `onStopped` for the old utterance after the new `speak`).
- `onError`: set null, `console.error('[Speech] failed:', e)`, show `Alert.alert(t('speech_unavailable_title'), t('speech_unavailable_body'))`. Show it at most once per mount (a ref flag) so a list of failures does not spam.
- Ignore `toggle` while the same id was tapped within the same tick (use the functional state/ref, not a timer).
- `useEffect` cleanup → `stopSpeaking()`. In `VaultScreen` also stop in the `useFocusEffect` cleanup (screen stays mounted under the stack when navigating to detail).

**`SpeakButton`**: props `{ word: string; speaking: boolean; onPress(): void; testID?: string }`. A `TouchableOpacity` 44×44 (use `hitSlop` rather than visible size), glyph `🔊` / `⏹` as in the existing header buttons (no icon library is installed — do not add one). `accessibilityLabel = t(speaking ? 'speech_stop_a11y' : 'speech_play_a11y', { word })`. Place it in `rowRight` above/beside the review chip in `VaultRow`; since it is a sibling of the row's touchable content, the tap must not trigger row navigation (make the row a `View` containing the main `TouchableOpacity` and the button, or stop propagation — choose the former, it is the more robust on RN).

**i18n keys** (`it.ts` text, translate the rest):
```
speech_play_a11y:         "Ascolta la pronuncia di %{word}"
speech_stop_a11y:         "Ferma la pronuncia di %{word}"
speech_unavailable_title: "Audio non disponibile"
speech_unavailable_body:  "Il telefono non riesce a leggere il tedesco. In Impostazioni di Android > Sistema > Lingua e input > Sintesi vocale installa una voce tedesca, poi riprova."
```

**Edge cases**: article is `die` etc. — spoken as is. Words with `/` or parentheses in the bank (check `speechText` over the real word bank in a property test: non-empty, no control characters). Muted/ringer: TTS follows the media volume; no handling needed.

**Privacy**: nothing leaves the device from our code. Note for the PO (Data safety form): Android's TTS engine (usually Google's) is the device's own component; it may use its own network voices — that is the OS, not the app, and not declared by us.

## Tests (write first, watch them fail)

`__mocks__/expo-speech.js`: `speak(text, opts)` records `{text, opts}` and exposes `__last()`, `__finish()` (calls `onDone`), `__fail()` (calls `onError`), `stop()` (calls the last utterance's `onStopped`, then clears), `__reset()`.

- `speech.test.ts`: `speechText('Tisch','der') === 'der Tisch'`; null article → bare word; `speakGerman` calls `stop` before `speak`, passes `language: 'de-DE'`; property test over the whole word bank → `speechText` non-empty and no control chars.
- `useSpeech.test.tsx`: toggle sets `speakingId`; `__finish` clears it; toggling the same id stops; toggling another id stops the first and the **late `onStopped` of the first does not clear the second**; `__fail` clears state, calls `console.error` and `Alert.alert` once, a second failure shows no second alert; unmount stops speech.
- `SpeakButton.test.tsx`: label switches between play/stop with the word interpolated; `onPress` fires; role `button`.
- `VaultScreen.test.tsx`: tapping the speaker on a row calls `Speech.speak` with `"der Tisch"` and does **not** call `router.push`; tapping the row still navigates; only one row shows the stop state at a time.
- `WordDetailScreen` test: the button exists next to the IPA and speaks `"article word"`.
- `uiStringsParity.test.ts` (existing) must pass with the 4 new keys.
- Guard check: remove the "only if still this id" condition once and confirm the race test goes red.

## Definition of Done
- [ ] All acceptance criteria checked, specified tests written first and green
- [ ] No hard-coded UI strings; no new icon library
- [ ] `expo-speech` imported only in `lib/speech.ts`
- [ ] Review checklist (CLAUDE.md §13) walked through: double taps, stale state across rapid taps, long vault (row re-renders: `VaultRow` should be `React.memo`-safe — pass `speaking` as a boolean prop, not the whole hook state), no unneeded files
- [ ] Conventional commit: `feat(TASK-035): listen to a word's pronunciation from the vault`
- [ ] Status set to `done`; `CONTEXT.md` notes that the next build needs `expo prebuild` (new native module) and bumps `LOCAL_FALLBACK_VERSION_CODE` after checking the highest versionCode on Play

## Notes for Tech Lead (remove before handing over)
- Rejected: bundled audio recordings (2,194 words × size, licensing, no voice for examples later); cloud TTS (violates the offline/no-network rule and needs a privacy change); a settings screen for voice/rate (YAGNI).
- Quality caveat to tell the PO: pronunciation quality depends on the German voice installed on the phone; most Android devices have one, a few need a download — hence the explanatory alert.
- Natural follow-up: speak the example sentence and the today word with the same hook/button.
