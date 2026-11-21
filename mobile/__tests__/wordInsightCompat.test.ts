import { generateWordInsight, normalizeExample } from '../src/lib/ai/wordInsight';
import * as llm from '../src/lib/ai/llm';

jest.mock('../src/lib/ai/llm');
const call = llm.callLLM as jest.Mock;
const input = { word: 'Haus', article: 'das', meaningNative: 'casa', cefrLevel: 'A1', nativeLanguage: 'it' as const };
const answer = (key: string) =>
  JSON.stringify({
    examples: [{ [key]: 'Das Haus ist groß.', native: 'La casa è grande.' }],
    note: 'nota',
    exercise: { sentence: 'Das ___ ist groß.', answer: 'Haus' },
  });

describe('AI answer: `target` key with a legacy `de` fallback', () => {
  it('parses a `target` answer', async () => {
    call.mockResolvedValue(answer('target'));
    const r = await generateWordInsight(input);
    expect(r.examples[0]).toEqual({ target: 'Das Haus ist groß.', native: 'La casa è grande.' });
  });

  it('parses a legacy `de` answer into `target`', async () => {
    call.mockResolvedValue(answer('de'));
    const r = await generateWordInsight(input);
    expect(r.examples[0]).toEqual({ target: 'Das Haus ist groß.', native: 'La casa è grande.' });
  });

  it('drops an example with neither key', async () => {
    call.mockResolvedValue(JSON.stringify({
      examples: [{ other: 'x', native: 'y' }, { target: 'ok', native: 'ja' }],
      note: 'n', exercise: { sentence: 's ___', answer: 'a' },
    }));
    expect((await generateWordInsight(input)).examples).toEqual([{ target: 'ok', native: 'ja' }]);
  });

  it('normalizeExample maps both shapes and rejects bad ones', () => {
    expect(normalizeExample({ target: 'a', native: 'b' })).toEqual({ target: 'a', native: 'b' });
    expect(normalizeExample({ de: 'a', native: 'b' })).toEqual({ target: 'a', native: 'b' });
    expect(normalizeExample({ target: 'new', de: 'old', native: 'b' })).toEqual({ target: 'new', native: 'b' });
    expect(normalizeExample({ native: 'b' })).toBeNull();
    expect(normalizeExample(null)).toBeNull();
    expect(normalizeExample({ target: 3, native: 'b' })).toBeNull();
  });

  it('asks for the `target` key and still says "learning German"', async () => {
    call.mockResolvedValue(answer('target'));
    await generateWordInsight(input);
    const arg = call.mock.calls.at(-1)[0];
    expect(arg.system).toContain('learning German');
    expect(arg.messages[0].content).toContain('"target"');
    expect(arg.messages[0].content).not.toContain('"de"');
  });
});

describe('cached legacy notes', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sqlite = require('expo-sqlite');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getDb, _resetDbForTests } = require('../src/data/db');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getWordInsight } = require('../src/services/vaultService');
  beforeEach(() => { sqlite.__reset(); _resetDbForTests(); });

  it('shows a payload stored with the old `de` key, and keeps the stored row untouched', async () => {
    const db = await getDb();
    const payload = JSON.stringify({
      lang: 'it',
      examples: [{ de: 'Der Strom ist teuer.', native: "L'elettricità è cara." }],
      note: 'nota',
      exercise: null,
    });
    await db.runAsync('INSERT INTO ai_word_notes (word, payload, created_at) VALUES (?, ?, ?)', ['Strom', payload, 'now']);
    const r = await getWordInsight('Strom', 'it');
    expect(r.examples).toEqual([{ target: 'Der Strom ist teuer.', native: "L'elettricità è cara." }]);
    const row = await db.getFirstAsync('SELECT payload FROM ai_word_notes WHERE word = ?', ['Strom']);
    expect(row.payload).toBe(payload);
  });
});
