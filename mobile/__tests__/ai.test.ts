import { MissingApiKeyError, setKey, hasKey, maskKey, requireKey } from '../src/lib/ai/keys';
import { generateWordInsight } from '../src/lib/ai/wordInsight';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MMKV } = require('react-native-mmkv');

beforeEach(() => {
  new MMKV().clearAll();
  (global.fetch as jest.Mock | undefined)?.mockReset?.();
});

describe('AI key storage', () => {
  it('stores, reports and clears the key', () => {
    expect(hasKey()).toBe(false);
    expect(() => requireKey()).toThrow(MissingApiKeyError);

    setKey('anthropic', 'sk-ant-abcdef123456');
    expect(hasKey()).toBe(true);
    expect(requireKey()).toBe('sk-ant-abcdef123456');
    expect(maskKey('sk-ant-abcdef123456')).toBe('••••3456');

    setKey('anthropic', null);
    expect(hasKey()).toBe(false);
  });
});

describe('generateWordInsight', () => {
  it('throws MissingApiKeyError when no key is set', async () => {
    await expect(
      generateWordInsight({ word: 'Haus', article: 'das', meaningNative: 'casa', cefrLevel: 'A1', nativeLanguage: 'it' }),
    ).rejects.toBeInstanceOf(MissingApiKeyError);
  });

  it('parses examples, note and exercise out of the model JSON', async () => {
    setKey('anthropic', 'sk-ant-test');
    const payload = {
      content: [{
        type: 'text',
        text: 'Ecco:\n{"examples":[{"de":"Das Haus ist groß.","native":"La casa è grande."},{"de":"Mein Haus ist alt.","native":"La mia casa è vecchia."},{"de":"Wir kaufen ein Haus.","native":"Compriamo una casa."}],"note":"Neutro, plurale Häuser.","exercise":{"sentence":"Ich wohne in einem großen ___.","answer":"Haus"}}',
      }],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    }) as jest.Mock;

    const res = await generateWordInsight({ word: 'Haus', article: 'das', meaningNative: 'casa', cefrLevel: 'A1', nativeLanguage: 'it' });
    expect(res.examples).toHaveLength(3);
    expect(res.examples[0].de).toContain('Haus');
    expect(res.note).toMatch(/Häuser/);
    expect(res.exercise).toEqual({ sentence: 'Ich wohne in einem großen ___.', answer: 'Haus' });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('sk-ant-test');
    expect(init.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  });

  it('rejects a non-2xx response without retrying a 400', async () => {
    setKey('anthropic', 'sk-ant-test');
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'bad request',
    }) as jest.Mock;

    await expect(
      generateWordInsight({ word: 'Haus', article: 'das', meaningNative: 'casa', cefrLevel: 'A1', nativeLanguage: 'it' }),
    ).rejects.toThrow(/HTTP 400/);
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
  });

  it('requests output in the learner\'s native language (system prompt + prompt text)', async () => {
    setKey('anthropic', 'sk-ant-test');
    const payload = {
      content: [{
        type: 'text',
        text: '{"examples":[{"de":"Das Haus ist groß.","native":"The house is big."},{"de":"Mein Haus ist alt.","native":"My house is old."},{"de":"Wir kaufen ein Haus.","native":"We are buying a house."}],"note":"Neuter noun.","exercise":{"sentence":"Ich wohne in einem großen ___.","answer":"Haus"}}',
      }],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    }) as jest.Mock;

    await generateWordInsight({ word: 'Haus', article: 'das', meaningNative: 'house', cefrLevel: 'A1', nativeLanguage: 'en' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.system).toMatch(/English/);
    expect(body.messages[0].content).toMatch(/English/);
    expect(body.system).not.toMatch(/Italian/);
  });

  it('requests output in Italian for an Italian-speaking learner', async () => {
    setKey('anthropic', 'sk-ant-test');
    const payload = {
      content: [{
        type: 'text',
        text: '{"examples":[{"de":"Das Haus ist groß.","native":"La casa è grande."},{"de":"Mein Haus ist alt.","native":"La mia casa è vecchia."},{"de":"Wir kaufen ein Haus.","native":"Compriamo una casa."}],"note":"Sostantivo neutro.","exercise":{"sentence":"Ich wohne in einem großen ___.","answer":"Haus"}}',
      }],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    }) as jest.Mock;

    await generateWordInsight({ word: 'Haus', article: 'das', meaningNative: 'casa', cefrLevel: 'A1', nativeLanguage: 'it' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.system).toMatch(/Italian/);
    expect(body.messages[0].content).toMatch(/Italian/);
    expect(body.system).not.toMatch(/English/);
  });
});
