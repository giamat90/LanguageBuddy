import { DEFAULT_OPENAI_BASE_URL, getOpenAiBaseUrl, getOpenAiModel } from '../keys';
import { AiApiError, type CallLLMParams } from '../types';

/**
 * OpenAI Chat Completions transport. Also works with OpenAI-compatible vendors
 * (Groq, OpenRouter, Mistral, Together, …) via the user-configured base URL.
 */

interface OpenAiResponse {
  choices?: { message?: { content?: string | null } }[];
}

export async function send({ max_tokens, system, messages }: CallLLMParams, apiKey: string): Promise<string> {
  const baseUrl = getOpenAiBaseUrl();
  // Official OpenAI (incl. newer models) wants max_completion_tokens; most
  // compatible servers and older models only know max_tokens.
  const limit = baseUrl === DEFAULT_OPENAI_BASE_URL
    ? { max_completion_tokens: max_tokens }
    : { max_tokens };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: getOpenAiModel(),
      ...limit,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });

  if (!response.ok) {
    throw new AiApiError(response.status, await response.text().catch(() => ''));
  }

  const data = (await response.json()) as OpenAiResponse;
  return data.choices?.[0]?.message?.content ?? '';
}
