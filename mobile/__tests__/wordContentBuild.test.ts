// eslint-disable-next-line @typescript-eslint/no-var-requires
const lib = require('../scripts/wordbank-i18n-lib.cjs');
import { normalizeLocal } from '../src/lib/exercises/distractors';

const bank = {
  A1: [
    { word: 'Brot', part_of_speech: 'noun', meaning_en: 'bread', example: 'Ich kaufe das Brot.', example_en: 'I buy the bread.', cultural_note_en: 'Germany has over 3,000 types of bread.' },
    { word: 'Haus', part_of_speech: 'noun', meaning_en: 'house', example: 'Das Haus ist groß.', example_en: 'The house is big.', cultural_note_en: 'Houses often have a cellar.' },
    { word: 'gehen', part_of_speech: 'verb', meaning_en: 'to go', example: 'Wir gehen heute.', example_en: 'We go today.', cultural_note_en: 'Gehen forms many expressions.' },
  ],
  A2: [
    { word: 'essen', part_of_speech: 'verb', meaning_en: 'to eat', example: 'Wir essen um acht.', example_en: 'We eat at eight.', cultural_note_en: 'Dinner is early.' },
  ],
};

const good = (lang = 'fr') => [
  { level: 'A1', word: 'Brot', meaning: 'pain', example: "J'achète le pain.", note: "L'Allemagne a plus de 3 000 sortes de pain." },
  { level: 'A1', word: 'Haus', meaning: 'maison', example: 'La maison est grande.', note: 'Les maisons ont souvent une cave.' },
  { level: 'A1', word: 'gehen', meaning: 'aller', example: "Nous y allons aujourd'hui.", note: 'Gehen forme beaucoup d’expressions.' },
  { level: 'A2', word: 'essen', meaning: 'manger', example: 'Nous mangeons à huit heures.', note: 'Le dîner est tôt.' },
].map((r) => ({ ...r, lang }));

const run = (rows: any[], lang = 'fr', opts: any = {}) => lib.validateLanguage({ lang, rows, bank, ...opts });

describe('parseTsv', () => {
  it('reads five tab-separated columns', () => {
    const { rows, problems } = lib.parseTsv('A1\tBrot\tpain\tex\tnote\n', 'A1');
    expect(problems).toEqual([]);
    expect(rows).toEqual([{ level: 'A1', word: 'Brot', meaning: 'pain', example: 'ex', note: 'note', line: 1 }]);
  });

  it('skips blank lines and # comments', () => {
    const { rows } = lib.parseTsv('# c\n\nA1\tBrot\ta\tb\tc\n', 'A1');
    expect(rows).toHaveLength(1);
  });

  it('reports a wrong column count with its line number', () => {
    const { problems } = lib.parseTsv('A1\tBrot\tpain\tex\n', 'A1');
    expect(problems[0]).toMatch(/line 1.*4 columns/);
  });

  it('rejects a row filed under the wrong level', () => {
    const { problems } = lib.parseTsv('A2\tBrot\ta\tb\tc\n', 'A1');
    expect(problems[0]).toMatch(/level A2/);
  });

  it('copes with CRLF', () => {
    const { rows } = lib.parseTsv('A1\tBrot\ta\tb\tc\r\n', 'A1');
    expect(rows[0].note).toBe('c');
  });
});

describe('validateLanguage', () => {
  it('accepts a complete, clean language', () => {
    expect(run(good())).toEqual([]);
  });

  it('reports a missing entry', () => {
    expect(run(good().slice(1)).join('\n')).toMatch(/missing.*A1:Brot/);
  });

  it('reports an unknown entry', () => {
    const rows = [...good(), { level: 'A1', word: 'Katze', meaning: 'chat', example: 'x y', note: 'z' }];
    expect(run(rows).join('\n')).toMatch(/unknown.*A1:Katze/);
  });

  it('reports a duplicate entry', () => {
    expect(run([...good(), good()[0]]).join('\n')).toMatch(/duplicate.*A1:Brot/);
  });

  it('reports an empty field', () => {
    const rows = good();
    rows[0].note = '  ';
    expect(run(rows).join('\n')).toMatch(/A1:Brot.*note.*empty/);
  });

  it('reports a meaning longer than 60 characters', () => {
    const rows = good();
    rows[1].meaning = 'x'.repeat(61);
    expect(run(rows).join('\n')).toMatch(/A1:Haus.*meaning.*too long/);
  });

  it('reports an example or note far longer than its English source', () => {
    const rows = good();
    rows[0].example = 'x '.repeat(200);
    rows[1].note = 'y '.repeat(300);
    const out = run(rows).join('\n');
    expect(out).toMatch(/A1:Brot.*example.*too long/);
    expect(out).toMatch(/A1:Haus.*note.*too long/);
  });

  it('reports an example left as the source sentence', () => {
    const rows = good();
    rows[0].example = 'Ich kaufe das Brot.';
    expect(run(rows).join('\n')).toMatch(/A1:Brot.*example.*source/);
  });

  it('allows a meaning equal to the German word (loanwords)', () => {
    const rows = good();
    rows[0].meaning = 'Brot';
    expect(run(rows)).toEqual([]);
  });

  it.each(['TODO', '???', 'FIXME', 'XXX'])('rejects the leftover marker %s', (marker) => {
    const rows = good();
    rows[2].meaning = `aller ${marker}`;
    expect(run(rows).join('\n')).toMatch(/marker/);
  });

  it('rejects a tab or line break inside a field', () => {
    const rows = good();
    rows[0].note = 'a\tb';
    rows[1].example = 'a\nb';
    expect(run(rows).join('\n')).toMatch(/A1:Brot.*note.*control/);
    expect(run(rows).join('\n')).toMatch(/A1:Haus.*example.*control/);
  });

  it('requires the right script for non-Latin languages', () => {
    const rows = good('ru').map((r) => ({ ...r, meaning: 'bread', example: 'I buy', note: 'note' }));
    const out = run(rows, 'ru').join('\n');
    expect(out).toMatch(/A1:Brot.*meaning.*script/);
  });

  it('accepts Cyrillic for Russian and Han for Chinese', () => {
    const ru = good('ru').map((r, i) => ({ ...r, meaning: ['хлеб', 'дом', 'идти', 'есть'][i], example: 'Я покупаю хлеб.', note: 'Заметка о хлебе.' }));
    const zh = good('zh').map((r, i) => ({ ...r, meaning: ['面包', '房子', '去', '吃'][i], example: '我买面包。', note: '关于面包的说明。' }));
    expect(run(ru, 'ru')).toEqual([]);
    expect(run(zh, 'zh')).toEqual([]);
  });

  it('reports same-part-of-speech entries that read identically, when English tells them apart', () => {
    const two = {
      A1: [
        { word: 'gehen', part_of_speech: 'verb', meaning_en: 'to go', example: 'a', example_en: 'a b', cultural_note_en: 'n' },
        { word: 'eilen', part_of_speech: 'verb', meaning_en: 'to hurry', example: 'c', example_en: 'c d', cultural_note_en: 'n' },
      ],
    };
    const rows = [
      { level: 'A1', word: 'gehen', meaning: 'aller', example: 'x y', note: 'n' },
      { level: 'A1', word: 'eilen', meaning: 'Aller', example: 'x z', note: 'n' },
    ];
    const out = lib.validateLanguage({ lang: 'fr', rows, bank: two }).join('\n');
    expect(out).toMatch(/collision.*A1:gehen.*A1:eilen/);
  });

  it('does not report a collision when a qualifier tells the two apart', () => {
    const two = {
      A1: [
        { word: 'gehen', part_of_speech: 'verb', meaning_en: 'to go', example: 'a', example_en: 'a b', cultural_note_en: 'n' },
        { word: 'eilen', part_of_speech: 'verb', meaning_en: 'to hurry', example: 'c', example_en: 'c d', cultural_note_en: 'n' },
      ],
    };
    const rows = [
      { level: 'A1', word: 'gehen', meaning: 'aller', example: 'x y', note: 'n' },
      { level: 'A1', word: 'eilen', meaning: 'aller (vite)', example: 'x z', note: 'n' },
    ];
    expect(lib.validateLanguage({ lang: 'fr', rows, bank: two })).toEqual([]);
  });

  it('does not report a collision when English reads the same too (nothing to tell apart)', () => {
    const two = {
      A1: [
        { word: 'a', part_of_speech: 'noun', meaning_en: 'car', example: 'a', example_en: 'a b', cultural_note_en: 'n' },
        { word: 'b', part_of_speech: 'noun', meaning_en: 'Car', example: 'c', example_en: 'c d', cultural_note_en: 'n' },
      ],
    };
    const rows = [
      { level: 'A1', word: 'a', meaning: 'voiture', example: 'x y', note: 'n' },
      { level: 'A1', word: 'b', meaning: 'voiture', example: 'x z', note: 'n' },
    ];
    expect(lib.validateLanguage({ lang: 'fr', rows, bank: two })).toEqual([]);
  });

  it('does not report a collision between the same word listed in two levels', () => {
    const two = {
      A1: [{ word: 'essen', part_of_speech: 'verb', meaning_en: 'to eat', example: 'a', example_en: 'a b', cultural_note_en: 'n' }],
      A2: [{ word: 'essen', part_of_speech: 'verb', meaning_en: 'to eat (a meal)', example: 'c', example_en: 'c d', cultural_note_en: 'n' }],
    };
    const rows = [
      { level: 'A1', word: 'essen', meaning: 'manger', example: 'x y', note: 'n' },
      { level: 'A2', word: 'essen', meaning: 'manger', example: 'x z', note: 'n' },
    ];
    expect(lib.validateLanguage({ lang: 'fr', rows, bank: two })).toEqual([]);
  });

  it('can validate a subset of levels', () => {
    const rows = good().filter((r) => r.level === 'A1');
    expect(run(rows)).not.toEqual([]);
    expect(run(rows, 'fr', { levels: ['A1'] })).toEqual([]);
  });
});

describe('buildTable', () => {
  it('keys entries like entryId() and keeps the three fields in order', () => {
    const t = lib.buildTable(good());
    expect(t['A1:brot']).toEqual(['pain', "J'achète le pain.", "L'Allemagne a plus de 3 000 sortes de pain."]);
    expect(t['A2:essen'][0]).toBe('manger');
  });

  it('turns spaces in a word into dashes', () => {
    const t = lib.buildTable([{ level: 'B1', word: 'zum Beispiel', meaning: 'm', example: 'e', note: 'n' }]);
    expect(Object.keys(t)).toEqual(['B1:zum-beispiel']);
  });
});

describe('normalisation matches the app', () => {
  it.each(['Aller, ', 'clé (de porte)', '行く', 'जाना', 'идти', 'يذهب', 'Pain / Brot', "l'eau"])(
    '%s',
    (s) => expect(lib.normalizeLocal(s)).toBe(normalizeLocal(s)),
  );
});
