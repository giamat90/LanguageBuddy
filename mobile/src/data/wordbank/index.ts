import a1 from './A1.json';
import a2 from './A2.json';
import b1 from './B1.json';
import b2 from './B2.json';
import c1 from './C1.json';
import c2 from './C2.json';

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const CEFR_ORDER: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export interface WordBankEntry {
  word: string;
  article: string | null;
  part_of_speech: string;
  ipa: string;
  meaning_en: string;
  meaning_it: string;
  example_de: string;
  example_it: string;
  cultural_note: string;
  grammar_angle: string;
  topic_domain: string;
  cefr_band: string;
  session_scenario: string;
  example_en: string;
  cultural_note_en: string;
}

/**
 * Bump this whenever the bundled JSON changes so the app re-seeds new words into
 * the local DB on next launch (see src/data/seed.ts).
 */
export const WORDBANK_VERSION = '2026-09-12.1';

export const WORD_BANK: Record<CefrLevel, WordBankEntry[]> = {
  A1: a1 as WordBankEntry[],
  A2: a2 as WordBankEntry[],
  B1: b1 as WordBankEntry[],
  B2: b2 as WordBankEntry[],
  C1: c1 as WordBankEntry[],
  C2: c2 as WordBankEntry[],
};

/** Stable per-entry id, derived so JSON stays free of bookkeeping fields. */
export function entryId(level: CefrLevel, entry: WordBankEntry): string {
  return `${level}:${entry.word.toLowerCase().replace(/\s+/g, '-')}`;
}

export function allEntries(): { level: CefrLevel; entry: WordBankEntry }[] {
  return CEFR_ORDER.flatMap((level) =>
    WORD_BANK[level].map((entry) => ({ level, entry })),
  );
}
