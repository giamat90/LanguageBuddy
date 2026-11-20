import { _resetDbForTests } from '../src/data/db';
import { submitOnboarding, fetchProfile, setTopicPreferences } from '../src/services/profileService';
import { fetchTodayWord, saveWord } from '../src/services/wordService';
import { fetchStats, fetchStatWords } from '../src/services/statsService';
import { buildTopicPreferences, TOPIC_KEYS } from '../src/lib/topics';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require('expo-sqlite');

beforeEach(() => {
  sqlite.__reset();
  _resetDbForTests();
});

describe('setTopicPreferences', () => {
  it('persists the selection', async () => {
    await submitOnboarding({ cefr_level: 'A1', topic_preferences: buildTopicPreferences(TOPIC_KEYS, ['food', 'home']) });
    await setTopicPreferences(buildTopicPreferences(TOPIC_KEYS, ['work']));
    const p = await fetchProfile();
    expect(p?.topicPreferences.work).toBe(0.8);
    expect(p?.topicPreferences.food).toBe(0.3);
  });
  it('refuses an all-inactive map and keeps the old one', async () => {
    await submitOnboarding({ cefr_level: 'A1', topic_preferences: buildTopicPreferences(TOPIC_KEYS, ['food']) });
    await expect(setTopicPreferences(buildTopicPreferences(TOPIC_KEYS, []))).rejects.toThrow();
    expect((await fetchProfile())?.topicPreferences.food).toBe(0.8);
  });
  it('does nothing without a profile', async () => {
    await expect(setTopicPreferences(buildTopicPreferences(TOPIC_KEYS, ['food']))).resolves.toBeUndefined();
    expect(await fetchProfile()).toBeNull();
  });
});

describe('the daily word follows the chosen topics', () => {
  it.each(['food', 'travel', 'health'])('picks a %s word when that is the only topic', async (topic) => {
    await submitOnboarding({ cefr_level: 'A1', topic_preferences: buildTopicPreferences(TOPIC_KEYS, [topic]) });
    const w = await fetchTodayWord();
    expect(w?.topicDomain).toBe(topic);
  });
  it('still returns a word when the level has none for the chosen topic', async () => {
    await submitOnboarding({ cefr_level: 'C1', topic_preferences: buildTopicPreferences(TOPIC_KEYS, ['food']) });
    expect((await fetchTodayWord())?.cefrBand).toBe('C1');
  });
  it('an edit made today applies to the next new word, not to the one already chosen', async () => {
    await submitOnboarding({ cefr_level: 'A1', topic_preferences: buildTopicPreferences(TOPIC_KEYS, ['food']) });
    const first = await fetchTodayWord();
    await setTopicPreferences(buildTopicPreferences(TOPIC_KEYS, ['work']));
    expect((await fetchTodayWord())?.word).toBe(first?.word);
  });
});

describe('fetchStats', () => {
  it('is empty before any word is saved', async () => {
    await submitOnboarding({ cefr_level: 'A1', topic_preferences: buildTopicPreferences(TOPIC_KEYS, ['food']) });
    const s = await fetchStats();
    expect(s.saved.total).toBe(0);
    expect(s.streakDays).toBe(0);
  });
  it('counts a saved word in its topic and level, plus the streak', async () => {
    await submitOnboarding({ cefr_level: 'A1', topic_preferences: buildTopicPreferences(TOPIC_KEYS, ['food']) });
    await fetchTodayWord();
    await saveWord();
    const s = await fetchStats();
    expect(s.saved).toMatchObject({ total: 1, new: 1 });
    expect(s.byTopic.find((g) => g.key === 'food')!.total).toBe(1);
    expect(s.byLevel.find((g) => g.key === 'A1')!.total).toBe(1);
    expect(s.streakDays).toBe(1);
  });
});

describe('fetchStatWords', () => {
  it('lists the saved word under "all", its tier and its group, and nothing elsewhere', async () => {
    await submitOnboarding({ cefr_level: 'A1', topic_preferences: buildTopicPreferences(TOPIC_KEYS, ['food']) });
    await fetchTodayWord();
    await saveWord();
    const all = await fetchStatWords({ kind: 'all' });
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ tier: 'new' });
    expect(all[0].id).toBeTruthy();
    expect(await fetchStatWords({ kind: 'tier', tier: 'new' })).toHaveLength(1);
    expect(await fetchStatWords({ kind: 'tier', tier: 'mastered' })).toHaveLength(0);
    expect(await fetchStatWords({ kind: 'topic', key: 'food' })).toHaveLength(1);
    expect(await fetchStatWords({ kind: 'topic', key: 'work' })).toHaveLength(0);
    expect(await fetchStatWords({ kind: 'level', key: 'A1' })).toHaveLength(1);
    expect(await fetchStatWords({ kind: 'level', key: 'C2' })).toHaveLength(0);
  });
  it('is empty with no saved words', async () => {
    expect(await fetchStatWords({ kind: 'all' })).toEqual([]);
  });
});
