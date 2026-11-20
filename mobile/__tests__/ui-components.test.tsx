import React from 'react';
import { render } from '@testing-library/react-native';
import ArticleBadge from '../src/components/ui/ArticleBadge';
import CefrBadge from '../src/components/ui/CefrBadge';
import StreakRow from '../src/components/ui/StreakRow';
import CulturalNote from '../src/components/ui/CulturalNote';
import WordHero from '../src/components/ui/WordHero';
import PrimaryButton from '../src/components/ui/PrimaryButton';
import SecondaryButton from '../src/components/ui/SecondaryButton';
import SectionLabel from '../src/components/ui/SectionLabel';
import Divider from '../src/components/ui/Divider';
import WordCard from '../src/components/ui/WordCard';
import { DailyWord } from '../src/types/domain';

const mockWord: DailyWord = {
  id: '1',
  word: 'Gemütlichkeit',
  article: 'die',
  partOfSpeech: 'noun',
  ipa: 'ɡəˈmyːtlɪçkaɪt',
  meaningIt: 'accoglienza, calore',
  meaningEn: 'coziness',
  exampleDe: 'Das Café hat eine tolle Gemütlichkeit.',
  exampleIt: 'Il caffè ha una grande accoglienza.',
  exampleEn: 'The café has a great coziness.',
  culturalNote: 'Un concetto tedesco intraducibile.',
  culturalNoteEn: 'An untranslatable German concept.',
  grammarAngle: 'NOUN_GENDER',
  topicDomain: 'culture',
  cefrBand: 'B2',
  date: '2026-05-15',
  isSaved: false,
};

describe('UI Components — snapshots', () => {
  it('ArticleBadge der', () => {
    const { toJSON } = render(<ArticleBadge article="der" word="Hund" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('ArticleBadge die', () => {
    const { toJSON } = render(<ArticleBadge article="die" word="Katze" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('ArticleBadge das', () => {
    const { toJSON } = render(<ArticleBadge article="das" word="Kind" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('ArticleBadge null', () => {
    const { toJSON } = render(<ArticleBadge article={null} />);
    expect(toJSON()).toBeNull();
  });

  it('CefrBadge', () => {
    const { toJSON } = render(<CefrBadge level="B1" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('StreakRow zero', () => {
    const { toJSON } = render(<StreakRow count={0} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('StreakRow partial', () => {
    const { toJSON } = render(<StreakRow count={3} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('StreakRow full', () => {
    const { toJSON } = render(<StreakRow count={7} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('StreakRow overflow', () => {
    const { toJSON } = render(<StreakRow count={14} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('CulturalNote', () => {
    const { toJSON } = render(<CulturalNote text="Ein langer Text über die Kultur." />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('WordHero with article', () => {
    const { toJSON } = render(
      <WordHero word="Krankenhaus" article="das" ipa="ˈkʁaŋkənˌhaʊs" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('WordHero no article', () => {
    const { toJSON } = render(<WordHero word="fahren" article={null} ipa="ˈfaːʁən" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('PrimaryButton idle', () => {
    const { toJSON } = render(<PrimaryButton label="Salva" onPress={jest.fn()} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('PrimaryButton loading', () => {
    const { toJSON } = render(<PrimaryButton label="Salva" onPress={jest.fn()} loading />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('PrimaryButton disabled', () => {
    const { toJSON } = render(<PrimaryButton label="Salva" onPress={jest.fn()} disabled />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('SecondaryButton', () => {
    const { toJSON } = render(<SecondaryButton label="Salta" onPress={jest.fn()} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('SectionLabel', () => {
    const { toJSON } = render(<SectionLabel label="significato" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('Divider', () => {
    const { toJSON } = render(<Divider />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('WordCard', () => {
    const { toJSON } = render(
      <WordCard
        word={mockWord}
        saveState="idle"
        streakDays={3}
        onSave={jest.fn()}
        onSkip={jest.fn()}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
