/** Reading data of a bank word, for the screens that show a saved copy of it (TASK-074). */
import { allEntries } from '../../data/wordbank';

export interface BankReading {
  pronunciation: string;
  example: string;
  segments: string[] | null;
  /** One pronunciation word per word of the example. */
  examplePinyin: string[] | null;
}

/** The pronunciation words of a bank row. */
export const pinyinWords = (value: string | undefined): string[] | null =>
  value ? value.trim().split(/\s+/) : null;

let index: Map<string, BankReading> | null = null;

export function bankReading(word: string): BankReading | null {
  if (!index) {
    index = new Map();
    for (const { entry } of allEntries()) {
      index.set(entry.word.toLowerCase(), {
        pronunciation: entry.ipa,
        example: entry.example,
        segments: entry.segments ?? null,
        examplePinyin: pinyinWords(entry.example_pinyin),
      });
    }
  }
  return index.get(word.toLowerCase()) ?? null;
}
