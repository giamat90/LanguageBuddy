import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import QuizScreen from '../src/screens/QuizScreen';
import { setActivePackForTests } from '../src/languages';
import { testPack } from '../test-support/testPack';
import { de } from '../src/languages/de';
import { es } from '../src/languages/es';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({ nativeLanguage: 'it' }),
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: any) => children }));

beforeEach(() => mockPush.mockClear());
afterEach(() => setActivePackForTests(null));

/** Answers the five questions with the given option indexes (0 = A, 1 = B) and returns the level reached. */
function answer(picks: (0 | 1)[]) {
  const r = render(<QuizScreen />);
  picks.forEach((p, i) => {
    const n = de.quiz[i].n;
    fireEvent.press(r.getByText(require('../src/i18n').t(`quiz_q${n}_${p === 0 ? 'a' : 'b'}` as never)));
  });
  return mockPush.mock.calls.at(-1)?.[0]?.params?.cefrLevel;
}

describe('the placement quiz follows the pack', () => {
  it('German: the pack lists the old positions', () => {
    expect(de.quiz.map((q) => q.correctIndex)).toEqual([0, 0, 0, 1, 0]);
  });

  it('German: all right gives B2, all wrong A1', () => {
    expect(answer([0, 0, 0, 1, 0])).toBe('B2');
    mockPush.mockClear();
    expect(answer([1, 1, 1, 0, 1])).toBe('A1');
  });

  it('a pack with other correct positions scores by its own', () => {
    setActivePackForTests(testPack);
    expect(testPack.quiz.map((q) => q.correctIndex)).toEqual([1, 1, 0, 0, 1]);
    expect(answer([1, 1, 0, 0, 1])).toBe('B2');
    mockPush.mockClear();
    expect(answer([0, 0, 0, 1, 0])).toBe('A1'); // only q3 matches
  });

  it('Spanish: all right gives B2, all wrong A1', () => {
    setActivePackForTests(es);
    expect(answer([0, 0, 0, 1, 1])).toBe('B2');
    mockPush.mockClear();
    expect(answer([1, 1, 1, 0, 0])).toBe('A1');
  });
});
