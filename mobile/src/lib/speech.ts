import * as Speech from 'expo-speech';
import { getActivePack } from '../languages';

/** What is read aloud for a word: the article is part of how a noun is learned. */
export function speechText(word: string, article: string | null): string {
  return article ? `${article} ${word}` : word;
}

export interface SpeechHandlers {
  onDone(): void;
  onStopped(): void;
  onError(e: unknown): void;
}

/** Speaks the target language with the phone's own TTS engine (no network code of ours). One utterance at a time. */
export function speak(text: string, handlers: SpeechHandlers): void {
  const { locale, rate } = getActivePack().speech;
  Speech.stop();
  Speech.speak(text, {
    language: locale,
    rate,
    onDone: handlers.onDone,
    onStopped: handlers.onStopped,
    onError: handlers.onError,
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}
