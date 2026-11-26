import { buildCloze } from '../cloze';
import { shuffle, type Rng } from '../grammar';
import { sentenceTokens, tokenizeSentence } from '../sentence';
import type { ReviewCard } from '../../services/reviewService';
import type { SentenceReorderModel } from './types';

export const REORDER_MIN_TOKENS = 4;
export const REORDER_MAX_TOKENS = 10;

export { tokenizeSentence };

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

/** A shuffle that is guaranteed to differ from the input (when it can). */
export function shuffleTokens(tokens: string[], rng: Rng): string[] {
  const out = shuffle(tokens, rng);
  if (sameOrder(out, tokens) && out.length > 1) return [...out.slice(1), out[0]];
  return out;
}

/**
 * Null unless the card's example contains the word and has 4–10 tokens, so the
 * exercise is about that word and fits a phone screen.
 */
export function buildReorder(card: ReviewCard, rng: Rng): SentenceReorderModel | null {
  if (!card.example || !buildCloze(card.example, card.word, undefined, card.segments)) return null;
  const solution = sentenceTokens(card.example, card.segments);
  if (solution.length < REORDER_MIN_TOKENS || solution.length > REORDER_MAX_TOKENS) return null;

  const tokens = shuffleTokens(solution, rng);
  if (sameOrder(tokens, solution)) return null; // e.g. every token identical
  return { kind: 'sentence_reorder', card, tokens, solution };
}

export type ReorderResult = 'exact' | 'wrong';

export function gradeReorder(placed: string[], solution: string[]): ReorderResult {
  return sameOrder(placed, solution) ? 'exact' : 'wrong';
}
