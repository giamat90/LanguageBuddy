import { WORD_BANK, CEFR_ORDER, entryId } from './wordbank';
import type { CefrLevel, WordBankEntry } from './wordbank';

/** Deterministic 32-bit hash of a string (seed derivation). */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — small, fast, deterministic. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle driven by a seeded PRNG. Pure — never mutates input. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const rng = mulberry32(hashString(seed));
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A bank without stages is one stage. */
const stageOf = (e: WordBankEntry): number => e.stage ?? 0;

/**
 * The per-install ordering of a level's bank. Stable for a given installId so the
 * learner works through the words in a consistent, non-obvious sequence: stage by
 * stage where the bank has stages, shuffled within each.
 */
export function orderedBankForLevel(level: CefrLevel, installId: string): WordBankEntry[] {
  return seededShuffle(WORD_BANK[level], `${installId}:${level}`)
    .map((entry, at) => ({ entry, at }))
    .sort((a, b) => stageOf(a.entry) - stageOf(b.entry) || a.at - b.at)
    .map(({ entry }) => entry);
}

/**
 * Pick the next word to show. `usedWords` = lowercased words already shown or saved.
 * The word comes from the lowest stage that still has an unused one. Within it
 * `activeTopics` (the learner's chosen topics; empty/absent = no preference) are
 * preferred: the first unused entry of those topics wins. `outsideTopics` is set when
 * they have no unused word left at this level (some levels have none for a topic at
 * all). If the whole level is used, the ordering is recycled, again preferring the
 * chosen topics.
 */
export function pickNextWord(
  level: CefrLevel,
  installId: string,
  usedWords: Set<string>,
  activeTopics?: readonly string[],
): { entry: WordBankEntry; id: string; exhausted: boolean; outsideTopics: boolean } {
  const ordered = orderedBankForLevel(level, installId);
  const wanted = activeTopics && activeTopics.length > 0 ? new Set(activeTopics) : null;
  const inTopics = (e: WordBankEntry) => wanted === null || wanted.has(e.topic_domain);
  const unused = (e: WordBankEntry) => !usedWords.has(e.word.toLowerCase());

  const open = ordered.find(unused);
  if (open) {
    const preferred = ordered.find((e) => stageOf(e) === stageOf(open) && unused(e) && inTopics(e));
    const entry = preferred ?? open;
    const outsideTopics = !ordered.some((e) => unused(e) && inTopics(e));
    return { entry, id: entryId(level, entry), exhausted: false, outsideTopics };
  }
  // Whole level seen — recycle from the top of the ordering.
  const entry = ordered.find(inTopics) ?? ordered[0];
  return { entry, id: entryId(level, entry), exhausted: true, outsideTopics: false };
}

export { CEFR_ORDER };
