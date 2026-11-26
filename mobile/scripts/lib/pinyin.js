/**
 * Pinyin as the word bank writes it (TASK-072): is this one syllable, and does a piece of pinyin
 * spell these characters? Pure CommonJS (node scripts and Jest).
 */
const TONE_MARKS = /[̄́̌̀]/g;

/** Without the four tone marks; the two dots of ü stay. */
const toneless = (s) => s.normalize('NFD').replace(TONE_MARKS, '').normalize('NFC');

const INITIALS = '(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?';
const FINALS = '(?:iang|iong|uang|ueng|ang|eng|ing|ong|ian|iao|uai|uan|üan|ai|ei|ao|ou|an|en|er|ia|ie|iu|in|ua|uo|ui|un|ue|üe|ün|a|o|e|i|u|ü)';
/** An initial and a final, or one of the few syllables that are a single consonant (r: erhua). */
const SYLLABLE = new RegExp(`^(?:${INITIALS}${FINALS}|r|n|ng|m)$`);

/** One lower-case syllable with at most one tone mark. */
function isSyllable(s) {
  if ((s.normalize('NFD').match(TONE_MARKS) ?? []).length > 1) return false;
  return SYLLABLE.test(toneless(s));
}

/** Lower-case, without the spaces, apostrophes and hyphens that only help the reader. */
const normalizePinyin = (s) => s.normalize('NFC').toLowerCase().replace(/[\s'’-]/g, '');

/** What may be written for one character: its readings, in the neutral tone too, and the configured extras. */
function syllablesOf(char, index, readings, cfg) {
  const out = new Set();
  for (const r of readings.get(char) ?? []) {
    out.add(r.normalize('NFC').toLowerCase());
    out.add(toneless(r).toLowerCase());
  }
  for (const r of cfg.alternatives?.[char] ?? []) out.add(r.normalize('NFC'));
  if (cfg.erhua === char && index > 0) out.add('r');
  return [...out];
}

/** `pinyin` cut into one allowed syllable per character of `word`, in order; null when it cannot be. */
function splitPinyin(pinyin, word, readings, cfg = {}) {
  const text = normalizePinyin(pinyin);
  const chars = [...word];
  const options = chars.map((c, i) => syllablesOf(c, i, readings, cfg));
  const seen = new Set();
  const match = (i, at) => {
    if (i === chars.length) return at === text.length ? [] : null;
    const key = `${i}:${at}`;
    if (seen.has(key)) return null;
    seen.add(key);
    for (const s of options[i]) {
      if (!text.startsWith(s, at)) continue;
      const rest = match(i + 1, at + s.length);
      if (rest) return [s, ...rest];
    }
    return null;
  };
  return chars.length > 0 ? match(0, 0) : null;
}

/** True when `pinyin` is exactly one allowed syllable per character of `word`, in order. */
const spells = (pinyin, word, readings, cfg = {}) => splitPinyin(pinyin, word, readings, cfg) !== null;

/** 1 to 4 by the tone mark, 0 for the neutral tone. */
function toneOf(s) {
  const mark = s.normalize('NFD').match(TONE_MARKS)?.[0];
  return mark ? ['\u0304', '\u0301', '\u030c', '\u0300'].indexOf(mark) + 1 : 0;
}

/**
 * What the app needs to know about each syllable of a headword (TASK-074): the other tones it takes
 * in speech (`alsoTyped`) and the tones that are other readings of the same character (`otherTones`),
 * which are therefore never offered as wrong answers.
 */
function syllablesFor(pinyin, word, readings, cfg = {}) {
  const parts = splitPinyin(pinyin, word, readings, cfg);
  if (!parts) return null;
  return [...word].map((char, i) => {
    const text = parts[i];
    const base = toneless(text);
    const tonesOf = (list) => [...new Set(list
      .map((s) => s.normalize('NFC').toLowerCase())
      .filter((s) => toneless(s) === base)
      .map(toneOf))]
      .filter((t) => t !== toneOf(text))
      .sort();
    const alsoTyped = tonesOf(cfg.alternatives?.[char] ?? []);
    const otherTones = tonesOf(readings.get(char) ?? []).filter((t) => !alsoTyped.includes(t));
    return { text, alsoTyped, otherTones };
  });
}

module.exports = { toneless, isSyllable, normalizePinyin, spells, splitPinyin, syllablesFor };
