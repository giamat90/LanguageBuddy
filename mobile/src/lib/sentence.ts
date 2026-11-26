/**
 * Where the words of a sentence are. A spaced language finds them in the text; a segmented one
 * (no spaces between words) reads them from the bank: nothing is segmented on the phone. Pure.
 */
import { getActivePack, type LanguagePack } from '../languages';

/**
 * Words of a spaced sentence as written; punctuation stays attached so there are no lone "."
 * tiles. Only ordinary whitespace separates them: French writes a no-break space (U+00A0) before
 * ? ! : ; and the mark must stay on its word's tile.
 */
export function tokenizeSentence(sentence: string): string[] {
  const trimmed = sentence.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
  return trimmed ? trimmed.split(/[ \t\r\n]+/) : [];
}

/** The bank's segments, only when they spell the sentence exactly. */
function usableSegments(text: string, segments: readonly string[] | null | undefined): readonly string[] | null {
  return segments && segments.length > 0 && segments.join('') === text ? segments : null;
}

function isWord(segment: string, pack: LanguagePack): boolean {
  const parts = segment.split(pack.letters);
  return parts.length === 3 && parts[0] === '' && parts[2] === '';
}

/** Same shape as `text.split(pack.letters)`: separators at even indexes, words at odd ones. */
export function sentenceParts(
  text: string,
  segments: readonly string[] | null | undefined,
  pack: LanguagePack = getActivePack(),
): string[] {
  if (pack.sentences === 'spaced') return text.split(pack.letters);
  const usable = usableSegments(text, segments);
  if (!usable) return [text];
  const parts = [''];
  for (const segment of usable) {
    if (isWord(segment, pack)) parts.push(segment, '');
    else parts[parts.length - 1] += segment;
  }
  return parts;
}

/**
 * Tiles: words as shown, with their punctuation attached (an opening mark goes with the next word,
 * any other mark with the previous one). Empty when a segmented sentence has no usable segments.
 */
export function sentenceTokens(
  text: string,
  segments: readonly string[] | null | undefined,
  pack: LanguagePack = getActivePack(),
): string[] {
  if (pack.sentences === 'spaced') return tokenizeSentence(text);
  const usable = usableSegments(text, segments);
  if (!usable) return [];
  const tokens: string[] = [];
  let prefix = '';
  for (const segment of usable) {
    if (isWord(segment, pack)) {
      tokens.push(prefix + segment);
      prefix = '';
    } else if (segment.match(pack.punctuation.lead)?.[0] === segment || tokens.length === 0) {
      prefix += segment;
    } else {
      tokens[tokens.length - 1] += segment;
    }
  }
  if (prefix && tokens.length > 0) tokens[tokens.length - 1] += prefix;
  return tokens;
}

/** Puts tiles back together as the language writes them. */
export function joinTokens(tokens: readonly string[], pack: LanguagePack = getActivePack()): string {
  return tokens.join(pack.sentences === 'segmented' ? '' : ' ');
}
