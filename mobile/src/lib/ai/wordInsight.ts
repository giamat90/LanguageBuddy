import { callLLM } from './llm';
import { languageEnglishName, type NativeLanguage } from '../../i18n/language';

/**
 * "Approfondisci" / "Explore further" — the first AI feature. Given a saved word,
 * the learner's CEFR level, and their native language, generates extra example
 * sentences, a short usage note, and one fill-in-the-blank exercise, as JSON.
 *
 * The plumbing (./keys.ts + ./llm.ts) is shared, so the deferred chat /
 * session recap features are the same shape.
 */

export interface InsightExample {
  de: string;
  native: string;
}

export interface InsightExercise {
  /** A German sentence with the target word replaced by "___". */
  sentence: string;
  answer: string;
}

export interface WordInsightResult {
  examples: InsightExample[];
  note: string;
  exercise: InsightExercise | null;
}

interface WordInsightInput {
  word: string;
  article: string | null;
  meaningNative: string | null;
  cefrLevel: string;
  nativeLanguage: NativeLanguage;
}

function buildSystem(lang: NativeLanguage): string {
  const name = languageEnglishName(lang);
  return `You are an assistant for learning German, for ${name}-speaking
students. Give short, practical explanations in ${name}. Respond ONLY
with valid JSON, no text before or after, no markdown.`;
}

function buildPrompt({ word, article, meaningNative, cefrLevel, nativeLanguage }: WordInsightInput): string {
  const headword = article ? `${article} ${word}` : word;
  const langName = languageEnglishName(nativeLanguage);
  return `Word: ${headword}${meaningNative ? ` (${meaningNative})` : ''}
Student's level: ${cefrLevel}

Generate study material for this word, suitable for level ${cefrLevel}.

Respond with exactly this JSON shape:
{
  "examples": [
    { "de": "a German sentence using the word", "native": "${langName} translation" }
  ],
  "note": "a usage note in ${langName}, max 2 sentences (register, nuance, common mistakes, related words)",
  "exercise": {
    "sentence": "a German sentence with ___ in place of the word",
    "answer": "the exact form that goes in ___"
  }
}

Rules:
- exactly 3 examples, natural and appropriately sized for level ${cefrLevel}
- every German example sentence MUST contain the word "${word}"
- the exercise: a different sentence from the examples, with "___" where the word goes; "answer" is the word (with any needed inflection)
- no markdown, no text outside the JSON`;
}

export async function generateWordInsight(input: WordInsightInput): Promise<WordInsightResult> {
  const raw = await callLLM({
    max_tokens: 800,
    system: buildSystem(input.nativeLanguage),
    messages: [{ role: 'user', content: buildPrompt(input) }],
  });

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error('[wordInsight] no JSON in AI response:', raw);
    throw new Error('invalid AI response');
  }

  const parsed = JSON.parse(match[0]) as Partial<WordInsightResult>;
  const examples = Array.isArray(parsed.examples)
    ? parsed.examples
        .filter((e): e is InsightExample => !!e && typeof e.de === 'string' && typeof e.native === 'string')
        .slice(0, 3)
    : [];
  if (examples.length === 0 || typeof parsed.note !== 'string') {
    console.error('[wordInsight] malformed AI payload:', parsed);
    throw new Error('invalid AI response');
  }

  const ex = parsed.exercise;
  const exercise: InsightExercise | null =
    ex && typeof ex.sentence === 'string' && typeof ex.answer === 'string'
      ? { sentence: ex.sentence, answer: ex.answer }
      : null;

  return { examples, note: parsed.note, exercise };
}
