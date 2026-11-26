/** TASK-074: when pinyin shows, and the stored setting. */
import { PINYIN_MODES, showInExercise, showWhenReading, coercePinyinMode } from '../src/lib/reading/visibility';
import { pinyinQuality } from '../src/lib/exercises/quality';

describe('when pinyin shows', () => {
  it.each([
    ['auto', 'new', true], ['auto', 'learning', false], ['auto', 'strong', false],
    ['always', 'new', true], ['always', 'learning', true], ['always', 'strong', true],
    ['tap', 'new', false], ['tap', 'learning', false], ['tap', 'strong', false],
  ] as const)('exercise, %s, %s word: %s', (mode, tier, shown) => {
    expect(showInExercise(mode, tier)).toBe(shown);
  });

  it('reading screens show it unless the learner asked for taps', () => {
    expect(PINYIN_MODES.map(showWhenReading)).toEqual([true, true, false]);
    expect([...PINYIN_MODES]).toEqual(['auto', 'always', 'tap']);
  });

  it('an unknown stored value means auto', () => {
    for (const bad of [undefined, null, '', 'never', 3]) expect(coercePinyinMode(bad)).toBe('auto');
    expect(coercePinyinMode('tap')).toBe('tap');
  });

  it('a peek caps the credit like the hint, and never raises it', () => {
    expect(pinyinQuality(1, false)).toBe(1);
    expect(pinyinQuality(0.9, true)).toBe(0.6);
    expect(pinyinQuality(0.4, true)).toBe(0.4);
    expect(pinyinQuality(0, true)).toBe(0);
  });
});

describe('useReadingSettingsStore', () => {
  it('starts on auto and remembers the choice', () => {
    const first = require('../src/store/useReadingSettingsStore').useReadingSettingsStore;
    expect(first.getState().pinyinMode).toBe('auto');
    first.getState().setPinyinMode('tap');
    expect(first.getState().pinyinMode).toBe('tap');
    const { MMKV } = require('react-native-mmkv');
    expect(new MMKV({ id: 'reading-settings' }).getString('readingPinyinMode')).toBe('tap');
  });
});
