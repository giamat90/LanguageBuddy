import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import WordCardScreen from '../src/screens/WordCardScreen';
import * as wordService from '../src/services/wordService';
import { useWordStore } from '../src/store/useWordStore';
import { DailyWord } from '../src/types/domain';

jest.mock('../src/services/wordService');
const mockRouter = {
  push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true),
};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

const mockWord: DailyWord = {
  id: '1', word: 'Gemütlichkeit', article: 'die', partOfSpeech: 'noun',
  ipa: 'ɡəˈmyːtlɪçkaɪt', meaningIt: 'accoglienza, calore', meaningEn: 'coziness',
  exampleDe: 'Das Café hat eine tolle Gemütlichkeit.',
  exampleIt: 'Il caffè ha una grande accoglienza.',
  exampleEn: 'The café has a great coziness.',
  culturalNote: 'Un concetto tedesco intraducibile.',
  culturalNoteEn: 'An untranslatable German concept.',
  grammarAngle: 'NOUN_GENDER', topicDomain: 'culture', cefrBand: 'B2',
  date: '2026-05-08', isSaved: false,
};

describe('WordCardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useWordStore.setState({ word: null, saveState: 'idle', isLoading: false, error: null, streakDays: 0 });
  });

  it('test_renders_word', async () => {
    (wordService.fetchTodayWord as jest.Mock).mockResolvedValueOnce(mockWord);
    const { getByText } = render(<WordCardScreen />);
    await waitFor(() => {
      expect(getByText('Gemütlichkeit')).toBeTruthy();
    });
  });

  it('test_save_transitions_to_saved', async () => {
    (wordService.fetchTodayWord as jest.Mock).mockResolvedValueOnce(mockWord);
    (wordService.saveWord as jest.Mock).mockResolvedValueOnce({ streak_days: 3, already_saved: false });

    const { getByText } = render(<WordCardScreen />);
    await waitFor(() => expect(getByText('Gemütlichkeit')).toBeTruthy());

    fireEvent.press(getByText('Salva la parola'));
    await waitFor(() => {
      expect(getByText('Salvata')).toBeTruthy();
    });
  });

  it('test_empty_state', async () => {
    const err = new Error('404');
    (wordService.fetchTodayWord as jest.Mock).mockRejectedValueOnce(err);

    const { getByText } = render(<WordCardScreen />);
    await waitFor(() => {
      expect(getByText('Qualcosa è andato storto. Riprova.')).toBeTruthy();
    });
  });
});
