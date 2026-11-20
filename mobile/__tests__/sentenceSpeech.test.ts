import { clozeSentence, reorderSentence, correctedSentence, filledExercise } from '../src/lib/sentenceSpeech';

describe('sentenceSpeech', () => {
  it('cloze joins the parts without double spaces', () => {
    expect(clozeSentence('Ich trinke ', 'Wasser', ' jeden Tag.')).toBe('Ich trinke Wasser jeden Tag.');
    expect(clozeSentence('Das ist ', 'gut', '.')).toBe('Das ist gut.');
    expect(clozeSentence('', 'Hallo', ' Welt')).toBe('Hallo Welt');
  });
  it('reorder joins the solution', () => {
    expect(reorderSentence(['Ich', 'gehe', 'nach', 'Hause.'])).toBe('Ich gehe nach Hause.');
  });
  it('corrected sentence replaces exactly the wrong token and keeps the rest', () => {
    const tokens = ['Ich', 'sehe', 'der', 'Mann.'];
    expect(correctedSentence(tokens, 2, 'den')).toBe('Ich sehe den Mann.');
    expect(tokens[2]).toBe('der'); // input untouched
    expect(correctedSentence(['Das', 'Haus', 'des', 'Mann.'], 3, 'Mannes.')).toBe('Das Haus des Mannes.');
  });
  it('filled exercise replaces only the first blank and leaves no blank', () => {
    expect(filledExercise('Ich ___ gern Kaffee.', 'trinke')).toBe('Ich trinke gern Kaffee.');
    expect(filledExercise('Er ist ___ und ___.', 'müde')).toBe('Er ist müde und ___.');
    expect(filledExercise('Kein Platzhalter.', 'x')).toBe('Kein Platzhalter.');
  });
});
