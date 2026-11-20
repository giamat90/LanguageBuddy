import { buildCloze, isAnswerCorrect } from '../src/lib/cloze';

describe('buildCloze', () => {
  it('blanks the whole-word match case-insensitively', () => {
    expect(buildCloze('Ich kaufe das Brot beim Bäcker.', 'Brot')).toEqual({
      before: 'Ich kaufe das ',
      after: ' beim Bäcker.',
    });
    expect(buildCloze('brot ist gut.', 'Brot')?.before).toBe('');
  });
  it('does not match inside a longer word', () => {
    expect(buildCloze('Ich esse Brotzeit.', 'Brot')).toBeNull();
  });
  it('returns null for missing sentence or word', () => {
    expect(buildCloze(null, 'Brot')).toBeNull();
    expect(buildCloze('Ich trinke Wasser.', 'Brot')).toBeNull();
  });
});

describe('isAnswerCorrect', () => {
  it('ignores case, whitespace and umlauts', () => {
    expect(isAnswerCorrect('  bäcker ', 'Bäcker')).toBe(true);
    expect(isAnswerCorrect('backer', 'Bäcker')).toBe(true);
    expect(isAnswerCorrect('strasse', 'Straße')).toBe(true);
  });
  it('tolerates one typo only on long words', () => {
    expect(isAnswerCorrect('Wassr', 'Wasser')).toBe(true);
    expect(isAnswerCorrect('Brt', 'Brot')).toBe(false);
    expect(isAnswerCorrect('Wssr', 'Wasser')).toBe(false);
  });
  it('rejects empty input', () => {
    expect(isAnswerCorrect('', 'Brot')).toBe(false);
  });
});
