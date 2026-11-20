import {
  TOPICS, TOPIC_KEYS, activeTopicKeys, isActiveTopic, buildTopicPreferences, toggleTopic, topicCountsForLevel,
} from '../src/lib/topics';
import { WORD_BANK, CEFR_ORDER } from '../src/data/wordbank';
import itStrings from '../src/i18n/it';

const only = (...on: string[]) => buildTopicPreferences(TOPIC_KEYS, on);

describe('topic list', () => {
  it('covers every topic_domain used by the word bank, and nothing else', () => {
    const inBank = new Set(CEFR_ORDER.flatMap((l) => WORD_BANK[l].map((e) => e.topic_domain)));
    expect([...inBank].sort()).toEqual([...TOPIC_KEYS].sort());
  });
  it('has an Italian label for every topic', () => {
    for (const tp of TOPICS) expect(itStrings[tp.labelKey]).toBeTruthy();
  });
});

describe('activeTopicKeys / isActiveTopic', () => {
  it('uses the >= 0.5 convention of the onboarding screen', () => {
    expect(activeTopicKeys(only('food', 'work')).sort()).toEqual(['food', 'work']);
    expect(isActiveTopic(only('food'), 'food')).toBe(true);
    expect(isActiveTopic(only('food'), 'work')).toBe(false);
  });
  it('treats empty, missing or all-inactive preferences as "every topic"', () => {
    const cases = [{}, null, undefined, only(), { food: 'x' } as unknown as Record<string, number>, { food: NaN }];
    for (const prefs of cases) {
      expect(activeTopicKeys(prefs).sort()).toEqual([...TOPIC_KEYS].sort());
    }
  });
  it('ignores keys that are not known topics', () => {
    expect(activeTopicKeys({ food: 0.8, bogus: 0.9 })).toEqual(['food']);
    expect(activeTopicKeys({ bogus: 0.9 }).length).toBe(TOPIC_KEYS.length);
  });
});

describe('toggleTopic', () => {
  it('switches a topic on and off', () => {
    const on = toggleTopic(only('food'), 'work');
    expect(on && activeTopicKeys(on).sort()).toEqual(['food', 'work']);
    const off = toggleTopic(on!, 'work');
    expect(off && activeTopicKeys(off)).toEqual(['food']);
  });
  it('refuses to switch off the last active topic', () => {
    expect(toggleTopic(only('food'), 'food')).toBeNull();
  });
  it('from the "all active" fallback, switching one off leaves the others on', () => {
    const next = toggleTopic({}, 'food');
    expect(next && activeTopicKeys(next)).not.toContain('food');
    expect(next && activeTopicKeys(next).length).toBe(TOPIC_KEYS.length - 1);
  });
  it('ignores an unknown key', () => {
    expect(toggleTopic(only('food'), 'bogus')).toEqual(only('food'));
  });
});

describe('topicCountsForLevel', () => {
  it('matches the bank and adds up to the level size', () => {
    for (const level of CEFR_ORDER) {
      const counts = topicCountsForLevel(level);
      expect(Object.keys(counts).sort()).toEqual([...TOPIC_KEYS].sort());
      expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(WORD_BANK[level].length);
    }
  });
  it('reports zero for topics a level has no words for', () => {
    expect(topicCountsForLevel('C1').food).toBe(0);
  });
});
