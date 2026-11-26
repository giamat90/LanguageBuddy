/** TASK-074: the build splits a headword's pinyin into syllables; the validator requires it. */
import bank from '../src/data/wordbank/zh/A1.json';

const { splitPinyin, syllablesFor } = require('../scripts/lib/pinyin.js');
const { syllableProblems } = require('../scripts/lib/segmented.js');

const readings = new Map<string, string[]>([
  ['朋', ['péng']], ['友', ['yǒu', 'you']], ['好', ['hǎo', 'hào']], ['不', ['bù']], ['中', ['zhōng', 'zhòng']],
  ['国', ['guó']], ['觉', ['jué', 'jiào']], ['玩', ['wán']], ['儿', ['ér']],
]);
const cfg = { alternatives: { 不: ['bú'] }, erhua: '儿' };

describe('splitPinyin', () => {
  it('cuts the pinyin into one syllable per character', () => {
    expect(splitPinyin('péngyou', '朋友', readings, cfg)).toEqual(['péng', 'you']);
    expect(splitPinyin('Zhōng guó', '中国', readings, cfg)).toEqual(['zhōng', 'guó']);
    expect(splitPinyin('wánr', '玩儿', readings, cfg)).toEqual(['wán', 'r']);
    expect(splitPinyin('pengyo', '朋友', readings, cfg)).toBeNull();
  });
});

describe('syllablesFor', () => {
  it('adds the spoken alternatives and the other readings of the same syllable', () => {
    expect(syllablesFor('bù', '不', readings, cfg)).toEqual([{ text: 'bù', alsoTyped: [2], otherTones: [] }]);
    expect(syllablesFor('hǎo', '好', readings, cfg)).toEqual([{ text: 'hǎo', alsoTyped: [], otherTones: [4] }]);
    expect(syllablesFor('Zhōngguó', '中国', readings, cfg)[0]).toEqual({ text: 'zhōng', alsoTyped: [], otherTones: [4] });
    // jué is another reading, but not of the syllable "jiao"
    expect(syllablesFor('jiào', '觉', readings, cfg)[0].otherTones).toEqual([]);
    expect(syllablesFor('xx', '好', readings, cfg)).toBeNull();
  });
});

describe('syllableProblems', () => {
  const entry = { word: '朋友', ipa: 'péng you', syllables: [{ text: 'péng', alsoTyped: [], otherTones: [] }, { text: 'you', alsoTyped: [], otherTones: [] }] };
  it('accepts syllables that spell the pinyin', () => expect(syllableProblems(entry)).toEqual([]));
  it('reports missing or different syllables', () => {
    expect(syllableProblems({ ...entry, syllables: undefined })).toHaveLength(1);
    expect(syllableProblems({ ...entry, syllables: entry.syllables.slice(0, 1) })).toHaveLength(1);
    expect(syllableProblems({ ...entry, ipa: 'péngyǒu' })).toHaveLength(1);
  });
});

describe('the generated Chinese bank', () => {
  type E = { word: string; ipa: string; syllables: { text: string; alsoTyped: number[]; otherTones: number[] }[] };
  const words = bank as unknown as E[];
  it('has syllables for every headword', () => {
    for (const e of words) expect(syllableProblems(e)).toEqual([]);
  });
  it('knows 不 changes in speech and 好 has a second reading', () => {
    expect(words.find((e) => e.word === '不')!.syllables[0].alsoTyped).toEqual([2]);
    expect(words.find((e) => e.word === '好')!.syllables[0].otherTones).toEqual([4]);
  });
});
