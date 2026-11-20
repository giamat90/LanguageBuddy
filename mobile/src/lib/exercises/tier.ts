import type { ReviewCard } from '../../services/reviewService';
import type { Tier } from './types';

export const NEW_RETENTION_BELOW = 0.6;
export const STRONG_RETENTION_FROM = 0.85;
export const STRONG_MIN_SEEN = 4;

export function tierOf(card: Pick<ReviewCard, 'timesSeen' | 'retentionScore'>): Tier {
  if (card.timesSeen <= 1 || card.retentionScore < NEW_RETENTION_BELOW) return 'new';
  if (card.retentionScore >= STRONG_RETENTION_FROM && card.timesSeen >= STRONG_MIN_SEEN) return 'strong';
  return 'learning';
}
