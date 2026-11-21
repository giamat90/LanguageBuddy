import { WORD_BANK, CEFR_ORDER, allEntries, entryId } from '../src/data/wordbank';
import { WORD_CONTENT_LOADERS } from '../src/i18n/wordContentLoaders';

describe('German word bank layout (TASK-042)', () => {
  it('keeps the level sizes', () => {
    expect(CEFR_ORDER.map((l) => WORD_BANK[l].length)).toEqual([375, 379, 372, 419, 375, 359]);
    expect(allEntries()).toHaveLength(2279);
  });

  it('uses the neutral field name: every entry has `example`, none has `example_de`', () => {
    for (const { entry } of allEntries()) {
      expect(typeof (entry as any).example).toBe('string');
      expect((entry as any).example.trim()).not.toBe('');
      expect('example_de' in entry).toBe(false);
    }
  });

  it.each([
    ['A1', 0, 'Brot', 'das', 'pane', 'Ich kaufe das Brot beim Bäcker.'],
    ['A2', 0, 'einkaufen', null, 'fare la spesa', 'Ich kaufe heute Abend ein.'],
    ['B1', 0, 'Heimweh', 'das', 'nostalgia di casa', 'Nach zwei Monaten bekam sie starkes Heimweh.'],
    ['B2', 0, 'Weltanschauung', 'die', 'visione del mondo', 'Ihre Weltanschauung hat sich nach der Reise verändert.'],
    ['C1', 0, 'Zeitgeist', 'der', 'spirito del tempo', 'Dieser Roman trifft den Zeitgeist perfekt.'],
    ['C2', 0, 'Torschlusspanik', 'die', 'ansia da ultima occasione', 'Mit Mitte dreißig begann sie, eine leichte Torschlusspanik zu verspüren.'],
    ['A1', -1, 'gern', null, 'volentieri / (mi) piace', 'Ich trinke gern Tee am Morgen.'],
    ['C2', -1, 'Torwächterfunktion', 'die', 'funzione di controllo (guardiano dell\'accesso)', 'Redaktionen übten früher eine wichtige Torwächterfunktion aus.'],
  ] as const)('%s entry %i is unchanged', (level, at, word, article, meaningIt, example) => {
    const list = WORD_BANK[level];
    const e = list.at(at)! as any;
    expect([e.word, e.article, e.meaning_it, e.example]).toEqual([word, article, meaningIt, example]);
  });

  it('keeps ids and the two levels of "essen"', () => {
    expect(entryId('A1', WORD_BANK.A1[0])).toBe('A1:brot');
    expect(WORD_BANK.A1.some((e) => e.word === 'essen')).toBe(true);
    expect(WORD_BANK.A2.some((e) => e.word === 'essen')).toBe(true);
  });

  it('resolves the translation tables of the 11 languages for the active bank', () => {
    const langs = Object.keys(WORD_CONTENT_LOADERS).sort();
    expect(langs).toEqual(['ar', 'es', 'fr', 'hi', 'ja', 'pl', 'pt', 'ru', 'tr', 'uk', 'zh']);
    for (const l of langs) {
      const table = (WORD_CONTENT_LOADERS as any)[l]();
      expect(table['A1:brot']).toHaveLength(3);
      expect(Object.keys(table)).toHaveLength(2279);
    }
  });
});
