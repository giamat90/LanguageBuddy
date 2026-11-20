import {
  tierOf,
  typedQuality, toQuality, PASS_QUALITY, QUALITY,
  pickExercise, TYPED_CLOZE, FLASHCARD,
  createSession, currentEntry, submitResult, isFinished, progress,
  RELEARN_GAP, MAX_RETRIES,
  type ExerciseDefinition, type SessionState, type QueueEntry,
} from '../src/lib/exercises';
import { gradeTypedAnswer, isAnswerCorrect } from '../src/lib/cloze';
import type { ReviewCard } from '../src/services/reviewService';

function makeCard(over: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id: 'c1',
    word: 'Brot',
    article: 'das',
    translationIt: 'pane',
    translationEn: 'bread',
    exampleDe: 'Ich kaufe das Brot beim Bäcker.',
    exampleIt: 'Compro il pane dal panettiere.',
    exampleEn: 'I buy the bread at the baker.',
    timesSeen: 2,
    retentionScore: 0.7,
    ...over,
  };
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o as object).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

describe('tierOf', () => {
  it('is "new" for a first sighting or weak retention', () => {
    expect(tierOf({ timesSeen: 1, retentionScore: 0.95 })).toBe('new');
    expect(tierOf({ timesSeen: 6, retentionScore: 0.59 })).toBe('new');
  });
  it('is "learning" in the middle (boundaries included)', () => {
    expect(tierOf({ timesSeen: 2, retentionScore: 0.6 })).toBe('learning');
    expect(tierOf({ timesSeen: 3, retentionScore: 0.99 })).toBe('learning'); // not seen enough for strong
    expect(tierOf({ timesSeen: 9, retentionScore: 0.84 })).toBe('learning');
  });
  it('is "strong" with high retention and enough sightings', () => {
    expect(tierOf({ timesSeen: 4, retentionScore: 0.85 })).toBe('strong');
    expect(tierOf({ timesSeen: 12, retentionScore: 1 })).toBe('strong');
  });
});

describe('quality', () => {
  it('maps typed results to a quality', () => {
    expect(typedQuality('exact', false)).toBe(1);
    expect(typedQuality('close', false)).toBe(0.7);
    expect(typedQuality('wrong', false)).toBe(0);
  });
  it('caps quality when the hint was used, never raising it', () => {
    expect(typedQuality('exact', true)).toBe(QUALITY.hintCap);
    expect(typedQuality('close', true)).toBe(QUALITY.hintCap);
    expect(typedQuality('wrong', true)).toBe(0);
  });
  it('a hinted correct answer still passes', () => {
    expect(typedQuality('exact', true)).toBeGreaterThanOrEqual(PASS_QUALITY);
  });
  it('toQuality normalises booleans and clamps numbers', () => {
    expect(toQuality(true)).toBe(1);
    expect(toQuality(false)).toBe(0);
    expect(toQuality(0.4)).toBe(0.4);
    expect(toQuality(-1)).toBe(0);
    expect(toQuality(2)).toBe(1);
    expect(toQuality(NaN)).toBe(0);
  });
});

describe('gradeTypedAnswer', () => {
  it('is exact for the right word ignoring case and surrounding space', () => {
    expect(gradeTypedAnswer('brot', 'Brot')).toBe('exact');
    expect(gradeTypedAnswer('  Brot ', 'Brot')).toBe('exact');
    expect(gradeTypedAnswer('bäcker', 'Bäcker')).toBe('exact');
  });
  it('is close when only umlauts / ß are folded', () => {
    expect(gradeTypedAnswer('backer', 'Bäcker')).toBe('close');
    expect(gradeTypedAnswer('Mutter', 'Mütter')).toBe('close');
    expect(gradeTypedAnswer('strasse', 'Straße')).toBe('close');
  });
  it('is close for one typo on words of 5+ letters only', () => {
    expect(gradeTypedAnswer('Wassr', 'Wasser')).toBe('close');
    expect(gradeTypedAnswer('muter', 'Mutter')).toBe('close');
    expect(gradeTypedAnswer('Brt', 'Brot')).toBe('wrong');
  });
  it('is wrong for empty, blank or distant answers', () => {
    expect(gradeTypedAnswer('', 'Brot')).toBe('wrong');
    expect(gradeTypedAnswer('   ', 'Brot')).toBe('wrong');
    expect(gradeTypedAnswer('Wssr', 'Wasser')).toBe('wrong');
  });
  it('isAnswerCorrect stays true for exact and close, false for wrong', () => {
    expect(isAnswerCorrect('brot', 'Brot')).toBe(true);
    expect(isAnswerCorrect('backer', 'Bäcker')).toBe(true);
    expect(isAnswerCorrect('Brt', 'Brot')).toBe(false);
  });
});

describe('pickExercise', () => {
  it('uses typed cloze when the example contains the word', () => {
    const m = pickExercise(makeCard(), [TYPED_CLOZE, FLASHCARD]);
    expect(m.kind).toBe('typed_cloze');
    if (m.kind === 'typed_cloze') {
      expect(m.before).toBe('Ich kaufe das ');
      expect(m.after).toBe(' beim Bäcker.');
    }
  });

  it('falls back to a flashcard without an example, or when the word is not in it', () => {
    expect(pickExercise(makeCard({ exampleDe: null })).kind).toBe('flashcard');
    expect(pickExercise(makeCard({ exampleDe: 'Ich trinke Wasser.' })).kind).toBe('flashcard');
  });

  it('keeps the flashcard out of the random pool (parity with the old screen)', () => {
    for (const r of [0, 0.5, 0.99]) {
      expect(pickExercise(makeCard(), [TYPED_CLOZE, FLASHCARD], () => r).kind).toBe('typed_cloze');
    }
  });

  describe('with an injected registry', () => {
    const tagged = (tag: string, tiers: ExerciseDefinition['tiers']): ExerciseDefinition => ({
      kind: 'typed_cloze',
      tiers,
      build: (card) => ({ kind: 'typed_cloze', card, before: tag, after: '' }),
    });
    const tagOf = (card: ReviewCard, reg: ExerciseDefinition[], rng?: () => number) => {
      const m = pickExercise(card, reg, rng);
      return m.kind === 'typed_cloze' ? m.before : m.kind;
    };

    const newCard = makeCard({ timesSeen: 1 });
    const learningCard = makeCard({ timesSeen: 2, retentionScore: 0.7 });
    const strongCard = makeCard({ timesSeen: 8, retentionScore: 0.95 });

    it('offers each definition only to the tiers it serves', () => {
      const reg = [tagged('NEW', ['new']), tagged('STRONG', ['strong']), FLASHCARD];
      expect(tagOf(newCard, reg)).toBe('NEW');
      expect(tagOf(strongCard, reg)).toBe('STRONG');
      expect(tagOf(learningCard, reg)).toBe('flashcard'); // nothing serves "learning" -> fallback
    });

    it('lets the rng choose between several matching definitions, deterministically', () => {
      const reg = [tagged('A', ['learning']), tagged('B', ['learning']), FLASHCARD];
      expect(tagOf(learningCard, reg, () => 0)).toBe('A');
      expect(tagOf(learningCard, reg, () => 0.99)).toBe('B');
    });

    it('skips a definition whose build returns null', () => {
      const none: ExerciseDefinition = { kind: 'typed_cloze', tiers: ['learning'], build: () => null };
      expect(tagOf(learningCard, [none, tagged('OK', ['learning']), FLASHCARD], () => 0)).toBe('OK');
    });
  });
});

describe('session', () => {
  const cards = (ids: string[]) => ids.map((id) => makeCard({ id, word: id }));
  const cardIdOf = (e: QueueEntry | undefined) => (e && e.kind === 'single' ? e.card.id : undefined);
  const ids = (s: SessionState) =>
    s.queue.map((e) => (e.kind === 'single' ? `${e.card.id}${e.retry ? `#${e.retry}` : ''}` : 'GROUP'));

  it('starts on the first card with nothing graded', () => {
    const s = createSession(cards(['a', 'b']));
    expect(s.total).toBe(2);
    expect(cardIdOf(currentEntry(s))).toBe('a');
    expect(progress(s)).toEqual({ current: 1, total: 2 });
    expect(isFinished(s)).toBe(false);
  });

  it('an empty session is finished immediately', () => {
    const s = createSession([]);
    expect(isFinished(s)).toBe(true);
    expect(currentEntry(s)).toBeUndefined();
  });

  it('a passing first attempt is graded, counted, and not requeued', () => {
    const { state, grade } = submitResult(createSession(cards(['a', 'b'])), 1);
    expect(grade).toEqual({ cardId: 'a', quality: 1 });
    expect(state.gradedCount).toBe(1);
    expect(state.firstTryCorrect).toBe(1);
    expect(ids(state)).toEqual(['a', 'b']);
    expect(cardIdOf(currentEntry(state))).toBe('b');
  });

  it('quality exactly at the pass mark counts as correct', () => {
    const { state } = submitResult(createSession(cards(['a'])), PASS_QUALITY);
    expect(state.firstTryCorrect).toBe(1);
  });

  it('a failed first attempt is graded, not counted, and requeued RELEARN_GAP later', () => {
    const { state, grade } = submitResult(createSession(cards(['a', 'b', 'c', 'd', 'e'])), 0);
    expect(grade).toEqual({ cardId: 'a', quality: 0 });
    expect(state.firstTryCorrect).toBe(0);
    expect(state.gradedCount).toBe(1);
    expect(RELEARN_GAP).toBe(3);
    expect(ids(state)).toEqual(['a', 'b', 'c', 'd', 'a#1', 'e']);
  });

  it('requeues at the end when fewer cards remain than the gap', () => {
    const { state } = submitResult(createSession(cards(['a', 'b'])), 0);
    expect(ids(state)).toEqual(['a', 'b', 'a#1']);
  });

  it('a retry is not graded and does not change the counters', () => {
    const s = submitResult(createSession(cards(['a'])), 0).state; // a, a#1
    const r = submitResult(s, 1);
    expect(r.grade).toBeNull();
    expect(r.state.gradedCount).toBe(1);
    expect(r.state.firstTryCorrect).toBe(0);
    expect(isFinished(r.state)).toBe(true);
  });

  it('gives up after MAX_RETRIES failed retries', () => {
    expect(MAX_RETRIES).toBe(2);
    let s = createSession(cards(['a']));
    s = submitResult(s, 0).state; // first fail -> a#1
    s = submitResult(s, 0).state; // retry 1 fails -> a#2
    expect(ids(s)).toEqual(['a', 'a#1', 'a#2']);
    s = submitResult(s, 0).state; // retry 2 fails -> not requeued
    expect(ids(s)).toEqual(['a', 'a#1', 'a#2']);
    expect(isFinished(s)).toBe(true);
  });

  it('progress counts first attempts only and never exceeds the total', () => {
    let s = createSession(cards(['a', 'b']));
    s = submitResult(s, 0).state; // a fails: queue a, b, a#1
    expect(progress(s)).toEqual({ current: 2, total: 2 });
    s = submitResult(s, 1).state; // b
    expect(progress(s)).toEqual({ current: 2, total: 2 });
    s = submitResult(s, 1).state; // a#1
    expect(progress(s)).toEqual({ current: 2, total: 2 });
    expect(isFinished(s)).toBe(true);
  });

  it('never mutates the state it is given', () => {
    const s = deepFreeze(createSession(cards(['a', 'b', 'c'])));
    expect(() => submitResult(s, 0)).not.toThrow();
    expect(ids(s)).toEqual(['a', 'b', 'c']);
    expect(s.position).toBe(0);
  });

  it('normalises out-of-range quality values', () => {
    const { grade } = submitResult(createSession(cards(['a'])), 7);
    expect(grade?.quality).toBe(1);
  });
});
