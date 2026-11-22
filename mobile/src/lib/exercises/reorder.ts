import { buildCloze } from '../cloze';
import { shuffle, type Rng } from '../grammar';
import type { ReviewCard } from '../../services/reviewService';
import type { SentenceReorderModel } from './types';

export const REORDER_MIN_TOKENS = 4;
export const REORDER_MAX_TOKENS = 10;

/**
 * Words as written; punctuation stays attached so there are no lone "." tiles. Only ordinary
 * whitespace separates tiles: French writes a no-break space (U+00A0) before ? ! : ; and the
 * mark must stay on its word's tile.
 */
export function tokenizeSentence(sentence: string): string[] {
  const trimmed = sentence.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
  return trimmed ? trimmed.split(/[ \t\r\n]+/) : [];
}

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
  if (!card.example || !buildCloze(card.example, card.word)) return null;
  const solution = tokenizeSentence(card.example);
  if (solution.length < REORDER_MIN_TOKENS || solution.length > REORDER_MAX_TOKENS) return null;

  const tokens = shuffleTokens(solution, rng);
  if (sameOrder(tokens, solution)) return null; // e.g. every token identical
  return { kind: 'sentence_reorder', card, tokens, solution };
}

export type ReorderResult = 'exact' | 'wrong';

export function gradeReorder(placed: string[], solution: string[]): ReorderResult {
  return sameOrder(placed, solution) ? 'exact' : 'wrong';
}
