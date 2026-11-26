/** When the pronunciation shows (TASK-074): the learner's setting, and how well a word is known. Pure. */
import type { Tier } from '../exercises/types';

export const PINYIN_MODES = ['auto', 'always', 'tap'] as const;
export type PinyinMode = (typeof PINYIN_MODES)[number];

/** Anything read from storage that is not a mode means the default. */
export const coercePinyinMode = (value: unknown): PinyinMode =>
  PINYIN_MODES.includes(value as PinyinMode) ? (value as PinyinMode) : 'auto';

/** Word card, word detail and lists: shown unless the learner asked to tap for it. */
export const showWhenReading = (mode: PinyinMode): boolean => mode !== 'tap';

/** Before the answer of an exercise. "auto" fades it out once a word is no longer new. */
export const showInExercise = (mode: PinyinMode, tier: Tier): boolean =>
  mode === 'always' || (mode === 'auto' && tier === 'new');
