// Palette per language app (theme/palettes.ts), fixed at build time like the language pack.
// The article-gender accents are shared: blue / red / gray.
import { getActivePack } from '../languages';
import { palettes } from './palettes';

const { paper, mist, cream, ink, muted, primary, primaryLight, gold, goldLight, border } =
  palettes[getActivePack().code];

const derBlue      = '#0C447C'; // der — brand blue
const dieRed       = '#D3202F'; // die — flag red
const dasGray      = '#3D454F'; // das — flag black, softened

export const colors = {
  // Backgrounds
  paper,
  mist,
  cream,

  // Text
  ink,
  muted,

  // Primary action
  forest:       primary,
  forestLight:  primaryLight,

  // Accent
  gold,
  goldLight,

  // Borders
  border,

  // Semantic aliases
  background:    paper,
  onBackground:  ink,
  textSecondary: muted,
  primary,
  error:         dieRed,

  // Article gender — text (dark), mapped to the German flag tricolor
  derBlue,
  diePink:      dieRed,
  dasGray,

  // Article gender — backgrounds (light tint)
  derBlueBg:    '#E6F1FB',
  diePinkBg:    '#FBEAEA',
  dasGrayBg:    '#EAEDF0',
} as const;

export type ColorKey = keyof typeof colors;
