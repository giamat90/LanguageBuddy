import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import StatsWordsScreen from '../src/screens/StatsWordsScreen';
import { Alert } from 'react-native';
import * as statsService from '../src/services/statsService';
import * as wordService from '../src/services/wordService';
import { t } from '../src/i18n';
import { WORD_BANK } from '../src/data/wordbank';

jest.mock('../src/services/statsService');
jest.mock('../src/services/wordService');
const mockRouter = { push: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string | string[] | undefined> = {};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

const fetchStatWords = statsService.fetchStatWords as jest.Mock;
const fetchSaved = statsService.fetchSavedStates as jest.Mock;
const item = (id: string, word: string, tier: string) => ({
  id, word, article: 'der', translationIt: 'cane', translationEn: 'dog', partOfSpeech: 'noun',
  retentionScore: 0.9, nextReviewAt: '2030-01-01', tier,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { kind: 'tier', value: 'mastered' };
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('StatsWordsScreen', () => {
  it('lists the words of the filter and opens one', async () => {
    fetchStatWords.mockResolvedValueOnce([item('1', 'Hund', 'mastered'), item('2', 'Katze', 'mastered')]);
    const { getByText, getAllByText, getByLabelText, getByTestId } = render(<StatsWordsScreen />);
    await waitFor(() => expect(getByText('Hund')).toBeTruthy());
    expect(fetchStatWords).toHaveBeenCalledWith({ kind: 'tier', tier: 'mastered' });
    expect(getByText('Katze')).toBeTruthy();
    expect(getAllByText(t('stats_mastered')).length).toBeGreaterThanOrEqual(1); // title + row labels
    expect(getByTestId('stats-words-count').props.children).toBe(t('stats_words_count', { count: 2 }));
    fireEvent.press(getByLabelText(`der Hund, ${t('catalog_row_mastered')}`));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(app)/word', params: { id: '1' } });
  });

  it('shows an empty state', async () => {
    fetchStatWords.mockResolvedValueOnce([]);
    const { getByText } = render(<StatsWordsScreen />);
    await waitFor(() => expect(getByText(t('stats_words_empty'))).toBeTruthy());
  });

  it('treats unknown params as nothing to show, without touching the service', async () => {
    mockParams = { kind: 'topic', value: "x'; DROP TABLE y;--" };
    const { getByText } = render(<StatsWordsScreen />);
    await waitFor(() => expect(getByText(t('stats_words_empty'))).toBeTruthy());
    expect(fetchStatWords).not.toHaveBeenCalled();
    expect(fetchSaved).not.toHaveBeenCalled();
  });

  it('shows a generic error (never the raw message) and can retry', async () => {
    fetchStatWords.mockRejectedValueOnce(new Error('SQLITE_CORRUPT secret'));
    const { getByText, queryByText } = render(<StatsWordsScreen />);
    await waitFor(() => expect(getByText(t('stats_error'))).toBeTruthy());
    expect(queryByText(/SQLITE_CORRUPT/)).toBeNull();
    expect(console.error).toHaveBeenCalled();
    fetchStatWords.mockResolvedValueOnce([item('1', 'Hund', 'new')]);
    fireEvent.press(getByText(t('vault_retry')));
    await waitFor(() => expect(getByText('Hund')).toBeTruthy());
  });

  it('goes back', async () => {
    fetchStatWords.mockResolvedValueOnce([]);
    const { getByLabelText } = render(<StatsWordsScreen />);
    fireEvent.press(getByLabelText(t('nav_back')));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  describe('filter sheet inside a bucket (TASK-038/039)', () => {
    const foodA1 = WORD_BANK.A1.filter((e) => e.topic_domain === 'food');
    const foodAll = Object.values(WORD_BANK).flat().filter((e) => e.topic_domain === 'food').length;
    const lbl = (e: { article: string | null; word: string }, st: string) => `${e.article ? `${e.article} ` : ''}${e.word}, ${st}`;
    type R = ReturnType<typeof render>;
    const choose = (r: R, testID: string) => {
      if (!r.queryByTestId('filter-done')) fireEvent.press(r.getByTestId('filter-button'));
      fireEvent.press(r.getByTestId(testID));
    };

    it('topic list: no chip rows or legend; level options with counts narrow the list and clear on a second tap', async () => {
      mockParams = { kind: 'topic', value: 'food' };
      fetchSaved.mockResolvedValue(new Map());
      const r = render(<StatsWordsScreen />);
      await r.findByTestId('filter-button');
      expect(r.queryByTestId('stats-filter-row')).toBeNull();
      expect(r.queryByTestId('status-legend')).toBeNull();
      expect(r.queryByTestId('catalog-status-all')).toBeNull();
      expect(r.queryByTestId('filter-summary')).toBeNull();
      expect(r.getByTestId('stats-words-count').props.children).toBe(t('stats_words_count', { count: foodAll }));
      choose(r, 'filter-opt-level-A1');
      expect(r.getByTestId('filter-opt-level-A1').props.accessibilityLabel)
        .toBe(t('stats_words_filter_a11y', { name: 'A1', count: foodA1.length }));
      expect(r.getByLabelText(lbl(foodA1.find((e) => e.word === 'Apfel')!, t('catalog_status_todo')))).toBeTruthy();
      expect(r.getByTestId('stats-words-count').props.children).toBe(t('stats_words_count', { count: foodA1.length }));
      expect(r.getByTestId('filter-summary').props.children).toBe('A1');
      expect(r.getByTestId('filter-badge').props.children).toBe(1);
      choose(r, 'filter-opt-level-A1');
      expect(r.getByTestId('stats-words-count').props.children).toBe(t('stats_words_count', { count: foodAll }));
      expect(r.queryByTestId('filter-badge')).toBeNull();
    });

    it('level list: topic options combine with the status option; summary and badge follow', async () => {
      mockParams = { kind: 'level', value: 'A1' };
      fetchSaved.mockResolvedValue(new Map([['apfel', { id: 'S9', retentionScore: 0.7, timesSeen: 3 }]]));
      const r = render(<StatsWordsScreen />);
      await r.findByTestId('filter-button');
      choose(r, 'filter-opt-topic-food');
      expect(r.getByTestId('stats-words-count').props.children).toBe(t('stats_words_count', { count: foodA1.length }));
      expect(r.getByTestId('stats-words-progress').props.children).toBe(t('stats_progress', { saved: 1, total: foodA1.length }));
      const todoSibling = foodA1.find((e) => e.word !== 'Apfel')!;
      expect(r.getByLabelText(lbl(todoSibling, t('catalog_status_todo')))).toBeTruthy();
      choose(r, 'filter-opt-status-todo');
      expect(r.queryByLabelText(lbl(foodA1.find((e) => e.word === 'Apfel')!, t('stats_learning')))).toBeNull();
      expect(r.getByTestId('filter-opt-status-todo').props.accessibilityLabel)
        .toBe(t('stats_words_filter_a11y', { name: t('catalog_status_todo'), count: foodA1.length - 1 }));
      expect(r.getByTestId('filter-summary').props.children).toBe(`${t('topic_food')} · ${t('catalog_status_todo')}`);
      expect(r.getByTestId('filter-badge').props.children).toBe(2);
      fireEvent.press(r.getByTestId('filter-reset'));
      expect(r.queryByTestId('filter-summary')).toBeNull();
      expect(r.getByTestId('stats-words-count').props.children).toBe(t('stats_words_count', { count: WORD_BANK.A1.length }));
    });

    it('an option with no words shows the empty state', async () => {
      const emptyCombo = (Object.keys(WORD_BANK) as (keyof typeof WORD_BANK)[]).flatMap((l) =>
        ['food', 'travel', 'work', 'culture', 'home', 'leisure', 'health', 'shopping']
          .filter((tp) => !WORD_BANK[l].some((e) => e.topic_domain === tp)).map((tp) => [l, tp] as const))[0];
      if (!emptyCombo) return; // the bank has a word for every combination: nothing to assert
      mockParams = { kind: 'level', value: emptyCombo[0] };
      fetchSaved.mockResolvedValue(new Map());
      const r = render(<StatsWordsScreen />);
      await r.findByTestId('filter-button');
      choose(r, `filter-opt-topic-${emptyCombo[1]}`);
      expect(r.getByText(t('stats_words_empty'))).toBeTruthy();
    });

    it('saved-only lists have no filter button', async () => {
      mockParams = { kind: 'tier', value: 'mastered' };
      fetchStatWords.mockResolvedValueOnce([item('1', 'Hund', 'mastered')]);
      const { findByTestId, queryByTestId } = render(<StatsWordsScreen />);
      await findByTestId('catalog-row-1');
      expect(queryByTestId('filter-button')).toBeNull();
    });
  });

  describe('level and topic buckets list the whole bank', () => {
    const food = WORD_BANK.A1.find((e) => e.word === 'Apfel')!;

    it('topic bucket: unsaved Apfel is "Da iniziare", rows carry a CEFR badge', async () => {
      mockParams = { kind: 'topic', value: 'food' };
      fetchSaved.mockResolvedValueOnce(new Map());
      const { findByLabelText, getAllByText, getByTestId } = render(<StatsWordsScreen />);
      expect(await findByLabelText(`${food.article} Apfel, ${t('catalog_status_todo')}`)).toBeTruthy();
      expect(getAllByText('A1').length).toBeGreaterThan(0);
      const n = Object.values(WORD_BANK).flat().filter((e) => e.topic_domain === 'food').length;
      expect(getByTestId('stats-words-count').props.children).toBe(t('stats_words_count', { count: n }));
      expect(fetchStatWords).not.toHaveBeenCalled();
    });

    it('level bucket: an unsaved word can be started; tier lists have no start action', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      mockParams = { kind: 'level', value: 'A1' };
      fetchSaved.mockResolvedValue(new Map());
      (wordService.startLearning as jest.Mock).mockResolvedValue({ added: true, id: 'N1' });
      const { findByLabelText } = render(<StatsWordsScreen />);
      fireEvent.press(await findByLabelText(`${food.article} Apfel, ${t('catalog_status_todo')}`));
      expect(alertSpy).toHaveBeenCalledTimes(1);
      const confirm = (alertSpy.mock.calls[0][2] as any[]).find((b) => b.text === t('catalog_start_confirm'));
      fetchSaved.mockResolvedValue(new Map([['apfel', { id: 'N1', retentionScore: 0.5, timesSeen: 1 }]]));
      await waitFor(async () => { await confirm.onPress(); });
      expect(wordService.startLearning).toHaveBeenCalledWith('A1', 'Apfel');
      expect(await findByLabelText(`${food.article} Apfel, ${t('catalog_row_new')}`)).toBeTruthy();
      alertSpy.mockRestore();
    });

    it('saved-only lists give a row no start action', async () => {
      mockParams = { kind: 'tier', value: 'mastered' };
      fetchStatWords.mockResolvedValueOnce([item('1', 'Hund', 'mastered')]);
      const { findByTestId } = render(<StatsWordsScreen />);
      const row = await findByTestId('catalog-row-1');
      expect(row.props.accessibilityHint).toBeUndefined();
    });

    it('level bucket: a saved word shows its tier, the status option narrows to "Da iniziare"', async () => {
      mockParams = { kind: 'level', value: 'A1' };
      fetchSaved.mockResolvedValueOnce(new Map([['apfel', { id: 'S9', retentionScore: 0.7, timesSeen: 3 }]]));
      const { findByLabelText, getByTestId, queryByLabelText } = render(<StatsWordsScreen />);
      const label = `${food.article} Apfel, ${t('stats_learning')}`;
      fireEvent.press(await findByLabelText(label));
      expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(app)/word', params: { id: 'S9' } });
      fireEvent.press(getByTestId('filter-button'));
      fireEvent.press(getByTestId('filter-opt-status-todo'));
      expect(queryByLabelText(label)).toBeNull();
      expect(getByTestId('filter-opt-status-todo').props.accessibilityLabel)
        .toBe(t('stats_words_filter_a11y', { name: t('catalog_status_todo'), count: WORD_BANK.A1.length - 1 }));
      expect(getByTestId('stats-words-progress').props.children)
        .toBe(t('stats_progress', { saved: 1, total: WORD_BANK.A1.length }));
    });
  });
});
