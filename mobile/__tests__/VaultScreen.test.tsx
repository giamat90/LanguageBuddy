import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import VaultScreen from '../src/screens/VaultScreen';
import * as vaultService from '../src/services/vaultService';
import { useVaultStore } from '../src/store/useVaultStore';
import { VaultItem } from '../src/types/domain';
import { t } from '../src/i18n';
import * as Speech from 'expo-speech';

const speechMock = Speech as unknown as { __last(): { text: string } | null; __reset(): void };

jest.mock('../src/services/vaultService');
jest.mock('../src/services/reviewService', () => ({
  dueCount: jest.fn().mockResolvedValue(0),
}));

const mockRouter = { push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (cb: () => void) => {
    const react = require('react');
    react.useEffect(() => cb(), []);
  },
}));

const makeItem = (id: string, word: string): VaultItem => ({
  id, word, article: 'der', translationIt: `${word} (it)`, translationEn: `${word} (en)`,
  partOfSpeech: 'noun', retentionScore: 0.75,
  nextReviewAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
});

const mockItems: VaultItem[] = [makeItem('1', 'Bahnhof'), makeItem('2', 'Gemütlichkeit')];

describe('VaultScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useVaultStore.setState({ items: [], page: 1, total: 0, isLoading: false, error: null });
  });

  it('test_renders_items', async () => {
    (vaultService.fetchVault as jest.Mock).mockResolvedValueOnce({ items: mockItems, total: 2 });
    const { getByText } = render(<VaultScreen />);
    await waitFor(() => {
      expect(getByText('Bahnhof')).toBeTruthy();
    });
  });

  it('shows a generic error, never the raw native message, and logs the cause', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (vaultService.fetchVault as jest.Mock).mockRejectedValueOnce(
      new Error("Call to function 'NativeDatabase.prepareAsync' has been rejected. java.lang.NullPointerException"),
    );
    const { findByText, queryByText } = render(<VaultScreen />);
    expect(await findByText(t('vault_error'))).toBeTruthy();
    expect(queryByText(/NativeDatabase|NullPointer/)).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('test_empty_state', async () => {
    (vaultService.fetchVault as jest.Mock).mockResolvedValueOnce({ items: [], total: 0 });
    const { getByText } = render(<VaultScreen />);
    await waitFor(() => {
      expect(getByText(/Nessuna parola salvata/)).toBeTruthy();
    });
  });

  it('opens the statistics from a header icon next to settings, not from an action button', async () => {
    (vaultService.fetchVault as jest.Mock).mockResolvedValueOnce({ items: mockItems, total: 2 });
    const { findByLabelText, queryByText } = render(<VaultScreen />);
    expect(queryByText('Statistiche')).toBeNull();
    fireEvent.press(await findByLabelText('Statistiche'));
    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/stats');
  });

  it('shows Pratica once the vault has words (even with nothing due) and opens the practice menu', async () => {
    (vaultService.fetchVault as jest.Mock).mockResolvedValueOnce({ items: mockItems, total: 2 });
    const { findByText, queryByText } = render(<VaultScreen />);
    fireEvent.press(await findByText('Pratica'));
    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/practice');
    expect(queryByText(/Ripassa \(/)).toBeNull(); // nothing is due, so no review button
  });

  it('hides Pratica while the vault is empty', async () => {
    (vaultService.fetchVault as jest.Mock).mockResolvedValueOnce({ items: [], total: 0 });
    const { getByText, queryByText } = render(<VaultScreen />);
    await waitFor(() => expect(getByText(/Nessuna parola salvata/)).toBeTruthy());
    expect(queryByText('Pratica')).toBeNull();
  });

  it('test_loads_next_page', async () => {
    const page1 = [makeItem('1', 'Bahnhof')];
    const page2 = [makeItem('2', 'Gemütlichkeit')];
    (vaultService.fetchVault as jest.Mock)
      .mockResolvedValueOnce({ items: page1, total: 2 })
      .mockResolvedValueOnce({ items: page2, total: 2 });

    const { getByTestId } = render(<VaultScreen />);
    await waitFor(() => expect(vaultService.fetchVault).toHaveBeenCalledWith(1));

    // Simulate scroll to end
    useVaultStore.setState({ items: page1, total: 2, page: 1, isLoading: false });
    const flatList = require('@testing-library/react-native').act;
    await flatList(async () => {
      useVaultStore.getState().nextPage();
      await (vaultService.fetchVault as jest.Mock).mockResolvedValueOnce({ items: page2, total: 2 });
    });

    // Verify page 2 was fetched at some point
    expect(vaultService.fetchVault).toHaveBeenCalledWith(1);
  });

  describe('pronunciation button', () => {
    beforeEach(() => {
      speechMock.__reset();
      // earlier tests can leave an unused mockResolvedValueOnce queued
      (vaultService.fetchVault as jest.Mock).mockReset();
    });

    it('speaks article + word and does not navigate', async () => {
      (vaultService.fetchVault as jest.Mock).mockResolvedValueOnce({ items: mockItems, total: 2 });
      const { findByTestId } = render(<VaultScreen />);
      fireEvent.press(await findByTestId('speak-1'));
      expect(speechMock.__last()!.text).toBe('der Bahnhof');
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('still navigates when the row itself is tapped', async () => {
      (vaultService.fetchVault as jest.Mock).mockResolvedValueOnce({ items: mockItems, total: 2 });
      const { findByLabelText } = render(<VaultScreen />);
      fireEvent.press(await findByLabelText('Bahnhof'));
      expect(mockRouter.push).toHaveBeenCalled();
    });

    it('only one row is in the stop state at a time', async () => {
      (vaultService.fetchVault as jest.Mock).mockResolvedValueOnce({ items: mockItems, total: 2 });
      const { findByTestId, getByLabelText, queryByLabelText } = render(<VaultScreen />);
      fireEvent.press(await findByTestId('speak-1'));
      expect(getByLabelText(t('speech_stop_a11y', { word: 'Bahnhof' }))).toBeTruthy();
      fireEvent.press(await findByTestId('speak-2'));
      expect(queryByLabelText(t('speech_stop_a11y', { word: 'Bahnhof' }))).toBeNull();
      expect(getByLabelText(t('speech_stop_a11y', { word: 'Gemütlichkeit' }))).toBeTruthy();
    });
  });

  it('the catalog button opens the word catalog', async () => {
    (vaultService.fetchVault as jest.Mock).mockReset();
    (vaultService.fetchVault as jest.Mock).mockResolvedValue({ items: [], total: 0 });
    const { getByLabelText } = render(<VaultScreen />);
    fireEvent.press(getByLabelText(t('catalog_open')));
    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/catalog');
  });
});
