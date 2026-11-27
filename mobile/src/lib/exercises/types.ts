import type { ReviewCard } from '../../services/reviewService';
import type { Rng } from '../grammar';
import type { NativeLanguage } from '../../i18n/language';

/** How well the learner knows a word; picks which exercises it is offered. */
export type Tier = 'new' | 'learning' | 'strong';

export type ExerciseKind =
  | 'typed_cloze'
  | 'flashcard'
  | 'multiple_choice'
  | 'sentence_reorder'
  | 'find_mistake'
  | 'tone_choice';

export interface TypedClozeModel {
  kind: 'typed_cloze';
  card: ReviewCard;
  before: string;
  after: string;
}

export interface FlashcardModel {
  kind: 'flashcard';
  card: ReviewCard;
}

export interface MultipleChoiceOption {
  /** Lower-cased "article word", unique within one question. */
  id: string;
  word: string;
  article: string | null;
  meaningIt: string;
  meaningEn: string;
  /** Pronunciation, in languages with a reading layer. */
  pronunciation?: string;
  /** Where the word sits in the bank; picks the right row for words that exist in two levels. */
  cefrBand?: string | null;
}

export interface MultipleChoiceModel {
  kind: 'multiple_choice';
  card: ReviewCard;
  /** to_native: see the German word, pick the meaning. to_german: see the meaning, pick the word. */
  direction: 'to_native' | 'to_german';
  /** Four shuffled options. */
  options: MultipleChoiceOption[];
  correctIndex: number;
}

export interface SentenceReorderModel {
  kind: 'sentence_reorder';
  card: ReviewCard;
  /** Shuffled tiles. */
  tokens: string[];
  /** The sentence in its original order. */
  solution: string[];
}

/** The word's example sentence with exactly one wrong determiner: find it, then fix it. */
export interface FindMistakeModel {
  kind: 'find_mistake';
  card: ReviewCard;
  mistakeKind: 'gender' | 'case' | 'choice' | 'measure';
  /** Key of the grammar explanation: the pack's article rule, a case rule (German) or a choice rule (Spanish). */
  ruleCode: string;
  /** The sentence as shown; exactly one token is wrong. */
  tokens: string[];
  wrongIndex: number;
  /** What tokens[wrongIndex] originally was (capitalisation and attached punctuation as in the sentence). */
  correctToken: string;
  /** Three bare forms for the fix step, capitalised like the slot. */
  options: string[];
  correctOption: number;
}

/** The word in its own script: pick its pronunciation among wrong tones. */
export interface ToneChoiceModel {
  kind: 'tone_choice';
  card: ReviewCard;
  options: string[];
  correctIndex: number;
}

export type ExerciseModel =
  | TypedClozeModel
  | FlashcardModel
  | MultipleChoiceModel
  | SentenceReorderModel
  | FindMistakeModel
  | ToneChoiceModel;

export interface ExerciseDefinition {
  kind: ExerciseKind;
  /** Tiers this exercise may be offered to. */
  tiers: Tier[];
  /** Relative chance when several definitions apply (default 1). */
  weight?: number;
  /** Chosen only when no non-fallback definition applies to the card. */
  fallback?: boolean;
  /** Builds the exercise for a card; null = not applicable to this card. */
  build(card: ReviewCard, rng: Rng, lang?: NativeLanguage): ExerciseModel | null;
}

/** A set-based exercise: one screen covering several cards at once. */
export interface MatchingModel {
  kind: 'matching';
  /** 4..5 cards. */
  cards: ReviewCard[];
  /** Card ids, shuffled independently of rightOrder. */
  leftOrder: string[];
  rightOrder: string[];
}

export interface GroupExerciseDefinition {
  kind: 'matching';
  tiers: Tier[];
  minSize: number;
  maxSize: number;
  /** May use a subset of `cards`; the model must cover at least `minSize`. */
  build(cards: ReviewCard[], rng: Rng, lang?: NativeLanguage): MatchingModel | null;
}
