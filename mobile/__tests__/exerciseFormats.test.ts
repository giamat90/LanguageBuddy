import { allEntries } from '../src/data/wordbank';
import { updateRetentionScore, nextReviewDate } from '../src/data/srs';
import {
  pickDistractors, buildMultipleChoice, getDistractorPool, meaningTokens,
  tokenizeSentence, shuffleTokens, buildReorder, gradeReorder,
  buildMatchingRound, matchingQuality, MATCH_MIN, MATCH_MAX,
  pickExercise, DEFAULT_REGISTRY, FORMAT_QUALITY, TYPED_CLOZE, SENTENCE_REORDER, FLASHCARD,
  type DistractorSource,
} from '../src/lib/exercises';
import type { Rng } from '../src/lib/grammar';
import type { ReviewCard } from '../src/services/reviewService';

function makeCard(over: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id: 'c1',
    word: 'Brot',
    article: 'das',
    translationIt: 'pane',
    translationEn: 'bread',
    example: 'Ich kaufe das Brot beim Bäcker.',
    exampleIt: 'Compro il pane dal panettiere.',
    exampleEn: 'I buy the bread at the baker.',
    partOfSpeech: 'noun',
    cefrBand: 'A1',
    topicDomain: 'food',
    timesSeen: 2,
    retentionScore: 0.7,
    ...over,
  };
}

function src(
  word: string, meaningIt: string, meaningEn: string,
  over: Partial<DistractorSource> = {},
): DistractorSource {
  return {
    word, article: null, partOfSpeech: 'noun', cefrBand: 'A1', topicDomain: 'home',
    meaningIt, meaningEn, ...over,
  };
}

function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const FIXTURE_POOL: DistractorSource[] = [
  src('Wasser', 'acqua', 'water', { topicDomain: 'food' }),
  src('Haus', 'casa', 'house'),
  src('Tisch', 'tavolo', 'table'),
  src('Buch', 'libro', 'book', { topicDomain: 'leisure' }),
  src('gehen', 'andare', 'to go', { partOfSpeech: 'verb' }),
];

describe('meaningTokens', () => {
  it('keeps lower-cased letter runs of 3+ characters, accents included', () => {
    expect([...meaningTokens('Il tavolo da pranzo (è)')].sort()).toEqual(['pranzo', 'tavolo']);
    expect(meaningTokens('to go').has('to')).toBe(false);
    expect(meaningTokens('perché').has('perché')).toBe(true);
  });
});

describe('pickDistractors', () => {
  it('picks 3 same-part-of-speech distractors, never the card itself, best-scored first', () => {
    const pool = [...FIXTURE_POOL, src('Brot', 'pane', 'bread')];
    const picked = pickDistractors(makeCard(), pool, () => 0)!;
    // same band + same topic (Wasser) outranks same band only (Haus, Tisch, Buch)
    expect(picked.map((p) => p.word)).toEqual(['Wasser', 'Haus', 'Tisch']);
  });

  it('excludes candidates sharing a 3+ letter meaning token in Italian or English', () => {
    const pool = [
      ...FIXTURE_POOL,
      src('Brötchen', 'panino', 'bread roll'),          // English token "bread"
      src('Pizza', 'pane e pizza', 'pizza'),            // Italian token "pane"
    ];
    const words = pickDistractors(makeCard(), pool, () => 0)!.map((p) => p.word);
    expect(words).not.toContain('Brötchen');
    expect(words).not.toContain('Pizza');
  });

  it('skips empty meanings and collapses duplicate meanings', () => {
    const pool = [
      src('Leer', '', 'empty'),
      src('Wasser', 'acqua', 'water'),
      src('Aqua', 'acqua', 'water body'),               // same Italian meaning as Wasser
      src('Haus', 'casa', 'house'),
      src('Tisch', 'tavolo', 'table'),
    ];
    const words = pickDistractors(makeCard(), pool, () => 0)!.map((p) => p.word);
    expect(words).toEqual(['Wasser', 'Haus', 'Tisch']);
  });

  it('returns null when fewer than 3 valid distractors exist', () => {
    expect(pickDistractors(makeCard(), FIXTURE_POOL.slice(0, 2), () => 0)).toBeNull();
    // a different part of speech is not a valid distractor
    expect(pickDistractors(makeCard({ partOfSpeech: 'verb' }), FIXTURE_POOL, () => 0)).toBeNull();
  });

  it('returns null when the card lacks part of speech or translations', () => {
    expect(pickDistractors(makeCard({ partOfSpeech: null }), FIXTURE_POOL, () => 0)).toBeNull();
    expect(pickDistractors(makeCard({ translationIt: null }), FIXTURE_POOL, () => 0)).toBeNull();
    expect(pickDistractors(makeCard({ translationEn: null }), FIXTURE_POOL, () => 0)).toBeNull();
  });
});

describe('buildMultipleChoice', () => {
  const pool = [...FIXTURE_POOL, src('Stuhl', 'sedia', 'chair')];

  it('builds 4 unique options with exactly one correct, pointed to by correctIndex', () => {
    const m = buildMultipleChoice(makeCard(), pool, seeded(1))!;
    expect(m.kind).toBe('multiple_choice');
    expect(m.options).toHaveLength(4);
    expect(new Set(m.options.map((o) => o.id)).size).toBe(4);
    const correct = m.options.filter((o) => o.word === 'Brot');
    expect(correct).toHaveLength(1);
    expect(m.options[m.correctIndex]).toBe(correct[0]);
    expect(correct[0]).toMatchObject({ article: 'das', meaningIt: 'pane', meaningEn: 'bread' });
  });

  it('always asks to_native for a first sighting', () => {
    for (const r of [0, 0.3, 0.7, 0.99]) {
      expect(buildMultipleChoice(makeCard({ timesSeen: 1 }), pool, () => r)!.direction).toBe('to_native');
    }
  });

  it('reaches both directions afterwards, decided by rng', () => {
    const card = makeCard({ timesSeen: 3 });
    expect(buildMultipleChoice(card, pool, () => 0)!.direction).toBe('to_native');
    expect(buildMultipleChoice(card, pool, () => 0.99)!.direction).toBe('to_german');
  });

  it('is deterministic for a fixed rng', () => {
    const a = buildMultipleChoice(makeCard(), pool, seeded(7));
    const b = buildMultipleChoice(makeCard(), pool, seeded(7));
    expect(a).toEqual(b);
  });

  it('returns null when distractors are missing', () => {
    expect(buildMultipleChoice(makeCard(), FIXTURE_POOL.slice(0, 2), () => 0)).toBeNull();
  });
});

describe('multiple choice against the real word bank', () => {
  it('can be built for every entry, with unique options and no meaning-token overlap', () => {
    const pool = getDistractorPool();
    expect(pool.length).toBe(allEntries().length);
    const rng = seeded(42);
    const failures: string[] = [];
    for (const { level, entry } of allEntries()) {
      const card = makeCard({
        id: entry.word,
        word: entry.word,
        article: entry.article,
        translationIt: entry.meaning_it,
        translationEn: entry.meaning_en,
        partOfSpeech: entry.part_of_speech,
        cefrBand: level,
        topicDomain: entry.topic_domain,
      });
      const m = buildMultipleChoice(card, pool, rng);
      if (!m) {
        failures.push(`${entry.word}: no model`);
        continue;
      }
      const ids = new Set(m.options.map((o) => o.id));
      const answer = m.options[m.correctIndex];
      const answerIt = meaningTokens(answer.meaningIt);
      const answerEn = meaningTokens(answer.meaningEn);
      const bad = m.options.some(
        (o, i) =>
          i !== m.correctIndex &&
          ([...meaningTokens(o.meaningIt)].some((t) => answerIt.has(t)) ||
            [...meaningTokens(o.meaningEn)].some((t) => answerEn.has(t))),
      );
      if (ids.size !== 4 || bad) failures.push(`${entry.word}: unique=${ids.size} overlap=${bad}`);
    }
    expect(failures).toEqual([]);
  }, 90000);
});

describe('sentence reorder', () => {
  it('tokenizes on whitespace and keeps punctuation attached', () => {
    expect(tokenizeSentence('  Ich kaufe das Brot beim Bäcker.  ')).toEqual(
      ['Ich', 'kaufe', 'das', 'Brot', 'beim', 'Bäcker.'],
    );
  });

  it('shuffleTokens never returns the original order and keeps every token', () => {
    const tokens = ['Ich', 'kaufe', 'das', 'Brot'];
    const rngs: Rng[] = [() => 0, () => 0.999999, () => 0.5, seeded(1), seeded(2), seeded(3)];
    for (const rng of rngs) {
      const out = shuffleTokens(tokens, rng);
      expect(out).not.toEqual(tokens);
      expect([...out].sort()).toEqual([...tokens].sort());
    }
  });

  it('buildReorder returns a model for a good sentence', () => {
    const m = buildReorder(makeCard(), seeded(5))!;
    expect(m.kind).toBe('sentence_reorder');
    expect(m.solution).toEqual(['Ich', 'kaufe', 'das', 'Brot', 'beim', 'Bäcker.']);
    expect(m.tokens).not.toEqual(m.solution);
    expect([...m.tokens].sort()).toEqual([...m.solution].sort());
  });

  it('buildReorder respects the 4..10 token window and requires the word in the sentence', () => {
    expect(buildReorder(makeCard({ word: 'Wasser', example: 'Ich trinke Wasser.' }), () => 0.3)).toBeNull(); // 3 tokens
    expect(buildReorder(makeCard({ word: 'Wasser', example: 'Ich trinke Wasser.' }), () => 0.3)).toBeNull();
    expect(buildReorder(makeCard({ word: 'Brot', example: 'Ich esse heute Abend mit meiner Familie gern frisches Brot zum Fruehstueck.' }), () => 0.3)).toBeNull(); // 11 tokens
    expect(buildReorder(makeCard({ word: 'Brot', example: 'Ich trinke heute Abend gern Wasser.' }), () => 0.3)).toBeNull(); // no "Brot"
    expect(buildReorder(makeCard({ example: null }), () => 0.3)).toBeNull();
    expect(buildReorder(makeCard({ word: 'Ja', example: 'Ja Ja Ja Ja' }), () => 0.3)).toBeNull(); // identical tiles cannot be shuffled
  });

  it('gradeReorder compares token by token', () => {
    const solution = ['das', 'Haus', 'das', 'Dach'];
    expect(gradeReorder(['das', 'Haus', 'das', 'Dach'], solution)).toBe('exact');
    expect(gradeReorder(['Haus', 'das', 'das', 'Dach'], solution)).toBe('wrong');
    expect(gradeReorder(['das', 'Haus'], solution)).toBe('wrong');
  });

  it('is available for most of the real bank', () => {
    let eligible = 0;
    for (const { entry } of allEntries()) {
      const card = makeCard({ word: entry.word, example: entry.example });
      if (buildReorder(card, () => 0.3)) eligible++;
    }
    expect(eligible).toBeGreaterThanOrEqual(1500);
  });
});

describe('matching', () => {
  const m = (id: string, word: string, it: string | null, en: string | null) =>
    makeCard({ id, word, translationIt: it, translationEn: en });
  const five = [
    m('1', 'Brot', 'pane', 'bread'),
    m('2', 'Wasser', 'acqua', 'water'),
    m('3', 'Haus', 'casa', 'house'),
    m('4', 'Tisch', 'tavolo', 'table'),
    m('5', 'Buch', 'libro', 'book'),
  ];
  const sorted = (a: string[]) => [...a].sort();

  it('builds a round of up to 5 with both columns as permutations of the ids', () => {
    expect(MATCH_MIN).toBe(4);
    expect(MATCH_MAX).toBe(5);
    const round = buildMatchingRound([...five, m('6', 'Stuhl', 'sedia', 'chair')], seeded(3))!;
    expect(round.kind).toBe('matching');
    expect(round.cards.map((c) => c.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(sorted(round.leftOrder)).toEqual(['1', '2', '3', '4', '5']);
    expect(sorted(round.rightOrder)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('drops cards whose meaning collides (Italian or English) or is missing', () => {
    const round = buildMatchingRound(
      [
        five[0], five[1], five[2],
        m('x', 'Heim', 'casa', 'home'),          // Italian collision with Haus
        m('y', 'Wohnung', 'appartamento', 'house'), // English collision with Haus
        m('z', 'Ding', null, 'thing'),            // missing Italian
        five[3], five[4],
      ],
      () => 0.4,
    )!;
    expect(round.cards.map((c) => c.id)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('returns null with fewer than 4 usable cards', () => {
    expect(buildMatchingRound(five.slice(0, 3), () => 0.4)).toBeNull();
    expect(
      buildMatchingRound([...five.slice(0, 3), m('x', 'Heim', 'casa', 'home')], () => 0.4),
    ).toBeNull();
  });

  it('maps mistakes to quality', () => {
    expect([0, 1, 2, 9].map(matchingQuality)).toEqual([0.7, 0.4, 0, 0]);
    expect(FORMAT_QUALITY.matching).toEqual([0.7, 0.4, 0]);
  });
});

describe('registry: tier gating and weights', () => {
  const newCard = (over: Partial<ReviewCard> = {}) => makeCard({ timesSeen: 1, retentionScore: 0.5, ...over });
  const learning = makeCard({ timesSeen: 2, retentionScore: 0.7 });
  const strong = makeCard({ timesSeen: 8, retentionScore: 0.95 });

  it('offers multiple choice to new words', () => {
    expect(pickExercise(newCard()).kind).toBe('multiple_choice');
  });

  it('offers typed cloze or sentence reorder (2:1) to learning and strong words', () => {
    for (const card of [learning, strong]) {
      // explicit registry: the default one also offers "find the mistake" to this card
      const twoFormats = [TYPED_CLOZE, SENTENCE_REORDER, FLASHCARD];
      expect(pickExercise(card, twoFormats, () => 0.5).kind).toBe('typed_cloze');
      expect(pickExercise(card, twoFormats, () => 0.9).kind).toBe('sentence_reorder');
    }
  });

  it('typed cloze is the only choice when the sentence is too short to reorder', () => {
    const card = makeCard({ word: 'Wasser', example: 'Ich trinke Wasser.' });
    for (const r of [0, 0.5, 0.99]) {
      expect(pickExercise(card, DEFAULT_REGISTRY, () => r).kind).toBe('typed_cloze');
    }
  });

  it('falls back to a flashcard when nothing applies', () => {
    expect(pickExercise(makeCard({ example: null })).kind).toBe('flashcard');             // learning, no example
    expect(pickExercise(newCard({ partOfSpeech: 'interj' })).kind).toBe('flashcard');       // new, no distractors
    expect(pickExercise(newCard({ partOfSpeech: null })).kind).toBe('flashcard');
  });
});

describe('quality ceilings are safe for the schedule', () => {
  const base = new Date('2026-01-01T00:00:00.000Z');

  it('a clean reorder or find-the-mistake never takes a >= 0.9 card below 0.9 or shortens its interval', () => {
    for (const q of [FORMAT_QUALITY.sentence_reorder.exact, FORMAT_QUALITY.find_mistake.fixed]) {
      for (let seen = 2; seen <= 30; seen++) {
        for (let r = 90; r <= 100; r++) {
          const before = r / 100;
          const after = updateRetentionScore(before, q, seen);
          expect(after).toBeGreaterThanOrEqual(0.9);
          expect(nextReviewDate(after, base).getTime()).toBeGreaterThanOrEqual(nextReviewDate(before, base).getTime());
        }
      }
    }
  });

  it('a clean multiple-choice or matching answer raises every reachable new-tier card', () => {
    const qualities = [FORMAT_QUALITY.multiple_choice, FORMAT_QUALITY.matching[0]];
    for (const q of qualities) {
      for (let seen = 1; seen <= 30; seen++) {
        for (let r = 0; r <= 59; r++) {
          const before = r / 100;
          expect(updateRetentionScore(before, q, seen)).toBeGreaterThan(before);
        }
      }
    }
  });
});
