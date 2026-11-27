/** TASK-074: pinyin tones, typed answers, wrong spellings for tone choice, hint. */
import {
  toneOf, stripTone, withTone, isPinyinInput, gradePinyin, toneVariants, pinyinHint, pinyinReading, type Syllable,
} from '../src/lib/reading/pinyin';
import bank from '../src/data/wordbank/zh/A1.json';

const s = (text: string, alsoTyped: number[] = [], otherTones: number[] = []): Syllable => ({ text, alsoTyped, otherTones });
const pengyou = [s('péng'), s('you')];
const seeded = (seed: number) => {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
};

describe('tones', () => {
  it('reads the tone of a syllable', () => {
    expect(['mā', 'má', 'mǎ', 'mà', 'ma', 'lǜ', 'nǚ', 'lü'].map(toneOf)).toEqual([1, 2, 3, 4, 0, 4, 3, 0]);
  });
  it('strips the tone and keeps the dots of ü', () => {
    expect(stripTone('lǜ')).toBe('lü');
    expect(stripTone('Zhōng')).toBe('Zhong');
    expect(stripTone('ma')).toBe('ma');
  });
  it.each([
    ['hao', 3, 'hǎo'], ['mei', 2, 'méi'], ['gou', 4, 'gòu'], ['liu', 4, 'liù'], ['gui', 4, 'guì'],
    ['xiong', 2, 'xióng'], ['lü', 4, 'lǜ'], ['nüe', 4, 'nüè'], ['Zhong', 1, 'Zhōng'], ['hǎo', 1, 'hāo'], ['hǎo', 0, 'hao'],
  ])('marks %s with tone %i as %s', (text, tone, out) => {
    expect(withTone(text, tone as 0)).toBe(out);
  });
});

describe('isPinyinInput', () => {
  it('knows Latin writing from characters', () => {
    for (const ok of ['pengyou', 'péng you', "xi'an", 'peng2you5', 'lv4', 'lu:4', 'Zhōng-guó']) expect(isPinyinInput(ok)).toBe(true);
    for (const no of ['朋友', 'péng友', '', '   ', '123']) expect(isPinyinInput(no)).toBe(false);
  });
});

describe('gradePinyin', () => {
  it.each([
    ['péngyou', 'exact'], ['peng2you', 'exact'], ['peng2you5', 'exact'], ['peng2you0', 'exact'], ['PÉNG YOU', 'exact'],
    ['  péng-you ', 'exact'], ["peng2'you", 'exact'],
    ['pengyou', 'missing_tones'],
    ['pēngyou', 'wrong_tone'], ['peng4you', 'wrong_tone'], ['péngyǒu', 'wrong_tone'], ['peng2you3', 'wrong_tone'], ['péng3you', 'wrong_tone'],
    ['pengyo', 'wrong'], ['pengyouu', 'wrong'], ['bengyou', 'wrong'], ['', 'wrong'], ['朋友', 'wrong'], ['p2engyou', 'wrong'],
  ])('%s for 朋友 is %s', (typed, result) => {
    expect(gradePinyin(typed, pengyou)).toBe(result);
  });

  it('counts tones written on only some syllables as missing', () => {
    const china = [s('zhōng'), s('guó')];
    expect(gradePinyin('zhong1guo', china)).toBe('missing_tones');
    expect(gradePinyin('zhongguó', china)).toBe('missing_tones');
    expect(gradePinyin('zhong4guo', china)).toBe('wrong_tone');
    expect(gradePinyin('zhong1guo2', china)).toBe('exact');
  });

  it('accepts a tone that changes in speech, and the one written in the sentence', () => {
    const bu = [s('bù', [2])];
    expect(gradePinyin('bu4', bu)).toBe('exact');
    expect(gradePinyin('bú', bu)).toBe('exact');
    expect(gradePinyin('bu3', bu)).toBe('wrong_tone');
    expect(gradePinyin('yi4', [s('yī')], 'yì')).toBe('exact');
    expect(gradePinyin('yi2', [s('yī')], 'yì')).toBe('wrong_tone');
  });

  it('does not accept another reading of the character', () => {
    expect(gradePinyin('hao4', [s('hǎo', [], [4])])).toBe('wrong_tone');
  });

  it('takes the number of an erhua word before or after the r', () => {
    const wanr = [s('wán'), s('r')];
    for (const ok of ['wánr', 'wan2r', 'wanr2']) expect(gradePinyin(ok, wanr)).toBe('exact');
    expect(gradePinyin('wanr3', wanr)).toBe('wrong_tone');
    expect(gradePinyin('wanr', wanr)).toBe('missing_tones');
  });

  it('types ü as v or u:, and as ü after j q x y', () => {
    const lv = [s('lǜ')];
    for (const ok of ['lv4', 'lu:4', 'lǜ']) expect(gradePinyin(ok, lv)).toBe('exact');
    expect(gradePinyin('lu4', lv)).toBe('wrong');
    expect(gradePinyin('qv4', [s('qù')])).toBe('exact');
    expect(gradePinyin('qu4', [s('qù')])).toBe('exact');
  });
});

describe('toneVariants', () => {
  it('changes one tone at a time and keeps capitals', () => {
    const out = toneVariants('Zhōngguó', [s('zhōng', [], [4]), s('guó')], seeded(1))!;
    expect(out).toHaveLength(3);
    for (const v of out) {
      expect(v).not.toBe('Zhōngguó');
      expect(v.startsWith('Z')).toBe(true);
      expect(stripTone(v)).toBe('Zhongguo');
      expect(v.startsWith('Zhòng')).toBe(false);
    }
    expect(new Set(out).size).toBe(3);
  });

  it('keeps spaces and leaves a neutral syllable alone', () => {
    for (const v of toneVariants('péng you', pengyou, seeded(2))!) expect(v.endsWith(' you')).toBe(true);
  });

  it('offers two when another reading takes the third, none when fewer than two are left', () => {
    expect(toneVariants('hǎo', [s('hǎo', [], [4])], seeded(3))!.sort()).toEqual(['háo', 'hāo']);
    expect(toneVariants('ma', [s('ma')], seeded(3))).toBeNull();
    expect(toneVariants('hǎo', [s('hǎo', [2], [4])], seeded(3))).toBeNull();
    expect(toneVariants('x', [s('hǎo')], seeded(3))).toBeNull(); // syllables that do not spell it
  });

  it('never offers a valid reading, over the whole bank', () => {
    let built = 0;
    for (const entry of bank as unknown as { word: string; ipa: string; syllables: Syllable[] }[]) {
      expect(entry.syllables).toHaveLength([...entry.word].length);
      for (let seed = 0; seed < 20; seed++) {
        const variants = toneVariants(entry.ipa, entry.syllables, seeded(seed));
        if (!variants) continue;
        built++;
        expect(new Set([entry.ipa, ...variants]).size).toBe(variants.length + 1);
        for (const v of variants) expect(['wrong_tone', 'missing_tones']).toContain(gradePinyin(v, entry.syllables));
      }
    }
    expect(built).toBeGreaterThan(600);
  });
});

describe('pinyinHint', () => {
  it('gives the first initial and the number of syllables', () => {
    expect(pinyinHint(pengyou)).toEqual({ initial: 'p', count: 2 });
    expect(pinyinHint([s('zhōng'), s('guó')])).toEqual({ initial: 'zh', count: 2 });
    expect(pinyinHint([s('shén'), s('me')])).toEqual({ initial: 'sh', count: 2 });
    expect(pinyinHint([s('ài')])).toEqual({ initial: 'a', count: 1 });
  });
});

it('is offered as one capability', () => {
  expect(Object.keys(pinyinReading).sort()).toEqual(['citations', 'grade', 'hint', 'isInput', 'toneVariants']);
});
