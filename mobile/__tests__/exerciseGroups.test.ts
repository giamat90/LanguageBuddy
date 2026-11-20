import {
  createSession, currentEntry, submitResult, submitGroupResult, progress, isFinished,
  RELEARN_GAP, type SessionState, type QueueEntry,
} from '../src/lib/exercises';
import type { ReviewCard } from '../src/services/reviewService';

const MEANINGS: [string, string][] = [
  ['pane', 'bread'], ['acqua', 'water'], ['casa', 'house'], ['tavolo', 'table'],
  ['libro', 'book'], ['gatto', 'cat'], ['cane', 'dog'], ['mela', 'apple'], ['sole', 'sun'],
];

function card(id: string, i: number, tier: 'new' | 'learning' = 'new', over: Partial<ReviewCard> = {}): ReviewCard {
  const [it, en] = MEANINGS[i % MEANINGS.length];
  return {
    id,
    word: `Wort${id}`,
    article: 'das',
    translationIt: it,
    translationEn: en,
    exampleDe: null,
    exampleIt: null,
    exampleEn: null,
    partOfSpeech: 'noun',
    cefrBand: 'A1',
    topicDomain: 'food',
    timesSeen: tier === 'new' ? 1 : 3,
    retentionScore: tier === 'new' ? 0.5 : 0.7,
    ...over,
  };
}
const newCards = (n: number) => Array.from({ length: n }, (_, i) => card(`n${i + 1}`, i));

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o as object).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

const describeEntry = (e: QueueEntry) =>
  e.kind === 'group' ? `G(${e.cards.map((c) => c.id).join(',')})` : `${e.card.id}${e.retry ? `#${e.retry}` : ''}`;
const shape = (s: SessionState) => s.queue.map(describeEntry);
const rng = () => 0.4;

describe('createSession planning', () => {
  it('groups 9 new cards into rounds of 5 and 4', () => {
    const s = createSession(newCards(9), { rng });
    expect(shape(s)).toEqual(['G(n1,n2,n3,n4,n5)', 'G(n6,n7,n8,n9)']);
    expect(s.total).toBe(9); // cards, not steps
  });

  it('leaves a single behind when 6 new cards remain after a round of 5', () => {
    expect(shape(createSession(newCards(6), { rng }))).toEqual(['G(n1,n2,n3,n4,n5)', 'n6']);
  });

  it('does not group fewer than 4 new cards', () => {
    expect(shape(createSession(newCards(3), { rng }))).toEqual(['n1', 'n2', 'n3']);
  });

  it('puts rounds first and keeps the other cards in their original order', () => {
    const cards = [
      card('L1', 0, 'learning'), card('n1', 0), card('n2', 1), card('L2', 2, 'learning'),
      card('n3', 2), card('n4', 3), card('L3', 4, 'learning'),
    ];
    expect(shape(createSession(cards, { rng }))).toEqual(['G(n1,n2,n3,n4)', 'L1', 'L2', 'L3']);
  });

  it('keeps cards with a colliding meaning out of the round, as singles', () => {
    const cards = [card('n1', 0), card('n2', 1), card('n3', 2), card('dup', 2), card('n5', 3)];
    expect(shape(createSession(cards, { rng }))).toEqual(['G(n1,n2,n3,n5)', 'dup']);
  });

  it('{ groups: [] } disables grouping', () => {
    expect(shape(createSession(newCards(5), { groups: [], rng }))).toEqual(['n1', 'n2', 'n3', 'n4', 'n5']);
  });

  it('groupsOnly keeps just the rounds: leftovers are dropped and total counts the cards in rounds', () => {
    const s = createSession(newCards(7), { rng, groupsOnly: true });
    expect(shape(s)).toEqual(['G(n1,n2,n3,n4,n5)']);
    expect(s.total).toBe(5);
  });

  it('groupsOnly with too few usable cards gives an empty session', () => {
    const s = createSession(newCards(3), { rng, groupsOnly: true });
    expect(s.queue).toEqual([]);
    expect(s.total).toBe(0);
    expect(isFinished(s)).toBe(true);
  });

  it('is deterministic for a fixed rng', () => {
    const a = createSession(newCards(5), { rng: () => 0.3 });
    const b = createSession(newCards(5), { rng: () => 0.3 });
    expect(a).toEqual(b);
  });
});

describe('submitGroupResult', () => {
  const cards = [
    ...newCards(4),
    card('L1', 4, 'learning'), card('L2', 5, 'learning'), card('L3', 6, 'learning'),
  ];
  const fresh = () => createSession(cards, { rng });

  it('grades every card of the round and counts cards, not steps', () => {
    const { state, grades } = submitGroupResult(fresh(), { n1: 0.7, n2: 0.4, n3: 0, n4: 0.7 });
    expect(grades).toEqual([
      { cardId: 'n1', quality: 0.7 },
      { cardId: 'n2', quality: 0.4 },
      { cardId: 'n3', quality: 0 },
      { cardId: 'n4', quality: 0.7 },
    ]);
    expect(state.gradedCount).toBe(4);
    expect(state.firstTryCorrect).toBe(2);
    expect(state.position).toBe(1);
  });

  it('requeues each failing card as a single retry, spaced by the relearn gap', () => {
    expect(RELEARN_GAP).toBe(3);
    const { state } = submitGroupResult(fresh(), { n1: 0.7, n2: 0.4, n3: 0, n4: 0.7 });
    expect(shape(state)).toEqual(['G(n1,n2,n3,n4)', 'L1', 'L2', 'L3', 'n2#1', 'n3#1']);
  });

  it('appends retries when fewer cards remain than the gap', () => {
    const only = createSession(newCards(4), { rng });
    const { state } = submitGroupResult(only, { n1: 0, n2: 0, n3: 0.7, n4: 0.7 });
    expect(shape(state)).toEqual(['G(n1,n2,n3,n4)', 'n1#1', 'n2#1']);
  });

  it('counts a missing quality as 0', () => {
    const { grades, state } = submitGroupResult(fresh(), { n1: 0.7, n2: 0.7, n3: 0.7 });
    expect(grades.find((g) => g.cardId === 'n4')).toEqual({ cardId: 'n4', quality: 0 });
    expect(state.firstTryCorrect).toBe(3);
  });

  it('retries of group failures are single entries that are never graded', () => {
    let s = createSession(newCards(4), { rng });
    s = submitGroupResult(s, { n1: 0, n2: 0.7, n3: 0.7, n4: 0.7 }).state; // n1#1 queued
    expect(currentEntry(s)).toMatchObject({ kind: 'single', retry: 1 });
    const r = submitResult(s, 1);
    expect(r.grade).toBeNull();
    expect(r.state.gradedCount).toBe(4);
    expect(isFinished(r.state)).toBe(true);
  });

  it('progress after a 5-card round is 6 of the total', () => {
    const s = createSession([...newCards(5), card('L1', 5, 'learning'), card('L2', 6, 'learning')], { rng });
    const next = submitGroupResult(s, { n1: 0.7, n2: 0.7, n3: 0.7, n4: 0.7, n5: 0.7 }).state;
    expect(progress(next)).toEqual({ current: 6, total: 7 });
  });

  it('is a no-op on a single entry, and submitResult is a no-op on a group entry', () => {
    const singles = createSession(newCards(3), { rng });
    const a = submitGroupResult(singles, { n1: 1 });
    expect(a.state).toBe(singles);
    expect(a.grades).toEqual([]);

    const group = createSession(newCards(4), { rng });
    const b = submitResult(group, 1);
    expect(b.state).toBe(group);
    expect(b.grade).toBeNull();
  });

  it('never mutates the state it is given', () => {
    const s = deepFreeze(fresh());
    expect(() => submitGroupResult(s, { n1: 0, n2: 0, n3: 0, n4: 0 })).not.toThrow();
    expect(shape(s)).toEqual(['G(n1,n2,n3,n4)', 'L1', 'L2', 'L3']);
  });
});
