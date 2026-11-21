/**
 * The generic texts every language pack must supply in each app language (its `strings` overlay).
 * `grammar_rule_<CODE>` keys are extra: they depend on the language's own rule codes.
 */
export const REQUIRED_TARGET_KEYS = [
  'welcome_subtitle',
  'review_mc_prompt_target',
  'speech_unavailable_title',
  'speech_unavailable_body',
  'quiz_q1', 'quiz_q1_a', 'quiz_q1_b',
  'quiz_q2', 'quiz_q2_a', 'quiz_q2_b',
  'quiz_q3', 'quiz_q3_a', 'quiz_q3_b',
  'quiz_q4', 'quiz_q4_a', 'quiz_q4_b',
  'quiz_q5', 'quiz_q5_a', 'quiz_q5_b',
] as const;

export type RequiredTargetKey = (typeof REQUIRED_TARGET_KEYS)[number];
