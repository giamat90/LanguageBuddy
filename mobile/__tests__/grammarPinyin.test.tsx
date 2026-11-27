/** TASK-076: pinyin on the drill and on find-the-mistake, and no tone that gives an answer away. */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { zh } from '../src/languages/zh';
import { setActivePackForTests } from '../src/languages';
import { setAppLocale, t } from '../src/i18n';
import { useReadingSettingsStore } from '../src/store/useReadingSettingsStore';
import GrammarScreen from '../src/screens/GrammarScreen';
import FindMistakeView from '../src/components/exercises/FindMistakeView';
import TypedClozeView from '../src/components/exercises/TypedClozeView';
import SentenceReorderView from '../src/components/exercises/SentenceReorderView';
import { buildDrill } from '../src/services/grammarService';
import type { ReviewCard } from '../src/services/reviewService';

jest.mock('../src/services/grammarService', () => ({ buildDrill: jest.fn(), recordAnswer: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));

const card = (over: Partial<ReviewCard> = {}): ReviewCard => ({
  id: '1', word: '书', article: null, translationIt: 'libro', translationEn: 'book',
  example: '他有一本书。', segments: ['他', '有', '一', '本', '书', '。'], exampleIt: 'x', exampleEn: 'x',
  partOfSpeech: 'noun', cefrBand: 'A1', timesSeen: 1, retentionScore: 0.5,
  pronunciation: 'shū', syllables: [{ text: 'shū', alsoTyped: [], otherTones: [] }],
  examplePinyin: ['Tā', 'yǒu', 'yì', 'běn', 'shū'], measure: '本', measureAlso: [], ...over,
});
const learned = (over: Partial<ReviewCard> = {}) => card({ timesSeen: 8, retentionScore: 0.95, ...over });

beforeEach(() => {
  jest.clearAllMocks();
  setActivePackForTests(zh);
  setAppLocale('en');
  useReadingSettingsStore.getState().setPinyinMode('auto');
});
afterEach(() => { setActivePackForTests(null); setAppLocale('it'); });

describe('typed cloze', () => {
  it('writes 一 before the blank in its citation tone', () => {
    const c = card({ word: '本', pronunciation: 'běn', syllables: [{ text: 'běn', alsoTyped: [], otherTones: [] }] });
    const ui = render(
      <TypedClozeView model={{ kind: 'typed_cloze', card: c, before: '他有一', after: '书。' }} isRetry={false} onResult={jest.fn()} />,
    );
    expect(ui.getByText('yī')).toBeTruthy();
    expect(ui.queryByText('yì')).toBeNull();
  });
});

describe('sentence reorder', () => {
  it('writes every 一 in its citation tone: the tile order must not show through', () => {
    const solution = ['他', '有', '一', '本', '书。'];
    const ui = render(
      <SentenceReorderView model={{ kind: 'sentence_reorder', card: card(), tokens: [...solution].reverse(), solution }} isRetry={false} onResult={jest.fn()} />,
    );
    expect(ui.getByText('yī')).toBeTruthy();
    expect(ui.queryByText('yì')).toBeNull();
  });
});

describe('find the mistake', () => {
  const view = (c: ReviewCard, onResult = jest.fn()) => ({
    ui: render(
      <FindMistakeView
        model={{
          kind: 'find_mistake', card: c, mistakeKind: 'measure', ruleCode: 'MEASURE_WORD',
          tokens: ['他', '有', '一', '张', '书。'], wrongIndex: 3, correctToken: '本',
          options: ['条', '本', '张'], correctOption: 1,
        }}
        isRetry={false}
        onResult={onResult}
      />,
    ),
    onResult,
  });
  const solve = (ui: ReturnType<typeof render>) => {
    fireEvent.press(ui.getByTestId('mistake-token-3'));
    fireEvent.press(ui.getByTestId('mistake-option-1'));
    fireEvent.press(ui.getByText(t('review_continue')));
  };

  it('shows the pinyin of what is written, with 一 neutral', () => {
    const { ui } = view(card());
    expect(ui.getByText('zhāng')).toBeTruthy(); // the wrong word, as shown
    expect(ui.queryByText('běn')).toBeNull();
    expect(ui.getByText('yī')).toBeTruthy();
    expect(ui.queryByText('yì')).toBeNull();
  });

  it('shows the pinyin of the options in the fix step', () => {
    const { ui } = view(card());
    fireEvent.press(ui.getByTestId('mistake-token-3'));
    expect(ui.getByText('běn')).toBeTruthy();
    expect(ui.getByText('tiáo')).toBeTruthy();
  });

  it('hides it for a learned word; asking caps the credit', () => {
    const { ui, onResult } = view(learned());
    expect(ui.queryByText('zhāng')).toBeNull();
    fireEvent.press(ui.getByTestId('reveal-pinyin'));
    expect(ui.getByText('zhāng')).toBeTruthy();
    solve(ui);
    expect(onResult).toHaveBeenCalledWith(0.6);
  });

  it('keeps full credit without asking', () => {
    const { ui, onResult } = view(learned());
    solve(ui);
    expect(onResult).toHaveBeenCalledWith(0.9);
  });

  it('is unchanged for German', () => {
    setActivePackForTests(null);
    const { ui } = view(learned({ examplePinyin: undefined, pronunciation: undefined }));
    expect(ui.queryByTestId('reveal-pinyin')).toBeNull();
  });
});

describe('the drill', () => {
  const question = {
    id: 'measure:书', ruleCode: 'MEASURE_WORD', before: '一', after: '书', answer: '本', options: ['本', '张', '条'],
    word: '书', translationIt: 'libro', translationEn: 'book', blank: 1, optionReadings: ['běn', 'zhāng', 'tiáo'],
    cells: [
      { word: '一', lead: '', trail: '', pinyin: 'yī' },
      { word: '本', lead: '', trail: '', pinyin: 'běn' },
      { word: '书', lead: '', trail: '', pinyin: 'shū' },
    ],
  };
  const open = async () => {
    (buildDrill as jest.Mock).mockResolvedValue([question]);
    const ui = render(<GrammarScreen />);
    await ui.findByText(t('review_progress', { current: 1, total: 1 }));
    return ui;
  };

  it('asks for the measure word, with pinyin everywhere but the blank', async () => {
    const ui = await open();
    expect(ui.getByText(t('grammar_prompt_measure'))).toBeTruthy();
    expect(ui.getByText('yī')).toBeTruthy();
    expect(ui.getByText('shū')).toBeTruthy();
    expect(ui.getAllByText('běn')).toHaveLength(1); // under its option only
    expect(ui.getByText('_____')).toBeTruthy();
    expect(ui.getByText('libro')).toBeTruthy(); // the noun's meaning
  });

  it('fills the blank after the answer and explains a mistake', async () => {
    const ui = await open();
    fireEvent.press(ui.getByLabelText('张'));
    expect(ui.getByText('běn')).toBeTruthy();
    expect(ui.queryByText('_____')).toBeNull();
    expect(ui.getByText(t('grammar_rule_MEASURE_WORD' as never))).toBeTruthy();
  });

  it('waits for a tap in tap mode', async () => {
    useReadingSettingsStore.getState().setPinyinMode('tap');
    const ui = await open();
    expect(ui.queryByText('shū')).toBeNull();
    expect(ui.queryByText('zhāng')).toBeNull();
    fireEvent.press(ui.getByTestId('reveal-pinyin'));
    expect(ui.getByText('shū')).toBeTruthy();
    expect(ui.getByText('zhāng')).toBeTruthy();
  });
});
