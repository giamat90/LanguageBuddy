/**
 * The generic texts every language pack must supply in each app language (its `strings` overlay).
 * `grammar_rule_<CODE>` keys are extra: they depend on the language's own rule codes.
 */
export const BASE_TARGET_KEYS = [
  'welcome_subtitle',
  'review_mc_prompt_target',
  'speech_unavailable_title',
  'speech_unavailable_body',
] as const;

/** The placement quiz's sentences: only a pack with a quiz needs them. */
export const QUIZ_TARGET_KEYS = [
  'quiz_q1', 'quiz_q1_a', 'quiz_q1_b',
  'quiz_q2', 'quiz_q2_a', 'quiz_q2_b',
  'quiz_q3', 'quiz_q3_a', 'quiz_q3_b',
  'quiz_q4', 'quiz_q4_a', 'quiz_q4_b',
  'quiz_q5', 'quiz_q5_a', 'quiz_q5_b',
] as const;

/** Texts of the pronunciation layer (TASK-074): only a pack with `reading` needs them. */
export const READING_TARGET_KEYS = [
  'practice_format_tone_choice',
  'practice_desc_tone_choice',
  'reading_tone_prompt',
  'reading_show_pinyin',
  'reading_cloze_placeholder',
  'reading_hint_text',
  'reading_wrong_tone',
  'reading_missing_tones',
  'settings_pinyin_title',
  'settings_pinyin_desc',
  'settings_pinyin_auto',
  'settings_pinyin_always',
  'settings_pinyin_tap',
] as const;

/** What a spaced language with a placement quiz must supply (the older packs). */
export const REQUIRED_TARGET_KEYS = [...BASE_TARGET_KEYS, ...QUIZ_TARGET_KEYS] as const;

/** Every key a pack may be asked for. These never live in the shared strings of src/i18n. */
export type RequiredTargetKey = (typeof REQUIRED_TARGET_KEYS)[number] | (typeof READING_TARGET_KEYS)[number];

/** The keys this pack must supply. */
export function requiredTargetKeys(
  pack: { quiz: readonly unknown[]; reading: object | null },
): readonly RequiredTargetKey[] {
  const base: readonly RequiredTargetKey[] = pack.quiz.length > 0 ? REQUIRED_TARGET_KEYS : BASE_TARGET_KEYS;
  return pack.reading ? [...base, ...READING_TARGET_KEYS] : base;
}
