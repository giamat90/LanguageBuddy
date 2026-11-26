import { CEFR_ORDER, type CefrLevel } from '../data/wordbank';
import { getActivePack, type LanguagePack } from '../languages';

/**
 * Anything from storage, a route or a backup: a level this pack has words for. A level above the
 * pack's becomes its highest; anything else that is not one of its levels, its first.
 */
export function coerceLevel(value: unknown, pack: LanguagePack = getActivePack()): CefrLevel {
  const levels = pack.levels;
  const known = CEFR_ORDER.indexOf(value as CefrLevel);
  if (known < 0) return levels[0];
  const highest = levels[levels.length - 1];
  return known > CEFR_ORDER.indexOf(highest) ? highest : (value as CefrLevel);
}
