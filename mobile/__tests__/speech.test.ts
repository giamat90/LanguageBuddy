import * as Speech from 'expo-speech';
import { speechText, speakGerman, stopSpeaking } from '../src/lib/speech';
import { allEntries } from '../src/data/wordbank';

const mock = Speech as unknown as { __last(): { text: string; opts: any } | null; __reset(): void; stop: jest.Mock };

describe('speech helper', () => {
  beforeEach(() => mock.__reset());

  it('prefixes the article', () => {
    expect(speechText('Tisch', 'der')).toBe('der Tisch');
  });

  it('speaks the bare word without an article', () => {
    expect(speechText('gehen', null)).toBe('gehen');
  });

  it('stops the previous utterance, then speaks German', () => {
    const order: string[] = [];
    mock.stop.mockImplementationOnce(() => { order.push('stop'); });
    const handlers = { onDone: jest.fn(), onStopped: jest.fn(), onError: jest.fn() };
    speakGerman('der Tisch', handlers);
    expect(order).toEqual(['stop']);
    expect(mock.__last()!.text).toBe('der Tisch');
    expect(mock.__last()!.opts.language).toBe('de-DE');
  });

  it('stopSpeaking calls the engine stop', () => {
    stopSpeaking();
    expect(mock.stop).toHaveBeenCalled();
  });

  it('every word of the bank gives non-empty text without control characters', () => {
    for (const { entry } of allEntries()) {
      const text = speechText(entry.word, entry.article ?? null);
      expect(text.trim().length).toBeGreaterThan(0);
      expect(/[\u0000-\u001f\u007f]/.test(text)).toBe(false);
    }
  });
});
