/** TASK-074: the reading layer over the active app's real bank (nothing to check without one). */
import { allEntries } from '../../src/data/wordbank';
import { getActivePack } from '../../src/languages';
import { bankReading } from '../../src/lib/reading/lookup';
import { rubyCells, blankCell } from '../../src/lib/reading/ruby';
import { tilePinyin } from '../../src/lib/reading/tiles';
import { buildCloze } from '../../src/lib/cloze';
import { sentenceTokens } from '../../src/lib/sentence';

describe('the reading layer of the active app', () => {
  const pack = getActivePack();

  it('pairs every example with its pronunciation, and grades every headword as typed', () => {
    if (!pack.reading) {
      expect(pack.pronunciation).toBe('ipa');
      return;
    }
    for (const { entry } of allEntries()) {
      const data = bankReading(entry.word)!;
      expect(data.pronunciation).toBe(entry.ipa);
      const cells = rubyCells(data.segments, data.examplePinyin, pack)!;
      expect(cells).not.toBeNull();
      // the cloze finds the cell it must hide, and it is the headword's
      const cloze = buildCloze(entry.example, entry.word, pack, entry.segments)!;
      expect(cells[blankCell(cells, entry.word, cloze.before)]?.word).toBe(entry.word);
      // every shuffled tile gets its pinyin
      const solution = sentenceTokens(entry.example, entry.segments, pack);
      expect(tilePinyin([...solution].reverse(), solution, cells)).not.toContain(undefined);
      expect(pack.reading.grade(entry.ipa, entry.syllables!)).toBe('exact');
    }
  });
});
