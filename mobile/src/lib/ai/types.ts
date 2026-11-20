export interface CallLLMParams {
  max_tokens: number;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

/** Thrown for any non-2xx provider response. `status` lets callers classify. */
export class AiApiError extends Error {
  constructor(readonly status: number, body: string) {
    super(`AI API error (HTTP ${status}): ${body.slice(0, 200)}`);
    this.name = 'AiApiError';
  }
}
