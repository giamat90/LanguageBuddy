import { TextStyle } from 'react-native';

const PLAYFAIR = 'PlayfairDisplay_400Regular';
const PLAYFAIR_ITALIC = 'PlayfairDisplay_400Regular_Italic';
const INTER = 'Inter_400Regular';
const INTER_MEDIUM = 'Inter_500Medium';

export const typography: Record<string, TextStyle> = {
  // German words and screen titles — Playfair Display
  wordHero: {
    fontFamily: PLAYFAIR,
    fontSize: 36,
    lineHeight: 44,
  },
  wordHeroItalic: {
    fontFamily: PLAYFAIR_ITALIC,
    fontSize: 36,
    lineHeight: 44,
  },

  // Example sentences in German — Playfair Display italic
  exampleDe: {
    fontFamily: PLAYFAIR_ITALIC,
    fontSize: 15,
    lineHeight: 22,
  },

  // Section headers — Inter uppercase tracked
  sectionLabel: {
    fontFamily: INTER_MEDIUM,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  // Body text — Inter regular
  body: {
    fontFamily: INTER,
    fontSize: 14,
    lineHeight: 20,
  },

  // Article, IPA, metadata — Inter small
  articleMeta: {
    fontFamily: INTER,
    fontSize: 12,
    lineHeight: 16,
  },

  // Buttons, badges, small UI labels — Inter small
  uiSmall: {
    fontFamily: INTER,
    fontSize: 12,
    lineHeight: 16,
  },

  // Button labels — Inter medium
  uiButton: {
    fontFamily: INTER_MEDIUM,
    fontSize: 13,
    lineHeight: 18,
  },
} as const;
