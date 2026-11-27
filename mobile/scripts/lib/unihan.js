/**
 * Readings of Chinese characters from Unicode's Unihan_Readings.txt (TASK-077), to check the bank's
 * own character table against an independent source. The file is downloaded by hand and never
 * committed. Pure CommonJS.
 */
const { toneless } = require('./pinyin.js');

// Each field writes its readings differently: "yī", "21028.010:hǎo,hào", "jí(120)".
const FIELDS = {
  kMandarin: (value) => value.split(/\s+/),
  kHanyuPinyin: afterColon,
  kXHC1983: afterColon,
  kTGHZ2013: afterColon,
  kHanyuPinlu: (value) => value.split(/\s+/).map((v) => v.replace(/\(.*\)$/, '')),
};

function afterColon(value) {
  return value.split(/\s+/).flatMap((v) => v.slice(v.indexOf(':') + 1).split(','));
}

/** Map of character to the set of its readings. */
function parseReadings(text) {
  const out = new Map();
  for (const line of text.split(/\r?\n/)) {
    const [code, field, value] = line.split('\t');
    if (!value || !code.startsWith('U+') || !Object.hasOwn(FIELDS, field)) continue;
    const char = String.fromCodePoint(parseInt(code.slice(2), 16));
    if (!out.has(char)) out.set(char, new Set());
    for (const reading of FIELDS[field](value)) {
      if (reading) out.get(char).add(reading.normalize('NFC').toLowerCase());
    }
  }
  return out;
}

/**
 * `rows`: the rows of characters.json. A reading without a tone mark is the neutral tone, which the
 * dictionaries behind Unihan often leave out: it is fine when the syllable exists in any tone.
 */
function readingProblems(rows, unihan) {
  const out = [];
  for (const { char, pinyin } of rows) {
    const known = unihan.get(char);
    if (!known) {
      out.push(`${char}: not in Unihan`);
      continue;
    }
    const bases = new Set([...known].map(toneless));
    for (const raw of pinyin) {
      const reading = raw.normalize('NFC').toLowerCase();
      const neutral = toneless(reading) === reading;
      if (!known.has(reading) && !(neutral && bases.has(reading))) {
        out.push(`${char}: reading "${raw}" is not in Unihan (it has ${[...known].join(', ')})`);
      }
    }
  }
  return out;
}

module.exports = { parseReadings, readingProblems };
