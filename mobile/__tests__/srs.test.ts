import { updateRetentionScore, nextReviewDate, updateStreak, isoDate } from '../src/data/srs';

describe('updateRetentionScore', () => {
  it('moves toward 1 on a correct answer', () => {
    expect(updateRetentionScore(0.5, true, 5)).toBeGreaterThan(0.5);
    expect(updateRetentionScore(0.5, true, 5)).toBeLessThanOrEqual(1);
  });
  it('moves toward 0 on a wrong answer', () => {
    expect(updateRetentionScore(0.5, false, 5)).toBeLessThan(0.5);
  });
  it('weights later reviews less', () => {
    const early = updateRetentionScore(0.5, true, 1) - 0.5;
    const late = updateRetentionScore(0.5, true, 20) - 0.5;
    expect(late).toBeLessThan(early);
  });
});

describe('updateRetentionScore with a graded outcome', () => {
  it('treats numeric 1 and 0 exactly like true and false', () => {
    expect(updateRetentionScore(0.5, 1, 5)).toBe(updateRetentionScore(0.5, true, 5));
    expect(updateRetentionScore(0.5, 0, 5)).toBe(updateRetentionScore(0.5, false, 5));
  });
  it('lands strictly between a clean pass and a fail for a partial outcome', () => {
    const pass = updateRetentionScore(0.5, 1, 5);
    const fail = updateRetentionScore(0.5, 0, 5);
    const partial = updateRetentionScore(0.5, 0.7, 5);
    expect(partial).toBeGreaterThan(fail);
    expect(partial).toBeLessThan(pass);
  });
  it('clamps out-of-range outcomes', () => {
    expect(updateRetentionScore(0.5, 5, 5)).toBe(updateRetentionScore(0.5, 1, 5));
    expect(updateRetentionScore(0.5, -3, 5)).toBe(updateRetentionScore(0.5, 0, 5));
  });
});

describe('nextReviewDate', () => {
  const base = new Date('2026-01-01T00:00:00.000Z');
  it('schedules 1 day out for weak retention', () => {
    expect(nextReviewDate(0.4, base).toISOString().slice(0, 10)).toBe('2026-01-02');
  });
  it('schedules 21 days out for strong retention', () => {
    expect(nextReviewDate(0.95, base).toISOString().slice(0, 10)).toBe('2026-01-22');
  });
});

describe('updateStreak', () => {
  it('starts at 1 with no prior activity', () => {
    expect(updateStreak(0, '2026-01-10', null)).toBe(1);
  });
  it('stays put when already saved today', () => {
    expect(updateStreak(5, '2026-01-10', '2026-01-10')).toBe(5);
  });
  it('increments on a consecutive day', () => {
    expect(updateStreak(5, '2026-01-10', '2026-01-09')).toBe(6);
  });
  it('resets after a gap', () => {
    expect(updateStreak(5, '2026-01-10', '2026-01-08')).toBe(1);
  });
});

describe('isoDate', () => {
  it('returns YYYY-MM-DD', () => {
    expect(isoDate(new Date('2026-09-04T12:00:00Z'))).toBe('2026-09-04');
  });
});
