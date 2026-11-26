/** The pronunciation of each shuffled sentence tile (TASK-074). Pure. */
import type { RubyCell } from './ruby';

/**
 * By tile index. Lower-cased: the capital would give away which word starts the sentence.
 * A tile whose word cannot be found gets none.
 */
export function tilePinyin(
  tokens: readonly string[],
  solution: readonly string[],
  cells: readonly RubyCell[] | null,
): (string | undefined)[] {
  const out: (string | undefined)[] = new Array(tokens.length).fill(undefined);
  if (!cells) return out;
  const taken = new Set<number>();
  solution.forEach((token) => {
    // The same word can appear twice: each tile takes one occurrence of the sentence.
    const at = tokens.findIndex((t, i) => t === token && !taken.has(i));
    if (at < 0) return;
    taken.add(at);
    const nth = [...taken].filter((i) => tokens[i] === token).length;
    const cell = cells.filter((c) => c.lead + c.word + c.trail === token)[nth - 1];
    out[at] = cell?.pinyin.toLowerCase();
  });
  return out;
}
