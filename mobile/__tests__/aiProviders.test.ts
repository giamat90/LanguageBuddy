import {
  MissingApiKeyError, InvalidBaseUrlError,
  getProvider, setProvider, getStoredKey, setKey, hasKey, hasAnyKey, requireKey,
  getOpenAiBaseUrl, setOpenAiBaseUrl, getOpenAiModel, setOpenAiModel,
  DEFAULT_OPENAI_BASE_URL, DEFAULT_OPENAI_MODEL,
} from '../src/lib/ai/keys';
import { callLLM } from '../src/lib/ai/llm';
import { generateWordInsight } from '../src/lib/ai/wordInsight';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MMKV } = require('react-native-mmkv');

const params = {
  max_tokens: 100,
  system: 'sys prompt',
  messages: [{ role: 'user' as const, content: 'hello' }],
};

function mockFetchOnce(json: unknown) {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => json }) as jest.Mock;
}
const lastCall = () => {
  const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
  return { url: url as string, init, body: JSON.parse(init.body) };
};

beforeEach(() => {
  new MMKV().clearAll();
  jest.useRealTimers();
});

describe('key & provider storage', () => {
  it('defaults to anthropic and keeps keys independent per provider', () => {
    expect(getProvider()).toBe('anthropic');
    setKey('anthropic', 'sk-ant-1');
    setKey('openai', 'sk-oa-1');
    expect(getStoredKey('anthropic')).toBe('sk-ant-1');
    expect(getStoredKey('openai')).toBe('sk-oa-1');

    setProvider('openai');
    expect(getProvider()).toBe('openai');
    expect(requireKey()).toBe('sk-oa-1');
    setProvider('anthropic');
    expect(requireKey()).toBe('sk-ant-1');
  });

  it('requireKey throws MissingApiKeyError for the ACTIVE provider only', () => {
    setKey('anthropic', 'sk-ant-1');
    setProvider('openai');
    expect(hasKey()).toBe(false);
    expect(hasAnyKey()).toBe(true);
    expect(() => requireKey()).toThrow(MissingApiKeyError);
    expect(new MissingApiKeyError().name).toBe('MissingApiKeyError');
  });

  it('clears a key with null / blank', () => {
    setKey('openai', 'sk-oa-1');
    setKey('openai', '   ');
    expect(getStoredKey('openai')).toBeNull();
  });

  it('normalizes the base URL and falls back to the default', () => {
    expect(getOpenAiBaseUrl()).toBe(DEFAULT_OPENAI_BASE_URL);
    setOpenAiBaseUrl('  https://api.groq.com/openai/v1//  ');
    expect(getOpenAiBaseUrl()).toBe('https://api.groq.com/openai/v1');
    setOpenAiBaseUrl('');
    expect(getOpenAiBaseUrl()).toBe(DEFAULT_OPENAI_BASE_URL);
  });

  it('rejects non-https and malformed base URLs', () => {
    expect(() => setOpenAiBaseUrl('http://localhost:11434/v1')).toThrow(InvalidBaseUrlError);
    expect(() => setOpenAiBaseUrl('not a url')).toThrow(InvalidBaseUrlError);
    expect(() => setOpenAiBaseUrl('https://')).toThrow(InvalidBaseUrlError);
    expect(() => setOpenAiBaseUrl('https://host/with space')).toThrow(InvalidBaseUrlError);
    expect(() => setOpenAiBaseUrl('https://user:pw@host/v1')).toThrow(InvalidBaseUrlError);
    expect(() => setOpenAiBaseUrl('https://host/v1?key=1')).toThrow(InvalidBaseUrlError);
    expect(() => setOpenAiBaseUrl('https://host/v1#frag')).toThrow(InvalidBaseUrlError);
    expect(getOpenAiBaseUrl()).toBe(DEFAULT_OPENAI_BASE_URL);
  });

  it('model defaults and can be overridden', () => {
    expect(getOpenAiModel()).toBe(DEFAULT_OPENAI_MODEL);
    setOpenAiModel(' llama-3.3-70b ');
    expect(getOpenAiModel()).toBe('llama-3.3-70b');
    setOpenAiModel(null);
    expect(getOpenAiModel()).toBe(DEFAULT_OPENAI_MODEL);
  });
});

describe('callLLM — anthropic', () => {
  it('keeps the existing request shape and parses text blocks', async () => {
    setKey('anthropic', 'sk-ant-test');
    mockFetchOnce({ content: [{ type: 'text', text: 'Hal' }, { type: 'text', text: 'lo' }] });

    expect(await callLLM(params)).toBe('Hallo');

    const { url, init, body } = lastCall();
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('sk-ant-test');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
    expect(init.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(body).toEqual({
      model: 'claude-haiku-4-5',
      max_tokens: 100,
      system: 'sys prompt',
      messages: params.messages,
    });
  });
});

describe('callLLM — openai-compatible', () => {
  beforeEach(() => {
    setProvider('openai');
    setKey('openai', 'sk-oa-test');
  });

  it('uses chat/completions, Bearer auth, a system message and max_completion_tokens', async () => {
    mockFetchOnce({ choices: [{ message: { content: 'Hallo' } }] });

    expect(await callLLM(params)).toBe('Hallo');

    const { url, init, body } = lastCall();
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-oa-test');
    expect(init.headers['x-api-key']).toBeUndefined();
    expect(body.model).toBe(DEFAULT_OPENAI_MODEL);
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys prompt' },
      { role: 'user', content: 'hello' },
    ]);
    expect(body.max_completion_tokens).toBe(100);
    expect(body.max_tokens).toBeUndefined();
    expect(body.system).toBeUndefined();
  });

  it('uses the custom base URL, custom model and max_tokens', async () => {
    setOpenAiBaseUrl('https://api.groq.com/openai/v1/');
    setOpenAiModel('llama-3.3-70b');
    mockFetchOnce({ choices: [{ message: { content: 'ok' } }] });

    await callLLM(params);

    const { url, body } = lastCall();
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(body.model).toBe('llama-3.3-70b');
    expect(body.max_tokens).toBe(100);
    expect(body.max_completion_tokens).toBeUndefined();
  });

  it('returns an empty string when the response has no content', async () => {
    mockFetchOnce({ choices: [] });
    expect(await callLLM(params)).toBe('');
  });

  it('throws MissingApiKeyError without calling the network when the key is missing', async () => {
    setKey('openai', null);
    global.fetch = jest.fn() as jest.Mock;
    await expect(callLLM(params)).rejects.toBeInstanceOf(MissingApiKeyError);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('callLLM — errors and retries', () => {
  beforeEach(() => {
    setProvider('openai');
    setKey('openai', 'sk-oa-test');
  });

  it('does not retry a 401 and reports the status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 401, text: async () => 'bad key',
    }) as jest.Mock;
    await expect(callLLM(params)).rejects.toThrow(/HTTP 401/);
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
  });

  it('never leaks the key in the error message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 400, text: async () => 'nope',
    }) as jest.Mock;
    await expect(callLLM(params)).rejects.not.toThrow(/sk-oa-test/);
  });

  it('retries a 500 and then succeeds', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom' })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: 'yes' } }] }) }) as jest.Mock;

    const p = callLLM(params);
    await jest.advanceTimersByTimeAsync(1000);
    expect(await p).toBe('yes');
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(2);
  });

  it('gives up after two retries on a persistent 429', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 429, text: async () => 'slow down',
    }) as jest.Mock;

    const p = callLLM(params);
    const assertion = expect(p).rejects.toThrow(/HTTP 429/);
    await jest.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(3);
  });
});

describe('generateWordInsight through the openai provider', () => {
  it('works end to end', async () => {
    setProvider('openai');
    setKey('openai', 'sk-oa-test');
    const json = '```json\n{"examples":[{"de":"Das Haus ist groß.","native":"La casa è grande."}],"note":"Neutro.","exercise":{"sentence":"Das ___ ist groß.","answer":"Haus"}}\n```';
    mockFetchOnce({ choices: [{ message: { content: json } }] });

    const res = await generateWordInsight({
      word: 'Haus', article: 'das', meaningNative: 'casa', cefrLevel: 'A1', nativeLanguage: 'it',
    });
    expect(res.examples[0].target).toContain('Haus');
    expect(res.exercise?.answer).toBe('Haus');

    const { body } = lastCall();
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toMatch(/Italian/);
  });
});
