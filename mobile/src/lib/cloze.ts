import type { TypedResult } from './exercises/quality';
import { getActivePack, type LanguagePack } from '../languages';

export interface Cloze {
  /** Sentence parts around the blank. */
  before: string;
  after: string;
}

/** How many letters a word has in this language (counts ñ, á, ä, ß …, never punctuation or spaces). */
export function letterCount(word: string, pack: LanguagePack = getActivePack()): number {
  const re = new RegExp(pack.letters.source, 'g');
  return (word.match(re) ?? []).join('').length;
}

/**
 * Blanks the whole-word occurrence of `word` in `sentence`, or null if it is absent or occurs more
 * than once (a second copy would leave the answer in the sentence and make the blank ambiguous).
 */
export function buildCloze(
  sentence: string | null | undefined,
  word: string,
  pack: LanguagePack = getActivePack(),
): Cloze | null {
  if (!sentence) return null;
  const target = word.toLowerCase();
  const parts = sentence.split(pack.letters);
  // Odd indexes are the captured letter runs.
  const hits: number[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    if (parts[i].toLowerCase() === target) hits.push(i);
  }
  if (hits.length !== 1) return null;
  const i = hits[0];
  return { before: parts.slice(0, i).join(''), after: parts.slice(i + 1).join('') };
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Grades a typed answer against the target word.
 *  - exact: same word, ignoring case and surrounding space (accents and special letters must match)
 *  - close: matches once the pack folds them (German: umlauts/ß), or one typo on a word of `typoMinLength`+ letters
 *  - wrong: anything else, including empty input
 */
export function gradeTypedAnswer(answer: string, word: string, pack: LanguagePack = getActivePack()): TypedResult {
  // NFC so a decomposed "ü" (u + combining diaeresis) from a paste compares equal.
  // A typographic apostrophe (some keyboards type it) is the same letter as the straight one.
  const typed = answer.normalize('NFC').trim().replace(/’/g, "'");
  const target = word.normalize('NFC');
  if (!typed) return 'wrong';
  if (typed.toLowerCase() === target.toLowerCase()) return 'exact';

  const a = pack.fold(typed);
  const w = pack.fold(target);
  if (a === w) return 'close';
  return w.length >= pack.typoMinLength && editDistance(a, w) <= 1 ? 'close' : 'wrong';
}

/** True for exact and close answers. */
export function isAnswerCorrect(answer: string, word: string, pack: LanguagePack = getActivePack()): boolean {
  return gradeTypedAnswer(answer, word, pack) !== 'wrong';
}
