/** TASK-076: the pinyin and tones primer, in onboarding and from the grammar screen. */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import { zh } from '../src/languages/zh';
import { setActivePackForTests } from '../src/languages';
import { testPackCjk } from '../test-support/testPackCjk';
import { READING_TARGET_KEYS, requiredTargetKeys } from '../src/languages/targetStrings';
import { setAppLocale, t } from '../src/i18n';
import PrimerScreen from '../src/screens/PrimerScreen';
import WelcomeScreen from '../src/screens/WelcomeScreen';
import GrammarScreen from '../src/screens/GrammarScreen';
import { buildDrill, recordAnswer } from '../src/services/grammarService';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock('../src/services/grammarService', () => ({ buildDrill: jest.fn(), recordAnswer: jest.fn() }));
jest.mock('../src/services/restoreService', () => ({ rehydrateAfterRestore: jest.fn() }));
jest.mock('../src/data/backup', () => ({ pickBackup: jest.fn(), restoreBackup: jest.fn(), RESTART_REQUIRED: 'r', backupErrorText: jest.fn() }));

const SECTIONS = ['tones', 'tone_changes', 'breath', 'jqx', 'retroflex', 'zcs', 'vowels'];

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  setActivePackForTests(zh);
  setAppLocale('en');
});
afterEach(() => { setActivePackForTests(null); setAppLocale('it'); });

describe('the primer content', () => {
  it('has its sections, each with examples written in characters and pinyin', () => {
    expect(zh.primer!.sections.map((s) => s.id)).toEqual(SECTIONS);
    for (const section of zh.primer!.sections) {
      expect(section.examples.length).toBeGreaterThan(0);
      for (const e of section.examples) {
        expect(e.text).toMatch(/^[㐀-鿿]+$/);
        expect(e.reading).toMatch(/^[a-zāáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜ ]+$/);
      }
    }
  });

  it('shows the four tones and the neutral one', () => {
    expect(zh.primer!.sections[0].examples.map((e) => e.reading)).toEqual(['mā', 'má', 'mǎ', 'mà', 'māma']);
  });

  it('requires its texts in every app language', () => {
    const keys = requiredTargetKeys(zh);
    expect(keys).toEqual(expect.arrayContaining([
      ...READING_TARGET_KEYS, 'primer_title', 'primer_intro', 'primer_continue', 'grammar_prompt_measure',
      'grammar_rule_MEASURE_WORD', 'grammar_rule_SHI_ZAI_YOU', 'grammar_rule_QUESTION_PARTICLE',
      'grammar_rule_ER_LIANG', 'grammar_rule_BU_MEI',
      ...SECTIONS.flatMap((id) => [`primer_${id}_title`, `primer_${id}_text`]),
    ]));
    for (const ui of ['it', 'en'] as const) for (const key of keys) expect([key, Boolean(zh.strings[ui]![key])]).toEqual([key, true]);
    expect(requiredTargetKeys(testPackCjk).some((k) => k.startsWith('primer_'))).toBe(false);
  });
});

describe('PrimerScreen', () => {
  it('lists the sections and reads an example aloud', async () => {
    const ui = render(<PrimerScreen />);
    expect(ui.getByText(t('primer_title'))).toBeTruthy();
    for (const id of SECTIONS) expect(ui.getByText(t(`primer_${id}_title` as never))).toBeTruthy();
    fireEvent.press(ui.getByTestId('primer-example-tones-0'));
    const spoken = (Speech as unknown as { __last(): { text: string; opts: { language: string } } }).__last();
    expect([spoken.text, spoken.opts.language]).toEqual(['妈', 'zh-CN']);
  });

  it('goes back when it was opened from the app', () => {
    const ui = render(<PrimerScreen />);
    expect(ui.queryByText(t('primer_continue'))).toBeNull();
    fireEvent.press(ui.getByLabelText(t('nav_back')));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('continues to the topics during onboarding', () => {
    mockParams = { from: 'onboarding', nativeLanguage: 'en' };
    const ui = render(<PrimerScreen />);
    fireEvent.press(ui.getByText(t('primer_continue')));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/topics', params: { cefrLevel: 'A1', nativeLanguage: 'en' } });
  });

  it('shows nothing for a language without one', () => {
    setActivePackForTests(null);
    expect(render(<PrimerScreen />).queryByTestId('primer-example-tones-0')).toBeNull();
  });
});

describe('onboarding', () => {
  const start = () => {
    const ui = render(<WelcomeScreen />);
    fireEvent.press(ui.getByText(t('welcome_cta')));
  };

  it('goes through the primer', () => {
    start();
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/primer-intro', params: { from: 'onboarding', nativeLanguage: expect.any(String) },
    });
  });

  it('goes straight to the topics without a primer', () => {
    setActivePackForTests(testPackCjk);
    start();
    expect(mockRouter.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/topics' }));
  });
});

describe('the grammar screen', () => {
  const question = {
    id: 'measure:书', ruleCode: 'MEASURE_WORD', before: '一', after: '书', answer: '本', options: ['本', '张', '条'],
    word: '书', translationIt: 'libro', translationEn: 'book', blank: 1, optionReadings: ['běn', 'zhāng', 'tiáo'],
    cells: [
      { word: '一', lead: '', trail: '', pinyin: 'yī' },
      { word: '本', lead: '', trail: '', pinyin: 'běn' },
      { word: '书', lead: '', trail: '', pinyin: 'shū' },
    ],
  };

  it('links to the primer', async () => {
    (buildDrill as jest.Mock).mockResolvedValue([question]);
    const ui = render(<GrammarScreen />);
    fireEvent.press(await ui.findByText(t('primer_title')));
    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/primer');
  });

  // TASK-080: without its own label the link inherits the guide link's on Android, where the view is reused.
  it('names the way back on the score screen', async () => {
    (buildDrill as jest.Mock).mockResolvedValue([question]);
    (recordAnswer as jest.Mock).mockResolvedValue(undefined);
    const ui = render(<GrammarScreen />);
    fireEvent.press(await ui.findByLabelText('本'));
    fireEvent.press(ui.getByText(t('grammar_finish')));
    fireEvent.press(ui.getByLabelText(t('review_back')));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('has no link for a language without one', async () => {
    setActivePackForTests(null);
    (buildDrill as jest.Mock).mockResolvedValue([{ ...question, cells: undefined, ruleCode: 'NOUN_GENDER' }]);
    const ui = render(<GrammarScreen />);
    await ui.findByText(t('review_progress', { current: 1, total: 1 }));
    expect(ui.queryByTestId('grammar-primer')).toBeNull();
  });
});
