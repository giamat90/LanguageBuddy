// Palette derived from the GermanBuddy brand assets (logo1.png, banner):
// deep navy-teal backdrop, cool off-white word card, and the German flag
// tricolor (black / red / gold) carried through as the article-gender accent.

const paper        = '#F6F9FB'; // card/background — matches the wordcard surface in the logo
const mist         = '#E3E9EE'; // cool light surface tint
const cream        = '#EAF0F4'; // secondary surface tint

const ink          = '#0C2A3E'; // deep navy — matches the "Wort" wordmark
const muted        = '#626F82'; // slate blue-gray — matches the "DAS" label

const primary      = '#1E4A67'; // brand navy blue, from the logo gradient
const primaryLight = '#E3EDF3';

const gold         = '#8F6108'; // flag gold, darkened for text/UI contrast
const goldLight    = '#FBF0D9';

const border       = 'rgba(12,42,62,0.12)';

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
