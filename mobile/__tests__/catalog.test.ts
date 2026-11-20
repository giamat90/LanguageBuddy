import { buildCatalog, scopeCounts, CATALOG_STATUSES, type SavedState } from '../src/lib/catalog';
import { CEFR_ORDER, WORD_BANK, type CefrLevel, type WordBankEntry } from '../src/data/wordbank';
import { TOPIC_KEYS } from '../src/lib/topics';
import { computeStats } from '../src/lib/stats';
import { STATUS_COLORS } from '../src/theme/statusColors';

const entry = (word: string, topic: string, article: string | null = null): WordBankEntry => ({
  word, article, part_of_speech: 'noun', ipa: '', meaning_en: `${word}-en`, meaning_it: `${word}-it`,
  example_de: '', example_it: '', cultural_note: '', grammar_angle: 'NOUN_GENDER',
  topic_domain: topic, cefr_band: '', session_scenario: '', example_en: '', cultural_note_en: '',
});
const emptyBank = (): Record<CefrLevel, WordBankEntry[]> =>
  ({ A1: [], A2: [], B1: [], B2: [], C1: [], C2: [] });
const state = (retentionScore: number, timesSeen: number, id = 'x'): SavedState => ({ id, retentionScore, timesSeen });
const saved = (o: Record<string, SavedState>) => new Map(Object.entries(o));

describe('buildCatalog (tiny bank)', () => {
  const bank = emptyBank();
  bank.A1 = [entry('Tisch', 'home', 'der'), entry('Äpfel', 'food'), entry('Zug', 'travel', 'der'), entry('Brot', 'food', 'das')];
  bank.A2 = [entry('Brot', 'food', 'das'), entry('Käse', 'food', 'der')];

  it('everything is todo when nothing is saved', () => {
    const v = buildCatalog({ level: 'A1', topic: null }, null, new Map(), bank);
    expect(v.total).toBe(4);
    expect(v.counts).toEqual({ mastered: 0, learning: 0, new: 0, todo: 4 });
    expect(v.entries.every((e) => e.status === 'todo' && e.savedId === null)).toBe(true);
  });

  it('derives the status from retention and times seen like statTierOf', () => {
    const v = buildCatalog({ level: 'A1', topic: null }, null, saved({
      tisch: state(0.9, 5, 'a'), 'äpfel': state(0.7, 3, 'b'), zug: state(0.5, 3, 'c'), brot: state(0.9, 1, 'd'),
    }), bank);
    const by = Object.fromEntries(v.entries.map((e) => [e.word, e.status]));
    expect(by).toEqual({ Tisch: 'mastered', Äpfel: 'learning', Zug: 'new', Brot: 'new' });
    expect(v.entries.find((e) => e.word === 'Tisch')!.savedId).toBe('a');
  });

  it('matches case-insensitively', () => {
    const v = buildCatalog({ level: 'A1', topic: null }, null, saved({ tisch: state(0.9, 5) }), bank);
    expect(v.entries.find((e) => e.word === 'Tisch')!.status).toBe('mastered');
  });

  it('filters by topic; counts ignore the status filter, entries obey it', () => {
    const s = saved({ brot: state(0.7, 3) });
    const all = buildCatalog({ level: 'A1', topic: 'food' }, null, s, bank);
    const todo = buildCatalog({ level: 'A1', topic: 'food' }, 'todo', s, bank);
    expect(all.total).toBe(2);
    expect(todo.counts).toEqual(all.counts);
    expect(todo.total).toBe(2);
    expect(todo.entries.map((e) => e.word)).toEqual(['Äpfel']);
    expect(todo.entries.length).toBe(todo.counts.todo);
  });

  it('sorts with German collation (Ä with A) ', () => {
    const v = buildCatalog({ level: 'A1', topic: null }, null, new Map(), bank);
    expect(v.entries.map((e) => e.word)).toEqual(['Äpfel', 'Brot', 'Tisch', 'Zug']);
  });

  it('spanning all levels sorts level first and keeps keys unique for a word in two levels', () => {
    const v = buildCatalog({ level: null, topic: 'food' }, null, new Map(), bank);
    expect(v.entries.map((e) => `${e.level}:${e.word}`)).toEqual(['A1:Äpfel', 'A1:Brot', 'A2:Brot', 'A2:Käse']);
    expect(new Set(v.entries.map((e) => e.key)).size).toBe(4);
  });

  it('a saved word present at two levels shows its status at both', () => {
    const v = buildCatalog({ level: null, topic: 'food' }, null, saved({ brot: state(0.9, 5) }), bank);
    expect(v.entries.filter((e) => e.word === 'Brot').map((e) => e.status)).toEqual(['mastered', 'mastered']);
  });
});

describe('buildCatalog (real word bank)', () => {
  it('Apfel is a todo food word at A1 when not saved, learning when saved', () => {
    const none = buildCatalog({ level: 'A1', topic: 'food' }, null, new Map());
    expect(none.entries.find((e) => e.word === 'Apfel')!.status).toBe('todo');
    const some = buildCatalog({ level: 'A1', topic: 'food' }, null, saved({ apfel: state(0.7, 3) }));
    expect(some.entries.find((e) => e.word === 'Apfel')!.status).toBe('learning');
    const all = buildCatalog({ level: null, topic: 'food' }, null, new Map());
    expect(all.entries.some((e) => e.word === 'Apfel')).toBe(true);
  });

  it('totals match the bank and the statistics denominators', () => {
    const stats = computeStats([], { total: 0, correct: 0 });
    let sum = 0;
    for (const level of CEFR_ORDER) {
      const v = buildCatalog({ level, topic: null }, null, new Map());
      expect(v.total).toBe(WORD_BANK[level].length);
      expect(v.total).toBe(stats.byLevel.find((g) => g.key === level)!.bankTotal);
      sum += v.total;
      for (const topic of TOPIC_KEYS) {
        const tv = buildCatalog({ level, topic }, null, new Map());
        expect(tv.total).toBe(WORD_BANK[level].filter((e) => e.topic_domain === topic).length);
        expect(CATALOG_STATUSES.reduce((n, s) => n + tv.counts[s], 0)).toBe(tv.total);
      }
    }
    expect(sum).toBe(Object.values(WORD_BANK).flat().length);
    for (const topic of TOPIC_KEYS) {
      const v = buildCatalog({ level: null, topic }, null, new Map());
      expect(v.total).toBe(stats.byTopic.find((g) => g.key === topic)!.bankTotal);
    }
  });
});

describe('STATUS_COLORS', () => {
  it('has four distinct entries and todo is unfilled', () => {
    expect(new Set(CATALOG_STATUSES.map((s) => STATUS_COLORS[s])).size).toBe(4);
    expect(STATUS_COLORS.todo).toBe('transparent');
    for (const s of ['mastered', 'learning', 'new'] as const) expect(STATUS_COLORS[s]).not.toBe('transparent');
  });
});

describe('scopeCounts', () => {
  const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

  it('per level inside a topic: matches buildCatalog and sums to the topic total', () => {
    const r = scopeCounts('level', { level: null, topic: 'food' }, new Map());
    for (const level of CEFR_ORDER) {
      expect(r[level]).toBe(buildCatalog({ level, topic: 'food' }, null, new Map()).total);
    }
    expect(sum(r)).toBe(buildCatalog({ level: null, topic: 'food' }, null, new Map()).total);
  });

  it('per topic inside a level: sums to the level size', () => {
    const r = scopeCounts('topic', { level: 'A1', topic: null }, new Map());
    expect(Object.keys(r).sort()).toEqual([...TOPIC_KEYS].sort());
    expect(sum(r)).toBe(WORD_BANK.A1.length);
  });

  it('ignores what is saved', () => {
    const full = new Map<string, SavedState>(WORD_BANK.A1.map((e) => [e.word.toLowerCase(), state(0.9, 5)]));
    expect(scopeCounts('topic', { level: 'A1', topic: null }, full))
      .toEqual(scopeCounts('topic', { level: 'A1', topic: null }, new Map()));
  });
});
