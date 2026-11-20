import * as Speech from 'expo-speech';

/** What is read aloud for a word: the article is part of how a noun is learned. */
export function speechText(word: string, article: string | null): string {
  return article ? `${article} ${word}` : word;
}

export interface SpeechHandlers {
  onDone(): void;
  onStopped(): void;
  onError(e: unknown): void;
}

/** Speaks German with the phone's own TTS engine (no network code of ours). One utterance at a time. */
export function speakGerman(text: string, handlers: SpeechHandlers): void {
  Speech.stop();
  Speech.speak(text, {
    language: 'de-DE',
    rate: 0.9,
    onDone: handlers.onDone,
    onStopped: handlers.onStopped,
    onError: handlers.onError,
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}
