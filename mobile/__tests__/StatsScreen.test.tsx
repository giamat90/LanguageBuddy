import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import StatsScreen from '../src/screens/StatsScreen';
import * as statsService from '../src/services/statsService';
import { computeStats } from '../src/lib/stats';
import { WORD_BANK } from '../src/data/wordbank';
import { t } from '../src/i18n';

jest.mock('../src/services/statsService');
const mockRouter = { push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

const fetchStats = statsService.fetchStats as jest.Mock;

const foodWord = WORD_BANK.A1.find((e) => e.topic_domain === 'food')!.word;
const snapshot = (rows: Parameters<typeof computeStats>[0], streakDays = 4) => ({
  ...computeStats(rows, { total: 10, correct: 7 }),
  streakDays,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('StatsScreen', () => {
  it('shows the totals, accuracy and streak', async () => {
    fetchStats.mockResolvedValueOnce(snapshot([
      { word: foodWord, retentionScore: 0.9, timesSeen: 6 },
      { word: WORD_BANK.A1[1].word, retentionScore: 0.5, timesSeen: 1 },
    ]));
    const { getByTestId, getByText } = render(<StatsScreen />);
    await waitFor(() => expect(getByTestId('stats-saved').props.children).toBe(2));
    expect(getByTestId('stats-mastered').props.children).toBe(1);
    expect(getByTestId('stats-new').props.children).toBe(1);
    expect(getByTestId('stats-learning').props.children).toBe(0);
    expect(getByTestId('stats-streak').props.children).toBe(4);
    expect(getByText('70%')).toBeTruthy();
    expect(getByText(t('stats_by_topic'))).toBeTruthy();
    expect(getByText(t('stats_by_level'))).toBeTruthy();
  });

  it('shows saved against available words for each topic', async () => {
    fetchStats.mockResolvedValueOnce(snapshot([{ word: foodWord, retentionScore: 0.9, timesSeen: 6 }]));
    const { getByTestId } = render(<StatsScreen />);
    await waitFor(() => expect(getByTestId('stats-topic-food')).toBeTruthy());
    const foodTotal = Object.values(WORD_BANK).flat().filter((e) => e.topic_domain === 'food').length;
    expect(getByTestId('stats-topic-food-count').props.children).toBe(t('stats_progress', { saved: 1, total: foodTotal }));
  });

  it('shows an empty state and no breakdown when nothing is saved', async () => {
    fetchStats.mockResolvedValueOnce(snapshot([], 0));
    const { getByText, queryByTestId } = render(<StatsScreen />);
    await waitFor(() => expect(getByText(t('stats_empty'))).toBeTruthy());
    expect(queryByTestId('stats-topic-food')).toBeNull();
  });

  it('shows a generic error (never the raw message) and can retry', async () => {
    fetchStats.mockRejectedValueOnce(new Error('SQLITE_CORRUPT secret detail'));
    const { getByText, queryByText } = render(<StatsScreen />);
    await waitFor(() => expect(getByText(t('stats_error'))).toBeTruthy());
    expect(queryByText(/SQLITE_CORRUPT/)).toBeNull();
    expect(console.error).toHaveBeenCalled();

    fetchStats.mockResolvedValueOnce(snapshot([{ word: foodWord, retentionScore: 0.9, timesSeen: 6 }]));
    fireEvent.press(getByText(t('vault_retry')));
    await waitFor(() => expect(queryByText(t('stats_error'))).toBeNull());
  });

  it('goes back', async () => {
    fetchStats.mockResolvedValueOnce(snapshot([]));
    const { getByLabelText } = render(<StatsScreen />);
    fireEvent.press(getByLabelText(t('nav_back')));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('opens the word list for each widget, topic and level', async () => {
    fetchStats.mockResolvedValueOnce(snapshot([{ word: foodWord, retentionScore: 0.9, timesSeen: 6 }]));
    const { getByTestId } = render(<StatsScreen />);
    await waitFor(() => expect(getByTestId('stats-saved')).toBeTruthy());
    const go = (id: string, kind: string, value?: string) => {
      mockRouter.push.mockClear();
      fireEvent.press(getByTestId(`${id}-button`));
      expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(app)/stats-words', params: value ? { kind, value } : { kind } });
    };
    go('stats-saved', 'all');
    go('stats-mastered', 'tier', 'mastered');
    go('stats-topic-food', 'topic', 'food');
    go('stats-level-A1', 'level', 'A1');
  });

  it('does not let a zero count be pressed', async () => {
    fetchStats.mockResolvedValueOnce(snapshot([{ word: foodWord, retentionScore: 0.9, timesSeen: 6 }]));
    const { getByTestId } = render(<StatsScreen />);
    await waitFor(() => expect(getByTestId('stats-saved')).toBeTruthy());
    mockRouter.push.mockClear();
    expect(getByTestId('stats-learning-button').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(getByTestId('stats-learning-button'));
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('links to the word catalog and opens a level with no saved words', async () => {
    fetchStats.mockResolvedValue(snapshot([{ word: foodWord, retentionScore: 0.9, timesSeen: 6 }]));
    const { getByLabelText, getByTestId } = render(<StatsScreen />);
    await waitFor(() => expect(getByTestId('stats-level-C2-button')).toBeTruthy());
    expect(getByTestId('stats-level-C2-button').props.accessibilityState.disabled).toBeFalsy();
    fireEvent.press(getByTestId('stats-level-C2-button'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(app)/stats-words', params: { kind: 'level', value: 'C2' } });
    fireEvent.press(getByLabelText(t('catalog_open')));
    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/catalog');
  });
});
