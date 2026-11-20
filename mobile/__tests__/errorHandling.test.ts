import { classifyError } from '../src/lib/errorHandling';

describe('classifyError', () => {
  it('returns a generic offline-safe message for an Error', () => {
    const result = classifyError(new Error('something broke'));
    expect(result.type).toBe('unknown');
    expect(result.message).toContain('andato storto');
  });

  it('returns the same generic message for any value', () => {
    expect(classifyError({ code: 'whatever' }).message).toBe(classifyError(null).message);
  });
});
