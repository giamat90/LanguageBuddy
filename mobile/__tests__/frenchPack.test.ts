/** TASK-063: the French language pack (behavior only; no word content yet). */
import React from 'react';
import { render } from '@testing-library/react-native';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fr } from '../src/languages/fr';
import { es } from '../src/languages/es';
import { de } from '../src/languages/de';
import { setActivePackForTests } from '../src/languages';
import { gradeTypedAnswer, buildCloze } from '../src/lib/cloze';
import { buildArticleQuestion, buildChoiceCloze, buildChoiceQuestion, choiceOptions, choiceRules } from '../src/lib/grammar';
import { buildFindMistake, splitToken } from '../src/lib/exercises/mistake';
import { tokenizeSentence } from '../src/lib/exercises/reorder';
import { speak } from '../src/lib/speech';
import ArticleBadge from '../src/components/ui/ArticleBadge';
import { colors } from '../src/theme/colors';
import { coerceNativeLanguage } from '../src/i18n/language';
import type { ReviewCard } from '../src/services/reviewService';

const speechMock = require('expo-speech') as { __last(): { opts: any } | null };

beforeEach(() => setActivePackForTests(fr));
afterEach(() => setActivePackForTests(null));

const NBSP = ' ';
const seq = (...v: number[]): (() => number) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
function card(over: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id: 'c', word: 'chien', article: 'le', translationIt: 'cane', translationEn: 'dog',
    example: 'Le chien mange la viande ici', exampleIt: '', exampleEn: '', partOfSpeech: 'noun',
    cefrBand: 'A1', topicDomain: 'home', timesSeen: 1, retentionScore: 0.5, grammarAngle: null, ...over,
  } as ReviewCard;
}

describe('the French pack data', () => {
  it('has its identity, voice, quiz and offered languages', () => {
    expect(fr.code).toBe('fr');
    expect(fr.name).toBe('French');
    expect(fr.app).toEqual({ name: 'FrenchBuddy', backupTag: 'FrenchBuddy', dbFile: 'frenchbuddy.db' });
    expect(fr.speech).toEqual({ locale: 'fr-FR', rate: 0.9 });
    expect(fr.ai).toEqual({ languageName: 'French' });
    expect(fr.quiz.map((q) => q.correctIndex)).toEqual([1, 1, 0, 1, 0]);
    expect(fr.uiLanguages).toHaveLength(12);
    expect(fr.uiLanguages).not.toContain('fr');
    expect(fr.cases).toBeNull();
    expect(Object.keys(fr.choices!.ruleSets).sort()).toEqual(['AUXILIARY_AVOIR_ETRE', 'DIRECT_OBJECT_PRONOUN', 'RELATIVE_QUI_QUE']);
    expect(Object.keys(fr.strings).sort()).toEqual([...fr.uiLanguages].sort());
    expect(fr.articles!.forms).toEqual(['le', 'la']);
  });

  it('German and Spanish keep their own choices', () => {
    expect(de.choices).toBeNull();
    expect(Object.keys(es.choices!.ruleSets)).toContain('SER_ESTAR');
  });

  it('speaks with the French voice', () => {
    speak("l'ami", { onDone() {}, onStopped() {}, onError() {} });
    expect(speechMock.__last()!.opts.language).toBe('fr-FR');
  });

  it('is not offered to a French speaker as an app language', () => {
    expect(coerceNativeLanguage('fr')).toBe('it');
    expect(coerceNativeLanguage('es')).toBe('es');
  });

  it('sorts accented letters with their base letter', () => {
    const words = ['zèbre', 'école', 'épée'];
    const byCode = [...words].sort();
    const byPack = [...words].sort(new Intl.Collator(fr.collation).compare);
    expect(byPack).toEqual(['école', 'épée', 'zèbre']);
    expect(byCode).not.toEqual(byPack);
  });
});

describe('French folding and typed answers', () => {
  it('folds accents, cedilla, ligatures and the typographic apostrophe', () => {
    expect(fr.fold('  ÉCOLE ')).toBe('ecole');
    expect(fr.fold('français')).toBe('francais');
    expect(fr.fold('cœur')).toBe('coeur');
    expect(fr.fold('œil')).toBe('oeil');
    expect(fr.fold('où')).toBe('ou');
    expect(fr.fold('aujourd’hui')).toBe("aujourd'hui");
  });

  it.each([
    ['ecole', 'école', 'close'], ['etre', 'être', 'close'], ['francais', 'français', 'close'],
    ['coeur', 'cœur', 'close'], ['ca', 'ça', 'close'], ['Être', 'être', 'exact'],
    ['eleve', 'élève', 'close'], ['ecloe', 'école', 'wrong'], ['chat', 'chien', 'wrong'], ['', 'chien', 'wrong'],
    ["aujourd’hui", "aujourd'hui", 'exact'],
  ])('%s vs %s is %s', (typed, word, result) => expect(gradeTypedAnswer(typed, word)).toBe(result));

  it('blanks a word after an elision and does not accept the elided form as the answer', () => {
    expect(buildCloze("J'aime l'ami de Paul.", 'ami')).toEqual({ before: "J'aime l'", after: ' de Paul.' });
    expect(gradeTypedAnswer("l'ami", 'ami')).toBe('wrong');
    expect(gradeTypedAnswer('ami', 'ami')).toBe('exact');
  });
});

describe('French punctuation and tiles', () => {
  it('splits guillemets and the no-break space off a token', () => {
    expect(splitToken(`«${NBSP}Bonjour${NBSP}!»`)).toEqual({ lead: `«${NBSP}`, core: 'Bonjour', trail: `${NBSP}!»` });
    expect(splitToken(`va${NBSP}?`)).toEqual({ lead: '', core: 'va', trail: `${NBSP}?` });
    expect(splitToken("l'ami,")).toEqual({ lead: '', core: "l'ami", trail: ',' });
  });

  it('keeps a mark joined by a no-break space on the same tile', () => {
    expect(tokenizeSentence(`Comment ça va${NBSP}?`)).toEqual(['Comment', 'ça', `va${NBSP}?`]);
  });

  it('German and Spanish tiles are unchanged', () => {
    expect(tokenizeSentence('Ich  trinke\tTee.')).toEqual(['Ich', 'trinke', 'Tee.']);
    expect(tokenizeSentence('¿Dónde está el niño?')).toEqual(['¿Dónde', 'está', 'el', 'niño?']);
  });
});

describe('French article drill', () => {
  it('asks le/la for a noun', () => {
    const q = buildArticleQuestion({ word: 'ami', article: 'le', meaning_it: 'amico', meaning_en: 'friend' }, () => 0.3)!;
    expect([...q.options].sort()).toEqual(['la', 'le']);
    expect(q.answer).toBe('le');
    expect(buildArticleQuestion({ word: 'maison', article: 'la', meaning_it: '', meaning_en: '' })!.answer).toBe('la');
  });
  it.each(['les', "l'", '-', 'un'])('skips the article value %s', (article) => {
    expect(buildArticleQuestion({ word: 'gens', article, meaning_it: '', meaning_en: '' })).toBeNull();
  });
  it('colors the badge by gender', () => {
    const color = (a: string) => (render(React.createElement(ArticleBadge, { article: a })).getByText(a).props.style as any[]).flat().find((s) => s?.color)?.color;
    expect(color('le')).toBe(colors.derBlue);
    expect(color('la')).toBe(colors.diePink);
  });
});

describe('French choice drill', () => {
  it.each([
    ['Hier, je suis allé au marché.', 'AUXILIARY_AVOIR_ETRE', 'suis', 'Hier, je ', ' allé au marché.'],
    ['Il a mangé une pomme.', 'AUXILIARY_AVOIR_ETRE', 'a', 'Il ', ' mangé une pomme.'],
    ['Nous sommes partis tôt.', 'AUXILIARY_AVOIR_ETRE', 'sommes', 'Nous ', ' partis tôt.'],
    ['Je les vois tous les jours.', 'DIRECT_OBJECT_PRONOUN', 'les', 'Je ', ' vois tous les jours.'],
    ['Le livre que tu lis est ancien.', 'RELATIVE_QUI_QUE', 'que', 'Le livre ', ' tu lis est ancien.'],
    ['Qui parle ?', 'RELATIVE_QUI_QUE', 'qui', '', ' parle ?'],
  ])('%s (%s)', (sentence, rule, answer, before, after) => {
    const c = buildChoiceCloze(sentence, rule, fr)!;
    expect(c.answer).toBe(answer);
    expect(c.before).toBe(before);
    expect(c.after).toBe(after);
    expect(c.set).toContain(answer);
  });

  it('never blanks an elided form', () => {
    expect(buildChoiceCloze("J'ai mangé une pomme.", 'AUXILIARY_AVOIR_ETRE', fr)).toBeNull();
    expect(buildChoiceCloze("Je l'ai vu.", 'DIRECT_OBJECT_PRONOUN', fr)).toBeNull();
    expect(buildChoiceCloze("Le livre qu'il lit est ancien.", 'RELATIVE_QUI_QUE', fr)).toBeNull();
  });

  it('is null without a member, for an unknown rule and for a language without choices', () => {
    expect(buildChoiceCloze('Il mange du pain.', 'AUXILIARY_AVOIR_ETRE', fr)).toBeNull();
    expect(buildChoiceCloze('Il a mangé.', 'NEGATION_NE_PAS', fr)).toBeNull();
    expect(buildChoiceCloze('Il a mangé.', 'AUXILIARY_AVOIR_ETRE', de)).toBeNull();
  });

  it('offers 2, 3 and 2 options with the answer included', () => {
    expect([...choiceOptions('suis', fr.choices!.ruleSets.AUXILIARY_AVOIR_ETRE[0], () => 0.5)].sort()).toEqual(['ai', 'suis']);
    expect([...choiceOptions('les', fr.choices!.ruleSets.DIRECT_OBJECT_PRONOUN[0], () => 0.5)].sort()).toEqual(['la', 'le', 'les']);
    expect([...choiceOptions('que', fr.choices!.ruleSets.RELATIVE_QUI_QUE[0], () => 0.5)].sort()).toEqual(['que', 'qui']);
  });

  it('builds a question with the sentence-initial capital', () => {
    const q = buildChoiceQuestion({ word: 'parler', example: 'Qui parle ?', example_it: 'Chi parla?', example_en: 'Who is speaking?', grammar_angle: 'RELATIVE_QUI_QUE' }, () => 0.3, fr)!;
    expect(q.id).toBe('choice:parler');
    expect(q.answer).toBe('Qui');
    expect([...q.options].sort()).toEqual(['Que', 'Qui']);
  });

  it('choiceRules lists the three rules of the pack', () => {
    expect(choiceRules(fr).sort()).toEqual(['AUXILIARY_AVOIR_ETRE', 'DIRECT_OBJECT_PRONOUN', 'RELATIVE_QUI_QUE']);
  });

  it('buildDrill under fr yields only article and choice questions from a small bank', async () => {
    jest.resetModules();
    jest.doMock('../src/data/wordbank', () => ({
      CEFR_ORDER: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      WORD_BANK: {
        A1: [
          { word: 'maison', article: 'la', part_of_speech: 'noun', meaning_it: 'casa', meaning_en: 'house', example: 'La maison est grande.', example_it: 'x', example_en: 'y', grammar_angle: 'NOUN_GENDER', cefr_band: 'A1' },
          { word: 'aller', article: null, part_of_speech: 'verb', meaning_it: 'andare', meaning_en: 'go', example: 'Hier, je suis allé au marché.', example_it: 'x', example_en: 'y', grammar_angle: 'AUXILIARY_AVOIR_ETRE', cefr_band: 'A1' },
          { word: 'manger', article: null, part_of_speech: 'verb', meaning_it: 'mangiare', meaning_en: 'eat', example: 'Je mange du pain.', example_it: 'x', example_en: 'y', grammar_angle: 'VERB_PRESENT_ER', cefr_band: 'A1' },
        ],
        A2: [], B1: [], B2: [], C1: [], C2: [],
      },
      allEntries: () => [],
    }));
    const sqlite2 = require('expo-sqlite');
    const { _resetDbForTests: reset } = require('../src/data/db');
    const langs = require('../src/languages');
    const { buildDrill } = require('../src/services/grammarService');
    sqlite2.__reset(); reset();
    langs.setActivePackForTests(require('../src/languages/fr').fr);
    const qs = await buildDrill('A1', 10);
    expect(qs.map((q: any) => q.ruleCode).sort()).toEqual(['AUXILIARY_AVOIR_ETRE', 'NOUN_GENDER']);
    langs.setActivePackForTests(null);
    jest.dontMock('../src/data/wordbank');
  });
});

describe('French find the mistake', () => {
  it('builds a gender mistake: the wrong form is never valid', () => {
    const m = buildFindMistake(card(), seq(0.1, 0.1, 0.1))!;
    expect(m.mistakeKind).toBe('gender');
    expect(m.tokens[m.wrongIndex]).toBe('La');
    expect(m.correctToken).toBe('Le');
    expect([...m.options].sort()).toEqual(['La', 'Le']);
    expect(m.ruleCode).toBe('NOUN_GENDER');
  });

  it('gives no gender slot after an elided article or after un/une', () => {
    expect(buildFindMistake(card({ word: 'ami', example: "J'aime l'ami de Paul ici" }), () => 0.1)).toBeNull();
    expect(buildFindMistake(card({ example: 'Un chien mange la viande ici' }), () => 0.1)).toBeNull();
  });

  it('builds a choice mistake for a sentence tagged AUXILIARY_AVOIR_ETRE', () => {
    const c = card({ word: 'aller', article: null, partOfSpeech: 'verb', example: 'Hier, je suis allé au marché.', grammarAngle: 'AUXILIARY_AVOIR_ETRE' });
    const m = buildFindMistake(c, seq(0.1, 0.1, 0.1))!;
    expect(m.mistakeKind).toBe('choice');
    expect(m.ruleCode).toBe('AUXILIARY_AVOIR_ETRE');
    expect(m.tokens[m.wrongIndex]).toBe('ai');
    expect(m.correctToken).toBe('suis');
    expect([...m.options].sort()).toEqual(['ai', 'suis']);
    expect(m.options[m.correctOption]).toBe('suis');
  });

  it('chooses between gender and choice with one rng call', () => {
    const c = card({ word: 'livre', example: 'Le livre que tu lis est ancien', grammarAngle: 'RELATIVE_QUI_QUE' });
    expect(buildFindMistake(c, seq(0.1, 0, 0, 0))!.mistakeKind).toBe('gender');
    expect(buildFindMistake(c, seq(0.9, 0, 0, 0))!.mistakeKind).toBe('choice');
  });

  it('keeps a mark joined by a no-break space inside its token', () => {
    const c = card({ word: 'aller', article: null, partOfSpeech: 'verb', example: `Je suis allé au marché hier${NBSP}!`, grammarAngle: 'AUXILIARY_AVOIR_ETRE' });
    const m = buildFindMistake(c, seq(0.1, 0.1, 0.1))!;
    expect(m.tokens).toContain(`hier${NBSP}!`);
    expect(m.tokens).toHaveLength(6);
  });

  it('gives no choice slot for an elided member', () => {
    const c = card({ word: 'manger', article: null, partOfSpeech: 'verb', example: "Hier, j'ai mangé une pomme rouge", grammarAngle: 'AUXILIARY_AVOIR_ETRE' });
    expect(buildFindMistake(c, () => 0.1)).toBeNull();
  });

  it('German and Spanish still behave as before', () => {
    setActivePackForTests(de);
    expect(buildFindMistake(card({ word: 'Haus', article: 'das', example: 'Das Haus ist sehr groß.' }), seq(0.1, 0.1, 0.1))!.mistakeKind).toBe('gender');
    setActivePackForTests(es);
    expect(buildFindMistake(card({ word: 'perro', article: 'el', example: 'El perro come la carne ahora' }), seq(0.1, 0.1, 0.1))!.tokens[0]).toBe('La');
  });
});

describe('the French language', () => {
  const root = join(__dirname, '..', 'scripts', 'wordbank', 'fr');
  const cfg = JSON.parse(readFileSync(join(root, 'language.json'), 'utf8'));

  it('declares its rule codes, articles and checks', () => {
    expect(cfg.code).toBe('fr');
    expect(cfg.draft).toBeUndefined(); // all six levels exist (TASK-064)
    expect(cfg.levels).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
    expect(cfg.articles).toEqual(['le', 'la']);
    expect(cfg.i18nLanguages).toEqual(['es', 'pt', 'ru', 'uk', 'pl', 'tr', 'zh', 'ja', 'hi', 'ar']);
    expect(cfg.ruleCodes).toHaveLength(30);
    expect(Object.keys(cfg.ruleChecks).sort()).toEqual(Object.keys(fr.choices!.ruleSets).sort());
    // every choice rule of the pack is a tag of the bank, and each rule check lists the forms of its sets
    for (const [rule, sets] of Object.entries(fr.choices!.ruleSets)) {
      expect(cfg.ruleCodes).toContain(rule);
      expect(cfg.ruleChecks[rule].mustContainAny.slice().sort()).toEqual(sets.flat().slice().sort());
    }
    expect(cfg.ruleCodes).toContain(fr.articles!.rule);
  });

  it('the validator checks all six levels', () => {
    const scripts = join(__dirname, '..', 'scripts');
    const v = spawnSync(process.execPath, [join(scripts, 'validate-wordbank.mjs')], { encoding: 'utf8' });
    expect(v.status).toBe(0);
    expect(v.stdout).not.toMatch(/skipped draft language fr/);
    expect(v.stdout).toMatch(/Word bank valid/);
  });
});
