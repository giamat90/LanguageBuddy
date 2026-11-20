import { shuffle, type Rng } from '../grammar';
import type { ReviewCard } from '../../services/reviewService';
import { localMeaningKey, normalizeMeaning } from './distractors';
import type { NativeLanguage } from '../../i18n/language';
import type { MatchingModel } from './types';

export const MATCH_MIN = 4;
export const MATCH_MAX = 5;

/**
 * One matching round from the given cards, in order. Cards whose native meaning is
 * missing, or equal (Italian or English) to one already chosen, are skipped: two
 * identical right-hand tiles would make the pairing ambiguous. Null when fewer than
 * MATCH_MIN usable cards remain.
 */
export function buildMatchingRound(cards: ReviewCard[], rng: Rng, lang?: NativeLanguage): MatchingModel | null {
  const usedIt = new Set<string>();
  const usedLocal = new Set<string>();
  const usedEn = new Set<string>();
  const chosen: ReviewCard[] = [];

  for (const card of cards) {
    if (chosen.length >= MATCH_MAX) break;
    const it = normalizeMeaning(card.translationIt ?? '');
    const en = normalizeMeaning(card.translationEn ?? '');
    if (!it || !en || usedIt.has(it) || usedEn.has(en)) continue;
    const local = localMeaningKey(lang, card.word, card.cefrBand);
    if (local && usedLocal.has(local)) continue;
    usedIt.add(it);
    usedEn.add(en);
    if (local) usedLocal.add(local);
    chosen.push(card);
  }
  if (chosen.length < MATCH_MIN) return null;

  const ids = chosen.map((c) => c.id);
  return { kind: 'matching', cards: chosen, leftOrder: shuffle(ids, rng), rightOrder: shuffle(ids, rng) };
}
