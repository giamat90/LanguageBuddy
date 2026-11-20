import { getWordContent, localizedText, __setLoaderForTests } from '../src/i18n/wordContent';

afterEach(() => {
  __setLoaderForTests('fr', undefined);
  __setLoaderForTests('ja', undefined);
  jest.restoreAllMocks();
});

describe('localizedText without translated content', () => {
  it('returns Italian and English as before', () => {
    expect(localizedText('it', 'meaning', { word: 'Brot' }, 'pane', 'bread')).toBe('pane');
    expect(localizedText('en', 'meaning', { word: 'Brot' }, 'pane', 'bread')).toBe('bread');
  });

  it('falls back to English, then Italian, for the new languages', () => {
    expect(localizedText('fr', 'meaning', { word: 'Brot' }, 'pane', 'bread')).toBe('bread');
    expect(localizedText('fr', 'meaning', { word: 'Brot' }, 'pane', null)).toBe('pane');
    expect(localizedText('fr', 'meaning', { word: 'Brot' }, null, null)).toBeNull();
  });

  it('finds no content for a language without a loader', () => {
    expect(getWordContent('fr', 'Brot', 'A1')).toBeNull();
  });
});

describe('localizedText with a loader', () => {
  const data = {
    'A1:brot': ['pain', "J'achète le pain chez le boulanger.", 'Il existe plus de 3 000 sortes de pain.'] as [string, string, string],
    'A1:essen': ['manger', 'Wir essen um acht.', 'note A1'] as [string, string, string],
    'A2:essen': ['le repas', 'Das Essen ist fertig.', 'note A2'] as [string, string, string],
  };

  beforeEach(() => __setLoaderForTests('fr', () => data));

  it('returns the field asked for', () => {
    expect(localizedText('fr', 'meaning', { word: 'Brot', level: 'A1' }, 'pane', 'bread')).toBe('pain');
    expect(localizedText('fr', 'example', { word: 'Brot', level: 'A1' }, 'a', 'b')).toBe(data['A1:brot'][1]);
    expect(localizedText('fr', 'note', { word: 'Brot', level: 'A1' }, 'a', 'b')).toBe(data['A1:brot'][2]);
  });

  it('matches case-insensitively', () => {
    expect(localizedText('fr', 'meaning', { word: 'BROT', level: 'A1' }, 'x', 'y')).toBe('pain');
  });

  it('disambiguates words that exist in two levels', () => {
    expect(localizedText('fr', 'meaning', { word: 'essen', level: 'A1' }, 'x', 'y')).toBe('manger');
    expect(localizedText('fr', 'meaning', { word: 'essen', level: 'A2' }, 'x', 'y')).toBe('le repas');
  });

  it('uses the first level that has the word when the level is unknown', () => {
    expect(localizedText('fr', 'meaning', { word: 'essen' }, 'x', 'y')).toBe('manger');
    expect(localizedText('fr', 'meaning', { word: 'essen', level: null }, 'x', 'y')).toBe('manger');
  });

  it('falls back to English for a word the loader does not have', () => {
    expect(localizedText('fr', 'meaning', { word: 'Haus', level: 'A1' }, 'casa', 'house')).toBe('house');
  });

  it('falls back when a field is an empty string', () => {
    __setLoaderForTests('fr', () => ({ 'A1:haus': ['', 'ex', 'note'] }));
    expect(localizedText('fr', 'meaning', { word: 'Haus', level: 'A1' }, 'casa', 'house')).toBe('house');
  });

  it('does not use the loader for Italian or English', () => {
    expect(localizedText('en', 'meaning', { word: 'Brot', level: 'A1' }, 'pane', 'bread')).toBe('bread');
  });

  it('loads each language once', () => {
    const loader = jest.fn(() => data);
    __setLoaderForTests('fr', loader);
    localizedText('fr', 'meaning', { word: 'Brot', level: 'A1' }, 'a', 'b');
    localizedText('fr', 'note', { word: 'Brot', level: 'A1' }, 'a', 'b');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('survives a throwing loader, logs once and falls back', () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    __setLoaderForTests('ja', () => {
      throw new Error('boom');
    });
    expect(localizedText('ja', 'meaning', { word: 'Brot' }, 'pane', 'bread')).toBe('bread');
    expect(localizedText('ja', 'example', { word: 'Brot' }, 'a', 'b')).toBe('b');
    expect(err).toHaveBeenCalledTimes(1);
  });
});
