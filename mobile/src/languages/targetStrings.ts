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

/** Texts of the measure-word drill (TASK-076). */
export const CLASSIFIER_TARGET_KEYS = ['grammar_prompt_measure'] as const;

/** Texts of the pronunciation primer (TASK-076); each section adds a title and a text. */
export const PRIMER_TARGET_KEYS = ['primer_title', 'primer_intro', 'primer_continue'] as const;

/** What a spaced language with a placement quiz must supply (the older packs). */
export const REQUIRED_TARGET_KEYS = [...BASE_TARGET_KEYS, ...QUIZ_TARGET_KEYS] as const;

/** Every key a pack may be asked for. These never live in the shared strings of src/i18n. */
export type RequiredTargetKey =
  | (typeof REQUIRED_TARGET_KEYS)[number]
  | (typeof READING_TARGET_KEYS)[number]
  | (typeof CLASSIFIER_TARGET_KEYS)[number]
  | (typeof PRIMER_TARGET_KEYS)[number]
  | `grammar_rule_${string}`
  | `primer_${string}`;

/** The keys this pack must supply. */
export function requiredTargetKeys(pack: {
  quiz: readonly unknown[];
  reading: object | null;
  choices?: { ruleSets: object } | null;
  classifiers?: { rule: string } | null;
  primer?: { sections: readonly { id: string }[] } | null;
}): readonly RequiredTargetKey[] {
  const keys: RequiredTargetKey[] = [...(pack.quiz.length > 0 ? REQUIRED_TARGET_KEYS : BASE_TARGET_KEYS)];
  if (pack.reading) keys.push(...READING_TARGET_KEYS);
  // Every rule a drill can ask about needs its explanation.
  for (const rule of Object.keys(pack.choices?.ruleSets ?? {})) keys.push(`grammar_rule_${rule}`);
  if (pack.classifiers) keys.push(...CLASSIFIER_TARGET_KEYS, `grammar_rule_${pack.classifiers.rule}`);
  if (pack.primer) {
    keys.push(...PRIMER_TARGET_KEYS);
    for (const { id } of pack.primer.sections) keys.push(`primer_${id}_title`, `primer_${id}_text`);
  }
  return keys;
}
