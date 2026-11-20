import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import { Alert } from 'react-native';
import TypedClozeView from '../src/components/exercises/TypedClozeView';
import SentenceReorderView from '../src/components/exercises/SentenceReorderView';
import FindMistakeView from '../src/components/exercises/FindMistakeView';
import WordDetailScreen from '../src/screens/WordDetailScreen';
import * as vaultService from '../src/services/vaultService';
import { useSpeechSettingsStore } from '../src/store/useSpeechSettingsStore';
import { t } from '../src/i18n';
import type { ReviewCard } from '../src/services/reviewService';

jest.mock('../src/services/vaultService');
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ id: 'w1' }),
}));

const sp = Speech as unknown as {
  __last(): { text: string } | null;
  __calls(): { text: string }[];
  __reset(): void;
  stop: jest.Mock;
};

const card: ReviewCard = {
  id: 'c1', word: 'Wasser', article: 'das', translationIt: 'acqua', translationEn: 'water',
  exampleDe: 'Ich trinke Wasser jeden Tag.', exampleIt: 'Bevo acqua ogni giorno.', exampleEn: 'I drink water every day.',
  cefrBand: 'A1', timesSeen: 1, retentionScore: 0.5,
};

beforeEach(() => {
  sp.__reset();
  useSpeechSettingsStore.getState().setAutoPlaySentence(false);
});

describe('typed cloze', () => {
  const model = { kind: 'typed_cloze' as const, card, before: 'Ich trinke ', after: ' jeden Tag.' };
  it('has no speaker before the answer, speaks the full sentence after', () => {
    const r = render(<TypedClozeView model={model} isRetry={false} onResult={() => {}} />);
    expect(r.queryByTestId('speak-sentence')).toBeNull();
    fireEvent.press(r.getByText(t('review_dont_know')));
    fireEvent.press(r.getByTestId('speak-sentence'));
    expect(sp.__last()!.text).toBe('Ich trinke Wasser jeden Tag.');
    expect(sp.__last()!.text).not.toContain('_');
  });
  it('auto-plays once on reveal only when the setting is on', () => {
    const r = render(<TypedClozeView model={model} isRetry={false} onResult={() => {}} />);
    fireEvent.press(r.getByText(t('review_dont_know')));
    expect(sp.__calls()).toHaveLength(0);
    r.unmount();
    useSpeechSettingsStore.getState().setAutoPlaySentence(true);
    const r2 = render(<TypedClozeView model={model} isRetry={false} onResult={() => {}} />);
    expect(sp.__calls()).toHaveLength(0); // nothing before the answer
    fireEvent.press(r2.getByText(t('review_dont_know')));
    expect(sp.__calls()).toHaveLength(1);
    expect(sp.__last()!.text).toBe('Ich trinke Wasser jeden Tag.');
  });
});

describe('sentence reorder', () => {
  const model = {
    kind: 'sentence_reorder' as const, card,
    tokens: ['Tag.', 'Ich', 'trinke', 'jeden', 'Wasser'], solution: ['Ich', 'trinke', 'Wasser', 'jeden', 'Tag.'],
  };
  it('speaks the solution only after the result', () => {
    const r = render(<SentenceReorderView model={model} isRetry={false} onResult={() => {}} />);
    expect(r.queryByTestId('speak-sentence')).toBeNull();
    fireEvent.press(r.getByText(t('review_dont_know')));
    fireEvent.press(r.getByTestId('speak-sentence'));
    expect(sp.__last()!.text).toBe('Ich trinke Wasser jeden Tag.');
  });
  it('auto-plays on reveal when enabled', () => {
    useSpeechSettingsStore.getState().setAutoPlaySentence(true);
    const r = render(<SentenceReorderView model={model} isRetry={false} onResult={() => {}} />);
    expect(sp.__calls()).toHaveLength(0);
    fireEvent.press(r.getByText(t('review_dont_know')));
    expect(sp.__last()!.text).toBe('Ich trinke Wasser jeden Tag.');
  });
});

describe('find the mistake', () => {
  const model = {
    kind: 'find_mistake' as const, card, mistakeKind: 'gender' as const, ruleCode: 'NOUN_GENDER',
    tokens: ['Ich', 'trinke', 'der', 'Wasser.'], wrongIndex: 2, correctToken: 'das',
    options: ['der', 'die', 'das'], correctOption: 2,
  };
  it('speaks the corrected sentence, never the wrong one, only when done', () => {
    const r = render(<FindMistakeView model={model} isRetry={false} onResult={() => {}} />);
    expect(r.queryByTestId('speak-sentence')).toBeNull();
    fireEvent.press(r.getByTestId('mistake-token-2'));
    expect(r.queryByTestId('speak-sentence')).toBeNull(); // step 2 not finished
    fireEvent.press(r.getByTestId('mistake-option-2'));
    fireEvent.press(r.getByTestId('speak-sentence'));
    expect(sp.__last()!.text).toBe('Ich trinke das Wasser.');
  });
  it('after a missed tap it still speaks the corrected sentence', () => {
    const r = render(<FindMistakeView model={model} isRetry={false} onResult={() => {}} />);
    fireEvent.press(r.getByTestId('mistake-token-0'));
    fireEvent.press(r.getByTestId('speak-sentence'));
    expect(sp.__last()!.text).toBe('Ich trinke das Wasser.');
  });
});

describe('word detail', () => {
  const word = {
    id: 'w1', word: 'Tisch', article: 'der', ipa: 'tɪʃ', partOfSpeech: 'noun',
    meaningIt: 'tavolo', meaningEn: 'table', exampleDe: 'Der Tisch ist groß.', exampleIt: 'Il tavolo è grande.', exampleEn: 'The table is big.',
    culturalNote: null, culturalNoteEn: null, cefrBand: 'A1', retentionScore: 0.5,
    nextReviewAt: new Date().toISOString(), timesSeen: 1, timesUsed: 0, firstSeenAt: new Date().toISOString(),
  };
  const insight = {
    examples: [{ de: 'Ein Tisch.', native: 'Un tavolo.' }, { de: 'Zwei Tische.', native: 'Due tavoli.' }],
    note: 'nota',
    exercise: { sentence: 'Das ist ein ___.', answer: 'Tisch' },
  };
  beforeEach(() => {
    (vaultService.fetchVaultWord as jest.Mock).mockResolvedValue(word);
    (vaultService.getWordInsight as jest.Mock).mockResolvedValue(insight);
  });

  it('example and AI examples have a button; a second sentence replaces the first', async () => {
    const r = render(<WordDetailScreen />);
    fireEvent.press(await r.findByTestId('speak-example'));
    expect(sp.__last()!.text).toBe('Der Tisch ist groß.');
    fireEvent.press(await r.findByTestId('speak-insight-0'));
    expect(sp.stop).toHaveBeenCalled();
    expect(sp.__last()!.text).toBe('Ein Tisch.');
    fireEvent.press(r.getByTestId('speak-insight-1'));
    expect(sp.__last()!.text).toBe('Zwei Tische.');
  });

  it('the AI exercise button appears only after the reveal and speaks the filled sentence', async () => {
    const r = render(<WordDetailScreen />);
    await r.findByTestId('speak-insight-0');
    expect(r.queryByTestId('speak-insight-exercise')).toBeNull();
    fireEvent.press(r.getByText(t('insight_exercise_reveal')));
    fireEvent.press(r.getByTestId('speak-insight-exercise'));
    expect(sp.__last()!.text).toBe('Das ist ein Tisch.');
  });

  it('never auto-plays on this screen, even with the setting on', async () => {
    useSpeechSettingsStore.getState().setAutoPlaySentence(true);
    const r = render(<WordDetailScreen />);
    await r.findByTestId('speak-example');
    fireEvent.press(r.getByText(t('insight_exercise_reveal')));
    expect(sp.__calls()).toHaveLength(0);
  });

  it('a failing engine alerts once', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const r = render(<WordDetailScreen />);
    fireEvent.press(await r.findByTestId('speak-example'));
    (Speech as unknown as { __fail(): void }).__fail();
    fireEvent.press(r.getByTestId('speak-insight-0'));
    (Speech as unknown as { __fail(): void }).__fail();
    await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
    alert.mockRestore();
  });
});

describe('word card and settings', () => {
  it('today\'s word card has a sentence button', () => {
    const WordCard = require('../src/components/ui/WordCard').default;
    const w = { id: 'd1', word: 'Tisch', article: 'der', ipa: 'tɪʃ', partOfSpeech: 'noun', meaningIt: 'tavolo', meaningEn: 'table',
      exampleDe: 'Der Tisch ist groß.', exampleIt: 'x', exampleEn: 'y', culturalNote: null, culturalNoteEn: null, cefrBand: 'A1' };
    const r = render(<WordCard word={w} saveState="idle" streakDays={1} onSave={() => {}} onSkip={() => {}} />);
    fireEvent.press(r.getByTestId('speak-example'));
    expect(sp.__last()!.text).toBe('Der Tisch ist groß.');
  });
});

describe('auto-play with a missing voice', () => {
  it('alerts only once across consecutive cards, not on every card', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { _resetSpeechAlertForTests } = require('../src/hooks/useSpeech');
    _resetSpeechAlertForTests();
    useSpeechSettingsStore.getState().setAutoPlaySentence(true);
    const model = { kind: 'typed_cloze' as const, card, before: 'Ich trinke ', after: ' jeden Tag.' };
    for (let i = 0; i < 3; i++) {
      const r = render(<TypedClozeView model={model} isRetry={false} onResult={() => {}} />);
      fireEvent.press(r.getByText(t('review_dont_know')));
      (Speech as unknown as { __fail(): void }).__fail();
      r.unmount();
    }
    expect(alert).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });
});
