# TASK-018 — Multi-vendor AI (Anthropic + OpenAI-compatible)

**Status:** `done` (merged to main 2026-10-08)
**Assigned to:** Developer
**Written by:** Tech Lead
**Depends on:** TASK-016, TASK-017 (standalone app, opt-in BYO AI key)

---

## Context

AI features ("Approfondisci" word insight) only work with an Anthropic key. Users who
have a ChatGPT/OpenAI key (or any OpenAI-compatible vendor: Groq, OpenRouter, Mistral,
Together, …) can't use them. The app must let the user pick a provider and bring their
own key. Still no backend, no bundled key.

---

## Scope

### In scope
- Provider setting: `anthropic` (default) | `openai` (OpenAI-compatible).
- Per-provider key storage (switching provider never erases the other key).
- For `openai`: optional base URL (default `https://api.openai.com/v1`) and model
  (default `gpt-4o-mini`), both user-editable (custom vendors need their own model name).
- Provider-neutral transport `callLLM`, with the existing retry policy.
- Settings UI: provider picker + per-provider key modal.
- Backup: opt-in export carries provider, both keys, base URL and model; restore applies them.
- Tests (TDD) and i18n (it + en).

### Out of scope
- Streaming, tool use, chat, other native APIs (Gemini native, etc.).
- A model picker for Anthropic (fixed: `claude-haiku-4-5`).
- Cleartext `http://` base URLs (Android blocks cleartext; local Ollama is not supported).
- `response_format` / JSON mode — prompts already demand JSON and `wordInsight` extracts it
  by regex, which also tolerates code fences.

---

## Acceptance Criteria

- [ ] AC1: With provider `anthropic`, requests are byte-for-byte what they are today
      (URL, `x-api-key`, `anthropic-version`, browser-access header, body shape).
- [ ] AC2: With provider `openai`, a request goes to `${baseUrl}/chat/completions` with
      `Authorization: Bearer <key>`; the system prompt is sent as a leading
      `{role:'system'}` message; the text is read from `choices[0].message.content`.
- [ ] AC3: Default OpenAI base URL sends `max_completion_tokens`; a custom base URL sends
      `max_tokens` (many compatible servers and older models only accept that).
- [ ] AC4: Keys are stored per provider; `MissingApiKeyError` is thrown when the ACTIVE
      provider has no key (name stays `'MissingApiKeyError'`, WordDetailScreen relies on it).
- [ ] AC5: Base URL is normalized (trim, strip trailing `/`) and must be `https://`;
      invalid values are rejected (setter throws `InvalidBaseUrlError`; empty clears → default).
- [ ] AC6: Retry behaviour unchanged: network error / 429 / 5xx retried twice, 4xx not.
      Error message still contains `HTTP <status>`.
- [ ] AC7: Settings lets the user choose provider, set/clear that provider's key and,
      for OpenAI, base URL + model. Key row shows the masked key of the active provider.
- [ ] AC8: Backup without opt-in contains NO AI data. With opt-in it contains provider,
      keys, base URL, model. Restore applies whatever is present and never clears
      existing AI settings when the backup has none. Old backups (only `anthropicApiKey`)
      still restore.
- [ ] AC9: All existing tests still pass (after the mechanical renames listed below).

---

## Technical Spec

### Files to create
```
mobile/src/lib/ai/llm.ts                — callLLM(): dispatch by provider + retry loop
mobile/src/lib/ai/providers/anthropic.ts — request/response for Anthropic
mobile/src/lib/ai/providers/openai.ts    — request/response for OpenAI-compatible
mobile/__tests__/aiProviders.test.ts     — transport + settings tests
```

### Files to modify / remove
```
mobile/src/lib/ai/keys.ts        — provider-aware storage (API below)
mobile/src/lib/ai/anthropic.ts   — DELETE (moved into providers/anthropic.ts + llm.ts)
mobile/src/lib/ai/wordInsight.ts — use callLLM; drop MODEL constant
mobile/src/data/backup.ts        — carry AI settings (opt-in), restore them
mobile/src/screens/SettingsScreen.tsx — provider pills + per-provider modal
mobile/src/i18n/it.ts, en.ts     — new strings
mobile/__tests__/ai.test.ts      — rename imports (see below)
mobile/__tests__/backup.test.ts  — rename imports, add provider cases
```

### keys.ts API (storage: MMKV id `'ai'`)
Existing MMKV key `anthropicApiKey` is KEPT (no migration). New: `provider`,
`openaiApiKey`, `openaiBaseUrl`, `openaiModel`.

```ts
export type AiProvider = 'anthropic' | 'openai';
export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
export const ANTHROPIC_MODEL = 'claude-haiku-4-5';

export class MissingApiKeyError extends Error { name = 'MissingApiKeyError' }  // generic message
export class InvalidBaseUrlError extends Error {}

getProvider(): AiProvider                      // default 'anthropic'
setProvider(p: AiProvider): void
getStoredKey(p: AiProvider): string | null
setKey(p: AiProvider, value: string | null): void   // trims; empty/null deletes
hasKey(): boolean                              // ACTIVE provider
requireKey(): string                           // ACTIVE provider, else MissingApiKeyError
getOpenAiBaseUrl(): string                     // stored or default
setOpenAiBaseUrl(v: string | null): void       // normalize; invalid -> InvalidBaseUrlError; empty -> delete
getOpenAiModel(): string                       // stored or default
setOpenAiModel(v: string | null): void         // trims; empty -> delete
hasAnyKey(): boolean                           // either provider (backup prompt)
maskKey(v)                                     // unchanged
```
Removed (callers updated): `getStoredAnthropicKey`, `setAnthropicKey`, `hasAnthropicKey`,
`requireAnthropicKey`. Mechanical renames: `setAnthropicKey(x)` → `setKey('anthropic', x)`,
`getStoredAnthropicKey()` → `getStoredKey('anthropic')`, `hasAnthropicKey` → `hasKey`,
`requireAnthropicKey` → `requireKey`.

`normalizeBaseUrl(v)`: trim; strip trailing `/`+; must be a plain `https://host[/path]`
(no whitespace, userinfo, query or fragment); else throw `InvalidBaseUrlError`.

### llm.ts
```ts
export interface CallLLMParams { max_tokens: number; system: string;
  messages: { role: 'user'|'assistant'; content: string }[] }
export class AiApiError extends Error { status; message = `AI API error (HTTP ${status}): ${body.slice(0,200)}` }
export async function callLLM(p: CallLLMParams): Promise<string>
```
Reads provider + key, calls the provider's `send()`, retry loop identical to the old
`callClaude` (2 retries, backoff `2**attempt * 1000` ms; retry network errors, 429, 5xx).
Each provider module exports `send(params, key): Promise<string>` and throws `AiApiError`
on non-2xx. Empty/absent content → return `''` (wordInsight already errors on no JSON).

### OpenAI request
```
POST {baseUrl}/chat/completions
Authorization: Bearer <key>   content-type: application/json
{ model, [max_completion_tokens | max_tokens]: n,
  messages: [{role:'system',content:system}, ...messages] }
```
`max_completion_tokens` iff `baseUrl === DEFAULT_OPENAI_BASE_URL`, else `max_tokens`.

### Settings UI
- AI section: two pills (Anthropic / OpenAI-compatible) above the key row; selecting calls
  `setProvider` and refreshes the masked key.
- Key modal: key field (+ show/hide, clear, save, "get a key" link per provider:
  anthropic → `https://console.anthropic.com/settings/keys`,
  openai → `https://platform.openai.com/api-keys`). For `openai` also two optional fields:
  "Base URL" (placeholder = default) and "Model" (placeholder = default); saved with the key.
  Invalid base URL → inline error text (`settings_ai_baseurl_invalid`), do not close the modal.
- Export prompt appears when `hasAnyKey()`.

### Backup
`BackupKv` gains `aiProvider?`, `openaiApiKey?`, `openaiBaseUrl?`, `openaiModel?`
(`anthropicApiKey?` stays). Written only when `includeAiKey`. Each field written only
if set (provider only if a provider has been explicitly stored is NOT required: always
write the active provider when opting in). Restore: set each present field via the
setters; an invalid `openaiBaseUrl` in a file is skipped, not fatal.
**Review fix:** `openaiBaseUrl` is applied ONLY if the same backup also carries
`openaiApiKey` (otherwise a crafted file could repoint the user's existing key at a
hostile host).

---

## Tests (write FIRST, see them fail)

`aiProviders.test.ts`
- anthropic: request unchanged (URL, headers, body); parses `content[].text`.
- openai default: URL `https://api.openai.com/v1/chat/completions`, Bearer header, system as
  first message, `max_completion_tokens` present and `max_tokens` absent, parses
  `choices[0].message.content`.
- openai custom base URL (with trailing slash): URL joined correctly, `max_tokens` used,
  custom model sent.
- missing key for active provider throws `MissingApiKeyError` even if the OTHER provider has one.
- keys are independent per provider; switching provider keeps both.
- base URL: trims/strips slash; rejects `http://…`, garbage; empty clears to default.
- retries: 500 then 200 succeeds (fake timers); 401 not retried; message contains `HTTP 401`.
- generateWordInsight works end to end through the openai provider.

`backup.test.ts` (additions)
- no AI fields at all without opt-in (even with openai configured).
- opt-in roundtrip restores provider, both keys, base URL, model.
- backup without AI data leaves existing AI settings untouched.
- legacy backup with only `anthropicApiKey` restores.

---

## Definition of Done
- [ ] AC1–AC9 checked, tests green, `tsc --noEmit` clean
- [ ] No keys in logs or error messages; no raw error text in the UI (CLAUDE.md / memory rule)
- [ ] Conventional commit: `feat(TASK-018): multi-vendor AI (Anthropic + OpenAI-compatible)`
- [ ] Status → `done`
