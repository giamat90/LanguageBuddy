/** TASK-076: daily words walk a level stage by stage; chosen topics first within a stage. */
jest.mock('../src/data/wordbank', () => {
  const word = (w: string, stage: number, topic: string) => ({ word: w, stage, topic_domain: topic });
  const A1 = [
    word('c1', 3, 'food'), word('a1', 1, 'home'), word('b1', 2, 'food'), word('a2', 1, 'food'),
    word('a3', 1, 'home'), word('b2', 2, 'home'), word('c2', 3, 'travel'), word('a4', 1, 'work'),
  ];
  return {
    CEFR_ORDER: ['A1'],
    WORD_BANK: { A1 },
    entryId: (level: string, e: { word: string }) => `${level}:${e.word}`,
  };
});

import { orderedBankForLevel, pickNextWord } from '../src/data/dailyWord';

const used = (...w: string[]) => new Set(w);
const installs = Array.from({ length: 20 }, (_, i) => `install-${i}`);
const pick = (done: Set<string>, topics?: string[], install = 'x') => pickNextWord('A1', install, done, topics);

describe('order', () => {
  it('goes stage by stage, shuffled within a stage per install', () => {
    const orders = installs.map((id) => orderedBankForLevel('A1', id));
    for (const order of orders) {
      expect(order.map((e) => e.stage)).toEqual([1, 1, 1, 1, 2, 2, 3, 3]);
    }
    expect(new Set(orders.map((o) => o.map((e) => e.word).join())).size).toBeGreaterThan(1);
    expect(orderedBankForLevel('A1', 'install-3')).toEqual(orderedBankForLevel('A1', 'install-3'));
  });
});

describe('the next word', () => {
  it('is a chosen topic of the lowest unfinished stage', () => {
    for (const id of installs) expect(pick(used(), ['food'], id).entry.word).toBe('a2');
  });

  it('stays in the stage when its topic words are used up, without claiming the topic ran out', () => {
    for (const id of installs) {
      const next = pick(used('a2'), ['food'], id);
      expect(next.entry.stage).toBe(1);
      expect(next.outsideTopics).toBe(false);
    }
  });

  it('moves to the next stage only when the stage is done', () => {
    const next = pick(used('a1', 'a2', 'a3', 'a4'), ['food']);
    expect([next.entry.word, next.outsideTopics]).toEqual(['b1', false]);
  });

  it('says so when no word of the topics is left anywhere', () => {
    const next = pick(used('a2', 'b1', 'c1'), ['food']);
    expect(next.entry.stage).toBe(1);
    expect(next.outsideTopics).toBe(true);
  });

  it('without topics takes the first unused word', () => {
    expect(pick(used('a1', 'a2', 'a3', 'a4')).entry.stage).toBe(2);
  });

  it('recycles from stage 1, a chosen topic first', () => {
    const all = used('a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'c1', 'c2');
    expect(pick(all, ['food'])).toMatchObject({ exhausted: true, entry: { word: 'a2' } });
    expect(pick(all).entry.stage).toBe(1);
  });
});
