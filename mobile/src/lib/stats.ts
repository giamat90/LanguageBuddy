import { CEFR_ORDER, WORD_BANK } from '../data/wordbank';
import type { CefrLevel, WordBankEntry } from '../data/wordbank';
import { tierOf } from './exercises/tier';
import { TOPIC_KEYS } from './topics';

export interface VocabStatRow {
  word: string;
  retentionScore: number;
  timesSeen: number;
}

export interface TierCounts {
  new: number;
  learning: number;
  mastered: number;
  total: number;
}

export interface GroupStat extends TierCounts {
  key: string;
  /** Words the bank has in this group (the denominator of the progress bar). */
  bankTotal: number;
}

export interface LearningStats {
  saved: TierCounts;
  bankTotal: number;
  reviews: { total: number; correct: number; accuracy: number | null };
  byTopic: GroupStat[];
  byLevel: GroupStat[];
}

export type StatTier = 'mastered' | 'learning' | 'new';
export const STAT_TIERS: readonly StatTier[] = ['mastered', 'learning', 'new'];

/** The tier a saved word is shown under (the exercise engine's "strong" is "mastered"). */
export function statTierOf(row: Pick<VocabStatRow, 'retentionScore' | 'timesSeen'>): StatTier {
  const tier = tierOf({ timesSeen: row.timesSeen, retentionScore: row.retentionScore });
  return tier === 'strong' ? 'mastered' : tier;
}

type BankLookup = Map<string, { level: CefrLevel; topic: string }>;

/** Lowercased word -> its level and topic; the few words in two levels resolve to the lowest. */
function buildLookup(bank: Record<CefrLevel, WordBankEntry[]>): BankLookup {
  const lookup: BankLookup = new Map();
  for (const level of CEFR_ORDER) {
    for (const e of bank[level]) {
      const k = e.word.toLowerCase();
      if (!lookup.has(k)) lookup.set(k, { level, topic: e.topic_domain });
    }
  }
  return lookup;
}

const emptyCounts = (): TierCounts => ({ new: 0, learning: 0, mastered: 0, total: 0 });

function add(counts: TierCounts, tier: StatTier): void {
  counts[tier] += 1;
  counts.total += 1;
}

/**
 * Pure aggregation: saved words (tiered like the exercise engine) against the
 * bundled word bank, by topic and by CEFR level. A word is looked up in the bank
 * case-insensitively; the few words present at two levels resolve to the lowest.
 */
export function computeStats(
  rows: readonly VocabStatRow[],
  reviews: { total: number; correct: number },
  bank: Record<CefrLevel, WordBankEntry[]> = WORD_BANK,
): LearningStats {
  const lookup = buildLookup(bank);
  const topicBank = new Map<string, number>(TOPIC_KEYS.map((k) => [k, 0]));
  const levelBank = new Map<string, number>(CEFR_ORDER.map((l) => [l, 0]));
  let bankTotal = 0;

  for (const level of CEFR_ORDER) {
    for (const e of bank[level]) {
      bankTotal += 1;
      levelBank.set(level, (levelBank.get(level) ?? 0) + 1);
      if (topicBank.has(e.topic_domain)) topicBank.set(e.topic_domain, (topicBank.get(e.topic_domain) ?? 0) + 1);
    }
  }

  const saved = emptyCounts();
  const topics = new Map<string, TierCounts>(TOPIC_KEYS.map((k) => [k, emptyCounts()]));
  const levels = new Map<string, TierCounts>(CEFR_ORDER.map((l) => [l, emptyCounts()]));

  for (const r of rows) {
    const tier = statTierOf(r);
    add(saved, tier);
    const hit = lookup.get(r.word.toLowerCase());
    if (!hit) continue;
    const t = topics.get(hit.topic);
    if (t) add(t, tier);
    const l = levels.get(hit.level);
    if (l) add(l, tier);
  }

  const group = (counts: Map<string, TierCounts>, sizes: Map<string, number>): GroupStat[] =>
    [...counts].map(([key, c]) => ({ key, ...c, bankTotal: sizes.get(key) ?? 0 }));

  const correct = Math.min(reviews.correct, reviews.total);
  return {
    saved,
    bankTotal,
    reviews: {
      total: reviews.total,
      correct,
      accuracy: reviews.total > 0 ? correct / reviews.total : null,
    },
    byTopic: group(topics, topicBank),
    byLevel: group(levels, levelBank),
  };
}

export type WordFilter =
  | { kind: 'all' }
  | { kind: 'tier'; tier: StatTier }
  | { kind: 'topic'; key: string }
  | { kind: 'level'; key: CefrLevel };

const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);

/**
 * Route params are untrusted: only whitelisted kinds and values become a filter,
 * anything else is null (the screen then shows "nothing to show").
 */
export function parseWordFilter(kind: unknown, value: unknown): WordFilter | null {
  const k = first(kind);
  const v = first(value);
  if (k === 'all') return { kind: 'all' };
  if (typeof v !== 'string') return null;
  if (k === 'tier') return (STAT_TIERS as readonly string[]).includes(v) ? { kind: 'tier', tier: v as StatTier } : null;
  if (k === 'topic') return (TOPIC_KEYS as readonly string[]).includes(v) ? { kind: 'topic', key: v } : null;
  if (k === 'level') return (CEFR_ORDER as readonly string[]).includes(v) ? { kind: 'level', key: v as CefrLevel } : null;
  return null;
}

/**
 * The saved words behind one number on the statistics screen. Uses the same
 * lookup and tier rules as `computeStats`, so a list always has as many words as
 * the count that opened it.
 */
export function selectStatRows<T extends VocabStatRow>(
  rows: readonly T[],
  filter: WordFilter,
  bank: Record<CefrLevel, WordBankEntry[]> = WORD_BANK,
): T[] {
  if (filter.kind === 'all') return [...rows];
  if (filter.kind === 'tier') return rows.filter((r) => statTierOf(r) === filter.tier);
  const lookup = buildLookup(bank);
  return rows.filter((r) => {
    const hit = lookup.get(r.word.toLowerCase());
    if (!hit) return false;
    return filter.kind === 'topic' ? hit.topic === filter.key : hit.level === filter.key;
  });
}
