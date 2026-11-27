/** TASK-072: the Chinese pack and the screens that follow its new properties. */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { zh } from '../src/languages/zh';
import { de } from '../src/languages/de';
import { es } from '../src/languages/es';
import { fr } from '../src/languages/fr';
import { setActivePackForTests } from '../src/languages';
import { testPack } from '../test-support/testPack';
import { testPackCjk } from '../test-support/testPackCjk';
import { buildChoiceCloze, hasGrammarDrill } from '../src/lib/grammar';
import { gradeTypedAnswer, buildCloze } from '../src/lib/cloze';
import { sentenceTokens, joinTokens } from '../src/lib/sentence';
import { buildCatalog } from '../src/lib/catalog';
import WordHero from '../src/components/ui/WordHero';
import VaultScreen from '../src/screens/VaultScreen';
import * as vaultService from '../src/services/vaultService';
import { useVaultStore } from '../src/store/useVaultStore';
import { generateWordInsight } from '../src/lib/ai/wordInsight';
import * as llm from '../src/lib/ai/llm';
import { t, setAppLocale } from '../src/i18n';
import { offeredLanguages } from '../src/i18n/language';
import type { WordBankEntry, CefrLevel } from '../src/data/wordbank';

jest.mock('../src/lib/ai/llm');
jest.mock('../src/services/vaultService');
jest.mock('../src/services/reviewService', () => ({ dueCount: jest.fn().mockResolvedValue(0) }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) }),
  useFocusEffect: (cb: () => void) => {
    const react = require('react');
    react.useEffect(() => cb(), []);
  },
}));

afterEach(() => { setActivePackForTests(null); setAppLocale('it'); });

describe('the Chinese pack', () => {
  it('has its identity, level, voice and offered languages', () => {
    expect(zh.code).toBe('zh');
    expect(zh.name).toBe('Chinese');
    expect(zh.app).toEqual({ name: 'ChineseBuddy', backupTag: 'ChineseBuddy', dbFile: 'chinesebuddy.db' });
    expect(zh.levels).toEqual(['A1']);
    expect(zh.sentences).toBe('segmented');
    expect(zh.pronunciation).toBe('pinyin');
    expect(zh.speech).toEqual({ locale: 'zh-CN', rate: 0.8 });
    expect(zh.ai.languageName).toBe('Mandarin Chinese');
    expect(zh.ai.rules!.join(' ')).toMatch(/simplified/i);
    expect(zh.ai.rules!.join(' ')).toMatch(/pinyin/i);
    expect([zh.articles, zh.gender, zh.cases]).toEqual([null, null, null]);
    expect(zh.quiz).toEqual([]);
    expect(zh.uiLanguages).toEqual(['it', 'en']);
    expect(Object.keys(zh.strings).sort()).toEqual(['en', 'it']);
  });

  it('the older packs write IPA and add no AI rule', () => {
    for (const p of [de, es, fr, testPack, testPackCjk]) {
      expect(p.pronunciation).toBe('ipa');
      expect(p.ai.rules).toBeUndefined();
    }
  });

  it('offers Italian and English only (never Chinese to a Chinese speaker)', () => {
    setActivePackForTests(zh);
    expect([...offeredLanguages()]).toEqual(['it', 'en']);
  });

  it('speaks of Chinese in both app languages', () => {
    setActivePackForTests(zh);
    setAppLocale('it');
    expect(t('welcome_subtitle')).toMatch(/cinese/);
    setAppLocale('en');
    expect(t('welcome_subtitle')).toMatch(/Chinese/);
    expect(t('speech_unavailable_body')).toMatch(/Chinese/);
  });

  it('grades typed characters exactly: a wrong character is wrong, spaces do not count', () => {
    setActivePackForTests(zh);
    expect(gradeTypedAnswer('中国', '中国')).toBe('exact');
    expect(gradeTypedAnswer(' 中 国 ', '中国')).not.toBe('wrong');
    expect(gradeTypedAnswer('一二三四六', '一二三四五')).toBe('wrong');
  });

  it('reads words and sentences from the segments', () => {
    const segments = ['“', '你', '好', '”', '，', '他', '说', '。'];
    const text = segments.join('');
    expect(sentenceTokens(text, segments, zh)).toEqual(['“你', '好”，', '他', '说。']);
    expect(joinTokens(['他', '说。'], zh)).toBe('他说。');
    expect(buildCloze(text, '他', zh, segments)).toEqual({ before: '“你好”，', after: '说。' });
    expect(buildChoiceCloze(text, 'QUESTION_PARTICLE', zh, segments)).toBeNull();
  });
});

describe('pinyin is shown as it is', () => {
  it('keeps the slashes of IPA', () => {
    expect(render(<WordHero word="Haus" article="das" ipa="haʊs" />).getByText('/haʊs/')).toBeTruthy();
  });

  it('has no slashes in a pinyin pack', () => {
    setActivePackForTests(zh);
    const ui = render(<WordHero word="你好" article={null} ipa="nǐ hǎo" />);
    expect(ui.getByText('nǐ hǎo')).toBeTruthy();
    expect(ui.queryByText('/nǐ hǎo/')).toBeNull();
  });
});

describe('word lists follow the pronunciation of a pinyin pack', () => {
  const entry = (word: string, ipa: string) =>
    ({ word, ipa, article: null, topic_domain: 'home', meaning_it: '', meaning_en: '' }) as unknown as WordBankEntry;
  const bank = (list: WordBankEntry[]) => ({ A1: list, A2: [], B1: [], B2: [], C1: [], C2: [] }) as Record<CefrLevel, WordBankEntry[]>;
  const order = (list: WordBankEntry[]) =>
    buildCatalog({ level: 'A1', topic: null }, null, new Map(), bank(list)).entries.map((e) => e.word);
  const list = [entry('我', 'wǒ'), entry('爸爸', 'bàba'), entry('八', 'bā'), entry('茶', 'chá'), entry('北京', 'Běijīng'), entry('吧', 'ba')];

  it('orders by pinyin: letters first, tones only between equal letters', () => {
    setActivePackForTests(zh);
    const words = order(list);
    expect(words.slice(0, 2).sort()).toEqual(['八', '吧'].sort());
    expect(words.slice(2)).toEqual(['爸爸', '北京', '茶', '我']);
  });

  it('is the same for any input order', () => {
    setActivePackForTests(zh);
    expect(order([...list].reverse())).toEqual(order(list));
  });

  it('a pack with IPA still orders by the word', () => {
    expect(order([entry('Zug', 'a'), entry('Brot', 'z')])).toEqual(['Brot', 'Zug']);
  });
});

describe('the grammar button', () => {
  beforeEach(() => {
    useVaultStore.setState({ items: [], page: 1, total: 0, isLoading: false, error: null });
    (vaultService.fetchVault as jest.Mock).mockResolvedValue({ items: [], total: 0 });
  });

  it('knows which packs have a drill', () => {
    for (const p of [de, es, fr, testPack, testPackCjk]) expect(hasGrammarDrill(p)).toBe(true);
    expect(hasGrammarDrill(zh)).toBe(true);
    const bare = { ...zh, choices: null, classifiers: null };
    expect(hasGrammarDrill(bare)).toBe(false);
    expect(hasGrammarDrill({ ...bare, choices: testPackCjk.choices })).toBe(true);
  });

  it('is shown when the pack has a drill', async () => {
    const ui = render(<VaultScreen />);
    await waitFor(() => expect(ui.getByLabelText(t('vault_grammar_cta'))).toBeTruthy());
  });

  it('is hidden when it has none', async () => {
    setActivePackForTests({ ...zh, choices: null, classifiers: null });
    const ui = render(<VaultScreen />);
    await waitFor(() => expect(ui.getByLabelText(t('vault_today_cta'))).toBeTruthy());
    expect(ui.queryByLabelText(t('vault_grammar_cta'))).toBeNull();
  });
});

describe('the AI prompt', () => {
  const ask = async () => {
    (llm.callLLM as jest.Mock).mockResolvedValue('{"examples":[{"target":"a","native":"b"}],"note":"n","exercise":null}');
    await generateWordInsight({ word: '书', article: null, meaningNative: 'libro', cefrLevel: 'A1', nativeLanguage: 'it' });
    return (llm.callLLM as jest.Mock).mock.calls.at(-1)[0].messages[0].content as string;
  };

  it('lists the extra rules of the pack after its own, and adds nothing for a pack without', async () => {
    setActivePackForTests(zh);
    const withRules = await ask();
    setActivePackForTests({ ...zh, ai: { languageName: zh.ai.languageName } });
    const without = await ask();
    expect(without.endsWith('- no markdown, no text outside the JSON')).toBe(true);
    expect(withRules).toBe(`${without}\n${zh.ai.rules!.map((r) => `- ${r}`).join('\n')}`);
  });
});
