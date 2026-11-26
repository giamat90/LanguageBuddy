/** TASK-072: pinyin syllables and "does this pinyin spell these characters". */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { toneless, isSyllable, spells } = require('../scripts/lib/pinyin.js');

const READINGS = new Map<string, string[]>([
  ['朋', ['péng']], ['友', ['yǒu']], ['北', ['běi']], ['京', ['jīng']], ['女', ['nǚ']], ['儿', ['ér']],
  ['一', ['yī']], ['点', ['diǎn']], ['不', ['bù']], ['好', ['hǎo', 'hào']],
]);
const CFG = { alternatives: { 一: ['yí', 'yì'], 不: ['bú'] }, erhua: '儿' };

describe('toneless', () => {
  it('removes the four tone marks and keeps the diaeresis', () => {
    expect(toneless('lǜ')).toBe('lü');
    expect(toneless('Běijīng')).toBe('Beijing');
    expect(toneless('ma')).toBe('ma');
  });
});

describe('isSyllable', () => {
  it.each(['shū', 'lǜ', 'nǚ', 'ér', 'ma', 'zhuāng', 'ǎo', 'yuè', 'qù', 'xióng', 'wǒ', 'zi', 'r'])('accepts %s', (s) => {
    expect(isSyllable(s)).toBe(true);
  });
  it.each(['', 'shūū', 'shǔǐ', 'xx', 'sh', 'běnshū', 'shu1', 'Shū ', '书', 'vv'])('rejects "%s"', (s) => {
    expect(isSyllable(s)).toBe(false);
  });
});

describe('spells', () => {
  it.each([
    ['péngyǒu', '朋友'], ['péngyou', '朋友'], ['Běijīng', '北京'], ["nǚ'ér", '女儿'], ['běi jīng', '北京'],
    ['yìdiǎnr', '一点儿'], ['yídiǎnr', '一点儿'], ['bú', '不'], ['bu', '不'], ['hào', '好'],
  ])('%s spells %s', (pinyin, word) => {
    expect(spells(pinyin, word, READINGS, CFG)).toBe(true);
  });

  it.each([
    ['pēngyou', '朋友'], ['péng', '朋友'], ['péngyouu', '朋友'], ['youpéng', '朋友'], ['bǔ', '不'],
    ['r', '儿'], ['diǎnr', '点'], ['hāo', '好'], ['shū', '书'],
  ])('%s does not spell %s', (pinyin, word) => {
    expect(spells(pinyin, word, READINGS, CFG)).toBe(false);
  });

  it('without the configured alternatives and erhua they are not accepted', () => {
    expect(spells('bú', '不', READINGS, {})).toBe(false);
    expect(spells('yīdiǎnr', '一点儿', READINGS, {})).toBe(false);
    expect(spells('yīdiǎnér', '一点儿', READINGS, {})).toBe(true);
  });
});
