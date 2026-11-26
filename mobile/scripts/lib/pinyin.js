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

/** True when `pinyin` is exactly one allowed syllable per character of `word`, in order. */
function spells(pinyin, word, readings, cfg = {}) {
  const text = normalizePinyin(pinyin);
  const chars = [...word];
  const options = chars.map((c, i) => syllablesOf(c, i, readings, cfg));
  const seen = new Set();
  const match = (i, at) => {
    if (i === chars.length) return at === text.length;
    const key = `${i}:${at}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return options[i].some((s) => text.startsWith(s, at) && match(i + 1, at + s.length));
  };
  return chars.length > 0 && match(0, 0);
}

module.exports = { toneless, isSyllable, normalizePinyin, spells };
