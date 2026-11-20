import { CEFR_ORDER, WORD_BANK } from '../data/wordbank';
import type { CefrLevel } from '../data/wordbank';
import type it from '../i18n/it';

export interface Topic {
  key: string;
  emoji: string;
  labelKey: keyof typeof it;
}

/** The topics a learner can pick. Keys equal the word bank's `topic_domain` values. */
export const TOPICS: Topic[] = [
  { key: 'food',     emoji: '🍕', labelKey: 'topic_food'     },
  { key: 'travel',   emoji: '✈️',  labelKey: 'topic_travel'   },
  { key: 'work',     emoji: '💼', labelKey: 'topic_work'     },
  { key: 'culture',  emoji: '🎭', labelKey: 'topic_culture'  },
  { key: 'home',     emoji: '🏠', labelKey: 'topic_home'     },
  { key: 'leisure',  emoji: '🎮', labelKey: 'topic_leisure'  },
  { key: 'health',   emoji: '🏃', labelKey: 'topic_health'   },
  { key: 'shopping', emoji: '🛍️', labelKey: 'topic_shopping' },
];

export const TOPIC_KEYS: string[] = TOPICS.map((tp) => tp.key);

/** Stored preference weights: a selected topic gets SELECTED, the others UNSELECTED. */
const SELECTED = 0.8;
const UNSELECTED = 0.3;
const ACTIVE_FROM = 0.5;

export function buildTopicPreferences(
  allKeys: string[],
  selectedKeys: string[],
): Record<string, number> {
  return Object.fromEntries(
    allKeys.map((k) => [k, selectedKeys.includes(k) ? SELECTED : UNSELECTED]),
  );
}

/**
 * The topics the daily word is drawn from. Preferences come from storage or a
 * backup file, so anything unusable (empty, garbage, nothing selected) means
 * "every topic" rather than leaving the learner without words.
 */
export function activeTopicKeys(prefs: Record<string, number> | null | undefined): string[] {
  const active = TOPIC_KEYS.filter((k) => {
    const v = prefs?.[k];
    return typeof v === 'number' && Number.isFinite(v) && v >= ACTIVE_FROM;
  });
  return active.length > 0 ? active : [...TOPIC_KEYS];
}

export function isActiveTopic(prefs: Record<string, number> | null | undefined, key: string): boolean {
  return activeTopicKeys(prefs).includes(key);
}

/**
 * Flip one topic. Returns the new preferences, or null when that would leave no
 * topic active (the last one cannot be switched off).
 */
export function toggleTopic(
  prefs: Record<string, number> | null | undefined,
  key: string,
): Record<string, number> | null {
  const current = activeTopicKeys(prefs);
  if (!TOPIC_KEYS.includes(key)) return buildTopicPreferences(TOPIC_KEYS, current);
  const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
  return next.length === 0 ? null : buildTopicPreferences(TOPIC_KEYS, next);
}

/** How many bank words each topic has at one level (some levels have none for a topic). */
export function topicCountsForLevel(level: CefrLevel): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(TOPIC_KEYS.map((k) => [k, 0]));
  for (const e of WORD_BANK[level]) {
    if (e.topic_domain in counts) counts[e.topic_domain] += 1;
  }
  return counts;
}

export { CEFR_ORDER };
