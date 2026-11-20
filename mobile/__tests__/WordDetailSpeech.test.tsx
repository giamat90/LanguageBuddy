import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import WordDetailScreen from '../src/screens/WordDetailScreen';
import * as vaultService from '../src/services/vaultService';

jest.mock('../src/services/vaultService');
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ id: 'w1' }),
}));

const speechMock = Speech as unknown as { __last(): { text: string } | null; __reset(): void };

it('speaks article + word from the detail screen', async () => {
  speechMock.__reset();
  (vaultService.fetchVaultWord as jest.Mock).mockResolvedValue({
    id: 'w1', word: 'Tisch', article: 'der', ipa: 'tɪʃ', partOfSpeech: 'noun',
    meaningIt: 'tavolo', meaningEn: 'table', exampleDe: null, exampleIt: null, exampleEn: null,
    culturalNote: null, culturalNoteEn: null, cefrBand: 'A1', retentionScore: 0.5,
    nextReviewAt: new Date().toISOString(), timesSeen: 1, timesUsed: 0, firstSeenAt: new Date().toISOString(),
  });
  (vaultService.getWordInsight as jest.Mock).mockResolvedValue(null);
  const { findByTestId } = render(<WordDetailScreen />);
  fireEvent.press(await findByTestId('speak-detail'));
  expect(speechMock.__last()!.text).toBe('der Tisch');
});
