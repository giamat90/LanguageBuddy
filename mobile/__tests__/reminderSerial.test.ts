import { _resetDbForTests } from '../src/data/db';
import { submitOnboarding } from '../src/services/profileService';
import { fetchTodayWord, saveWord } from '../src/services/wordService';
import { fetchDueReviews, gradeReview, refreshReviewReminder } from '../src/services/reviewService';

// Counts how many scheduleReviewReminder calls overlap in time.
const mockState = { current: 0, max: 0, calls: 0, failNext: false };
jest.mock('../src/lib/notifications', () => ({
  cancelReviewReminder: jest.fn(async () => {}),
  scheduleReviewReminder: jest.fn(async () => {
    mockState.calls++;
    mockState.current++;
    mockState.max = Math.max(mockState.max, mockState.current);
    await new Promise((r) => setTimeout(r, 5));
    mockState.current--;
    if (mockState.failNext) {
      mockState.failNext = false;
      throw new Error('schedule failed');
    }
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require('expo-sqlite');
const PREFS = { food: 0.8, travel: 0.8, work: 0.3, culture: 0.3, home: 0.3, leisure: 0.3, health: 0.3, shopping: 0.3 };

beforeEach(async () => {
  sqlite.__reset();
  _resetDbForTests();
  await submitOnboarding({ cefr_level: 'A1', topic_preferences: PREFS });
  await fetchTodayWord();
  await saveWord();
  await new Promise((r) => setTimeout(r, 30)); // let saveWord's own refresh finish
  Object.assign(mockState, { current: 0, max: 0, calls: 0, failNext: false });
});

describe('refreshReviewReminder', () => {
  it('never runs two refreshes at once (they would leave duplicate notifications behind)', async () => {
    await Promise.all([1, 2, 3, 4, 5].map(() => refreshReviewReminder()));
    expect(mockState.calls).toBe(5);
    expect(mockState.max).toBe(1);
  });

  it('keeps going after a failed refresh, and still reports the failure to its caller', async () => {
    mockState.failNext = true;
    const first = refreshReviewReminder();
    const second = refreshReviewReminder();
    await expect(first).rejects.toThrow('schedule failed');
    await expect(second).resolves.toBeUndefined();
    expect(mockState.calls).toBe(2);
  });

  it('a burst of grades leaves the refreshes serialised too', async () => {
    const [card] = await fetchDueReviews(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000));
    Object.assign(mockState, { current: 0, max: 0, calls: 0 });
    await Promise.all([1, 2, 3, 4].map(() => gradeReview(card.id, 0.7)));
    await new Promise((r) => setTimeout(r, 80)); // gradeReview does not wait for its refresh
    expect(mockState.calls).toBe(4);
    expect(mockState.max).toBe(1);
  });
});
