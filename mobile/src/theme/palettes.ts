import type { TargetLanguageCode } from '../languages/types';

/** The colors that give a language app its own look. Everything else (article colors, error) is shared. */
export interface Palette {
  paper: string;
  mist: string;
  cream: string;
  ink: string;
  muted: string;
  primary: string;
  primaryLight: string;
  gold: string;
  goldLight: string;
  border: string;
}

export const palettes: Record<TargetLanguageCode, Palette> = {
  // Navy of the GermanBuddy logo.
  de: {
    paper: '#F6F9FB', mist: '#E3E9EE', cream: '#EAF0F4',
    ink: '#0C2A3E', muted: '#626F82',
    primary: '#1E4A67', primaryLight: '#E3EDF3',
    gold: '#8F6108', goldLight: '#FBF0D9',
    border: 'rgba(12,42,62,0.12)',
  },
  // Red of the Spanish flag (#AA151B), also the icon (variants/es.json adaptiveIcon.background), with warm neutrals.
  es: {
    paper: '#FBF7F4', mist: '#EFE6E1', cream: '#F5EDE8',
    ink: '#35120F', muted: '#7A5F59',
    primary: '#AA151B', primaryLight: '#F7E4E3',
    gold: '#8F6108', goldLight: '#FBF0D9',
    border: 'rgba(53,18,15,0.12)',
  },
};
