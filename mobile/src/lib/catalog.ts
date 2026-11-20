import { CEFR_ORDER, WORD_BANK } from '../data/wordbank';
import type { CefrLevel, WordBankEntry } from '../data/wordbank';
import { statTierOf } from './stats';
import { TOPIC_KEYS } from './topics';

export type CatalogStatus = 'mastered' | 'learning' | 'new' | 'todo';
export const CATALOG_STATUSES: readonly CatalogStatus[] = ['mastered', 'learning', 'new', 'todo'];

/** A saved word as the catalog needs it; the map is keyed by the lowercased word. */
export interface SavedState {
  id: string;
  retentionScore: number;
  timesSeen: number;
}

export interface CatalogEntry {
  /** `${level}:${word}` — unique even when the same word is in two levels. */
  key: string;
  word: string;
  article: string | null;
  /** Null only for rows built from saved words alone (the tier lists), which do not show a level. */
  level: CefrLevel | null;
  translationIt: string;
  translationEn: string;
  status: CatalogStatus;
  /** vocabulary_items.id; null when the word is not saved (status 'todo'). */
  savedId: string | null;
}

export interface CatalogView {
  entries: CatalogEntry[];
  /** Counts per status BEFORE the status filter, so each chip shows what it would give. */
  counts: Record<CatalogStatus, number>;
  total: number;
}

export interface CatalogScope {
  level: CefrLevel | null;
  topic: string | null;
}

/**
 * Every bank word of a scope (null = all levels / all topics) with its learning status.
 * Words are listed per level and NOT deduplicated: a word present at two levels appears
 * in both (the statistics lookup resolves it to the lowest level for its saved counts,
 * but its bank denominators count it at both, which is what the lists match).
 */
export function buildCatalog(
  scope: CatalogScope,
  status: CatalogStatus | null,
  saved: ReadonlyMap<string, SavedState>,
  bank: Record<CefrLevel, WordBankEntry[]> = WORD_BANK,
): CatalogView {
  const levels = scope.level ? [scope.level] : CEFR_ORDER;
  const counts: Record<CatalogStatus, number> = { mastered: 0, learning: 0, new: 0, todo: 0 };
  const all: CatalogEntry[] = [];

  for (const level of levels) {
    const inLevel: CatalogEntry[] = [];
    for (const e of bank[level]) {
      if (scope.topic !== null && e.topic_domain !== scope.topic) continue;
      const s = saved.get(e.word.toLowerCase());
      const st: CatalogStatus = s ? statTierOf(s) : 'todo';
      counts[st] += 1;
      inLevel.push({
        key: `${level}:${e.word}`,
        word: e.word,
        article: e.article,
        level,
        translationIt: e.meaning_it,
        translationEn: e.meaning_en,
        status: st,
        savedId: s ? s.id : null,
      });
    }
    inLevel.sort((a, b) => a.word.localeCompare(b.word, 'de', { sensitivity: 'base' }));
    all.push(...inLevel);
  }

  return {
    entries: status ? all.filter((e) => e.status === status) : all,
    counts,
    total: all.length,
  };
}

/**
 * Words per level (`by: 'level'`) or per topic (`by: 'topic'`) inside the bucket a list was
 * opened on. Status is ignored on purpose, so the numbers on the chips do not jump around
 * while the learner combines filters.
 */
export function scopeCounts(
  by: 'level' | 'topic',
  fixed: CatalogScope,
  saved: ReadonlyMap<string, SavedState>,
  bank: Record<CefrLevel, WordBankEntry[]> = WORD_BANK,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (by === 'level') {
    for (const level of CEFR_ORDER) out[level] = buildCatalog({ level, topic: fixed.topic }, null, saved, bank).total;
  } else {
    for (const topic of TOPIC_KEYS) out[topic] = buildCatalog({ level: fixed.level, topic }, null, saved, bank).total;
  }
  return out;
}
