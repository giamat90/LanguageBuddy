/**
 * Pinyin on the phone (TASK-074): tones, typed answers, wrong spellings for tone choice. Pure.
 * It never cuts pinyin into syllables itself: the word bank does that (`Syllable[]`).
 * It must not import the language packs: the Chinese pack imports it.
 */

export interface Syllable {
  /** Lower-case, with its tone mark if it has one. */
  text: string;
  /** Other tones this syllable takes in speech (一, 不): accepted when typed, never offered as wrong. */
  alsoTyped: number[];
  /** Tones of the character's other readings: another word's sound, so never offered as wrong. */
  otherTones: number[];
}

/** 0 is the neutral tone. */
export type Tone = 0 | 1 | 2 | 3 | 4;

export type PinyinResult = 'exact' | 'missing_tones' | 'wrong_tone' | 'wrong';

/** What a language that writes a pronunciation in Latin letters offers to the exercises. */
export interface ReadingSupport {
  grade(typed: string, syllables: readonly Syllable[], sentenceForm?: string): PinyinResult;
  /** Latin writing (graded as a pronunciation) as opposed to the language's own characters. */
  isInput(typed: string): boolean;
  toneVariants(pronunciation: string, syllables: readonly Syllable[], rng: () => number): string[] | null;
  hint(syllables: readonly Syllable[]): { initial: string; count: number };
}

/** Combining marks of tones 1–4, in order. */
const MARKS = ['\u0304', '\u0301', '\u030c', '\u0300'];
const MARK = /[\u0304\u0301\u030c\u0300]/g;
const UMLAUT = '\u0308';
const SEPARATOR = /[\s'’-]/;

export function toneOf(s: string): Tone {
  const mark = s.normalize('NFD').match(MARK)?.[0];
  return (mark ? MARKS.indexOf(mark) + 1 : 0) as Tone;
}

/** Without the tone mark; the two dots of ü stay. */
export const stripTone = (s: string): string => s.normalize('NFD').replace(MARK, '').normalize('NFC');

/** The mark goes on a or e, on the o of "ou", otherwise on the last vowel. */
export function withTone(s: string, tone: Tone): string {
  const plain = stripTone(s);
  if (tone === 0) return plain;
  const lower = plain.toLowerCase();
  let at = lower.search(/[ae]/);
  if (at < 0) at = lower.indexOf('ou');
  for (let i = lower.length - 1; at < 0 && i >= 0; i--) {
    if ('iouü'.includes(lower[i])) at = i;
  }
  if (at < 0) return plain;
  return (plain.slice(0, at + 1) + MARKS[tone - 1] + plain.slice(at + 1)).normalize('NFC');
}

export function isPinyinInput(s: string): boolean {
  const plain = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /^[a-z0-9\s'’:-]+$/i.test(plain) && /[a-z]/i.test(plain);
}

/** One typed letter (with the tone mark written on it) or one typed tone number. */
type Unit = { letter: string; mark: number } | { digit: number };

/** Null when the text holds anything pinyin cannot. */
function unitsOf(typed: string): Unit[] | null {
  const text = typed
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s'’-]/g, '')
    .replace(/u:/g, 'ü')
    .replace(/v/g, 'ü')
    .normalize('NFD');
  const units: Unit[] = [];
  for (const char of text) {
    const last = units[units.length - 1];
    if (/[a-z]/.test(char)) units.push({ letter: char, mark: 0 });
    else if (/[0-9]/.test(char)) units.push({ digit: Number(char) });
    else if (!last || 'digit' in last) return null;
    else if (char === UMLAUT && last.letter === 'u') last.letter = 'ü';
    else if (MARKS.includes(char) && last.mark === 0) last.mark = MARKS.indexOf(char) + 1;
    else return null;
  }
  return units;
}

interface Read {
  /** Null: no tone written. 'conflict': two different ones. */
  tones: (number | null | 'conflict')[];
}

/** Matches the typed units against the syllables' letters; null when the letters differ. */
function read(typed: string, syllables: readonly Syllable[]): Read | null {
  const units = unitsOf(typed);
  if (!units) return null;
  // "wanr2": the number of an erhua word is usually written after the r.
  const last = units[units.length - 1];
  const before = units[units.length - 2];
  if (syllables[syllables.length - 1]?.text === 'r' && last && 'digit' in last && before && 'letter' in before
    && before.letter === 'r') {
    units.splice(units.length - 2, 2, last, before);
  }
  const tones: Read['tones'] = [];
  let i = 0;
  for (const syllable of syllables) {
    const letters = [...stripTone(syllable.text.toLowerCase())];
    let tone: number | null | 'conflict' = null;
    const write = (t: number) => {
      tone = tone === null || tone === t ? t : 'conflict';
    };
    for (const letter of letters) {
      const unit = units[i];
      if (!unit || 'digit' in unit) return null;
      // After j, q, x and y a written u sounds ü, so both spellings are right.
      const umlaut = letter === 'u' && unit.letter === 'ü' && 'jqxy'.includes(letters[0]);
      if (unit.letter !== letter && !umlaut) return null;
      if (unit.mark) write(unit.mark);
      i++;
    }
    const next = units[i];
    if (next && 'digit' in next) {
      if (next.digit > 5) return null;
      write(next.digit === 5 ? 0 : next.digit);
      i++;
    }
    tones.push(tone);
  }
  return i === units.length ? { tones } : null;
}

/**
 * `sentenceForm`: how the word is written in the sentence it was taken from (一 and 不 are written
 * as pronounced there); its tones are accepted too.
 */
export function gradePinyin(typed: string, syllables: readonly Syllable[], sentenceForm?: string): PinyinResult {
  const answer = read(typed, syllables);
  if (!answer || syllables.length === 0) return 'wrong';
  const inSentence = sentenceForm ? read(sentenceForm, syllables)?.tones : undefined;
  let missing = false;
  for (let i = 0; i < syllables.length; i++) {
    const own = toneOf(syllables[i].text);
    const tone = answer.tones[i];
    if (tone === null) {
      if (own !== 0) missing = true;
      continue;
    }
    const spoken = inSentence ? (inSentence[i] ?? 0) : own;
    if (tone === 'conflict' || ![own, spoken, ...syllables[i].alsoTyped].includes(tone)) return 'wrong_tone';
  }
  return missing ? 'missing_tones' : 'exact';
}

/** Where each syllable sits in the written pronunciation (capitals and separators stay there). */
function spansOf(pronunciation: string, syllables: readonly Syllable[]): [number, number][] | null {
  const text = pronunciation.normalize('NFC');
  const spans: [number, number][] = [];
  let at = 0;
  const skip = () => {
    while (at < text.length && SEPARATOR.test(text[at])) at++;
  };
  for (const syllable of syllables) {
    skip();
    const end = at + syllable.text.length;
    if (text.slice(at, end).toLowerCase() !== syllable.text) return null;
    spans.push([at, end]);
    at = end;
  }
  skip();
  return at === text.length ? spans : null;
}

/**
 * Two or three wrong spellings, each differing from the right one in the tone of one syllable.
 * Null when the word cannot offer two.
 */
export function toneVariants(
  pronunciation: string,
  syllables: readonly Syllable[],
  rng: () => number,
): string[] | null {
  const text = pronunciation.normalize('NFC');
  const spans = spansOf(text, syllables);
  if (!spans) return null;
  const candidates: string[] = [];
  syllables.forEach((syllable, i) => {
    const own = toneOf(syllable.text);
    if (own === 0) return; // a neutral syllable has no tone to confuse
    const [from, to] = spans[i];
    for (const tone of [1, 2, 3, 4] as const) {
      if (tone === own || syllable.alsoTyped.includes(tone) || syllable.otherTones.includes(tone)) continue;
      candidates.push(text.slice(0, from) + withTone(text.slice(from, to), tone) + text.slice(to));
    }
  });
  if (candidates.length < 2) return null;
  const picked: string[] = [];
  while (picked.length < 3 && candidates.length > 0) {
    picked.push(...candidates.splice(Math.floor(rng() * candidates.length), 1));
  }
  return picked;
}

export function pinyinHint(syllables: readonly Syllable[]): { initial: string; count: number } {
  const first = stripTone(syllables[0]?.text ?? '');
  const initial = first.match(/^(zh|ch|sh)/)?.[0] ?? first.charAt(0);
  // The erhua "r" is not a syllable of its own when spoken.
  return { initial, count: syllables.filter((s) => s.text !== 'r').length };
}

export const pinyinReading: ReadingSupport = {
  grade: gradePinyin,
  isInput: isPinyinInput,
  toneVariants,
  hint: pinyinHint,
};
