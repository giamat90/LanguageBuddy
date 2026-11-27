/** Pairs the words of a segmented sentence with their pronunciation (TASK-074). Pure. */
import { getActivePack, type LanguagePack } from '../../languages';
import { isWordSegment } from '../sentence';

export interface RubyCell {
  word: string;
  /** Punctuation written before the word (an opening quote) and after it. */
  lead: string;
  trail: string;
  pinyin: string;
}

/** Null when the segments and the pronunciation words do not fit each other. */
export function rubyCells(
  segments: readonly string[] | null | undefined,
  pinyin: readonly string[] | null | undefined,
  pack: LanguagePack = getActivePack(),
): RubyCell[] | null {
  if (!segments || !pinyin) return null;
  const cells: RubyCell[] = [];
  let lead = '';
  for (const segment of segments) {
    if (isWordSegment(segment, pack)) {
      cells.push({ word: segment, lead, trail: '', pinyin: pinyin[cells.length] ?? '' });
      lead = '';
    } else if (segment.match(pack.punctuation.lead)?.[0] === segment || cells.length === 0) {
      lead += segment;
    } else {
      cells[cells.length - 1].trail += segment;
    }
  }
  if (cells.length === 0 || cells.length !== pinyin.length) return null;
  cells[cells.length - 1].trail += lead;
  return cells;
}

/** The cell a cloze hides: the word that follows exactly the text `before`. -1 when there is none. */
export function blankCell(cells: readonly RubyCell[], word: string, before: string): number {
  return cells.findIndex((c, i) => c.word === word && rubyText(cells.slice(0, i)) + c.lead === before);
}

/**
 * Rewrites 一 and 不 to their own tone, so that the pinyin shown before an answer does not depend on
 * the hidden word: the cell before position `at`, or every such cell without one.
 */
export function neutralCells(
  cells: readonly RubyCell[],
  citations: Readonly<Record<string, string>>,
  at?: number,
): RubyCell[] {
  return cells.map((cell, i) => {
    const own = citations[cell.word];
    if (!own || (at !== undefined && i !== at - 1)) return cell;
    const first = cell.pinyin.charAt(0);
    const capital = first !== first.toLowerCase();
    return { ...cell, pinyin: capital ? own.charAt(0).toUpperCase() + own.slice(1) : own };
  });
}

/** The whole sentence a list of cells writes. */
export const rubyText = (cells: readonly RubyCell[]): string =>
  cells.map((c) => c.lead + c.word + c.trail).join('');
