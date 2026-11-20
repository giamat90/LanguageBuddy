import { computeStats, parseWordFilter, selectStatRows, type WordFilter } from '../src/lib/stats';
import { WORD_BANK, CEFR_ORDER, allEntries } from '../src/data/wordbank';
import { TOPIC_KEYS } from '../src/lib/topics';

const NO_REVIEWS = { total: 0, correct: 0 };
const word = (level: 'A1' | 'A2', topic: string) =>
  WORD_BANK[level].find((e) => e.topic_domain === topic)!.word;

describe('computeStats', () => {
  it('is all zeros for an empty vault, with the bank sizes filled in', () => {
    const s = computeStats([], NO_REVIEWS);
    expect(s.saved).toEqual({ new: 0, learning: 0, mastered: 0, total: 0 });
    expect(s.reviews.accuracy).toBeNull();
    expect(s.bankTotal).toBe(allEntries().length);
    expect(s.byTopic.map((g) => g.key)).toEqual(TOPIC_KEYS);
    expect(s.byLevel.map((g) => g.key)).toEqual(CEFR_ORDER);
    expect(s.byTopic.reduce((a, g) => a + g.bankTotal, 0)).toBe(s.bankTotal);
    expect(s.byLevel.reduce((a, g) => a + g.bankTotal, 0)).toBe(s.bankTotal);
  });

  it('tiers words with the same rules as the exercise engine', () => {
    const s = computeStats([
      { word: word('A1', 'food'), retentionScore: 0.5, timesSeen: 1 },   // new
      { word: word('A1', 'home'), retentionScore: 0.7, timesSeen: 3 },   // learning
      { word: word('A1', 'work'), retentionScore: 0.9, timesSeen: 6 },   // mastered
      { word: word('A2', 'work'), retentionScore: 0.9, timesSeen: 2 },   // seen too rarely -> learning
    ], NO_REVIEWS);
    expect(s.saved).toEqual({ new: 1, learning: 2, mastered: 1, total: 4 });
  });

  it('groups by topic and level using the bank (case-insensitive)', () => {
    const s = computeStats([
      { word: word('A1', 'food').toUpperCase(), retentionScore: 0.9, timesSeen: 6 },
      { word: word('A2', 'food'), retentionScore: 0.5, timesSeen: 1 },
    ], NO_REVIEWS);
    const food = s.byTopic.find((g) => g.key === 'food')!;
    expect(food).toMatchObject({ total: 2, mastered: 1, new: 1 });
    expect(s.byLevel.find((g) => g.key === 'A1')!.total).toBe(1);
    expect(s.byLevel.find((g) => g.key === 'A2')!.total).toBe(1);
  });

  it('counts a word that is not in the bank in the totals but in no group', () => {
    const s = computeStats([{ word: 'Zzzzwort', retentionScore: 0.5, timesSeen: 1 }], NO_REVIEWS);
    expect(s.saved.total).toBe(1);
    expect(s.byTopic.reduce((a, g) => a + g.total, 0)).toBe(0);
    expect(s.byLevel.reduce((a, g) => a + g.total, 0)).toBe(0);
  });

  it('group totals never exceed the group bank size and tiers add up to the total', () => {
    const rows = allEntries().slice(0, 300).map((e, i) => ({
      word: e.entry.word, retentionScore: (i % 10) / 10, timesSeen: 1 + (i % 7),
    }));
    const s = computeStats(rows, NO_REVIEWS);
    for (const g of [...s.byTopic, ...s.byLevel]) {
      expect(g.new + g.learning + g.mastered).toBe(g.total);
      expect(g.total).toBeLessThanOrEqual(g.bankTotal);
    }
    expect(s.saved.new + s.saved.learning + s.saved.mastered).toBe(s.saved.total);
  });

  it('computes review accuracy, and guards a nonsensical correct > total', () => {
    expect(computeStats([], { total: 8, correct: 6 }).reviews.accuracy).toBeCloseTo(0.75);
    expect(computeStats([], { total: 2, correct: 5 }).reviews.accuracy).toBe(1);
  });
});

describe('parseWordFilter', () => {
  it('accepts only whitelisted kinds and values', () => {
    expect(parseWordFilter('all', undefined)).toEqual({ kind: 'all' });
    expect(parseWordFilter('tier', 'mastered')).toEqual({ kind: 'tier', tier: 'mastered' });
    expect(parseWordFilter('topic', 'food')).toEqual({ kind: 'topic', key: 'food' });
    expect(parseWordFilter('level', 'B2')).toEqual({ kind: 'level', key: 'B2' });
  });
  it('takes the first value of an array param', () => {
    expect(parseWordFilter(['level'], ['A1', 'A2'])).toEqual({ kind: 'level', key: 'A1' });
  });
  it.each([
    ['tier', 'bogus'], ['topic', "x'; DROP TABLE vocabulary_items;--"], ['level', 'D9'],
    ['nope', 'food'], [undefined, undefined], ['tier', undefined], [42, 'food'],
  ])('rejects %p / %p', (k, v) => {
    expect(parseWordFilter(k, v)).toBeNull();
  });
});

describe('selectStatRows', () => {
  const rows = allEntries().slice(0, 400).map((e, i) => ({
    word: e.entry.word, retentionScore: (i % 10) / 10, timesSeen: 1 + (i % 7),
  }));
  rows.push({ word: 'Zzzzwort', retentionScore: 0.5, timesSeen: 1 }); // not in the bank
  const stats = computeStats(rows, NO_REVIEWS);

  it('"all" returns every row', () => {
    expect(selectStatRows(rows, { kind: 'all' })).toHaveLength(stats.saved.total);
  });
  it.each(['mastered', 'learning', 'new'] as const)('tier %s matches the count shown', (tier) => {
    expect(selectStatRows(rows, { kind: 'tier', tier })).toHaveLength(stats.saved[tier]);
  });
  it('every topic and level list has exactly the length of its count', () => {
    for (const g of stats.byTopic) {
      const f: WordFilter = { kind: 'topic', key: g.key };
      expect(selectStatRows(rows, f)).toHaveLength(g.total);
    }
    for (const g of stats.byLevel) {
      const f: WordFilter = { kind: 'level', key: g.key as 'A1' };
      expect(selectStatRows(rows, f)).toHaveLength(g.total);
    }
  });
  it('keeps extra fields and never returns a word that is not in the bank for a group', () => {
    const out = selectStatRows([{ id: 'x', word: 'Zzzzwort', retentionScore: 0.5, timesSeen: 1 }], { kind: 'topic', key: 'food' });
    expect(out).toEqual([]);
    const kept = selectStatRows([{ id: 'x', word: word('A1', 'food'), retentionScore: 0.5, timesSeen: 1 }], { kind: 'topic', key: 'food' });
    expect(kept[0].id).toBe('x');
  });
});
