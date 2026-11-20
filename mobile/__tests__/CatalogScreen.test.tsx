import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CatalogScreen from '../src/screens/CatalogScreen';
import { Alert } from 'react-native';
import * as statsService from '../src/services/statsService';
import * as wordService from '../src/services/wordService';
import { useUserStore } from '../src/store/useUserStore';
import { WORD_BANK } from '../src/data/wordbank';
import { buildCatalog } from '../src/lib/catalog';
import { t } from '../src/i18n';

jest.mock('../src/services/statsService');
jest.mock('../src/services/wordService');
const mockRouter = { push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (cb: () => void) => {
    const react = require('react');
    react.useEffect(() => cb(), []);
  },
}));

const fetchSaved = statsService.fetchSavedStates as jest.Mock;
const a1First = [...WORD_BANK.A1].sort((a, b) => a.word.localeCompare(b.word, 'de', { sensitivity: 'base' }))[0];
const countText = (n: number) => t('stats_words_count', { count: n });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  useUserStore.setState({ cefrLevel: 'B1' });
  fetchSaved.mockResolvedValue(new Map());
});

type R = ReturnType<typeof render>;
/** Opens the filter sheet (once) and presses one option of it. */
const choose = (r: R, testID: string) => {
  if (!r.queryByTestId('filter-done')) fireEvent.press(r.getByTestId('filter-button'));
  fireEvent.press(r.getByTestId(testID));
};
const ready = (r: R) => waitFor(() => expect(r.getByTestId('filter-button')).toBeTruthy());
const lbl = (e: { article: string | null; word: string }, st: string) => `${e.article ? `${e.article} ` : ''}${e.word}, ${st}`;

describe('CatalogScreen', () => {
  it('starts on the learner level, falling back to A1', async () => {
    const { getByTestId, unmount } = render(<CatalogScreen />);
    await waitFor(() => expect(getByTestId('catalog-count').props.children).toBe(countText(WORD_BANK.B1.length)));
    unmount();
    useUserStore.setState({ cefrLevel: 'nonsense' });
    const r = render(<CatalogScreen />);
    await waitFor(() => expect(r.getByTestId('catalog-count').props.children).toBe(countText(WORD_BANK.A1.length)));
  });

  it('has no chip rows or legend above the list; one filter button instead', async () => {
    const r = render(<CatalogScreen />);
    await ready(r);
    expect(r.queryByTestId('status-legend')).toBeNull();
    expect(r.queryByTestId('catalog-status-all')).toBeNull();
    expect(r.queryByTestId('catalog-level-A1')).toBeNull();
    expect(r.queryByTestId('filter-summary')).toBeNull();
    expect(r.queryByTestId('filter-badge')).toBeNull();
  });

  it('level and topic from the sheet change the count; summary and badge follow', async () => {
    const r = render(<CatalogScreen />);
    await ready(r);
    choose(r, 'filter-opt-level-A1');
    expect(r.getByTestId('catalog-count').props.children).toBe(countText(WORD_BANK.A1.length));
    choose(r, 'filter-opt-topic-food');
    const n = WORD_BANK.A1.filter((e) => e.topic_domain === 'food').length;
    expect(r.getByTestId('catalog-count').props.children).toBe(countText(n));
    expect(r.getByTestId('filter-summary').props.children).toBe(`A1 · ${t('topic_food')}`);
    expect(r.getByTestId('filter-badge').props.children).toBe(1); // the level always has a value: not counted
  });

  it('status from the sheet narrows the list; every row carries its status text', async () => {
    fetchSaved.mockResolvedValue(new Map([[a1First.word.toLowerCase(), { id: 'S1', retentionScore: 0.9, timesSeen: 6 }]]));
    const r = render(<CatalogScreen />);
    await ready(r);
    choose(r, 'filter-opt-level-A1');
    expect(r.getByLabelText(lbl(a1First, t('catalog_row_mastered')))).toBeTruthy();
    choose(r, 'filter-opt-status-mastered');
    expect(r.getByTestId('catalog-count').props.children).toBe(countText(WORD_BANK.A1.length));
    expect(r.getByTestId('filter-opt-status-mastered').props.accessibilityLabel)
      .toBe(t('stats_words_filter_a11y', { name: t('stats_mastered'), count: 1 }));
    expect(r.queryAllByLabelText(new RegExp(`, ${t('catalog_status_todo')}$`)).length).toBe(0);
    expect(r.getByTestId('filter-summary').props.children).toBe(`A1 · ${t('stats_mastered')}`);
    choose(r, 'filter-opt-status-todo');
    expect(r.queryAllByLabelText(new RegExp(`, ${t('catalog_status_todo')}$`)).length).toBeGreaterThan(0);
  });

  it('Azzera clears topic and status and goes back to the learner level', async () => {
    const r = render(<CatalogScreen />);
    await ready(r);
    choose(r, 'filter-opt-level-A1');
    choose(r, 'filter-opt-topic-food');
    choose(r, 'filter-opt-status-todo');
    fireEvent.press(r.getByTestId('filter-reset'));
    expect(r.getByTestId('catalog-count').props.children).toBe(countText(WORD_BANK.B1.length));
    expect(r.queryByTestId('filter-summary')).toBeNull();
    expect(r.queryByTestId('filter-badge')).toBeNull();
    fireEvent.press(r.getByTestId('filter-done'));
    expect(r.queryByTestId('filter-done')).toBeNull();
  });

  it('level options respect the chosen topic and topic options the chosen level', async () => {
    const r = render(<CatalogScreen />);
    await ready(r);
    choose(r, 'filter-opt-level-A1');
    const food = WORD_BANK.A1.filter((e) => e.topic_domain === 'food').length;
    expect(r.getByTestId('filter-opt-topic-food').props.accessibilityLabel)
      .toBe(t('stats_words_filter_a11y', { name: t('topic_food'), count: food }));
    choose(r, 'filter-opt-topic-food');
    expect(r.getByTestId('filter-opt-level-A1').props.accessibilityLabel)
      .toBe(t('stats_words_filter_a11y', { name: 'A1', count: food }));
  });

  it('opens a saved word and ignores a press on an unsaved one', async () => {
    fetchSaved.mockResolvedValue(new Map([[a1First.word.toLowerCase(), { id: 'S1', retentionScore: 0.7, timesSeen: 3 }]]));
    const r = render(<CatalogScreen />);
    await ready(r);
    choose(r, 'filter-opt-level-A1');
    fireEvent.press(r.getByLabelText(lbl(a1First, t('stats_learning'))));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(app)/word', params: { id: 'S1' } });
    mockRouter.push.mockClear();
    const second = buildCatalog({ level: 'A1', topic: null }, null, new Map()).entries[1];
    const unsaved = r.getByTestId(`catalog-row-${second.key}`);
    expect(unsaved.props.accessibilityRole).toBe('button');
    expect(unsaved.props.accessibilityHint).toBe(t('catalog_start_hint'));
  });

  it('tapping an unsaved word asks, starts learning and the row becomes "Nuova"', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const first = buildCatalog({ level: 'A1', topic: null }, null, new Map()).entries[0];
    (wordService.startLearning as jest.Mock).mockResolvedValue({ added: true, id: 'N1' });
    const r = render(<CatalogScreen />);
    await ready(r);
    choose(r, 'filter-opt-level-A1');
    fireEvent.press(r.getByTestId('filter-done'));
    fireEvent.press(r.getByLabelText(lbl(first, t('catalog_status_todo'))));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).not.toHaveBeenCalled();
    fetchSaved.mockResolvedValue(new Map([[first.word.toLowerCase(), { id: 'N1', retentionScore: 0.5, timesSeen: 1 }]]));
    const confirm = (alertSpy.mock.calls[0][2] as any[]).find((b) => b.text === t('catalog_start_confirm'));
    await waitFor(async () => { await confirm.onPress(); });
    expect(wordService.startLearning).toHaveBeenCalledWith('A1', first.word);
    await waitFor(() => expect(r.getByLabelText(lbl(first, t('catalog_row_new')))).toBeTruthy());
    expect(r.queryByLabelText(lbl(first, t('catalog_status_todo')))).toBeNull();
    alertSpy.mockRestore();
  });

  it('the sheet lists the four statuses with their markers (it is the legend)', async () => {
    const r = render(<CatalogScreen />);
    await ready(r);
    fireEvent.press(r.getByTestId('filter-button'));
    for (const s of ['mastered', 'learning', 'new', 'todo']) {
      expect(r.getByTestId(`filter-opt-status-${s}`)).toBeTruthy();
      expect(r.getAllByTestId(`status-marker-${s}`).length).toBeGreaterThan(0);
    }
  });

  it('shows a generic error, logs the cause and retries', async () => {
    fetchSaved.mockRejectedValueOnce(new Error('SQLITE_CORRUPT secret'));
    const { getByText, queryByText, getByTestId } = render(<CatalogScreen />);
    await waitFor(() => expect(getByText(t('stats_error'))).toBeTruthy());
    expect(queryByText(/SQLITE_CORRUPT/)).toBeNull();
    expect(console.error).toHaveBeenCalled();
    fireEvent.press(getByText(t('vault_retry')));
    await waitFor(() => expect(getByTestId('catalog-count')).toBeTruthy());
  });
});

describe('row status wording', () => {
  it('uses the singular for one word (Nuova) and the plural in the status option (Nuove)', async () => {
    fetchSaved.mockResolvedValue(new Map([[a1First.word.toLowerCase(), { id: 'S1', retentionScore: 0.5, timesSeen: 1 }]]));
    const r = render(<CatalogScreen />);
    await ready(r);
    choose(r, 'filter-opt-level-A1');
    expect(r.getByLabelText(lbl(a1First, t('catalog_row_new')))).toBeTruthy();
    expect(t('catalog_row_new')).not.toBe(t('stats_new')); // Italian: "Nuova" vs "Nuove"
    expect(r.getByTestId('filter-opt-status-new').props.accessibilityLabel)
      .toBe(t('stats_words_filter_a11y', { name: t('stats_new'), count: 1 }));
  });
});
