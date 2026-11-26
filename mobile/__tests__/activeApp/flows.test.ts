/** The learner's flows with the real active bank and pack over the in-memory SQLite mock. */
import { _resetDbForTests, getDb } from '../../src/data/db';
import { submitOnboarding, fetchProfile } from '../../src/services/profileService';
import { fetchTodayWord, saveWord, startLearning } from '../../src/services/wordService';
import { fetchDueReviews, gradePractice, gradeReview, fetchVaultCards, type ReviewCard } from '../../src/services/reviewService';
import { nextReviewDate, updateRetentionScore } from '../../src/data/srs';
import { WORD_BANK, allEntries, type CefrLevel } from '../../src/data/wordbank';
import { getActivePack } from '../../src/languages';
import { buildCloze, gradeTypedAnswer } from '../../src/lib/cloze';
import { buildArticleQuestion, buildChoiceQuestion, caseRules, choiceRules } from '../../src/lib/grammar';
import {
  DEFAULT_REGISTRY, MAX_RETRIES, createSession, currentEntry, isFinished, pickExercise, submitGroupResult, submitResult,
  tierOf, PASS_QUALITY, practiceAvailability, type SessionState,
} from '../../src/lib/exercises';
import { current } from '../../test-support/appExpectations';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require('expo-sqlite');
const PREFS = { food: 0.8, travel: 0.8, work: 0.3, culture: 0.3, home: 0.3, leisure: 0.3, health: 0.3, shopping: 0.3 };
const DAY = 24 * 60 * 60 * 1000;
const seeded = (): (() => number) => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

beforeEach(() => {
  sqlite.__reset();
  _resetDbForTests();
});

describe.each([...getActivePack().levels])('daily flow at %s', (level: CefrLevel) => {
  beforeEach(async () => { await submitOnboarding({ cefr_level: level, topic_preferences: PREFS }); });

  it('shows a word of the level, saves it with retention 0.5 due in a day, and starts the streak', async () => {
    const profile = await fetchProfile();
    expect(profile!.cefrLevel).toBe(level);
    const today = await fetchTodayWord();
    expect(WORD_BANK[level].map((e) => e.word)).toContain(today!.word);
    const before = Date.now();
    expect((await saveWord()).streak_days).toBe(1);
    const db = await getDb();
    const [row] = await db.getAllAsync<any>('SELECT * FROM vocabulary_items');
    expect(row.word).toBe(today!.word);
    expect(row.retention_score).toBe(0.5);
    const due = new Date(row.next_review_at).getTime();
    expect(due).toBeGreaterThanOrEqual(before + DAY - 2000);
    expect(due).toBeLessThanOrEqual(Date.now() + DAY + 2000);
    expect((await saveWord()).already_saved).toBe(true);
  });
});

describe('vault and scheduling', () => {
  beforeEach(async () => {
    await submitOnboarding({ cefr_level: 'A1', topic_preferences: PREFS });
    await fetchTodayWord();
    await saveWord();
  });

  it('start learning from the catalog adds a word and never touches the streak', async () => {
    const db = await getDb();
    const profile = (await fetchProfile())!;
    const word = current().sampleWord.A1;
    const res = await startLearning('A1', word);
    expect(res.added).toBe(true);
    const after = (await fetchProfile())!;
    expect(after.streakDays).toBe(profile.streakDays);
    const [row] = await db.getAllAsync<any>('SELECT * FROM vocabulary_items WHERE word = ?', [word]);
    expect(row).toMatchObject({ source: 'catalog', retention_score: 0.5, times_seen: 1 });
    expect((await startLearning('A1', word)).added).toBe(false);
  });

  it('a pass lengthens and a miss shortens the interval as CLAUDE.md §7 says', async () => {
    const [card] = await fetchDueReviews(new Date(Date.now() + 5 * DAY));
    const db = await getDb();
    const row0 = (await db.getFirstAsync<any>('SELECT * FROM vocabulary_items WHERE id = ?', [card.id]))!;
    await gradeReview(card.id, 1);
    const row1 = (await db.getFirstAsync<any>('SELECT * FROM vocabulary_items WHERE id = ?', [card.id]))!;
    expect(row1.retention_score).toBe(updateRetentionScore(row0.retention_score, 1, row0.times_seen));
    expect(row1.retention_score).toBeGreaterThan(row0.retention_score);
    expect(row1.times_seen).toBe(row0.times_seen + 1);
    const base = new Date('2026-01-01T10:00:00Z');
    const days = (score: number) => Math.round((nextReviewDate(score, base).getTime() - base.getTime()) / DAY);
    expect([days(0.95), days(0.8), days(0.65), days(0.3)]).toEqual([21, 7, 3, 1]);
    await gradeReview(card.id, 0);
    const row2 = (await db.getFirstAsync<any>('SELECT * FROM vocabulary_items WHERE id = ?', [card.id]))!;
    expect(row2.retention_score).toBeLessThan(row1.retention_score);
    expect(await db.getAllAsync<any>('SELECT * FROM review_log')).toHaveLength(2);
  });

  it('practice never pushes a review later: a pass changes nothing, a miss can only move it earlier', async () => {
    const [card] = await fetchVaultCards();
    const db = await getDb();
    const read = async () => (await db.getFirstAsync<any>('SELECT * FROM vocabulary_items WHERE id = ?', [card.id]))!;
    const before = await read();
    await gradePractice(card.id, 1);
    expect(await read()).toEqual(before);
    await gradePractice(card.id, 0);
    const after = await read();
    expect(after.retention_score).toBeLessThan(before.retention_score);
    expect(after.next_review_at <= before.next_review_at).toBe(true);
    expect(after.times_seen).toBe(before.times_seen);
    expect(await db.getAllAsync<any>('SELECT * FROM review_log')).toHaveLength(0);
  });
});

function cards(count: number): ReviewCard[] {
  const all = allEntries().filter((_, i) => i % 7 === 0).slice(0, count);
  return all.map(({ level, entry: e }, i) => ({
    id: `c${i}`, word: e.word, article: e.article, translationIt: e.meaning_it, translationEn: e.meaning_en,
    example: e.example, segments: e.segments, exampleIt: e.example_it, exampleEn: e.example_en, partOfSpeech: e.part_of_speech,
    cefrBand: level, topicDomain: e.topic_domain, grammarAngle: e.grammar_angle,
    // a mix of new, learning and strong words
    timesSeen: [1, 2, 5][i % 3], retentionScore: [0.5, 0.7, 0.9][i % 3],
  }));
}

describe('a review session over real cards', () => {
  it('plays 30 cards to the end: every first attempt graded once, retries bounded, rounds well formed', () => {
    const rng = seeded();
    const deck = cards(30);
    let s: SessionState = createSession(deck, { rng, lang: 'fr' });
    const graded = new Map<string, number>();
    const asked = new Map<string, number>();
    let steps = 0;
    while (!isFinished(s) && steps++ < 500) {
      const entry = currentEntry(s)!;
      if (entry.kind === 'group') {
        expect(entry.cards.length).toBeGreaterThanOrEqual(4);
        expect(entry.cards.length).toBeLessThanOrEqual(5);
        const meanings = entry.cards.map((c) => c.translationIt!.toLowerCase());
        expect(new Set(meanings).size).toBe(meanings.length);
        const q: Record<string, number> = {};
        entry.cards.forEach((c, i) => { q[c.id] = i === 0 ? 0 : 1; });
        const r = submitGroupResult(s, q);
        r.grades.forEach((g) => graded.set(g.cardId, (graded.get(g.cardId) ?? 0) + 1));
        s = r.state;
        continue;
      }
      const model = pickExercise(entry.card, DEFAULT_REGISTRY, rng, 'fr');
      const def = DEFAULT_REGISTRY.find((d) => d.kind === model.kind)!;
      expect(def.fallback === true || def.tiers.includes(tierOf(entry.card))).toBe(true);
      asked.set(entry.card.id, (asked.get(entry.card.id) ?? 0) + 1);
      const miss = entry.card.id === 'c1' && entry.retry < MAX_RETRIES; // one stubborn card
      const r = submitResult(s, miss ? 0 : 1);
      if (r.grade) graded.set(r.grade.cardId, (graded.get(r.grade.cardId) ?? 0) + 1);
      s = r.state;
    }
    expect(isFinished(s)).toBe(true);
    for (const c of deck) expect(graded.get(c.id)).toBe(1);
    expect(Math.max(...asked.values())).toBeLessThanOrEqual(MAX_RETRIES + 1);
    expect(s.gradedCount).toBe(deck.length);
    expect(PASS_QUALITY).toBe(0.5);
  });

  it('practice menu: every format that is offered really can be built', () => {
    const availability = practiceAvailability(cards(40));
    expect(availability.mixed).toBe(true);
    expect(availability.multiple_choice).toBe(true);
    expect(availability.typed_cloze).toBe(true);
    expect(availability.sentence_reorder).toBe(true);
  });
});

describe('typing and grammar', () => {
  it('every word typed exactly is exact; typed without accents is never wrong (prevents a layout without the special letters from failing the learner)', () => {
    for (const { entry } of allEntries()) {
      expect(gradeTypedAnswer(entry.word, entry.word)).toBe('exact');
      expect(gradeTypedAnswer(getActivePack().fold(entry.word), entry.word)).not.toBe('wrong');
    }
  });

  it('a fill-in-the-blank can be built for most words and always hides the word', () => {
    let built = 0;
    for (const { entry } of allEntries()) {
      const c = buildCloze(entry.example, entry.word, getActivePack(), entry.segments);
      if (c) { built++; expect((c.before + c.after).toLowerCase()).not.toContain(` ${entry.word.toLowerCase()} `); }
    }
    expect(built).toBeGreaterThan(allEntries().length * 0.5);
  });

  (current().articleForms.length > 0 ? it : it.skip)('the article drill builds for nouns with the answer among the options', () => {
    const nouns = allEntries().filter(({ entry }) => entry.part_of_speech === 'noun').slice(0, 40);
    expect(nouns.length).toBe(40);
    for (const { level, entry } of nouns) {
      const q = buildArticleQuestion({ ...entry, cefr_band: level }, seeded())!;
      expect(q).not.toBeNull();
      expect(q.options).toContain(q.answer);
      expect(q.options.slice().sort()).toEqual([...current().articleForms].sort());
    }
  });

  it('the choice and case drills match the pack (no case drill where the language has none)', () => {
    expect(choiceRules()).toEqual([...current().choiceRules]);
    expect(caseRules().length > 0).toBe(current().hasCases);
    for (const rule of choiceRules()) {
      const sentences = allEntries().filter(({ entry }) => entry.grammar_angle === rule).slice(0, 20);
      expect(sentences.length).toBeGreaterThan(0);
      for (const { level, entry } of sentences) {
        const q = buildChoiceQuestion({ ...entry, cefr_band: level }, seeded())!;
        expect(q).not.toBeNull();
        expect(q.options).toContain(q.answer);
      }
    }
  });
});
