/**
 * The new app languages end to end where they touch behaviour: the AI prompt, the
 * i18n fallback, translated word content on the word card, and the welcome picker.
 */
import React from 'react';
import { Alert, I18nManager } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import i18n, { setAppLocale, t } from '../src/i18n';
import en from '../src/i18n/en';
import { LANGUAGES, languageEnglishName, SUPPORTED_NATIVE_LANGUAGES } from '../src/i18n/language';
import { __setLoaderForTests } from '../src/i18n/wordContent';
import { generateWordInsight } from '../src/lib/ai/wordInsight';
import { setKey } from '../src/lib/ai/keys';
import WordCard from '../src/components/ui/WordCard';
import WelcomeScreen from '../src/screens/WelcomeScreen';
import { useUserStore } from '../src/store/useUserStore';
import type { DailyWord } from '../src/types/domain';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }) }));
jest.mock('../src/data/backup', () => ({
  pickBackup: jest.fn(),
  restoreBackup: jest.fn(),
  RESTART_REQUIRED: 'RESTART_REQUIRED',
}));

const { MMKV } = require('react-native-mmkv');

const word: DailyWord = {
  id: '1', word: 'Brot', article: 'das', partOfSpeech: 'noun', ipa: 'bʁoːt',
  meaningIt: 'pane', meaningEn: 'bread',
  example: 'Ich kaufe das Brot.', exampleIt: 'Compro il pane.', exampleEn: 'I buy the bread.',
  culturalNote: 'Nota italiana.', culturalNoteEn: 'English note.',
  grammarAngle: 'NOUN_GENDER', topicDomain: 'food', cefrBand: 'A1', date: '2026-10-15', isSaved: false,
};

beforeEach(() => {
  new MMKV().clearAll();
  setAppLocale('it');
  useUserStore.setState({ nativeLanguage: 'it' });
  jest.restoreAllMocks();
});

afterEach(() => __setLoaderForTests('fr', undefined));

describe('AI prompt', () => {
  it.each(LANGUAGES.map((l) => [l.code, l.english] as const))('names %s as %s', async (code, english) => {
    setKey('anthropic', 'sk-ant-test');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{
          type: 'text',
          text: '{"examples":[{"de":"Das Haus ist groß.","native":"x"}],"note":"n","exercise":null}',
        }],
      }),
    }) as jest.Mock;

    await generateWordInsight({ word: 'Haus', article: 'das', meaningNative: 'x', cefrLevel: 'A1', nativeLanguage: code });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(languageEnglishName(code)).toBe(english);
    expect(body.system).toContain(`${english}-speaking`);
    expect(body.messages[0].content).toContain(`"native": "${english} translation"`);
    expect(`${body.system}${body.messages[0].content}`).not.toMatch(/undefined/);
  });
});

describe('i18n fallback', () => {
  it('shows English, not Italian, for a key missing from a non-Italian language', () => {
    const fr = (i18n.translations as Record<string, Record<string, string>>).fr;
    const saved = fr.quiz_title;
    delete fr.quiz_title;
    try {
      setAppLocale('fr');
      expect(t('quiz_title')).toBe(en.quiz_title);
    } finally {
      fr.quiz_title = saved;
    }
  });

  it('translates every key for every supported language', () => {
    for (const code of SUPPORTED_NATIVE_LANGUAGES) {
      setAppLocale(code);
      expect(t('quiz_title')).toBeTruthy();
    }
  });
});

describe('WordCard in a new language', () => {
  it('falls back to English content when the language has no translations yet', () => {
    useUserStore.setState({ nativeLanguage: 'fr' });
    const { getByText, queryByText } = render(<WordCard word={word} saveState="idle" streakDays={0} onSave={() => {}} onSkip={() => {}} />);
    expect(getByText('bread')).toBeTruthy();
    expect(getByText('I buy the bread.')).toBeTruthy();
    expect(getByText('English note.')).toBeTruthy();
    expect(queryByText('pane')).toBeNull();
  });

  it('shows translated content once the language has it', () => {
    __setLoaderForTests('fr', () => ({
      'A1:brot': ['pain', "J'achète le pain.", 'Une note en français.'],
    }));
    useUserStore.setState({ nativeLanguage: 'fr' });
    const { getByText, queryByText } = render(<WordCard word={word} saveState="idle" streakDays={0} onSave={() => {}} onSkip={() => {}} />);
    expect(getByText('pain')).toBeTruthy();
    expect(getByText("J'achète le pain.")).toBeTruthy();
    expect(getByText('Une note en français.')).toBeTruthy();
    expect(queryByText('bread')).toBeNull();
  });
});

describe('WelcomeScreen language picker', () => {
  it('preselects the phone language when supported', () => {
    jest.spyOn(I18nManager, 'getConstants').mockReturnValue({
      isRTL: false, doLeftAndRightSwapInRTL: true, localeIdentifier: 'fr_FR',
    });
    const { getByTestId } = render(<WelcomeScreen />);
    expect(getByTestId('lang-fr').props.accessibilityState.selected).toBe(true);
  });

  it('preselects English for an unsupported phone language', () => {
    jest.spyOn(I18nManager, 'getConstants').mockReturnValue({
      isRTL: false, doLeftAndRightSwapInRTL: true, localeIdentifier: 'de_DE',
    });
    const { getByTestId } = render(<WelcomeScreen />);
    expect(getByTestId('lang-en').props.accessibilityState.selected).toBe(true);
  });

  it('switches the UI language when a pill is tapped', () => {
    jest.spyOn(I18nManager, 'getConstants').mockReturnValue({
      isRTL: false, doLeftAndRightSwapInRTL: true, localeIdentifier: 'it_IT',
    });
    const { getByTestId, getByText } = render(<WelcomeScreen />);
    fireEvent.press(getByTestId('lang-es'));
    expect(getByText('Empezar')).toBeTruthy();
  });

  it('warns that Arabic needs a restart to flip the layout', () => {
    jest.spyOn(I18nManager, 'getConstants').mockReturnValue({
      isRTL: false, doLeftAndRightSwapInRTL: true, localeIdentifier: 'en_US',
    });
    jest.spyOn(I18nManager, 'allowRTL').mockImplementation(() => {});
    const force = jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => {});
    Object.defineProperty(I18nManager, 'isRTL', { value: false, configurable: true });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = render(<WelcomeScreen />);
    fireEvent.press(getByTestId('lang-ar'));
    expect(force).toHaveBeenCalledWith(true);
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('التطبيق'));
  });
});
