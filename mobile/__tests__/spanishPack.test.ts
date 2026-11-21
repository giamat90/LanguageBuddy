import React from 'react';
import { render } from '@testing-library/react-native';
import { es } from '../src/languages/es';
import { de } from '../src/languages/de';
import { setActivePackForTests } from '../src/languages';
import { gradeTypedAnswer, buildCloze } from '../src/lib/cloze';
import { buildArticleQuestion } from '../src/lib/grammar';
import { buildFindMistake, splitToken } from '../src/lib/exercises/mistake';
import { speak } from '../src/lib/speech';
import ArticleBadge from '../src/components/ui/ArticleBadge';
import { colors } from '../src/theme/colors';
import { coerceNativeLanguage } from '../src/i18n/language';
import type { ReviewCard } from '../src/services/reviewService';

const speechMock = require('expo-speech') as { __last(): { opts: any } | null };

beforeEach(() => setActivePackForTests(es));
afterEach(() => setActivePackForTests(null));

const seq = (...v: number[]): (() => number) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
function card(over: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id: 'c', word: 'perro', article: 'el', translationIt: 'cane', translationEn: 'dog',
    example: 'El perro come la carne ahora', exampleIt: '', exampleEn: '', partOfSpeech: 'noun',
    cefrBand: 'A1', topicDomain: 'home', timesSeen: 1, retentionScore: 0.5, grammarAngle: null, ...over,
  } as ReviewCard;
}

describe('the Spanish pack data', () => {
  it('has its identity, voice, quiz and offered languages', () => {
    expect(es.code).toBe('es');
    expect(es.app).toEqual({ name: 'SpanishBuddy', backupTag: 'SpanishBuddy', dbFile: 'spanishbuddy.db' });
    expect(es.speech).toEqual({ locale: 'es-US', rate: 0.9 });
    expect(es.ai).toEqual({ languageName: 'Spanish' });
    expect(es.quiz.map((q) => q.correctIndex)).toEqual([0, 0, 0, 1, 1]);
    expect(es.uiLanguages).toHaveLength(12);
    expect(es.uiLanguages).not.toContain('es');
    expect(es.cases).toBeNull();
    expect(Object.keys(es.choices!.ruleSets).sort()).toEqual(['DIRECT_OBJECT_PRONOUN', 'POR_PARA', 'SER_ESTAR']);
    expect(Object.keys(es.strings).sort()).toEqual([...es.uiLanguages].sort());
  });

  it('German stays without choices', () => expect(de.choices).toBeNull());

  it('folds vowel accents and ü but keeps ñ', () => {
    expect(es.fold('  CAMIÓN ')).toBe('camion');
    expect(es.fold('pingüino')).toBe('pinguino');
    expect(es.fold('Año')).toBe('año');
  });

  it('speaks with the Latin American voice', () => {
    speak('el niño', { onDone() {}, onStopped() {}, onError() {} });
    expect(speechMock.__last()!.opts.language).toBe('es-US');
  });

  it('is not offered to a Spanish speaker as an app language', () => {
    expect(coerceNativeLanguage('es')).toBe('it');
    expect(coerceNativeLanguage('fr')).toBe('fr');
  });
});

describe('Spanish typed answers and cloze', () => {
  it.each([
    ['camion', 'camión', 'close'], ['Camión', 'camión', 'exact'], ['ano', 'año', 'wrong'],
    ['cafe', 'café', 'close'], ['ventanas', 'ventana', 'close'], ['gato', 'perro', 'wrong'], ['', 'perro', 'wrong'],
  ])('%s vs %s is %s', (typed, word, result) => expect(gradeTypedAnswer(typed, word)).toBe(result));

  it('finds a word with ñ inside a question', () => {
    expect(buildCloze('¿Dónde está el niño?', 'niño')).toEqual({ before: '¿Dónde está el ', after: '?' });
  });

  it('splits inverted punctuation', () => {
    expect(splitToken('¡Hola!')).toEqual({ lead: '¡', core: 'Hola', trail: '!' });
    expect(splitToken('¿Dónde')).toEqual({ lead: '¿', core: 'Dónde', trail: '' });
  });
});

describe('Spanish article drill', () => {
  it('asks el/la for a noun', () => {
    const q = buildArticleQuestion({ word: 'casa', article: 'la', meaning_it: 'casa', meaning_en: 'house' }, () => 0.3)!;
    expect([...q.options].sort()).toEqual(['el', 'la']);
    expect(q.answer).toBe('la');
  });
  it('skips another article value', () => {
    expect(buildArticleQuestion({ word: 'casas', article: 'las', meaning_it: '', meaning_en: '' })).toBeNull();
  });
  it('colors the badge by gender', () => {
    const color = (a: string) => (render(React.createElement(ArticleBadge, { article: a })).getByText(a).props.style as any[]).flat().find((s) => s?.color)?.color;
    expect(color('el')).toBe(colors.derBlue);
    expect(color('la')).toBe(colors.diePink);
  });
});

describe('Spanish find the mistake', () => {
  it('builds a gender mistake: wrong form never valid', () => {
    const m = buildFindMistake(card(), seq(0.1, 0.1, 0.1))!;
    expect(m.mistakeKind).toBe('gender');
    expect(m.tokens[m.wrongIndex]).toBe('La');
    expect(m.correctToken).toBe('El');
    expect([...m.options].sort()).toEqual(['El', 'La']);
    expect(m.ruleCode).toBe('NOUN_GENDER');
  });

  it('builds a choice mistake for a sentence tagged SER_ESTAR', () => {
    const c = card({ word: 'cansada', article: null, partOfSpeech: 'adj', example: 'Mi madre está muy cansada hoy', grammarAngle: 'SER_ESTAR' });
    const m = buildFindMistake(c, seq(0.1, 0.1, 0.1))!;
    expect(m.mistakeKind).toBe('choice');
    expect(m.ruleCode).toBe('SER_ESTAR');
    expect(m.tokens[m.wrongIndex]).toBe('es');
    expect(m.correctToken).toBe('está');
    expect([...m.options].sort()).toEqual(['es', 'está']);
    expect(m.options[m.correctOption]).toBe('está');
  });

  it('keeps the capital of a sentence-initial slot', () => {
    const c = card({ word: 'cansada', article: null, partOfSpeech: 'adj', example: 'Está muy cansada mi madre hoy', grammarAngle: 'SER_ESTAR' });
    const m = buildFindMistake(c, seq(0.1, 0.1, 0.1))!;
    expect(m.tokens[0]).toBe('Es');
    expect(m.options).toContain('Está');
  });

  it('chooses between gender and choice with one rng call when both are possible', () => {
    const c = card({ example: 'El perro es muy grande hoy', grammarAngle: 'SER_ESTAR', partOfSpeech: 'noun' });
    expect(buildFindMistake(c, seq(0.1, 0, 0, 0))!.mistakeKind).toBe('gender');
    expect(buildFindMistake(c, seq(0.9, 0, 0, 0))!.mistakeKind).toBe('choice');
  });

  it('is null without an article slot and without a tagged rule', () => {
    expect(buildFindMistake(card({ example: 'Corre rápido por el parque grande' }), () => 0.1)).toBeNull();
    expect(buildFindMistake(card({ word: 'cansada', article: null, partOfSpeech: 'adj', example: 'Mi madre está muy cansada hoy', grammarAngle: null }), () => 0.1)).toBeNull();
    expect(buildFindMistake(card({ word: 'cansada', article: null, partOfSpeech: 'adj', example: 'Mi madre está muy cansada hoy', grammarAngle: 'NEGATION_NO' }), () => 0.1)).toBeNull();
  });

  it('the German pack never produces a choice mistake', () => {
    setActivePackForTests(de);
    const c = card({ word: 'Haus', article: 'das', example: 'Das Haus ist sehr groß.', grammarAngle: 'SER_ESTAR' });
    expect(buildFindMistake(c, seq(0.1, 0.1, 0.1))!.mistakeKind).toBe('gender');
  });
});
