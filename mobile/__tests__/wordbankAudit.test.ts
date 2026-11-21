/** TASK-058: the pure audit functions and the script's refusals (no real bank or frequency list needed). */
import { spawnSync } from 'child_process';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const A = require('../scripts/lib/wordbankAudit.js');

const entry = (word: string, level: string, topic = 'food', example = 'x') => ({ word, cefr_band: level, topic_domain: topic, example });

describe('parseFrequencyList', () => {
  it('ranks in file order and the first occurrence wins', () => {
    const m = A.parseFrequencyList('de 500\nla 400\nde 300\n');
    expect(m.get('de')).toBe(1);
    expect(m.get('la')).toBe(2);
    expect(m.size).toBe(2);
  });
  it('accepts tabs and extra spaces, skips blank and malformed lines', () => {
    const m = A.parseFrequencyList('uno\t9\n\n  dos   8 \nx\n# c\ntres 7');
    expect([...m.keys()]).toEqual(['uno', 'dos', 'tres']);
    expect(m.get('tres')).toBe(3);
  });
  it('handles CRLF', () => {
    expect(A.parseFrequencyList('a 3\r\nb 2\r\n').get('b')).toBe(2);
  });
});

describe('fold / rankOf', () => {
  it('lower-cases', () => expect(A.fold('Pan', 'es')).toBe('pan'));
  it('German ß becomes ss', () => expect(A.fold('Straße', 'de')).toBe('strasse'));
  it('finds an exact folded match first', () => {
    const m = A.parseFrequencyList('pan 9\npán 8');
    expect(A.rankOf(m, 'Pan', 'es')).toBe(1);
  });
  it('falls back to an accent-insensitive match, both ways', () => {
    expect(A.rankOf(A.parseFrequencyList('pan 9'), 'pán', 'es')).toBe(1);
    expect(A.rankOf(A.parseFrequencyList('canción 9'), 'cancion', 'es')).toBe(1);
  });
  it('German umlaut folds', () => expect(A.rankOf(A.parseFrequencyList('uber 9'), 'über', 'de')).toBe(1));
  it('returns null when absent', () => expect(A.rankOf(A.parseFrequencyList('a 1'), 'zzz', 'es')).toBeNull());
});

const words = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
const list = (ws: string[]) => A.parseFrequencyList(ws.map((w, i) => `${w} ${1000 - i}`).join('\n'));

describe('levelStats / isMonotone', () => {
  const rank = list(words(20, 'w'));
  it('median, found share and top-N shares', () => {
    const e = [entry('w1', 'A1'), entry('w3', 'A1'), entry('zzz', 'A1')];
    const [s] = A.levelStats(e, rank, 'es');
    expect(s).toMatchObject({ level: 'A1', count: 3, found: 2, median: 2 });
    expect(s.top1000).toBeCloseTo(2 / 3);
  });
  it('an empty level has median null and does not crash', () => {
    expect(A.levelStats([], rank, 'es')).toEqual([]);
    const [s] = A.levelStats([entry('zzz', 'B1')], rank, 'es');
    expect(s.median).toBeNull();
  });
  it('isMonotone true when medians rise, false when not, ignores empty levels', () => {
    expect(A.isMonotone([{ level: 'A1', median: 1 }, { level: 'A2', median: null }, { level: 'B1', median: 5 }])).toBe(true);
    expect(A.isMonotone([{ level: 'A1', median: 9 }, { level: 'A2', median: 2 }])).toBe(false);
  });
});

describe('misplaced', () => {
  const rank = list(words(30, 'w'));
  const cfg = { tooRare: { A1: 10 }, tooCommon: { C2: 5 } };
  it('flags a rare A1 word and a very common C2 word, worst first, and skips unranked words', () => {
    const e = [entry('w12', 'A1'), entry('w25', 'A1'), entry('w1', 'C2'), entry('w3', 'C2'), entry('zzz', 'A1'), entry('w8', 'A1')];
    const r = A.misplaced(e, rank, 'es', cfg);
    expect(r.tooRare.map((x: { word: string }) => x.word)).toEqual(['w25', 'w12']);
    expect(r.tooCommon.map((x: { word: string }) => x.word)).toEqual(['w1', 'w3']);
    expect(r.tooRare[0]).toMatchObject({ level: 'A1', rank: 25, topic: 'food' });
  });
  it('config thresholds override the defaults', () => {
    const e = [entry('w12', 'A1')];
    expect(A.misplaced(e, rank, 'es', { tooRare: { A1: 20 } }).tooRare).toEqual([]);
    expect(A.misplaced(e, rank, 'es', { tooRare: { A1: 5 } }).tooRare).toHaveLength(1);
  });
  it('uses defaults without a config', () => {
    expect(A.misplaced([entry('w1', 'A1')], rank, 'es').tooRare).toEqual([]);
  });
});

describe('notFound', () => {
  it('groups by level', () => {
    const r = A.notFound([entry('zzz', 'A1'), entry('w1', 'A1'), entry('yyy', 'B1')], list(['w1']), 'es');
    expect(r.byLevel).toEqual({ A1: ['zzz'], B1: ['yyy'] });
  });
});

describe('coverageGaps', () => {
  const rank = list(['de', 'pan', 'tengo', '12', 'a', 'casa', 'agua']);
  it('excludes bank words (also accent variants), stop words, numbers and one-letter tokens, and counts the skipped', () => {
    const r = A.coverageGaps(rank, ['pan', 'água'], 'es', { stop: ['de'], limit: 10 });
    expect(r.candidates.map((c: { word: string }) => c.word)).toEqual(['tengo', 'casa']);
    expect(r.skipped).toBe(3); // de, 12, a
  });
  it('respects the limit', () => {
    expect(A.coverageGaps(rank, [], 'es', { limit: 2 }).candidates).toHaveLength(2);
  });
});

describe('topicBalance', () => {
  it('counts per level and topic and names topics under the minimum share', () => {
    const e = [
      ...Array.from({ length: 18 }, (_, i) => entry(`a${i}`, 'C1', 'culture')),
      entry('b', 'C1', 'home'),
      entry('c', 'C1', 'travel'),
    ];
    const r = A.topicBalance(e, 0.1);
    expect(r.table.C1).toEqual({ culture: 18, home: 1, travel: 1 });
    expect(r.thin.C1.sort()).toEqual(['home', 'travel']);
  });
  it('no words, no levels', () => {
    expect(A.topicBalance([], 0.05)).toEqual({ table: {}, thin: {} });
  });
});

describe('script', () => {
  const script = join(__dirname, '..', 'scripts', 'audit-wordbank.mjs');
  const run = (...a: string[]) => spawnSync(process.execPath, [script, ...a], { encoding: 'utf8' });
  it('without a reference file exits 2 and names the expected path', () => {
    const r = run('--lang', 'es', '--reference', join(__dirname, 'no-such-list.txt'));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('no-such-list.txt');
    expect(r.stderr.toLowerCase()).toContain('download');
  });
  it('an unknown language is refused', () => {
    const r = run('zz');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/language/i);
  });
});
