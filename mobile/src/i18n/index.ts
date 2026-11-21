import { I18n } from 'i18n-js';
import it from './it';
import en from './en';
import fr from './fr';
import es from './es';
import pt from './pt';
import ru from './ru';
import uk from './uk';
import pl from './pl';
import tr from './tr';
import zh from './zh';
import ja from './ja';
import hi from './hi';
import ar from './ar';
import type { NativeLanguage } from './language';
import { DEFAULT_NATIVE_LANGUAGE } from './language';
import { getActivePack, onActivePackChange, type LanguagePack } from '../languages';
import type { RequiredTargetKey } from '../languages/targetStrings';

const BASE = { it, en, fr, es, pt, ru, uk, pl, tr, zh, ja, hi, ar };

const i18n = new I18n(BASE);
// A key missing from a language (the parity test forbids it) shows English, not Italian.
i18n.enableFallback = true;
i18n.defaultLocale = 'en';
i18n.locale = DEFAULT_NATIVE_LANGUAGE;

/** Base strings with the active language pack's overlay merged over them, per app language. */
export function applyTargetStrings(pack: LanguagePack): void {
  const merged: Record<string, Record<string, string>> = {};
  for (const lang of Object.keys(BASE) as NativeLanguage[]) {
    merged[lang] = { ...(BASE[lang] as Record<string, string>), ...(pack.strings[lang] ?? {}) };
  }
  // Replace (not merge): a previous pack's overlay must not linger.
  i18n.translations = merged;
  i18n.store({}); // notifies listeners
}
applyTargetStrings(getActivePack());
onActivePackChange(applyTargetStrings);

export function setAppLocale(lang: NativeLanguage): void {
  i18n.locale = lang;
}
export function getAppLocale(): NativeLanguage {
  return i18n.locale as NativeLanguage;
}

export default i18n;
/** Every key a screen may ask for: the shared ones, the generic target-language ones and the rule texts. */
export type StringKey = keyof typeof it | RequiredTargetKey | `grammar_rule_${string}`;

/** `%{app}` is always available: the name of the app (the active language pack's). */
export const t = (key: StringKey, opts?: object) =>
  i18n.t(key, { app: getActivePack().app.name, ...opts });
