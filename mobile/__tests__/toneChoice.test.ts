/** TASK-074: the tone-choice format, the practice menu per pack, review cards with reading data. */
import { zh } from '../src/languages/zh';
import { de } from '../src/languages/de';
import { es } from '../src/languages/es';
import { fr } from '../src/languages/fr';
import { setActivePackForTests } from '../src/languages';
import { testPack } from '../test-support/testPack';
import { testPackCjk } from '../test-support/testPackCjk';
import {
  DEFAULT_REGISTRY, TONE_CHOICE, FORMAT_QUALITY, PRACTICE_FORMATS, practiceFormats, parsePracticeFormat,
  practiceConfig, canPractice, practiceAvailability, pickExercise,
} from '../src/lib/exercises';
import { BASE_TARGET_KEYS, READING_TARGET_KEYS, requiredTargetKeys } from '../src/languages/targetStrings';
import type { ReviewCard } from '../src/services/reviewService';
import type { Syllable } from '../src/lib/reading/pinyin';

const syl = (text: string, otherTones: number[] = []): Syllable => ({ text, alsoTyped: [], otherTones });
const card = (over: Partial<ReviewCard> = {}): ReviewCard => ({
  id: '1', word: '朋友', article: null, translationIt: 'amico', translationEn: 'friend', example: null,
  exampleIt: null, exampleEn: null, partOfSpeech: 'noun', cefrBand: 'A1', timesSeen: 1, retentionScore: 0.5,
  pronunciation: 'péngyou', syllables: [syl('péng'), syl('you')], ...over,
});
const strong = { timesSeen: 8, retentionScore: 0.95 };

afterEach(() => setActivePackForTests(null));

describe('packs', () => {
  it('only Chinese has a reading layer and upright text', () => {
    expect(zh.reading).not.toBeNull();
    expect(zh.italics).toBe(false);
    for (const p of [de, es, fr, testPack]) {
      expect(p.reading).toBeNull();
      expect(p.italics).toBe(true);
    }
    expect(testPackCjk.reading).toBeNull();
    expect(testPackCjk.italics).toBe(false);
  });

  it('a pack with a reading layer needs its texts', () => {
    expect([...requiredTargetKeys(zh)]).toEqual(expect.arrayContaining([...BASE_TARGET_KEYS, ...READING_TARGET_KEYS]));
    expect(requiredTargetKeys(testPackCjk).filter((k) => !k.startsWith('grammar_rule_'))).toHaveLength(BASE_TARGET_KEYS.length);
    for (const ui of ['it', 'en'] as const) {
      for (const key of READING_TARGET_KEYS) expect(zh.strings[ui]![key]).toBeTruthy();
    }
  });
});

describe('TONE_CHOICE', () => {
  it('asks a new word for its pinyin among wrong tones', () => {
    setActivePackForTests(zh);
    const model = TONE_CHOICE.build(card(), () => 0.3)!;
    expect(model.kind).toBe('tone_choice');
    if (model.kind !== 'tone_choice') return;
    expect(model.options.length).toBeGreaterThanOrEqual(3);
    expect(model.options[model.correctIndex]).toBe('péngyou');
    expect(new Set(model.options).size).toBe(model.options.length);
    expect(TONE_CHOICE.tiers).toEqual(['new']);
    expect(FORMAT_QUALITY.tone_choice).toBe(0.8);
  });

  it('is not built without a reading layer, syllables or enough tones', () => {
    expect(TONE_CHOICE.build(card(), () => 0.3)).toBeNull(); // German pack
    setActivePackForTests(zh);
    expect(TONE_CHOICE.build(card({ syllables: null }), () => 0.3)).toBeNull();
    expect(TONE_CHOICE.build(card({ pronunciation: null }), () => 0.3)).toBeNull();
    expect(TONE_CHOICE.build(card({ word: '吗', pronunciation: 'ma', syllables: [syl('ma')] }), () => 0.3)).toBeNull();
  });

  it('sits last before the flip card, and a learned word never gets it in review', () => {
    expect(DEFAULT_REGISTRY.map((d) => d.kind).slice(-2)).toEqual(['tone_choice', 'flashcard']);
    setActivePackForTests(zh);
    expect(pickExercise(card(), [TONE_CHOICE, DEFAULT_REGISTRY[DEFAULT_REGISTRY.length - 1]], () => 0).kind).toBe('tone_choice');
    expect(pickExercise(card(strong), DEFAULT_REGISTRY, () => 0.99).kind).not.toBe('tone_choice');
  });
});

describe('practice menu per pack', () => {
  it('German, Spanish and French keep the six formats', () => {
    for (const p of [de, es, fr]) expect(practiceFormats(p)).toEqual(PRACTICE_FORMATS);
    expect(parsePracticeFormat('tone_choice')).toBe('mixed');
  });

  it('a reading pack with nothing to swap has tone choice and no find-the-mistake', () => {
    const bare = { ...zh, choices: null, classifiers: null };
    expect(practiceFormats(bare)).toEqual(['mixed', 'matching', 'multiple_choice', 'sentence_reorder', 'typed_cloze', 'tone_choice']);
    setActivePackForTests(bare);
    expect(parsePracticeFormat('tone_choice')).toBe('tone_choice');
    expect(parsePracticeFormat('find_mistake')).toBe('mixed');
    expect(practiceFormats()).toEqual(practiceFormats(bare));
  });

  it('a pack with choice rules keeps find-the-mistake', () => {
    expect(practiceFormats(testPackCjk)).toContain('find_mistake');
  });

  it('serves tone choice to any tier, with the flip card behind it', () => {
    setActivePackForTests(zh);
    const config = practiceConfig('tone_choice');
    expect(pickExercise(card(strong), config.registry).kind).toBe('tone_choice');
    expect(canPractice(card(strong), 'tone_choice')).toBe(true);
    expect(canPractice(card({ syllables: null }), 'tone_choice')).toBe(false);
    expect(practiceAvailability([card()]).tone_choice).toBe(true);
    expect(practiceConfig('mixed').registry.some((d) => d.kind === 'tone_choice')).toBe(true);
  });
});
