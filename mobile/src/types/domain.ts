export interface DailyWord {
  id: string;
  word: string;
  article: string | null;
  partOfSpeech: string | null;
  ipa: string | null;
  meaningIt: string | null;
  meaningEn: string | null;
  exampleDe: string | null;
  exampleIt: string | null;
  exampleEn: string | null;
  culturalNote: string | null;
  culturalNoteEn: string | null;
  grammarAngle: string | null;
  topicDomain: string | null;
  cefrBand: string | null;
  date: string;
  isSaved: boolean;
}

export interface VaultItem {
  id: string;
  word: string;
  article: string | null;
  translationIt: string | null;
  translationEn: string | null;
  partOfSpeech: string | null;
  retentionScore: number;
  nextReviewAt: string;
}

export interface VaultWordDetail {
  id: string;
  word: string;
  article: string | null;
  ipa: string | null;
  partOfSpeech: string | null;
  meaningIt: string | null;
  meaningEn: string | null;
  exampleDe: string | null;
  exampleIt: string | null;
  exampleEn: string | null;
  culturalNote: string | null;
  culturalNoteEn: string | null;
  cefrBand: string | null;
  retentionScore: number;
  nextReviewAt: string;
  timesSeen: number;
  timesUsed: number;
  firstSeenAt: string;
}
