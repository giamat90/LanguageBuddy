/** TASK-071: sentences without spaces. The bank says where the words are; nothing is segmented on the phone. */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import SentenceReorderView from '../src/components/exercises/SentenceReorderView';
import { setActivePackForTests } from '../src/languages';
import { de } from '../src/languages/de';
import { buildCloze } from '../src/lib/cloze';
import { buildChoiceCloze, buildChoiceQuestion } from '../src/lib/grammar';
import { joinTokens, sentenceParts, sentenceTokens } from '../src/lib/sentence';
import { correctedSentence, reorderSentence } from '../src/lib/sentenceSpeech';
import {
  DEFAULT_REGISTRY, FIND_MISTAKE, SENTENCE_REORDER, TYPED_CLOZE, pickExercise,
} from '../src/lib/exercises/registry';
import { buildFindMistake } from '../src/lib/exercises/mistake';
import { canPractice } from '../src/lib/exercises/practice';
import { tokenizeSentence } from '../src/lib/exercises/reorder';
import { useSpeechSettingsStore } from '../src/store/useSpeechSettingsStore';
import { t } from '../src/i18n';
import type { ReviewCard } from '../src/services/reviewService';
import { testPackCjk } from '../test-support/testPackCjk';

const sp = Speech as unknown as { __last(): { text: string } | null; __reset(): void };
const rng = () => 0.3;

const base: ReviewCard = {
  id: 'c1', word: '书', article: null, translationIt: 'libro', translationEn: 'book',
  example: '他有一本书。', segments: ['他', '有', '一', '本', '书', '。'],
  exampleIt: 'Ha un libro.', exampleEn: 'He has a book.', cefrBand: 'A1', partOfSpeech: 'noun',
  grammarAngle: null, timesSeen: 3, retentionScore: 0.7,
};
const particle: ReviewCard = {
  ...base, id: 'c2', word: '学生', example: '你是学生吗？', segments: ['你', '是', '学生', '吗', '？'],
  grammarAngle: 'QUESTION_PARTICLE',
};

afterEach(() => setActivePackForTests(null));

describe('spaced languages are unchanged', () => {
  const text = 'Ich trinke jeden Morgen Kaffee.';

  it('parts and tiles come from the text, whatever segments say', () => {
    expect(sentenceParts(text, undefined, de)).toEqual(text.split(de.letters));
    expect(sentenceParts(text, ['nonsense'], de)).toEqual(text.split(de.letters));
    expect(sentenceTokens(text, undefined, de)).toEqual(tokenizeSentence(text));
    expect(sentenceTokens(text, ['nonsense'], de)).toEqual(tokenizeSentence(text));
    expect(joinTokens(['Ich', 'trinke.'], de)).toBe('Ich trinke.');
  });
});

describe('segmented sentences', () => {
  const parts = (text: string, segments?: string[]) => sentenceParts(text, segments, testPackCjk);
  const tokens = (text: string, segments?: string[]) => sentenceTokens(text, segments, testPackCjk);

  it('parts have the shape of split(letters): separators at even, words at odd indexes', () => {
    expect(parts(base.example!, base.segments!)).toEqual(['', '他', '', '有', '', '一', '', '本', '', '书', '。']);
    expect(parts('“你好！”', ['“', '你好', '！', '”'])).toEqual(['“', '你好', '！”']);
    expect(parts('你好，我是学生。', ['你好', '，', '我', '是', '学生', '。']))
      .toEqual(['', '你好', '，', '我', '', '是', '', '学生', '。']);
  });

  it('tiles keep punctuation attached: opening marks to the next word, the others to the previous one', () => {
    expect(tokens(base.example!, base.segments!)).toEqual(['他', '有', '一', '本', '书。']);
    expect(tokens('“你好！”', ['“', '你好', '！', '”'])).toEqual(['“你好！”']);
    expect(tokens('你好，我是学生。', ['你好', '，', '我', '是', '学生', '。'])).toEqual(['你好，', '我', '是', '学生。']);
    expect(tokens('他说《书》好', ['他', '说', '《', '书', '》', '好'])).toEqual(['他', '说', '《书》', '好']);
    expect(tokens('，好', ['，', '好'])).toEqual(['，好']);
    expect(tokens('好（', ['好', '（'])).toEqual(['好（']);
  });

  it('joining tiles adds no space', () => {
    expect(joinTokens(['他', '有', '书。'], testPackCjk)).toBe('他有书。');
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['empty', []],
    ['one word short', ['他', '有', '一', '本', '。']],
    ['out of order', ['有', '他', '一', '本', '书', '。']],
  ])('segments that are %s give no words and no tiles', (_name, segments) => {
    expect(sentenceParts(base.example!, segments as string[], testPackCjk)).toEqual([base.example]);
    expect(sentenceTokens(base.example!, segments as string[], testPackCjk)).toEqual([]);
  });
});

describe('the sentence exercises on a segmented card', () => {
  beforeEach(() => setActivePackForTests(testPackCjk));

  it('typed cloze blanks the word', () => {
    expect(buildCloze(base.example, base.word, testPackCjk, base.segments)).toEqual({ before: '他有一本', after: '。' });
    expect(TYPED_CLOZE.build(base, rng)).toMatchObject({ kind: 'typed_cloze', before: '他有一本', after: '。' });
    expect(canPractice(base, 'typed_cloze')).toBe(true);
  });

  it('reorder makes one tile per word and reads the sentence without spaces', () => {
    const model = SENTENCE_REORDER.build(base, rng) as { solution: string[]; tokens: string[] };
    expect(model.solution).toEqual(['他', '有', '一', '本', '书。']);
    expect(model.tokens).not.toEqual(model.solution);
    expect([...model.tokens].sort()).toEqual([...model.solution].sort());
    expect(reorderSentence(model.solution)).toBe('他有一本书。');
    expect(canPractice(base, 'sentence_reorder')).toBe(true);
  });

  it('the reorder screen shows and speaks the sentence without spaces', () => {
    sp.__reset();
    useSpeechSettingsStore.getState().setAutoPlaySentence(false);
    const model = SENTENCE_REORDER.build(base, rng) as never;
    const r = render(<SentenceReorderView model={model} isRetry={false} onResult={() => {}} />);
    fireEvent.press(r.getByText(t('review_dont_know')));
    expect(r.getByText(t('review_reorder_correct_was', { sentence: '他有一本书。' }))).toBeTruthy();
    fireEvent.press(r.getByTestId('speak-sentence'));
    expect(sp.__last()!.text).toBe('他有一本书。');
  });

  it('the choice question offers the particles', () => {
    expect(buildChoiceCloze(particle.example, 'QUESTION_PARTICLE', testPackCjk, particle.segments))
      .toMatchObject({ before: '你是学生', after: '？', answer: '吗' });
    const q = buildChoiceQuestion({
      word: particle.word, example: particle.example!, segments: particle.segments!,
      example_it: 'Sei uno studente?', example_en: 'Are you a student?', grammar_angle: 'QUESTION_PARTICLE',
    }, rng, testPackCjk)!;
    expect(q.answer).toBe('吗');
    expect([...q.options].sort()).toEqual(['吗', '呢'].sort());
  });

  it('find the mistake swaps the particle and corrects it without spaces', () => {
    const model = buildFindMistake(particle, rng)!;
    expect(model.mistakeKind).toBe('choice');
    expect(model.tokens).toEqual(['你', '是', '学生', '呢？']);
    expect(model.wrongIndex).toBe(3);
    expect(model.correctToken).toBe('吗？');
    expect([...model.options].sort()).toEqual(['吗', '呢'].sort());
    expect(model.options[model.correctOption]).toBe('吗');
    expect(correctedSentence(model.tokens, model.wrongIndex, model.correctToken)).toBe('你是学生吗？');
    expect(FIND_MISTAKE.build(particle, rng)).not.toBeNull();
    expect(canPractice(particle, 'find_mistake')).toBe(true);
  });

  it.each([
    ['no segments', { segments: undefined }],
    ['segments that do not match the sentence', { segments: ['你', '是', '吗', '？'] }],
  ])('with %s no sentence exercise is built and the card is a flip card', (_name, patch) => {
    const card: ReviewCard = { ...particle, ...patch };
    expect(TYPED_CLOZE.build(card, rng)).toBeNull();
    expect(SENTENCE_REORDER.build(card, rng)).toBeNull();
    expect(FIND_MISTAKE.build(card, rng)).toBeNull();
    expect(buildChoiceCloze(card.example, 'QUESTION_PARTICLE', testPackCjk, card.segments)).toBeNull();
    expect(canPractice(card, 'typed_cloze')).toBe(false);
    expect(canPractice(card, 'sentence_reorder')).toBe(false);
    expect(canPractice(card, 'find_mistake')).toBe(false);
    expect(pickExercise(card, DEFAULT_REGISTRY, rng, 'it').kind).toBe('flashcard');
  });
});
