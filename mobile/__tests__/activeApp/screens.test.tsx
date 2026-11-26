/** Screens and components of the active app, with real bank words and the pack's special characters. */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import LanguagePicker from '../../src/components/ui/LanguagePicker';
import ArticleBadge from '../../src/components/ui/ArticleBadge';
import TypedClozeView from '../../src/components/exercises/TypedClozeView';
import PracticeMenuScreen from '../../src/screens/PracticeMenuScreen';
import { allEntries } from '../../src/data/wordbank';
import { buildCloze, letterCount } from '../../src/lib/cloze';
import { setAppLocale, t } from '../../src/i18n';
import { fetchVaultCards, type ReviewCard } from '../../src/services/reviewService';
import { current } from '../../test-support/appExpectations';

jest.mock('../../src/services/reviewService', () => ({
  fetchVaultCards: jest.fn(),
  gradePractice: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) }),
  useLocalSearchParams: () => ({}),
}));

const toCard = ({ level, entry: e }: ReturnType<typeof allEntries>[number], i: number): ReviewCard => ({
  id: `c${i}`, word: e.word, article: e.article, translationIt: e.meaning_it, translationEn: e.meaning_en,
  example: e.example, segments: e.segments, exampleIt: e.example_it, exampleEn: e.example_en, partOfSpeech: e.part_of_speech,
  cefrBand: level, topicDomain: e.topic_domain, grammarAngle: e.grammar_angle, timesSeen: 6, retentionScore: 0.95,
});

afterEach(() => setAppLocale('it'));

it('the language picker lists exactly the languages the app offers', () => {
  const ui = render(<LanguagePicker value="it" onChange={() => {}} />);
  const pills = ui.getAllByRole('radio').map((p) => p.props.testID);
  expect(pills.sort()).toEqual(current().uiLanguages.map((l) => `lang-${l}`).sort());
});

it('the practice menu shows the formats of the pack and offers case-free drills only where the pack has no cases', async () => {
  (fetchVaultCards as jest.Mock).mockResolvedValue(allEntries().slice(0, 30).map(toCard));
  const ui = render(<PracticeMenuScreen />);
  await waitFor(() => expect(ui.getByTestId('practice-format-mixed')).toBeTruthy());
  await waitFor(() => expect(ui.getByTestId('practice-format-typed_cloze').props.accessibilityState?.disabled).not.toBe(true));
  expect(ui.queryByText(/dativ|accusativ|genitiv/i) === null || current().hasCases).toBe(true);
});

describe('special characters', () => {
  (current().articleForms.length > 0 ? it : it.skip)('the article badge names article and word, with the special letters intact', () => {
    const { entry } = allEntries().find(({ entry: e }) => e.article && [...e.word].some((c) => current().specialCharacters.includes(c)))
      ?? allEntries().find(({ entry: e }) => e.article)!;
    const ui = render(<ArticleBadge article={entry.article} word={entry.word} />);
    expect(ui.getByLabelText(`${entry.article} ${entry.word}`)).toBeTruthy();
  });

  it('letterCount counts every letter of the language (prevents "5 letters" for mañana)', () => {
    for (const { entry } of allEntries()) {
      const expected = [...entry.word].filter((c) => /\p{L}/u.test(c)).length;
      if (letterCount(entry.word) !== expected) throw new Error(`${entry.word}: ${letterCount(entry.word)} vs ${expected}`);
    }
  });

  it('the typed fill-in shows the right hint for a word with special letters and keeps them in the answer line', async () => {
    const cloze = (e: ReturnType<typeof allEntries>[number]['entry']) => buildCloze(e.example, e.word, undefined, e.segments);
    const { level, entry } = allEntries().find(({ entry: e }) => [...e.word].some((c) => current().specialCharacters.includes(c)) && cloze(e))!;
    const c = cloze(entry)!;
    const card = toCard({ level, entry }, 0);
    setAppLocale('en');
    const ui = render(<TypedClozeView model={{ kind: 'typed_cloze', card, before: c.before, after: c.after }} isRetry={false} onResult={() => {}} />);
    fireEvent.press(ui.getByLabelText(t('review_hint')));
    expect(ui.getByText(new RegExp(`${letterCount(entry.word)} letters`))).toBeTruthy();
    expect(letterCount(entry.word)).toBe([...entry.word].filter((ch) => /\p{L}/u.test(ch)).length);
  });
});
