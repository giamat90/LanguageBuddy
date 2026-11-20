import { pickLocalized } from '../src/i18n/language';
import itStrings from '../src/i18n/it';
import en from '../src/i18n/en';

describe('pickLocalized', () => {
  it('returns the requested language when present', () => {
    expect(pickLocalized('it', 'ciao', 'hello')).toBe('ciao');
    expect(pickLocalized('en', 'ciao', 'hello')).toBe('hello');
  });

  it('falls back to the other language when the requested one is missing', () => {
    expect(pickLocalized('en', 'ciao', null)).toBe('ciao');
    expect(pickLocalized('it', null, 'hello')).toBe('hello');
    expect(pickLocalized('en', 'ciao', undefined)).toBe('ciao');
  });

  it('returns null when both are missing', () => {
    expect(pickLocalized('it', null, null)).toBeNull();
    expect(pickLocalized('en', undefined, undefined)).toBeNull();
  });

  it('returns null when both are empty strings', () => {
    expect(pickLocalized('it', '', '')).toBeNull();
  });
});

describe('pickLocalized with local content', () => {
  it('prefers the local text for languages other than it/en', () => {
    expect(pickLocalized('fr', 'ciao', 'hello', 'bonjour')).toBe('bonjour');
  });

  it('falls back to English, then Italian, when the local text is missing or empty', () => {
    expect(pickLocalized('fr', 'ciao', 'hello', null)).toBe('hello');
    expect(pickLocalized('fr', 'ciao', 'hello', '')).toBe('hello');
    expect(pickLocalized('ja', 'ciao', null, undefined)).toBe('ciao');
    expect(pickLocalized('ar', null, null, null)).toBeNull();
  });

  it('ignores the local text for Italian and English', () => {
    expect(pickLocalized('it', 'ciao', 'hello', 'bonjour')).toBe('ciao');
    expect(pickLocalized('en', 'ciao', 'hello', 'bonjour')).toBe('hello');
  });
});

describe('en.ts / it.ts key parity', () => {
  it('has exactly the same set of keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(itStrings).sort());
  });
});
