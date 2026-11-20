/** Text handed to the speech engine for whole sentences. Pure: no I/O. */

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

/** The cloze sentence with the learner's word put back in (never contains the blank). */
export function clozeSentence(before: string, word: string, after: string): string {
  return tidy(`${before}${word}${after}`);
}

export function reorderSentence(solution: string[]): string {
  return tidy(solution.join(' '));
}

/** The find-the-mistake sentence with the wrong token replaced: the wrong form is never read aloud. */
export function correctedSentence(tokens: string[], wrongIndex: number, correctToken: string): string {
  return tidy(tokens.map((tok, i) => (i === wrongIndex ? correctToken : tok)).join(' '));
}

/** An AI exercise sentence with its (first) blank filled by the answer. */
export function filledExercise(sentenceWithBlank: string, answer: string): string {
  return tidy(sentenceWithBlank.replace('___', answer));
}
