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

const i18n = new I18n({ it, en, fr, es, pt, ru, uk, pl, tr, zh, ja, hi, ar });
// A key missing from a language (the parity test forbids it) shows English, not Italian.
i18n.enableFallback = true;
i18n.defaultLocale = 'en';
i18n.locale = DEFAULT_NATIVE_LANGUAGE;

export function setAppLocale(lang: NativeLanguage): void {
  i18n.locale = lang;
}
export function getAppLocale(): NativeLanguage {
  return i18n.locale as NativeLanguage;
}

export default i18n;
export const t = (key: keyof typeof it, opts?: object) => i18n.t(key, opts);
