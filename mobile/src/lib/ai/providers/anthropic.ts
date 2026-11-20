import { ANTHROPIC_MODEL } from '../keys';
import { AiApiError, type CallLLMParams } from '../types';

/**
 * Direct client-side transport for the Anthropic Messages API. The
 * `anthropic-dangerous-direct-browser-access` header is required for the API to
 * accept requests from a non-server (React Native) environment.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
}

export async function send({ max_tokens, system, messages }: CallLLMParams, apiKey: string): Promise<string> {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens, system, messages }),
  });

  if (!response.ok) {
    throw new AiApiError(response.status, await response.text().catch(() => ''));
  }

  const data = (await response.json()) as AnthropicResponse;
  return (data.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
}
