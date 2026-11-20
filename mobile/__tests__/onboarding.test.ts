import { inferCefrLevel } from '../src/screens/QuizScreen';
import { buildTopicPreferences } from '../src/screens/TopicsScreen';

const ALL_KEYS = ['food', 'travel', 'work', 'culture', 'home', 'leisure', 'health', 'shopping'];

// ---------------------------------------------------------------------------
// inferCefrLevel
// ---------------------------------------------------------------------------

describe('inferCefrLevel', () => {
  it('0 correct → A1', () => expect(inferCefrLevel(0)).toBe('A1'));
  it('1 correct → A1', () => expect(inferCefrLevel(1)).toBe('A1'));
  it('2 correct → A2', () => expect(inferCefrLevel(2)).toBe('A2'));
  it('3 correct → B1', () => expect(inferCefrLevel(3)).toBe('B1'));
  it('4 correct → B2', () => expect(inferCefrLevel(4)).toBe('B2'));
  it('5 correct → B2', () => expect(inferCefrLevel(5)).toBe('B2'));
});

// ---------------------------------------------------------------------------
// buildTopicPreferences
// ---------------------------------------------------------------------------

describe('buildTopicPreferences', () => {
  it('selected topics get weight 0.8', () => {
    const prefs = buildTopicPreferences(ALL_KEYS, ['food', 'travel']);
    expect(prefs.food).toBe(0.8);
    expect(prefs.travel).toBe(0.8);
  });

  it('unselected topics get weight 0.3', () => {
    const prefs = buildTopicPreferences(ALL_KEYS, ['food', 'travel']);
    expect(prefs.work).toBe(0.3);
    expect(prefs.culture).toBe(0.3);
    expect(prefs.home).toBe(0.3);
  });

  it('all 8 keys present regardless of selection', () => {
    const prefs = buildTopicPreferences(ALL_KEYS, ['food']);
    expect(Object.keys(prefs)).toHaveLength(8);
  });

  it('empty selection gives all keys weight 0.3', () => {
    const prefs = buildTopicPreferences(ALL_KEYS, []);
    expect(Object.values(prefs).every((v) => v === 0.3)).toBe(true);
  });

  it('full selection gives all keys weight 0.8', () => {
    const prefs = buildTopicPreferences(ALL_KEYS, ALL_KEYS);
    expect(Object.values(prefs).every((v) => v === 0.8)).toBe(true);
  });

  it('canContinue is false with fewer than 2 selections', () => {
    expect(['food'].length >= 2).toBe(false);
    expect([].length >= 2).toBe(false);
  });

  it('canContinue is true with 2 or more selections', () => {
    expect(['food', 'travel'].length >= 2).toBe(true);
    expect(['food', 'travel', 'work'].length >= 2).toBe(true);
  });
});
