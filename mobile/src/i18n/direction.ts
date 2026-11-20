import { I18nManager } from 'react-native';
import { isRtl, type NativeLanguage } from './language';

/**
 * Sets the layout direction for `lang`. Android applies a changed direction only
 * after the app restarts, so `changed` tells the caller to show a restart notice.
 * Safe to call at startup with the persisted language: it is idempotent.
 */
export function applyLayoutDirection(lang: NativeLanguage): { changed: boolean } {
  const wantRtl = isRtl(lang);
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL === wantRtl) return { changed: false };
  I18nManager.forceRTL(wantRtl);
  return { changed: true };
}
