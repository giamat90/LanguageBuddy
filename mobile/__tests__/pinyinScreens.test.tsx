/** TASK-074: pinyin on the exercises and reading screens, the caps, and what is never given away. */
import React from 'react';
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
import { zh } from '../src/languages/zh';
import { setActivePackForTests } from '../src/languages';
import { setAppLocale, t } from '../src/i18n';
import { useReadingSettingsStore } from '../src/store/useReadingSettingsStore';
import { rubyCells } from '../src/lib/reading/ruby';
import { exampleStyle } from '../src/theme/typography';
import TypedClozeView from '../src/components/exercises/TypedClozeView';
import MultipleChoiceView from '../src/components/exercises/MultipleChoiceView';
import MatchingView from '../src/components/exercises/MatchingView';
import SentenceReorderView from '../src/components/exercises/SentenceReorderView';
import FlashcardView from '../src/components/exercises/FlashcardView';
import ToneChoiceView from '../src/components/exercises/ToneChoiceView';
import PinyinSettings from '../src/components/ui/PinyinSettings';
import WordHero from '../src/components/ui/WordHero';
import WordCard from '../src/components/ui/WordCard';
import { CatalogRow } from '../src/components/ui/CatalogRow';
import PracticeMenuScreen from '../src/screens/PracticeMenuScreen';
import { fetchVaultCards, type ReviewCard } from '../src/services/reviewService';

jest.mock('../src/services/reviewService', () => ({ fetchVaultCards: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('../src/lib/reading/lookup', () => ({
  bankReading: (word: string) =>
    word === '朋友'
      ? {
          pronunciation: 'péngyou',
          example: '我的朋友在中国工作。',
          segments: ['我', '的', '朋友', '在', '中国', '工作', '。'],
          examplePinyin: ['Wǒ', 'de', 'péngyou', 'zài', 'Zhōngguó', 'gōngzuò'],
        }
      : null,
}));

const syl = (text: string) => ({ text, alsoTyped: [], otherTones: [] });
const friend = (over: Partial<ReviewCard> = {}): ReviewCard => ({
  id: '1', word: '朋友', article: null, translationIt: 'amico', translationEn: 'friend',
  example: '我的朋友在中国工作。', segments: ['我', '的', '朋友', '在', '中国', '工作', '。'],
  exampleIt: 'Il mio amico lavora in Cina.', exampleEn: 'My friend works in China.',
  partOfSpeech: 'noun', cefrBand: 'A1', timesSeen: 1, retentionScore: 0.5,
  pronunciation: 'péngyou', syllables: [syl('péng'), syl('you')],
  examplePinyin: ['Wǒ', 'de', 'péngyou', 'zài', 'Zhōngguó', 'gōngzuò'], ...over,
});
const learned = (over: Partial<ReviewCard> = {}) => friend({ timesSeen: 8, retentionScore: 0.95, ...over });
const tea = (over: Partial<ReviewCard> = {}) =>
  friend({ id: '2', word: '茶', translationEn: 'tea', translationIt: 'tè', pronunciation: 'chá', syllables: [syl('chá')], ...over });

type UI = ReturnType<typeof render>;
const press = (ui: UI, label: string) => fireEvent.press(ui.getByText(label));
const reveal = (ui: UI) => fireEvent.press(ui.getByTestId('reveal-pinyin'));
const canReveal = (ui: UI) => ui.queryByTestId('reveal-pinyin') !== null;

beforeEach(() => {
  setActivePackForTests(zh);
  setAppLocale('en');
  useReadingSettingsStore.getState().setPinyinMode('auto');
});
afterEach(() => { setActivePackForTests(null); setAppLocale('it'); });

describe('rubyCells', () => {
  it('pairs each word with its pinyin and keeps punctuation beside it', () => {
    expect(rubyCells(['“', '你', '好', '”', '，', '他', '。'], ['Nǐ', 'hǎo', 'tā'], zh)).toEqual([
      { word: '你', lead: '“', trail: '', pinyin: 'Nǐ' },
      { word: '好', lead: '', trail: '”，', pinyin: 'hǎo' },
      { word: '他', lead: '', trail: '。', pinyin: 'tā' },
    ]);
  });
  it('gives nothing when the data does not fit', () => {
    expect(rubyCells(['他', '。'], ['tā', 'x'], zh)).toBeNull();
    expect(rubyCells(null, ['tā'], zh)).toBeNull();
    expect(rubyCells(['他'], null, zh)).toBeNull();
  });
});

describe('typed cloze', () => {
  const view = (card: ReviewCard, onResult = jest.fn()) => {
    const ui = render(
      <TypedClozeView model={{ kind: 'typed_cloze', card, before: '我的', after: '在中国工作。' }} isRetry={false} onResult={onResult} />,
    );
    return { ui, onResult };
  };
  const answer = (ui: UI, text: string) => {
    fireEvent.changeText(ui.getByLabelText(t('reading_cloze_placeholder')), text);
    press(ui, t('review_check'));
  };

  it('shows the pinyin of a new word sentence, never of the blank', () => {
    const { ui } = view(friend());
    expect(ui.getByText('Wǒ')).toBeTruthy();
    expect(ui.getByText('Zhōngguó')).toBeTruthy();
    expect(ui.queryByText('péngyou')).toBeNull();
    expect(ui.queryByText(/朋友/)).toBeNull();
    expect(canReveal(ui)).toBe(false);
  });

  it('hides it for a learned word; asking for it caps the credit and still hides the blank', () => {
    const { ui, onResult } = view(learned());
    expect(ui.queryByText('Wǒ')).toBeNull();
    reveal(ui);
    expect(ui.getByText('Wǒ')).toBeTruthy();
    expect(ui.queryByText('péngyou')).toBeNull();
    answer(ui, '朋友');
    press(ui, t('review_continue'));
    expect(onResult).toHaveBeenCalledWith(0.6);
  });

  it.each([
    ['朋友', 1, 'review_correct'],
    ['peng2you', 1, 'review_correct'],
    ['pengyou', 0.7, 'reading_missing_tones'],
    ['peng1you', 0, 'reading_wrong_tone'],
    ['mingtian', 0, 'review_answer_was'],
    ['朋有', 0, 'review_answer_was'],
  ] as const)('%s earns %d', (typed, quality, message) => {
    const { ui, onResult } = view(learned());
    answer(ui, typed);
    expect(ui.getByText(t(message, { word: '朋友', pinyin: 'péngyou' }))).toBeTruthy();
    expect(ui.getByText('péngyou')).toBeTruthy(); // shown once answered, at no cost
    press(ui, t('review_continue'));
    expect(onResult).toHaveBeenCalledWith(quality);
  });

  it('hints with the first initial and the number of syllables', () => {
    const { ui } = view(learned());
    press(ui, t('review_hint'));
    expect(ui.getByText(t('reading_hint_text', { initial: 'p', count: 2 }))).toBeTruthy();
    expect(ui.queryByText(/朋/)).toBeNull();
  });

  it('is unchanged for German', () => {
    setActivePackForTests(null);
    const card = learned({ word: 'Brot', pronunciation: undefined, syllables: undefined, segments: undefined, examplePinyin: undefined });
    const ui = render(<TypedClozeView model={{ kind: 'typed_cloze', card, before: 'Das ', after: '.' }} isRetry={false} onResult={jest.fn()} />);
    expect(canReveal(ui)).toBe(false);
    expect(ui.getByLabelText(t('review_cloze_placeholder'))).toBeTruthy();
  });
});

describe('multiple choice', () => {
  const options = [
    { id: '朋友', word: '朋友', article: null, meaningIt: 'amico', meaningEn: 'friend', pronunciation: 'péngyou' },
    { id: '茶', word: '茶', article: null, meaningIt: 'tè', meaningEn: 'tea', pronunciation: 'chá' },
  ];
  const view = (card: ReviewCard, direction: 'to_native' | 'to_german', onResult = jest.fn()) => ({
    ui: render(
      <MultipleChoiceView model={{ kind: 'multiple_choice', card, direction, options, correctIndex: 0 }} isRetry={false} onResult={onResult} />,
    ),
    onResult,
  });

  it('shows the pinyin of the question word while it is new', () => {
    expect(view(friend(), 'to_native').ui.getByText('péngyou')).toBeTruthy();
  });

  it('shows it on every option when the words are the options', () => {
    const { ui } = view(friend(), 'to_german');
    expect(ui.getByText('péngyou')).toBeTruthy();
    expect(ui.getByText('chá')).toBeTruthy();
  });

  it('caps a learned word that asked for it', () => {
    const { ui, onResult } = view(learned(), 'to_native');
    expect(ui.queryByText('péngyou')).toBeNull();
    reveal(ui);
    fireEvent.press(ui.getByTestId('mc-option-0'));
    press(ui, t('review_continue'));
    expect(onResult).toHaveBeenCalledWith(0.6);
  });

  it('gives full credit without asking, and shows the pinyin afterwards', () => {
    const { ui, onResult } = view(learned(), 'to_native');
    fireEvent.press(ui.getByTestId('mc-option-0'));
    expect(ui.getByText('péngyou')).toBeTruthy();
    press(ui, t('review_continue'));
    expect(onResult).toHaveBeenCalledWith(0.8);
  });
});

describe('matching', () => {
  it('caps only the words whose pinyin was hidden', () => {
    const onResult = jest.fn();
    const cards = [friend(), tea({ timesSeen: 8, retentionScore: 0.95 })];
    const ui = render(<MatchingView model={{ kind: 'matching', cards, leftOrder: ['1', '2'], rightOrder: ['1', '2'] }} onResult={onResult} />);
    expect(ui.getByText('péngyou')).toBeTruthy();
    expect(ui.queryByText('chá')).toBeNull();
    reveal(ui);
    expect(ui.getByText('chá')).toBeTruthy();
    for (const id of ['1', '2']) {
      fireEvent.press(ui.getByTestId(`match-left-${id}`));
      fireEvent.press(ui.getByTestId(`match-right-${id}`));
    }
    press(ui, t('review_continue'));
    expect(onResult).toHaveBeenCalledWith({ '1': 0.7, '2': 0.6 });
  });
});

describe('sentence reorder', () => {
  const solution = ['我', '的', '朋友', '在', '中国', '工作。'];
  const view = (card: ReviewCard, onResult = jest.fn()) => ({
    ui: render(
      <SentenceReorderView model={{ kind: 'sentence_reorder', card, tokens: [...solution].reverse(), solution }} isRetry={false} onResult={onResult} />,
    ),
    onResult,
  });
  const solve = (ui: UI) => {
    for (let i = solution.length - 1; i >= 0; i--) fireEvent.press(ui.getByTestId(`reorder-pool-${i}`));
    press(ui, t('review_check'));
  };

  it('writes pinyin on the tiles of a new word, without the capital that marks the start', () => {
    const { ui } = view(friend());
    expect(ui.getByText('wǒ')).toBeTruthy();
    expect(ui.getByText('gōngzuò')).toBeTruthy();
    expect(ui.queryByText('Wǒ')).toBeNull();
  });

  it('caps a learned word that asked for it', () => {
    const { ui, onResult } = view(learned());
    expect(ui.queryByText('wǒ')).toBeNull();
    reveal(ui);
    solve(ui);
    press(ui, t('review_continue'));
    expect(onResult).toHaveBeenCalledWith(0.6);
  });

  it('keeps 0.9 without asking', () => {
    const { ui, onResult } = view(learned());
    solve(ui);
    press(ui, t('review_continue'));
    expect(onResult).toHaveBeenCalledWith(0.9);
  });
});

describe('flip card', () => {
  const view = (card: ReviewCard) => render(<FlashcardView model={{ kind: 'flashcard', card }} isRetry={false} onResult={jest.fn()} />);

  it('keeps the pinyin for the back', () => {
    const ui = view(friend());
    expect(ui.queryByText('péngyou')).toBeNull();
    press(ui, t('review_reveal'));
    expect(ui.getByText('péngyou')).toBeTruthy();
  });

  it('shows it at once when the learner always wants it', () => {
    useReadingSettingsStore.getState().setPinyinMode('always');
    expect(view(friend()).getByText('péngyou')).toBeTruthy();
  });
});

describe('tone choice', () => {
  const view = (onResult = jest.fn()) => ({
    ui: render(
      <ToneChoiceView
        model={{ kind: 'tone_choice', card: friend(), options: ['pèngyou', 'péngyou', 'pēngyou'], correctIndex: 1 }}
        isRetry={false}
        onResult={onResult}
      />,
    ),
    onResult,
  });

  it('shows the characters and a speaker, and neither the meaning nor a pinyin button before the answer', () => {
    const { ui } = view();
    expect(ui.getByText('朋友')).toBeTruthy();
    expect(ui.getByTestId('speak-tone')).toBeTruthy();
    expect(ui.queryByText('amico')).toBeNull();
    expect(canReveal(ui)).toBe(false);
    expect(ui.getAllByText('péngyou')).toHaveLength(1); // only as one of the options
  });

  it.each([[1, 0.8], [0, 0]])('option %i earns %d', (option, quality) => {
    const { ui, onResult } = view();
    fireEvent.press(ui.getByTestId(`tone-option-${option}`));
    expect(ui.getByText('amico')).toBeTruthy();
    press(ui, t('review_continue'));
    expect(onResult).toHaveBeenCalledWith(quality);
  });
});

describe('reading screens', () => {
  const dailyWord = {
    id: 'd', word: '朋友', article: null, partOfSpeech: 'noun', ipa: 'péngyou', meaningIt: 'amico', meaningEn: 'friend',
    example: '我的朋友在中国工作。', exampleIt: 'x', exampleEn: 'My friend works in China.', culturalNote: null,
    culturalNoteEn: null, grammarAngle: null, topicDomain: 'leisure', cefrBand: 'A1', date: '2026-11-26', isSaved: false,
  };
  const card = () => render(<WordCard word={dailyWord} saveState="idle" streakDays={0} onSave={jest.fn()} onSkip={jest.fn()} />);

  it('writes pinyin above the example', () => {
    const ui = card();
    expect(ui.getByText('Wǒ')).toBeTruthy();
    expect(ui.getByText('Zhōngguó')).toBeTruthy();
    expect(ui.getAllByText('péngyou').length).toBe(2); // headword and sentence
    expect(canReveal(ui)).toBe(false);
  });

  it('waits for a tap in tap mode', () => {
    useReadingSettingsStore.getState().setPinyinMode('tap');
    const ui = card();
    expect(ui.queryByText('Wǒ')).toBeNull();
    expect(ui.queryByText('péngyou')).toBeNull();
    expect(ui.getByText('我的朋友在中国工作。')).toBeTruthy();
    for (const button of ui.getAllByTestId('reveal-pinyin')) fireEvent.press(button);
    expect(ui.getByText('Wǒ')).toBeTruthy();
    expect(ui.getAllByText('péngyou').length).toBe(2);
  });

  it('leaves a German headword as it was', () => {
    setActivePackForTests(null);
    useReadingSettingsStore.getState().setPinyinMode('tap');
    const ui = render(<WordHero word="Haus" article="das" ipa="haʊs" />);
    expect(ui.getByText('/haʊs/')).toBeTruthy();
    expect(canReveal(ui)).toBe(false);
  });

  it('adds pinyin to a list row, except in tap mode', () => {
    const entry = {
      key: 'A1:朋友', word: '朋友', article: null, level: 'A1' as const, topic: 'leisure', translationIt: 'amico',
      translationEn: 'friend', status: 'todo' as const, savedId: null,
    };
    const row = () => render(<CatalogRow entry={entry as never} showLevel={false} onOpen={jest.fn()} />);
    expect(row().getByText('péngyou')).toBeTruthy();
    act(() => useReadingSettingsStore.getState().setPinyinMode('tap'));
    expect(row().queryByText('péngyou')).toBeNull();
  });

  it('sets Chinese upright and leaves the other languages in italics', () => {
    expect(exampleStyle().fontFamily).toBe('PlayfairDisplay_400Regular');
    setActivePackForTests(null);
    expect(exampleStyle().fontFamily).toBe('PlayfairDisplay_400Regular_Italic');
  });
});

describe('the setting', () => {
  it('offers three choices and stores the one tapped', () => {
    const ui = render(<PinyinSettings />);
    for (const key of ['settings_pinyin_auto', 'settings_pinyin_always', 'settings_pinyin_tap'] as const) {
      expect(ui.getByText(t(key))).toBeTruthy();
    }
    fireEvent.press(ui.getByTestId('pinyin-mode-tap'));
    expect(useReadingSettingsStore.getState().pinyinMode).toBe('tap');
    expect(ui.getByTestId('pinyin-mode-tap').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('is not there for a language without a reading layer', () => {
    setActivePackForTests(null);
    expect(render(<PinyinSettings />).toJSON()).toBeNull();
  });
});

describe('practice menu', () => {
  it('lists tone choice and find-the-mistake', async () => {
    (fetchVaultCards as jest.Mock).mockResolvedValue([friend()]);
    const ui = render(<PracticeMenuScreen />);
    await waitFor(() => expect(ui.getByTestId('practice-format-tone_choice')).toBeTruthy());
    expect(ui.getByTestId('practice-format-find_mistake')).toBeTruthy();
    expect(ui.getByText(t('practice_format_tone_choice'))).toBeTruthy();
  });
});
