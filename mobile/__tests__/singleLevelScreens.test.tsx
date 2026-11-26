/** TASK-071: onboarding skips the quiz and the level UI disappears when a language has one level. */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import WelcomeScreen from '../src/screens/WelcomeScreen';
import QuizScreen from '../src/screens/QuizScreen';
import TopicsScreen from '../src/screens/TopicsScreen';
import CatalogScreen from '../src/screens/CatalogScreen';
import StatsScreen from '../src/screens/StatsScreen';
import StatsWordsScreen from '../src/screens/StatsWordsScreen';
import * as statsService from '../src/services/statsService';
import * as profileService from '../src/services/profileService';
import { useUserStore } from '../src/store/useUserStore';
import { setActivePackForTests, type LanguagePack } from '../src/languages';
import { de } from '../src/languages/de';
import { computeStats } from '../src/lib/stats';
import { WORD_BANK } from '../src/data/wordbank';
import { t } from '../src/i18n';
import { testPackCjk } from '../test-support/testPackCjk';

jest.mock('../src/services/statsService');
jest.mock('../src/services/wordService');
jest.mock('../src/services/profileService');
const mockRouter = {
  push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissAll: jest.fn(),
  canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => false),
};
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => {
    const react = require('react');
    react.useEffect(() => cb(), []);
  },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: any) => children }));

const fetchStats = statsService.fetchStats as jest.Mock;
const fetchSaved = statsService.fetchSavedStates as jest.Mock;
const twoLevels: LanguagePack = { ...de, levels: ['A1', 'A2'] };
const count = (n: number) => t('stats_words_count', { count: n });

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { nativeLanguage: 'it' };
  fetchSaved.mockResolvedValue(new Map());
  useUserStore.setState({ cefrLevel: 'A1', nativeLanguage: 'it', hasProfile: false });
});
afterEach(() => setActivePackForTests(null));

describe('onboarding', () => {
  it('with a quiz, the welcome button opens it', () => {
    const r = render(<WelcomeScreen />);
    fireEvent.press(r.getByText(t('welcome_cta')));
    expect(mockRouter.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/quiz' }));
  });

  it('without a quiz, the welcome button goes to the topics at the first level', () => {
    setActivePackForTests(testPackCjk);
    const r = render(<WelcomeScreen />);
    fireEvent.press(r.getByText(t('welcome_cta')));
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/topics', params: { cefrLevel: 'A1', nativeLanguage: expect.stringMatching(/^(it|en)$/) },
    });
  });

  it('opening the quiz of a language without one redirects to the topics', () => {
    setActivePackForTests(testPackCjk);
    const r = render(<QuizScreen />);
    expect(r.toJSON()).toBeNull();
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/topics', params: { cefrLevel: 'A1', nativeLanguage: 'it' } });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('the quiz never gives a level the language does not have', () => {
    setActivePackForTests(twoLevels);
    const r = render(<QuizScreen />);
    for (const q of de.quiz) {
      fireEvent.press(r.getByText(t(`quiz_q${q.n}_${q.correctIndex === 0 ? 'a' : 'b'}` as never)));
    }
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/topics', params: { cefrLevel: 'A2', nativeLanguage: 'it' } });
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('the topics screen saves a level the language has, whatever the route says', async () => {
    setActivePackForTests(testPackCjk);
    mockParams = { cefrLevel: 'B1', nativeLanguage: 'it' };
    (profileService.submitOnboarding as jest.Mock).mockResolvedValueOnce({});
    const r = render(<TopicsScreen />);
    const boxes = r.getAllByRole('checkbox');
    fireEvent.press(boxes[0]);
    fireEvent.press(boxes[1]);
    fireEvent.press(r.getByText(t('topics_cta')));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    expect(profileService.submitOnboarding).toHaveBeenCalledWith(expect.objectContaining({ cefr_level: 'A1' }));
    expect(useUserStore.getState().cefrLevel).toBe('A1');
  });
});

describe('catalog', () => {
  const open = async () => {
    const r = render(<CatalogScreen />);
    await waitFor(() => expect(r.getByTestId('filter-button')).toBeTruthy());
    fireEvent.press(r.getByTestId('filter-button'));
    return r;
  };

  it('one level: no level filter, and a stored higher level shows that level', async () => {
    setActivePackForTests(testPackCjk);
    useUserStore.setState({ cefrLevel: 'B1' });
    const r = await open();
    expect(r.queryByTestId('filter-opt-level-A1')).toBeNull();
    expect(r.getByTestId('filter-opt-topic-food')).toBeTruthy();
    expect(r.getByTestId('catalog-count').props.children).toBe(count(WORD_BANK.A1.length));
  });

  it('several levels: only those are offered', async () => {
    setActivePackForTests(twoLevels);
    const r = await open();
    expect(r.getByTestId('filter-opt-level-A1')).toBeTruthy();
    expect(r.getByTestId('filter-opt-level-A2')).toBeTruthy();
    expect(r.queryByTestId('filter-opt-level-B1')).toBeNull();
  });

  it('six levels are all offered', async () => {
    const r = await open();
    expect(r.getByTestId('filter-opt-level-C2')).toBeTruthy();
  });
});

describe('word list of a topic', () => {
  const open = async () => {
    mockParams = { kind: 'topic', value: 'food' };
    const r = render(<StatsWordsScreen />);
    await r.findByTestId('filter-button');
    fireEvent.press(r.getByTestId('filter-button'));
    return r;
  };

  it('one level: only the status filter', async () => {
    setActivePackForTests(testPackCjk);
    const r = await open();
    expect(r.queryByTestId('filter-opt-level-all')).toBeNull();
    expect(r.queryByTestId('filter-opt-level-A1')).toBeNull();
    expect(r.getByTestId('filter-opt-status-all')).toBeTruthy();
  });

  it('six levels: the level filter is there', async () => {
    const r = await open();
    expect(r.getByTestId('filter-opt-level-all')).toBeTruthy();
    expect(r.getByTestId('filter-opt-level-C2')).toBeTruthy();
  });
});

describe('statistics', () => {
  const foodWord = WORD_BANK.A1.find((e) => e.topic_domain === 'food')!.word;
  const open = async () => {
    fetchStats.mockResolvedValueOnce({
      ...computeStats([{ word: foodWord, retentionScore: 0.9, timesSeen: 6 }], { total: 0, correct: 0 }),
      streakDays: 1,
    });
    const r = render(<StatsScreen />);
    await waitFor(() => expect(r.getByTestId('stats-topic-food')).toBeTruthy());
    return r;
  };

  it('one level: no "by level" section', async () => {
    setActivePackForTests(testPackCjk);
    const r = await open();
    expect(r.queryByText(t('stats_by_level'))).toBeNull();
    expect(r.queryByTestId('stats-level-A1')).toBeNull();
  });

  it('several levels: one row per level of the language', async () => {
    setActivePackForTests(twoLevels);
    const r = await open();
    expect(r.getByText(t('stats_by_level'))).toBeTruthy();
    expect(r.getByTestId('stats-level-A2')).toBeTruthy();
    expect(r.queryByTestId('stats-level-B1')).toBeNull();
  });

  it('six levels: all six rows', async () => {
    const r = await open();
    expect(r.getByTestId('stats-level-C2')).toBeTruthy();
  });
});
