import { useState } from 'react';
import { getActivePack } from '../../languages';
import { tierOf } from '../../lib/exercises/tier';
import { showInExercise } from '../../lib/reading/visibility';
import { useReadingSettingsStore } from '../../store/useReadingSettingsStore';
import type { ReviewCard } from '../../services/reviewService';

/**
 * Pinyin on one exercise (TASK-074). `answered`: from then on it shows at no cost. Inert for a
 * language without a reading layer. What gives the answer away is for each view to leave out.
 */
export function useExercisePinyin(answered: boolean) {
  const active = getActivePack().reading !== null;
  const mode = useReadingSettingsStore((s) => s.pinyinMode);
  const [revealed, setRevealed] = useState(false);
  /** Shown without being asked for. */
  const free = (card: ReviewCard) => showInExercise(mode, tierOf(card));

  return {
    free,
    shows: (card: ReviewCard) => active && (answered || revealed || free(card)),
    /** Whether "Show pinyin" has anything to show for these cards. */
    offers: (cards: ReviewCard[]) =>
      active && !answered && !revealed && cards.some((c) => Boolean(c.pronunciation) && !free(c)),
    reveal: () => setRevealed(true),
    /** The learner asked for pinyin that was hidden: it counts like a hint. */
    peeked: (card: ReviewCard) => revealed && !free(card),
  };
}
