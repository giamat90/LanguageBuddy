import { getActivePack } from '../languages';

/**
 * The languages the app itself can be shown in (never the language being studied,
 * which is always German). One registry drives the pickers, date formatting, the
 * AI prompt and the layout direction: adding a language is an entry here plus a
 * `<code>.ts` string file.
 */
export const LANGUAGES = [
  { code: 'it', label: 'Italiano', english: 'Italian', locale: 'it-IT', rtl: false },
  { code: 'en', label: 'English', english: 'English', locale: 'en-US', rtl: false },
  { code: 'fr', label: 'Français', english: 'French', locale: 'fr-FR', rtl: false },
  { code: 'es', label: 'Español', english: 'Spanish', locale: 'es-ES', rtl: false },
  { code: 'pt', label: 'Português', english: 'Brazilian Portuguese', locale: 'pt-BR', rtl: false },
  { code: 'ru', label: 'Русский', english: 'Russian', locale: 'ru-RU', rtl: false },
  { code: 'uk', label: 'Українська', english: 'Ukrainian', locale: 'uk-UA', rtl: false },
  { code: 'pl', label: 'Polski', english: 'Polish', locale: 'pl-PL', rtl: false },
  { code: 'tr', label: 'Türkçe', english: 'Turkish', locale: 'tr-TR', rtl: false },
  { code: 'zh', label: '简体中文', english: 'Simplified Chinese', locale: 'zh-CN', rtl: false },
  { code: 'ja', label: '日本語', english: 'Japanese', locale: 'ja-JP', rtl: false },
  { code: 'hi', label: 'हिन्दी', english: 'Hindi', locale: 'hi-IN', rtl: false },
  // ar-AE keeps Latin digits and the Gregorian calendar (ar-SA would print Hijri dates).
  { code: 'ar', label: 'العربية', english: 'Arabic', locale: 'ar-AE', rtl: true },
] as const;

export type NativeLanguage = (typeof LANGUAGES)[number]['code'];
export const SUPPORTED_NATIVE_LANGUAGES: readonly NativeLanguage[] = LANGUAGES.map((l) => l.code);
/** The data default: it is also the `learner_profile.native_language` column default, so it must not change. */
export const DEFAULT_NATIVE_LANGUAGE: NativeLanguage = 'it';

const BY_CODE = new Map<string, (typeof LANGUAGES)[number]>(LANGUAGES.map((l) => [l.code, l]));

export function isNativeLanguage(value: unknown): value is NativeLanguage {
  return typeof value === 'string' && BY_CODE.has(value);
}

/** The app languages the active language pack offers (a native speaker of the target language is left out). */
export function offeredLanguages(): readonly NativeLanguage[] {
  return getActivePack().uiLanguages;
}

/** Anything that comes from outside (backup file, MMKV, route param, DB row) goes through here. */
export function coerceNativeLanguage(value: unknown): NativeLanguage {
  const offered = offeredLanguages();
  if (isNativeLanguage(value) && offered.includes(value)) return value;
  return offered.includes(DEFAULT_NATIVE_LANGUAGE) ? DEFAULT_NATIVE_LANGUAGE : (offered[0] ?? DEFAULT_NATIVE_LANGUAGE);
}

export function languageLabel(lang: NativeLanguage): string {
  return BY_CODE.get(lang)?.label ?? lang;
}

/** The name used in AI prompts, always English. */
export function languageEnglishName(lang: NativeLanguage): string {
  return BY_CODE.get(lang)?.english ?? 'English';
}

export function dateLocale(lang: NativeLanguage): string {
  return BY_CODE.get(lang)?.locale ?? 'en-US';
}

export function isRtl(lang: NativeLanguage): boolean {
  return BY_CODE.get(lang)?.rtl ?? false;
}

/**
 * Maps a device locale identifier ("fr_FR", "zh-Hans-CN", "pt") to a supported app
 * language; English when it is missing or unsupported.
 */
export function detectDeviceLanguage(identifier?: string | null): NativeLanguage {
  const primary = (identifier ?? '').split(/[_-]/)[0].trim().toLowerCase();
  return coerceNativeLanguage(isNativeLanguage(primary) ? primary : 'en');
}

/**
 * Returns the value for `lang`. Italian and English use their own column; every other
 * language uses `local` (translated word content, see wordContent.ts) and then falls
 * back to English, then Italian. Empty strings count as missing.
 */
export function pickLocalized(
  lang: NativeLanguage,
  it: string | null | undefined,
  en: string | null | undefined,
  local?: string | null,
): string | null {
  if (lang === 'it') return it || en || null;
  if (lang === 'en') return en || it || null;
  return local || en || it || null;
}
