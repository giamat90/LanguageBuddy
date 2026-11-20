import { __setLoaderForTests } from '../src/i18n/wordContent';
import { pickDistractors, buildMultipleChoice, normalizeLocal, type DistractorSource } from '../src/lib/exercises/distractors';
import { buildMatchingRound } from '../src/lib/exercises/matching';
import type { ReviewCard } from '../src/services/reviewService';

const rng = () => 0.5;

function card(word: string, it: string, en: string, id = word): ReviewCard {
  return {
    id, word, article: null, translationIt: it, translationEn: en,
    exampleDe: `${word}.`, exampleIt: '', exampleEn: '',
    partOfSpeech: 'verb', cefrBand: 'A1', topicDomain: 'food', timesSeen: 0, retentionScore: 0.5,
  };
}
function src(word: string, it: string, en: string): DistractorSource {
  return { word, article: null, partOfSpeech: 'verb', cefrBand: 'A1', topicDomain: 'food', meaningIt: it, meaningEn: en };
}

// Distinct in Italian and English, identical once translated.
const FR = {
  'A1:gehen': ['aller', 'x', 'x'],
  'A1:laufen': ['courir', 'x', 'x'],
  'A1:fahren': ['conduire', 'x', 'x'],
  'A1:reisen': ['conduire', 'x', 'x'], // same French as fahren
  'A1:wandern': ['marcher', 'x', 'x'],
  'A1:eilen': ['aller', 'x', 'x'], // same French as gehen
} as Record<string, [string, string, string]>;

afterEach(() => {
  __setLoaderForTests('fr', undefined);
  __setLoaderForTests('ja', undefined);
});

describe('normalizeLocal', () => {
  it('lower-cases and collapses punctuation and spacing', () => {
    expect(normalizeLocal('  Aller, ')).toBe('aller');
    expect(normalizeLocal('clé (de porte)')).toBe('clé de porte');
  });

  it('keeps non-Latin scripts (the Latin-only letter-run regexp returns an empty key)', () => {
    expect(normalizeLocal('行く')).toBe('行く');
    expect(normalizeLocal('जाना')).toBe('जाना');
    expect(normalizeLocal('идти')).toBe('идти');
    expect(normalizeLocal('يذهب')).toBe('يذهب');
  });
});

describe('multiple choice in the learner language', () => {
  const answer = card('gehen', 'andare', 'to go');
  const candidates = [
    src('eilen', 'affrettarsi', 'to hurry'), // collides with the answer in French
    src('laufen', 'correre', 'to run'),
    src('fahren', 'guidare', 'to drive'),
    src('reisen', 'viaggiare', 'to travel'), // collides with fahren in French
    src('wandern', 'camminare', 'to hike'),
  ];

  it('without a language the Italian/English rules decide', () => {
    __setLoaderForTests('fr', () => FR);
    const picked = pickDistractors(answer, candidates, rng, 4);
    expect(picked?.map((d) => d.word).sort()).toEqual(['eilen', 'fahren', 'laufen', 'reisen']);
  });

  it('never offers an option whose translated meaning equals the answer or another option', () => {
    __setLoaderForTests('fr', () => FR);
    const picked = pickDistractors(answer, candidates, rng, 3, 'fr')!;
    const meanings = picked.map((d) => FR[`A1:${d.word}`][0]);
    expect(new Set(meanings).size).toBe(meanings.length);
    expect(meanings).not.toContain('aller');
  });

  it('returns null when too few distinct translated options remain', () => {
    __setLoaderForTests('fr', () => FR);
    expect(pickDistractors(answer, candidates, rng, 4, 'fr')).toBeNull();
  });

  it('builds a question whose four options have distinct translated texts', () => {
    __setLoaderForTests('fr', () => FR);
    const model = buildMultipleChoice(answer, candidates, rng, 'fr')!;
    const texts = model.options.map((o) => FR[`A1:${o.word.toLowerCase()}`]?.[0] ?? '');
    expect(new Set(texts).size).toBe(4);
  });

  it('dedupes non-Latin translations too', () => {
    __setLoaderForTests('ja', () => ({
      'A1:gehen': ['行く', 'x', 'x'],
      'A1:laufen': ['走る', 'x', 'x'],
      'A1:fahren': ['運転する', 'x', 'x'],
      'A1:reisen': ['運転する', 'x', 'x'],
      'A1:wandern': ['歩く', 'x', 'x'],
      'A1:eilen': ['行く', 'x', 'x'],
    }));
    expect(pickDistractors(answer, candidates, rng, 4, 'ja')).toBeNull();
    expect(pickDistractors(answer, candidates, rng, 3, 'ja')).not.toBeNull();
  });

  it('is unchanged for Italian and English', () => {
    __setLoaderForTests('fr', () => FR);
    const base = pickDistractors(answer, candidates, rng, 3)?.map((d) => d.word);
    expect(pickDistractors(answer, candidates, rng, 3, 'it')?.map((d) => d.word)).toEqual(base);
    expect(pickDistractors(answer, candidates, rng, 3, 'en')?.map((d) => d.word)).toEqual(base);
  });

  it('adds no extra rule when the language has no translated content yet', () => {
    const base = pickDistractors(answer, candidates, rng, 4)?.map((d) => d.word);
    expect(pickDistractors(answer, candidates, rng, 4, 'fr')?.map((d) => d.word)).toEqual(base);
  });
});

describe('matching in the learner language', () => {
  const cards = [
    card('gehen', 'andare', 'to go'),
    card('eilen', 'affrettarsi', 'to hurry'), // same French as gehen
    card('laufen', 'correre', 'to run'),
    card('fahren', 'guidare', 'to drive'),
    card('wandern', 'camminare', 'to hike'),
  ];

  it('skips a card whose translated meaning repeats one already in the round', () => {
    __setLoaderForTests('fr', () => FR);
    const round = buildMatchingRound(cards, rng, 'fr')!;
    expect(round.cards.map((c) => c.word)).toEqual(['gehen', 'laufen', 'fahren', 'wandern']);
  });

  it('keeps every card without a language', () => {
    __setLoaderForTests('fr', () => FR);
    expect(buildMatchingRound(cards, rng)!.cards).toHaveLength(5);
  });
});
