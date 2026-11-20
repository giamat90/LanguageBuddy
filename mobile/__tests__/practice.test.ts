import {
  PRACTICE_FORMATS, PRACTICE_SIZE, parsePracticeFormat, practiceConfig, canPractice,
  selectPracticeCards, practiceAvailability, pickExercise, createSession, currentEntry,
  type PracticeFormat,
} from '../src/lib/exercises';
import type { Rng } from '../src/lib/grammar';
import type { ReviewCard } from '../src/services/reviewService';

function card(
  id: string, word: string, it: string | null, en: string | null,
  over: Partial<ReviewCard> = {},
): ReviewCard {
  return {
    id,
    word,
    article: 'das',
    translationIt: it,
    translationEn: en,
    exampleDe: null,
    exampleIt: null,
    exampleEn: null,
    partOfSpeech: 'noun',
    cefrBand: 'A1',
    topicDomain: 'food',
    timesSeen: 3,
    retentionScore: 0.7,
    ...over,
  };
}

const withSentence = (id: string, word: string, it: string, en: string, sentence: string, over: Partial<ReviewCard> = {}) =>
  card(id, word, it, en, { exampleDe: sentence, exampleIt: 'x', exampleEn: 'x', ...over });

const brot = (over: Partial<ReviewCard> = {}) =>
  withSentence('1', 'Brot', 'pane', 'bread', 'Ich kaufe das Brot beim Bäcker.', over);
const wasser = (over: Partial<ReviewCard> = {}) =>
  withSentence('2', 'Wasser', 'acqua', 'water', 'Ich trinke ein Glas Wasser.', over);
const haus = (over: Partial<ReviewCard> = {}) =>
  withSentence('3', 'Haus', 'casa', 'house', 'Das Haus ist sehr groß.', over);
const buch = (over: Partial<ReviewCard> = {}) =>
  withSentence('4', 'Buch', 'libro', 'book', 'Ich lese ein Buch.', over);
const tisch = (over: Partial<ReviewCard> = {}) => card('5', 'Tisch', 'tavolo', 'table', over);

function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('parsePracticeFormat', () => {
  it('keeps every valid format', () => {
    for (const f of PRACTICE_FORMATS) expect(parsePracticeFormat(f)).toBe(f);
  });
  it('falls back to mixed for anything else', () => {
    for (const bad of [undefined, null, '', 'bogus', 42, {}]) expect(parsePracticeFormat(bad)).toBe('mixed');
  });
  it('takes the first element of an array', () => {
    expect(parsePracticeFormat(['matching', 'x'])).toBe('matching');
    expect(parsePracticeFormat([])).toBe('mixed');
  });
  it('lists the six formats in menu order', () => {
    expect(PRACTICE_FORMATS).toEqual([
      'mixed', 'matching', 'multiple_choice', 'sentence_reorder', 'find_mistake', 'typed_cloze',
    ]);
    expect(PRACTICE_SIZE).toBe(10);
  });
});

describe('practiceConfig ignores the review ladder', () => {
  const strong = brot({ timesSeen: 8, retentionScore: 0.95 });
  const fresh = brot({ timesSeen: 1, retentionScore: 0.5 });

  it.each([
    ['typed_cloze', 'typed_cloze'],
    ['sentence_reorder', 'sentence_reorder'],
    ['multiple_choice', 'multiple_choice'],
    ['find_mistake', 'find_mistake'],
  ] as [PracticeFormat, string][])('%s gives that format to strong and new words alike', (format, kind) => {
    const cfg = practiceConfig(format);
    expect(pickExercise(strong, cfg.registry).kind).toBe(kind);
    expect(pickExercise(fresh, cfg.registry).kind).toBe(kind);
    expect(cfg.groups).toEqual([]);
  });

  it('falls back to a flip-card for a word the format cannot be built for', () => {
    expect(pickExercise(tisch(), practiceConfig('sentence_reorder').registry).kind).toBe('flashcard');
  });

  it('mixed reaches typed, reorder and choice depending on rng', () => {
    const cfg = practiceConfig('mixed');
    const kinds = [0, 0.5, 0.9].map((r) => pickExercise(strong, cfg.registry, () => r).kind);
    expect(kinds).toEqual(['typed_cloze', 'sentence_reorder', 'multiple_choice']);
  });

  it('mixed never builds matching rounds (a 10-word session would be nothing else), matching builds only rounds', () => {
    expect(practiceConfig('mixed').groups).toEqual([]);
    expect(practiceConfig('mixed').groupsOnly).toBe(false);
    expect(practiceConfig('matching').groupsOnly).toBe(true);
    for (const f of ['typed_cloze', 'sentence_reorder', 'multiple_choice'] as const) {
      expect(practiceConfig(f).groupsOnly).toBe(false);
    }

    const ten = Array.from({ length: 10 }, (_, i) =>
      withSentence(`m${i}`, 'Brot', `significato${String.fromCharCode(97 + i)}`, `meaning${String.fromCharCode(97 + i)}`, 'Ich kaufe das Brot beim Bäcker.'),
    );
    const cfg = practiceConfig('mixed');
    const session = createSession(ten, { groups: cfg.groups, rng: () => 0.4 });
    expect(session.queue.every((e) => e.kind === 'single')).toBe(true);
    expect(session.total).toBe(10);
  });

  it('matching groups learning words, which the review ladder would not', () => {
    const cards = [brot(), wasser(), haus(), buch()]; // all learning tier
    const practice = createSession(cards, { groups: practiceConfig('matching').groups, rng: () => 0.4 });
    expect(currentEntry(practice)?.kind).toBe('group');
    const review = createSession(cards, { rng: () => 0.4 });
    expect(review.queue.every((e) => e.kind === 'single')).toBe(true);
  });
});

describe('canPractice', () => {
  it('typed cloze needs the word in an example', () => {
    expect(canPractice(brot(), 'typed_cloze')).toBe(true);
    expect(canPractice(tisch(), 'typed_cloze')).toBe(false);
    expect(canPractice(withSentence('9', 'Brot', 'pane', 'bread', 'Ich esse Obst.'), 'typed_cloze')).toBe(false);
  });
  it('reorder needs a 4–10 token sentence containing the word', () => {
    expect(canPractice(brot(), 'sentence_reorder')).toBe(true);
    expect(canPractice(withSentence('9', 'Brot', 'pane', 'bread', 'Brot ist gut.'), 'sentence_reorder')).toBe(false); // 3 tokens
    expect(canPractice(tisch(), 'sentence_reorder')).toBe(false);
  });
  it('find the mistake needs the card article right before the word, or a case-fixing determiner', () => {
    expect(canPractice(brot(), 'find_mistake')).toBe(true); // "das Brot"
    expect(canPractice(wasser(), 'find_mistake')).toBe(false); // "ein Glas Wasser"
    expect(canPractice(tisch(), 'find_mistake')).toBe(false); // no sentence
    expect(
      canPractice(withSentence('9', 'gehen', 'andare', 'to go', 'Ich spreche mit dem Lehrer.', { article: null, partOfSpeech: 'verb' }), 'find_mistake'),
    ).toBe(true);
  });
  it('multiple choice needs part of speech, translations and enough distractors', () => {
    expect(canPractice(brot(), 'multiple_choice')).toBe(true);
    expect(canPractice(brot({ partOfSpeech: 'interj' }), 'multiple_choice')).toBe(false); // no such words to draw from
    expect(canPractice(brot({ partOfSpeech: null }), 'multiple_choice')).toBe(false);
    expect(canPractice(brot({ translationEn: null }), 'multiple_choice')).toBe(false);
  });
  it('checking multiple choice is cheap: it must not build a question (no rng use)', () => {
    const noRng: Rng = () => {
      throw new Error('canPractice built a full question');
    };
    expect(canPractice(brot(), 'multiple_choice', noRng)).toBe(true);
  });
  it('matching needs both translations; mixed accepts anything', () => {
    expect(canPractice(brot(), 'matching')).toBe(true);
    expect(canPractice(card('9', 'X', 'x', null), 'matching')).toBe(false);
    expect(canPractice(tisch({ partOfSpeech: null }), 'mixed')).toBe(true);
  });
});

describe('selectPracticeCards', () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      withSentence(`m${i}`, 'Brot', `significato${String.fromCharCode(97 + i)}`, `meaning${String.fromCharCode(97 + i)}`, 'Ich kaufe das Brot beim Bäcker.'),
    );

  it('caps the session at PRACTICE_SIZE by default and honours an explicit count, without repeats', () => {
    const cards = many(14);
    const picked = selectPracticeCards(cards, 'typed_cloze', undefined, seeded(1));
    expect(picked).toHaveLength(PRACTICE_SIZE);
    expect(new Set(picked.map((c) => c.id)).size).toBe(PRACTICE_SIZE);
    expect(selectPracticeCards(cards, 'typed_cloze', 3, seeded(1))).toHaveLength(3);
  });

  it('returns fewer cards when the vault is small, and nothing for an empty vault', () => {
    expect(selectPracticeCards(many(4), 'typed_cloze', 10, seeded(2))).toHaveLength(4);
    expect(selectPracticeCards([], 'mixed')).toEqual([]);
  });

  it('find the mistake only draws words it can corrupt', () => {
    const cards = [brot(), wasser(), haus(), buch(), tisch()];
    const picked = selectPracticeCards(cards, 'find_mistake', 10, seeded(6));
    expect(picked.map((c) => c.id).sort()).toEqual(['1', '3']); // das Brot, Das Haus
  });

  it('only draws words the format can be built for', () => {
    const cards = [brot(), wasser(), haus(), tisch(), card('6', 'Stuhl', 'sedia', 'chair'), card('7', 'Bett', 'letto', 'bed')];
    const picked = selectPracticeCards(cards, 'sentence_reorder', 10, seeded(3));
    expect(picked.map((c) => c.id).sort()).toEqual(['1', '2', '3']);
  });

  it('matching needs at least four usable words', () => {
    const three = [brot(), wasser(), haus(), card('6', 'Heim', null, 'home')];
    expect(selectPracticeCards(three, 'matching', 10, seeded(4))).toEqual([]);
    const four = [brot(), wasser(), haus(), buch()];
    expect(selectPracticeCards(four, 'matching', 10, seeded(4))).toHaveLength(4);
  });

  it('is deterministic for a fixed rng', () => {
    const cards = many(14);
    expect(selectPracticeCards(cards, 'mixed', 10, seeded(9))).toEqual(selectPracticeCards(cards, 'mixed', 10, seeded(9)));
  });

  it('favours weaker words', () => {
    const weak = brot({ id: 'weak', retentionScore: 0.1 });
    const strong = wasser({ id: 'strong', retentionScore: 0.95 });
    const rng = seeded(11);
    let weakWins = 0;
    for (let i = 0; i < 400; i++) {
      if (selectPracticeCards([weak, strong], 'mixed', 1, rng)[0].id === 'weak') weakWins++;
    }
    expect(weakWins).toBeGreaterThan(280); // expected ≈ 84 %
    expect(weakWins).toBeLessThan(400); // strong words still appear
  });
});

describe('practiceAvailability', () => {
  const none = (a: Record<PracticeFormat, boolean>) => PRACTICE_FORMATS.every((f) => a[f] === false);

  it('is false everywhere for an empty vault', () => {
    expect(none(practiceAvailability([]))).toBe(true);
  });

  it('two words: everything but matching', () => {
    const a = practiceAvailability([brot(), wasser()]);
    expect(a).toEqual({
      mixed: true, matching: false, multiple_choice: true, sentence_reorder: true, find_mistake: true, typed_cloze: true,
    });
  });

  it('four distinct words enable matching', () => {
    expect(practiceAvailability([brot(), wasser(), haus(), buch()]).matching).toBe(true);
  });

  it('four words with one shared meaning do not', () => {
    const cards = [brot(), wasser(), haus(), card('6', 'Heim', 'casa', 'home')];
    expect(practiceAvailability(cards).matching).toBe(false);
  });

  it('words without sentences cannot do reorder or typing', () => {
    const a = practiceAvailability([tisch(), card('6', 'Stuhl', 'sedia', 'chair')]);
    expect(a.sentence_reorder).toBe(false);
    expect(a.typed_cloze).toBe(false);
    expect(a.find_mistake).toBe(false);
    expect(a.mixed).toBe(true);
  });
});
