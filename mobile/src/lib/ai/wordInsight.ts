import { callLLM } from './llm';
import { getActivePack } from '../../languages';
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
  target: string;
  native: string;
}

/**
 * One example from an AI answer. The sentence is under `target`; answers cached before TASK-042
 * (and a model that still answers the old way) use `de`, which stays readable.
 * Returns null when there is no usable sentence or translation.
 */
export function normalizeExample(e: unknown): InsightExample | null {
  if (!e || typeof e !== 'object') return null;
  const r = e as { target?: unknown; de?: unknown; native?: unknown };
  const sentence = typeof r.target === 'string' ? r.target : typeof r.de === 'string' ? r.de : null;
  if (sentence === null || typeof r.native !== 'string') return null;
  return { target: sentence, native: r.native };
}

export interface InsightExercise {
  /** A sentence in the target language with the target word replaced by "___". */
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
  const target = getActivePack().ai.languageName;
  return `You are an assistant for learning ${target}, for ${name}-speaking
students. Give short, practical explanations in ${name}. Respond ONLY
with valid JSON, no text before or after, no markdown.`;
}

function buildPrompt({ word, article, meaningNative, cefrLevel, nativeLanguage }: WordInsightInput): string {
  const headword = article ? `${article} ${word}` : word;
  const langName = languageEnglishName(nativeLanguage);
  const target = getActivePack().ai.languageName;
  return `Word: ${headword}${meaningNative ? ` (${meaningNative})` : ''}
Student's level: ${cefrLevel}

Generate study material for this word, suitable for level ${cefrLevel}.

Respond with exactly this JSON shape:
{
  "examples": [
    { "target": "a ${target} sentence using the word", "native": "${langName} translation" }
  ],
  "note": "a usage note in ${langName}, max 2 sentences (register, nuance, common mistakes, related words)",
  "exercise": {
    "sentence": "a ${target} sentence with ___ in place of the word",
    "answer": "the exact form that goes in ___"
  }
}

Rules:
- exactly 3 examples, natural and appropriately sized for level ${cefrLevel}
- every ${target} example sentence MUST contain the word "${word}"
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

  const parsed = JSON.parse(match[0]) as { examples?: unknown[]; note?: unknown; exercise?: { sentence?: unknown; answer?: unknown } | null };
  const examples = Array.isArray(parsed.examples)
    ? parsed.examples.map(normalizeExample).filter((e): e is InsightExample => e !== null).slice(0, 3)
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
