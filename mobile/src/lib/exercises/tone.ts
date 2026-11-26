import { getActivePack } from '../../languages';
import { shuffle, type Rng } from '../grammar';
import type { ReviewCard } from '../../services/reviewService';
import type { ToneChoiceModel } from './types';

/** The word's pronunciation among spellings with a wrong tone; null when the language or word has none. */
export function buildToneChoice(card: ReviewCard, rng: Rng): ToneChoiceModel | null {
  const { reading } = getActivePack();
  if (!reading || !card.pronunciation || !card.syllables) return null;
  const wrong = reading.toneVariants(card.pronunciation, card.syllables, rng);
  if (!wrong) return null;
  const correct = card.pronunciation.normalize('NFC');
  const options = shuffle([correct, ...wrong], rng);
  return { kind: 'tone_choice', card, options, correctIndex: options.indexOf(correct) };
}
