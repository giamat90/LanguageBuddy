import { colors } from './colors';
import type { CatalogStatus } from '../lib/catalog';

/** One color per learning status; used by the statistics bars, the catalog and the lists. */
export const STATUS_COLORS: Record<CatalogStatus, string> = {
  mastered: colors.forest,
  learning: colors.gold,
  new: colors.muted,
  // Not started: an outline only (see StatusMarker), never a filled color.
  todo: 'transparent',
};

/** The ring of the "not started" marker. */
export const TODO_RING = colors.muted;
