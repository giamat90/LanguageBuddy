import * as Speech from 'expo-speech';
import React from 'react';
import { render } from '@testing-library/react-native';
import { de } from '../src/languages/de';
import { getActivePack, setActivePackForTests } from '../src/languages';
import { testPack } from '../test-support/testPack';
import { buildCloze, gradeTypedAnswer } from '../src/lib/cloze';
import {
  buildArticleQuestion, buildCaseCloze, buildCaseQuestion, caseOptions, caseRules,
} from '../src/lib/grammar';
import { buildFindMistake, splitToken } from '../src/lib/exercises/mistake';
import { speak } from '../src/lib/speech';
import { generateWordInsight } from '../src/lib/ai/wordInsight';
import ArticleBadge from '../src/components/ui/ArticleBadge';
import { colors } from '../src/theme/colors';
import type { ReviewCard } from '../src/services/reviewService';
import * as llm from '../src/lib/ai/llm';

jest.mock('../src/lib/ai/llm');

const speechMock = Speech as unknown as { __last(): { text: string; opts: any } | null; __reset(): void };
const seq = (...v: number[]): (() => number) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

afterEach(() => setActivePackForTests(null));

function card(over: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id: 'c1', word: 'Haus', article: 'das', translationIt: 'casa', translationEn: 'house',
    exampleDe: 'Das Haus ist sehr groß.', exampleIt: '', exampleEn: '', partOfSpeech: 'noun',
    cefrBand: 'A1', topicDomain: 'home', timesSeen: 3, retentionScore: 0.7, ...over,
  };
}

describe('the German pack reproduces the old constants', () => {
  it('has the same letters, folding, speech and AI names', () => {
    expect(de.code).toBe('de');
    expect(de.name).toBe('German');
    expect(de.letters.source).toBe('([A-Za-zÄÖÜäöüß]+)');
    expect(de.fold('  Straße ÄÖÜ ')).toBe('strasse aou');
    expect(de.typoMinLength).toBe(5);
    expect(de.speech).toEqual({ locale: 'de-DE', rate: 0.9 });
    expect(de.ai).toEqual({ languageName: 'German', exampleKey: 'de' });
    expect(de.punctuation.lead.source).toBe("^[„\"«(‹‚“‘']+");
    expect(de.punctuation.trail.source).toBe('[.,!?;:“”"»)›’\'…]+$');
  });

  it('has the same articles, gender and case tables', () => {
    expect(de.articles!.forms).toEqual(['der', 'die', 'das']);
    expect(de.articles!.rule).toBe('NOUN_GENDER');
    expect([de.articles!.genderOf('der'), de.articles!.genderOf('die'), de.articles!.genderOf('das')]).toEqual(['m', 'f', 'n']);
    expect(de.articles!.genderOf('el')).toBeUndefined();
    expect(de.gender!.forms).toEqual({ der: ['der', 'den', 'dem', 'des'], die: ['die', 'der'], das: ['das', 'dem', 'des'] });
    expect(de.gender!.neverValid).toEqual({ der: ['die', 'das'], die: ['das', 'den', 'dem', 'des'], das: ['der', 'die', 'den'] });
    expect(de.gender!.pluralLookalike.source).toBe('(er|el|en|chen|lein)$');
    expect(de.cases!.ruleForms).toEqual({
      ACCUSATIVE_MASC: ['einen'], ACCUSATIVE_PREP: ['einen'], DATIV_PREP: ['dem', 'einem'],
      DATIV_INDIRECT_OBJ: ['dem', 'einem'], GENITIV_CASE: ['des', 'eines'],
    });
    expect(de.cases!.definiteForms).toEqual(['der', 'die', 'das', 'dem', 'den', 'des']);
    expect(de.cases!.indefiniteForms).toEqual(['ein', 'eine', 'einen', 'einem', 'einer', 'eines']);
    expect(de.cases!.ruleForForm('des', 'x')).toBe('GENITIV_CASE');
    expect(de.cases!.ruleForForm('einen', 'für')).toBe('ACCUSATIVE_PREP');
    expect(de.cases!.ruleForForm('einen', 'sehen')).toBe('ACCUSATIVE_MASC');
    expect(de.cases!.ruleForForm('dem', 'mit')).toBe('DATIV_PREP');
    expect(de.cases!.ruleForForm('dem', 'gibt')).toBe('DATIV_INDIRECT_OBJ');
  });
});

describe('the active pack', () => {
  it('is German by default and can be switched and restored in tests', () => {
    expect(getActivePack()).toBe(de);
    setActivePackForTests(testPack);
    expect(getActivePack()).toBe(testPack);
    setActivePackForTests(null);
    expect(getActivePack()).toBe(de);
  });
});

describe('a second language plugs in (testPack: accents, el/la, no cases)', () => {
  it('folds accents when grading a typed answer', () => {
    expect(gradeTypedAnswer('cafe', 'café', testPack)).toBe('close');
    expect(gradeTypedAnswer('Café', 'café', testPack)).toBe('exact');
    expect(gradeTypedAnswer('cafe', 'café')).toBe('wrong'); // German pack: é is not folded
    expect(gradeTypedAnswer('cafés', 'café', testPack)).toBe('wrong'); // 4 letters: no typo allowance
    expect(gradeTypedAnswer('ventnaa', 'ventana', testPack)).toBe('wrong');
    expect(gradeTypedAnswer('ventana', 'ventanas', testPack)).toBe('close'); // one typo, 5+ letters
  });

  it('takes the active pack when none is passed', () => {
    setActivePackForTests(testPack);
    expect(gradeTypedAnswer('cafe', 'café')).toBe('close');
    expect(buildCloze('¿Dónde está el baño?', 'baño')).toEqual({ before: '¿Dónde está el ', after: '?' });
  });

  it('finds words with accents and ñ', () => {
    expect(buildCloze('¿Dónde está el baño?', 'baño', testPack)).toEqual({ before: '¿Dónde está el ', after: '?' });
    expect(buildCloze('¿Dónde está el baño?', 'baño')).toBeNull(); // German letters split ñ
  });

  it('has no case drill', () => {
    expect(buildCaseCloze('Ich gebe dem Mann ein Buch.', 'DATIV_INDIRECT_OBJ', testPack)).toBeNull();
    expect(buildCaseQuestion({
      word: 'Mann', example_de: 'Ich gebe dem Mann ein Buch.', example_it: '', example_en: '', grammar_angle: 'DATIV_INDIRECT_OBJ',
    }, Math.random, testPack)).toBeNull();
    setActivePackForTests(testPack);
    expect(caseRules()).toEqual([]);
    setActivePackForTests(null);
    expect(caseRules()).toContain('GENITIV_CASE');
  });

  it('drills el/la for the article question', () => {
    const q = buildArticleQuestion({ word: 'casa', article: 'la', meaning_it: 'casa', meaning_en: 'house' }, () => 0.3, testPack)!;
    expect([...q.options].sort()).toEqual(['el', 'la']);
    expect(q.answer).toBe('la');
    expect(buildArticleQuestion({ word: 'Haus', article: 'das', meaning_it: '', meaning_en: '' }, Math.random, testPack)).toBeNull();
  });

  it('finds only gender mistakes, and none without an article slot', () => {
    const c = card({ word: 'perro', article: 'el', exampleDe: 'El perro come la carne ahora', partOfSpeech: 'noun' });
    const m = buildFindMistake(c, seq(0.1, 0.1, 0.1), testPack)!;
    expect(m.mistakeKind).toBe('gender');
    // sentence-initial: the capital letter is kept on the swapped form
    expect(m.tokens[m.wrongIndex]).toBe('La');
    expect(m.correctToken).toBe('El');
    expect([...m.options].sort()).toEqual(['El', 'La']);
    const noSlot = card({ word: 'perro', article: 'el', exampleDe: 'Corre rápido por el parque grande', partOfSpeech: 'noun' });
    expect(buildFindMistake(noSlot, () => 0.1, testPack)).toBeNull();
  });

  it('splits a token with the pack punctuation', () => {
    expect(splitToken('¿Dónde', testPack)).toEqual({ lead: '¿', core: 'Dónde', trail: '' });
    expect(splitToken('¿Dónde')).toEqual({ lead: '', core: '¿Dónde', trail: '' });
  });

  it('speaks with the pack locale', () => {
    const h = { onDone: jest.fn(), onStopped: jest.fn(), onError: jest.fn() };
    speechMock.__reset();
    speak('la casa', h);
    expect(speechMock.__last()!.opts.language).toBe('de-DE');
    setActivePackForTests(testPack);
    speak('la casa', h);
    expect(speechMock.__last()!.opts.language).toBe('es-ES');
  });

  it('names the language of the pack in the AI prompt', async () => {
    (llm.callLLM as jest.Mock).mockResolvedValue(
      JSON.stringify({ examples: [{ de: 'a', native: 'b' }], note: 'n', exercise: { sentence: 's ___', answer: 'a' } }),
    );
    setActivePackForTests(testPack);
    await generateWordInsight({ word: 'casa', article: 'la', meaningNative: 'casa', cefrLevel: 'A1', nativeLanguage: 'it' });
    const arg = (llm.callLLM as jest.Mock).mock.calls.at(-1)[0];
    expect(arg.system).toContain('learning Spanish');
    expect(arg.system).not.toContain('German');
    expect(arg.messages[0].content).toContain('a Spanish sentence');
  });

  it('colors the article badge by the pack gender', () => {
    const color = (article: string) => {
      const r = render(React.createElement(ArticleBadge, { article }));
      return (r.getByText(article).props.style as any[]).flat().find((s) => s && s.color)?.color;
    };
    expect(color('der')).toBe(colors.derBlue);
    expect(color('die')).toBe(colors.diePink);
    expect(color('das')).toBe(colors.dasGray);
    setActivePackForTests(testPack);
    expect(color('el')).toBe(colors.derBlue);
    expect(color('la')).toBe(colors.diePink);
    expect(color('xx')).toBe(colors.muted);
  });
});

describe('caseOptions with the pack', () => {
  it('draws distractors from the same definiteness family', () => {
    const o = caseOptions('dem', () => 0.2, de);
    expect(o).toContain('dem');
    expect(o.every((f) => de.cases!.definiteForms.includes(f))).toBe(true);
  });
});

describe('the grammar drill follows the pack', () => {
  const sqlite = require('expo-sqlite');
  const { _resetDbForTests } = require('../src/data/db');
  const { buildDrill } = require('../src/services/grammarService');
  beforeEach(() => { sqlite.__reset(); _resetDbForTests(); });

  it('asks only article questions when the language has no cases', async () => {
    setActivePackForTests({ ...de, cases: null });
    const qs = await buildDrill('B1', 30);
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.every((q: { ruleCode: string }) => q.ruleCode === 'NOUN_GENDER')).toBe(true);
  });

  it('still mixes in case questions for German', async () => {
    const qs = await buildDrill('B1', 30);
    expect(qs.some((q: { ruleCode: string }) => q.ruleCode !== 'NOUN_GENDER')).toBe(true);
  });

  it('builds nothing (and does not crash) for a language whose articles match no bank word', async () => {
    setActivePackForTests(testPack);
    expect(await buildDrill('A1', 10)).toEqual([]);
  });
});
