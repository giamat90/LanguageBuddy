import { CEFR_ORDER, allEntries } from '../../data/wordbank';
import { shuffle, type Rng } from '../grammar';
import type { ReviewCard } from '../../services/reviewService';
import type { MultipleChoiceModel, MultipleChoiceOption } from './types';
import type { NativeLanguage } from '../../i18n/language';
import { getWordContent } from '../../i18n/wordContent';

/** A word-bank entry reduced to what multiple choice needs. */
export interface DistractorSource {
  word: string;
  article: string | null;
  partOfSpeech: string;
  cefrBand: string;
  topicDomain: string;
  meaningIt: string;
  meaningEn: string;
}

let pool: DistractorSource[] | null = null;

/** The whole bank (not just the learner's level: some word types are tiny per level). */
export function getDistractorPool(): DistractorSource[] {
  if (!pool) {
    pool = allEntries().map(({ level, entry }) => ({
      word: entry.word,
      article: entry.article,
      partOfSpeech: entry.part_of_speech,
      cefrBand: level,
      topicDomain: entry.topic_domain,
      meaningIt: entry.meaning_it,
      meaningEn: entry.meaning_en,
    }));
  }
  return pool;
}

let supply: Map<string, number> | null = null;

/** How many bank words share this part of speech: a cheap "can a question be built?" signal. */
export function distractorSupply(partOfSpeech: string): number {
  if (!supply) {
    supply = new Map();
    for (const c of getDistractorPool()) supply.set(c.partOfSpeech, (supply.get(c.partOfSpeech) ?? 0) + 1);
  }
  return supply.get(partOfSpeech) ?? 0;
}

const LETTER_RUN = /[a-zà-öø-ÿß]+/g;
const MIN_TOKEN = 3;

function letterRuns(s: string): string[] {
  return s.toLowerCase().match(LETTER_RUN) ?? [];
}

/** Lower-cased letter runs of 3+ characters; two meanings sharing one are too alike to be told apart. */
export function meaningTokens(s: string): Set<string> {
  return new Set(letterRuns(s).filter((t) => t.length >= MIN_TOKEN));
}

/** Letters only, single-spaced: the key used to detect duplicate meanings. */
export function normalizeMeaning(s: string): string {
  return letterRuns(s).join(' ');
}

/**
 * Key for comparing meanings in the learner's own language. Unlike `normalizeMeaning` it
 * keeps every script (that one only knows Latin letters, so CJK, Cyrillic, Devanagari and
 * Arabic would all collapse to an empty key). Parenthetical qualifiers are kept: they are
 * what tells two otherwise equal translations apart on screen.
 */
export function normalizeLocal(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s,.;:!?()[\]{}/\'"`’‘«»„“”。、，；：！？（）・·…–—-]+/g, ' ')
    .trim();
}

/** The translated meaning key for a word, or '' when the language has none (no extra rule then). */
export function localMeaningKey(lang: NativeLanguage | undefined, word: string, level?: string | null): string {
  if (!lang || lang === 'it' || lang === 'en') return '';
  const meaning = getWordContent(lang, word, level)?.[0];
  return meaning ? normalizeLocal(meaning) : '';
}

interface Cached {
  itTokens: Set<string>;
  enTokens: Set<string>;
  itKey: string;
  enKey: string;
}

const cache = new WeakMap<DistractorSource, Cached>();

function cached(c: DistractorSource): Cached {
  let hit = cache.get(c);
  if (!hit) {
    hit = {
      itTokens: meaningTokens(c.meaningIt),
      enTokens: meaningTokens(c.meaningEn),
      itKey: normalizeMeaning(c.meaningIt),
      enKey: normalizeMeaning(c.meaningEn),
    };
    cache.set(c, hit);
  }
  return hit;
}

function overlaps(a: Set<string>, b: Set<string>): boolean {
  for (const t of a) if (b.has(t)) return true;
  return false;
}

function bandIndex(band: string | null | undefined): number {
  return band ? CEFR_ORDER.indexOf(band as (typeof CEFR_ORDER)[number]) : -1;
}

/**
 * Picks `count` wrong answers for `card`: same part of speech (so capitalisation and
 * form give nothing away), never the card itself, no shared meaning token with the
 * answer in either language, no two options with the same meaning. Closer level and
 * topic score higher; `rng` adds jitter so repeats vary. Null when fewer than
 * `count` qualify.
 */
export function pickDistractors(
  card: ReviewCard,
  candidates: DistractorSource[],
  rng: Rng,
  count = 3,
  lang?: NativeLanguage,
): DistractorSource[] | null {
  const pos = card.partOfSpeech;
  if (!pos || !card.translationIt || !card.translationEn) return null;

  const answerIt = meaningTokens(card.translationIt);
  const answerEn = meaningTokens(card.translationEn);
  const target = card.word.toLowerCase();
  const band = bandIndex(card.cefrBand);

  const scored: { c: DistractorSource; score: number; at: number }[] = [];
  candidates.forEach((c, at) => {
    if (c.partOfSpeech !== pos || c.word.toLowerCase() === target) return;
    if (!c.meaningIt || !c.meaningEn) return;
    const k = cached(c);
    if (!k.itKey || !k.enKey) return;
    if (overlaps(k.itTokens, answerIt) || overlaps(k.enTokens, answerEn)) return;

    let score = rng() * 1.5;
    const gap = band >= 0 ? Math.abs(bandIndex(c.cefrBand) - band) : Infinity;
    if (gap === 0) score += 2;
    else if (gap === 1) score += 1;
    if (card.topicDomain && c.topicDomain === card.topicDomain) score += 1;
    scored.push({ c, score, at });
  });
  scored.sort((a, b) => b.score - a.score || a.at - b.at);

  const usedIt = new Set([normalizeMeaning(card.translationIt)]);
  const usedEn = new Set([normalizeMeaning(card.translationEn)]);
  // In a translated language two distinct Italian/English meanings can still read the same.
  const usedLocal = new Set<string>();
  const answerLocal = localMeaningKey(lang, card.word, card.cefrBand);
  if (answerLocal) usedLocal.add(answerLocal);
  const picked: DistractorSource[] = [];
  for (const { c } of scored) {
    const k = cached(c);
    if (usedIt.has(k.itKey) || usedEn.has(k.enKey)) continue;
    const local = localMeaningKey(lang, c.word, c.cefrBand);
    if (local && usedLocal.has(local)) continue;
    usedIt.add(k.itKey);
    usedEn.add(k.enKey);
    if (local) usedLocal.add(local);
    picked.push(c);
    if (picked.length === count) return picked;
  }
  return null;
}

function toOption(
  word: string,
  article: string | null,
  meaningIt: string,
  meaningEn: string,
  cefrBand: string | null | undefined,
): MultipleChoiceOption {
  return {
    id: `${article ? `${article} ` : ''}${word}`.toLowerCase(),
    word,
    article,
    meaningIt,
    meaningEn,
    cefrBand,
  };
}

/** Four shuffled options (the card plus three distractors) and the direction to ask in. */
export function buildMultipleChoice(
  card: ReviewCard,
  candidates: DistractorSource[],
  rng: Rng,
  lang?: NativeLanguage,
): MultipleChoiceModel | null {
  const distractors = pickDistractors(card, candidates, rng, 3, lang);
  if (!distractors || !card.translationIt || !card.translationEn) return null;

  const correct = toOption(card.word, card.article, card.translationIt, card.translationEn, card.cefrBand);
  const options = shuffle(
    [correct, ...distractors.map((d) => toOption(d.word, d.article, d.meaningIt, d.meaningEn, d.cefrBand))],
    rng,
  );
  const direction = card.timesSeen <= 1 ? 'to_native' : rng() < 0.5 ? 'to_native' : 'to_german';

  return {
    kind: 'multiple_choice',
    card,
    direction,
    options,
    correctIndex: options.findIndex((o) => o.id === correct.id),
  };
}
