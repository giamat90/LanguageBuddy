import { getProvider, requireKey } from './keys';
import { AiApiError, type CallLLMParams } from './types';
import { send as sendAnthropic } from './providers/anthropic';
import { send as sendOpenAi } from './providers/openai';

/**
 * Provider-neutral LLM call. The app is standalone/offline by default; AI
 * features are opt-in and call the chosen vendor directly with the user's own
 * key (see ./keys.ts).
 */

export { AiApiError } from './types';
export type { CallLLMParams } from './types';

const SENDERS = { anthropic: sendAnthropic, openai: sendOpenAi } as const;

/** POSTs one request, retrying twice on network / 5xx / 429. */
export async function callLLM(params: CallLLMParams): Promise<string> {
  const apiKey = requireKey();
  const send = SENDERS[getProvider()];

  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await send(params, apiKey);
    } catch (e) {
      const retryable = e instanceof AiApiError ? e.status === 429 || e.status >= 500 : true;
      if (attempt === maxRetries || !retryable) throw e;
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    }
  }
  throw new Error('callLLM: exhausted retries');
}
