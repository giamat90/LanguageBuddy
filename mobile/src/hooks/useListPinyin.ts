import { getActivePack } from '../languages';
import { bankReading } from '../lib/reading/lookup';
import { showWhenReading } from '../lib/reading/visibility';
import { useReadingSettingsStore } from '../store/useReadingSettingsStore';

/** The pinyin of a word row; null for other languages and for a learner who taps to see it. */
export function useListPinyin(word: string): string | null {
  const mode = useReadingSettingsStore((s) => s.pinyinMode);
  if (!getActivePack().reading || !showWhenReading(mode)) return null;
  return bankReading(word)?.pronunciation ?? null;
}
