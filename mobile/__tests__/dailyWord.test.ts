import { seededShuffle, orderedBankForLevel, pickNextWord } from '../src/data/dailyWord';
import { WORD_BANK } from '../src/data/wordbank';

describe('seededShuffle', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  it('is deterministic for the same seed', () => {
    expect(seededShuffle(input, 'abc')).toEqual(seededShuffle(input, 'abc'));
  });
  it('differs for different seeds', () => {
    expect(seededShuffle(input, 'abc')).not.toEqual(seededShuffle(input, 'xyz'));
  });
  it('is a permutation (no loss, no dupes)', () => {
    expect([...seededShuffle(input, 'abc')].sort((a, b) => a - b)).toEqual(input);
  });
  it('does not mutate the input', () => {
    const copy = [...input];
    seededShuffle(input, 'abc');
    expect(input).toEqual(copy);
  });
});

describe('orderedBankForLevel', () => {
  it('covers the whole A1 bank exactly once', () => {
    const ordered = orderedBankForLevel('A1', 'inst_1');
    expect(ordered).toHaveLength(WORD_BANK.A1.length);
    expect(new Set(ordered.map((e) => e.word)).size).toBe(WORD_BANK.A1.length);
  });
});

describe('pickNextWord', () => {
  it('never repeats a used word until the level is exhausted', () => {
    const used = new Set<string>();
    const seen: string[] = [];
    for (let i = 0; i < WORD_BANK.A2.length; i++) {
      const { entry, exhausted } = pickNextWord('A2', 'inst_x', used);
      expect(exhausted).toBe(false);
      expect(used.has(entry.word.toLowerCase())).toBe(false);
      used.add(entry.word.toLowerCase());
      seen.push(entry.word);
    }
    expect(new Set(seen).size).toBe(WORD_BANK.A2.length);
    // one more pick past the end recycles and flags exhausted
    expect(pickNextWord('A2', 'inst_x', used).exhausted).toBe(true);
  });
});

describe('pickNextWord with active topics', () => {
  const lower = (s: string) => s.toLowerCase();

  it('behaves as before when no topics are given', () => {
    const a = pickNextWord('A1', 'inst_t', new Set());
    expect(a.outsideTopics).toBe(false);
    expect(a.entry).toEqual(orderedBankForLevel('A1', 'inst_t')[0]);
  });

  it('only returns active-topic words while any are left', () => {
    const used = new Set<string>();
    const total = WORD_BANK.A1.filter((e) => ['food', 'home'].includes(e.topic_domain)).length;
    for (let i = 0; i < total; i++) {
      const r = pickNextWord('A1', 'inst_t', used, ['food', 'home']);
      expect(['food', 'home']).toContain(r.entry.topic_domain);
      expect(r.outsideTopics).toBe(false);
      expect(r.exhausted).toBe(false);
      used.add(lower(r.entry.word));
    }
  });

  it('falls back to other topics of the level (flagged) once the active ones are used up', () => {
    const used = new Set(WORD_BANK.A1.filter((e) => e.topic_domain === 'food').map((e) => lower(e.word)));
    const r = pickNextWord('A1', 'inst_t', used, ['food']);
    expect(r.entry.topic_domain).not.toBe('food');
    expect(r.outsideTopics).toBe(true);
    expect(r.exhausted).toBe(false);
  });

  it('falls back immediately when the level has no word for the topic (C1 food)', () => {
    const r = pickNextWord('C1', 'inst_t', new Set(), ['food']);
    expect(r.entry).toBeDefined();
    expect(r.outsideTopics).toBe(true);
  });

  it('recycles preferring active topics once the whole level is used', () => {
    const used = new Set(WORD_BANK.A2.map((e) => lower(e.word)));
    const r = pickNextWord('A2', 'inst_t', used, ['health']);
    expect(r.exhausted).toBe(true);
    expect(r.entry.topic_domain).toBe('health');
  });

  it('never fails for any level and any single topic, including unknown topics', () => {
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const) {
      for (const topic of ['food', 'travel', 'work', 'culture', 'home', 'leisure', 'health', 'shopping', 'bogus']) {
        const r = pickNextWord(level, 'inst_t', new Set(), [topic]);
        expect(r.entry.cefr_band).toBe(level);
      }
    }
  });

  it('an empty topic list means "no preference"', () => {
    expect(pickNextWord('A1', 'inst_t', new Set(), []).outsideTopics).toBe(false);
  });
});
