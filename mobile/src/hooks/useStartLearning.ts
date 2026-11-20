import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { t } from '../i18n';
import { localizedText } from '../i18n/wordContent';
import { useUserStore } from '../store/useUserStore';
import { startLearning } from '../services/wordService';
import type { CatalogEntry } from '../lib/catalog';

/**
 * Tap an unsaved word -> confirm -> add it to the vault -> `onChanged` (the list reloads).
 * One confirmation or save at a time: a second tap meanwhile is ignored.
 */
export function useStartLearning(onChanged: () => void | Promise<void>) {
  const busyRef = useRef(false);

  const start = useCallback((entry: CatalogEntry) => {
    if (busyRef.current || !entry.level) return;
    busyRef.current = true;
    const level = entry.level;
    const release = () => { busyRef.current = false; };

    const lang = useUserStore.getState().nativeLanguage;
    const meaning = localizedText(lang, 'meaning', { word: entry.word, level }, entry.translationIt, entry.translationEn);
    const word = entry.article ? `${entry.article} ${entry.word}` : entry.word;
    const body = meaning
      ? t('catalog_start_body', { word, meaning })
      : t('catalog_start_body_nomeaning', { word });

    const confirm = async () => {
      try {
        await startLearning(level, entry.word);
        await onChanged();
      } catch (e) {
        console.error('[Catalog] start learning failed:', e);
        Alert.alert(t('catalog_start_error_title'), t('catalog_start_error_body'));
      } finally {
        release();
      }
    };

    Alert.alert(
      t('catalog_start_title'),
      body,
      [
        { text: t('common_cancel'), style: 'cancel', onPress: release },
        { text: t('catalog_start_confirm'), onPress: confirm },
      ],
      { cancelable: true, onDismiss: release },
    );
  }, [onChanged]);

  return { start };
}
