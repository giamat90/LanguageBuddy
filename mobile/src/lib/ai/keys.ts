import { MMKV } from 'react-native-mmkv';

/**
 * Bring-your-own AI key.
 *
 * GermanBuddy ships with NO key. The user picks a provider (Anthropic, or any
 * OpenAI-compatible vendor) and pastes their own key in Settings → Funzioni AI;
 * it's stored locally in MMKV (and only enters a backup if the user opts in at
 * export time). AI features throw MissingApiKeyError until the ACTIVE provider
 * has a key.
 */

export type AiProvider = 'anthropic' | 'openai';

export const ANTHROPIC_MODEL = 'claude-haiku-4-5';
export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

const storage = new MMKV({ id: 'ai' });
const PROVIDER = 'provider';
// `anthropicApiKey` predates multi-provider support — name kept so no migration is needed.
const KEY_FIELD: Record<AiProvider, string> = {
  anthropic: 'anthropicApiKey',
  openai: 'openaiApiKey',
};
const OPENAI_BASE_URL = 'openaiBaseUrl';
const OPENAI_MODEL = 'openaiModel';

export class MissingApiKeyError extends Error {
  constructor() {
    super('Aggiungi la tua chiave API in Impostazioni → Funzioni AI per usare questa funzione.');
    this.name = 'MissingApiKeyError';
  }
}

export class InvalidBaseUrlError extends Error {
  constructor() {
    super('Base URL must start with https://');
    this.name = 'InvalidBaseUrlError';
  }
}

function normalize(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function setOrDelete(field: string, value: string | null): void {
  if (value) storage.set(field, value);
  else storage.delete(field);
}

// ─── provider ────────────────────────────────────────────────────────────────

export function getProvider(): AiProvider {
  return storage.getString(PROVIDER) === 'openai' ? 'openai' : 'anthropic';
}

export function setProvider(provider: AiProvider): void {
  storage.set(PROVIDER, provider);
}

// ─── keys ────────────────────────────────────────────────────────────────────

export function getStoredKey(provider: AiProvider): string | null {
  return normalize(storage.getString(KEY_FIELD[provider]));
}

export function setKey(provider: AiProvider, value: string | null): void {
  setOrDelete(KEY_FIELD[provider], normalize(value));
}

/** True when the ACTIVE provider has a key. */
export function hasKey(): boolean {
  return getStoredKey(getProvider()) !== null;
}

/** True when any provider has a key (used for the backup prompt). */
export function hasAnyKey(): boolean {
  return getStoredKey('anthropic') !== null || getStoredKey('openai') !== null;
}

/** Returns the active provider's key or throws MissingApiKeyError. */
export function requireKey(): string {
  const key = getStoredKey(getProvider());
  if (!key) throw new MissingApiKeyError();
  return key;
}

// ─── OpenAI-compatible endpoint settings ─────────────────────────────────────

/** Trims, strips trailing slashes, requires a plain https://host[/path] (no
 *  userinfo, query or fragment — `/chat/completions` is appended to it).
 *  Throws InvalidBaseUrlError. */
export function normalizeBaseUrl(value: string): string {
  const url = value.trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^\s/?#@]+(\/[^\s?#]*)?$/.test(url)) throw new InvalidBaseUrlError();
  return url;
}

export function getOpenAiBaseUrl(): string {
  return normalize(storage.getString(OPENAI_BASE_URL)) ?? DEFAULT_OPENAI_BASE_URL;
}

/** Empty / null resets to the default. */
export function setOpenAiBaseUrl(value: string | null): void {
  const trimmed = normalize(value);
  setOrDelete(OPENAI_BASE_URL, trimmed ? normalizeBaseUrl(trimmed) : null);
}

export function getOpenAiModel(): string {
  return normalize(storage.getString(OPENAI_MODEL)) ?? DEFAULT_OPENAI_MODEL;
}

export function setOpenAiModel(value: string | null): void {
  setOrDelete(OPENAI_MODEL, normalize(value));
}

/** For display: `••••abcd`. */
export function maskKey(value: string | null | undefined): string | null {
  const k = normalize(value);
  if (!k) return null;
  return k.length <= 8 ? '••••' : `••••${k.slice(-4)}`;
}
