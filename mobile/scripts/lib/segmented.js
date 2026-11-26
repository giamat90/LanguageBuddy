/**
 * Checks of a language written without spaces (TASK-072), driven by its language.json: sentences cut
 * into words, pinyin, measure words, stages and the character table. Pure CommonJS; every function
 * returns a list of problem texts.
 */
const { isSyllable, normalizePinyin, spells, toneless } = require('./pinyin.js');

/** One or more Chinese characters: the same range as the `letters` of the app's pack. */
const HAN_WORD = /^[㐀-鿿]+$/;
/** One character of the Han script, radicals included (components and look-alikes). */
const HAN_CHAR = /^\p{Script=Han}$/u;

const isHanWord = (s) => HAN_WORD.test(s);
const wordsOf = (entry) => (Array.isArray(entry.segments) ? entry.segments.filter(isHanWord) : []);

/** `vocabulary`: the headwords of this level and the ones below it. */
function sentenceProblems(entry, cfg, vocabulary) {
  const segments = entry.segments;
  if (!Array.isArray(segments) || segments.join('') !== entry.example) return ['segments must spell the example'];
  const out = [];
  const marks = new Set([...cfg.punctuation]);
  for (const s of segments) {
    if (!isHanWord(s) && !(s !== '' && [...s].every((c) => marks.has(c)))) {
      out.push(`segment "${s}" is neither a Chinese word nor listed punctuation`);
    }
  }
  const last = segments.join('').replace(/[”’》）]+$/, '').slice(-1);
  if (!cfg.end.includes(last)) out.push(`example must end with one of ${cfg.end}`);
  const words = wordsOf(entry);
  if (words.length < cfg.minWords || words.length > cfg.maxWords) {
    out.push(`example has ${words.length} words (${cfg.minWords}–${cfg.maxWords})`);
  }
  const uses = words.filter((w) => w === entry.word).length;
  if (uses !== 1) out.push(`example must contain the headword exactly once (found ${uses})`);
  const allowed = new Set(cfg.allow ?? []);
  for (const w of new Set(words)) {
    if (!vocabulary.has(w) && !allowed.has(w)) out.push(`"${w}" in the example is not a headword and not in "allow"`);
  }
  return out;
}

/** Characters of the entry that the table must have: headword, sentence and measure words. */
function charactersOf(entry) {
  const measures = [entry.measure, ...(entry.measure_also ?? [])].filter((m) => m && m !== 'none');
  const text = [entry.word, ...wordsOf(entry), ...measures].join('');
  return [...new Set([...text])].filter((c) => HAN_WORD.test(c));
}

function pinyinProblems(entry, readings, cfg) {
  const missing = charactersOf(entry).filter((c) => !readings.has(c));
  if (missing.length) return missing.map((c) => `no character row for ${c}`);
  const out = [];
  if (!isHanWord(entry.word)) out.push('the headword must be written in Chinese characters');
  else if (!spells(entry.ipa, entry.word, readings, cfg)) out.push(`pinyin "${entry.ipa}" does not spell ${entry.word}`);

  const words = wordsOf(entry);
  const tokens = String(entry.example_pinyin ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length !== words.length) {
    out.push(`example_pinyin has ${tokens.length} pinyin words for ${words.length} words`);
    return out;
  }
  // A word whose sound changes with its neighbours (一, 不) may be written with another tone.
  const shifts = [...entry.word].some((c) => cfg.alternatives?.[c]);
  const key = (s) => (shifts ? toneless(normalizePinyin(s)) : normalizePinyin(s));
  words.forEach((word, i) => {
    if (!spells(tokens[i], word, readings, cfg)) out.push(`example pinyin "${tokens[i]}" does not spell ${word}`);
    else if (word === entry.word && key(tokens[i]) !== key(entry.ipa)) {
      out.push(`example pinyin "${tokens[i]}" reads the headword differently from "${entry.ipa}"`);
    }
  });
  return out;
}

/** `list`: the measure words of the language. A noun names one of them, or "none". */
function measureProblems(entry, list) {
  const also = entry.measure_also ?? [];
  if (entry.part_of_speech !== 'noun') {
    return entry.measure || also.length ? ['only nouns may have a measure word'] : [];
  }
  const out = [];
  if (!entry.measure) out.push('nouns need a measure word (or "none")');
  else if (entry.measure !== 'none' && !list.includes(entry.measure)) out.push(`measure word "${entry.measure}" is not listed`);
  for (const m of also) {
    if (!list.includes(m) || m === entry.measure) out.push(`measure_also "${m}" must be listed and differ from the measure word`);
  }
  return out;
}

const stageProblems = (entry, stages) =>
  stages.includes(entry.stage) ? [] : [`stage must be one of ${stages.join(', ')}`];

/** The rows of characters.json. */
function characterProblems(rows) {
  const out = [];
  const seen = new Set();
  rows.forEach((row) => {
    const at = `character ${row.char}`;
    if (!HAN_WORD.test(row.char) || [...row.char].length !== 1) {
      out.push(`${at}: must be one Chinese character`);
      return;
    }
    if (seen.has(row.char)) out.push(`${at}: duplicate row`);
    seen.add(row.char);
    if (!row.pinyin?.length) out.push(`${at}: needs a reading`);
    for (const r of row.pinyin ?? []) {
      if (r !== r.toLowerCase() || !isSyllable(r)) out.push(`${at}: reading "${r}" is not a pinyin syllable`);
    }
    for (const f of ['meaning_en', 'meaning_it']) if (!row[f]?.trim()) out.push(`${at}: ${f} is empty`);
    if (row.parts.some((p) => !HAN_CHAR.test(p.char ?? '') || !p.en || !p.it)) {
      out.push(`${at}: parts, parts_en and parts_it must have one entry each per component`);
    }
    if (new Set(row.lookalikes).size !== row.lookalikes.length
      || row.lookalikes.some((c) => !HAN_CHAR.test(c) || c === row.char)) {
      out.push(`${at}: look-alikes must be other single characters, each once`);
    }
    if (!row.trick_en !== !row.trick_it) out.push(`${at}: a memory trick needs both languages`);
  });
  return out;
}

module.exports = {
  isHanWord, wordsOf, sentenceProblems, pinyinProblems, measureProblems, stageProblems, characterProblems,
};
