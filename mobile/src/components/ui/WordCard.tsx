import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { DailyWord } from '../../types/domain';
import { SaveState } from '../../store/useWordStore';
import { colors } from '../../theme/colors';
import { typography, exampleStyle } from '../../theme/typography';
import { ReadingExample } from './PinyinSentence';
import { t } from '../../i18n';
import { localizedText } from '../../i18n/wordContent';
import { useUserStore } from '../../store/useUserStore';
import WordHero from './WordHero';
import CefrBadge from './CefrBadge';
import StreakRow from './StreakRow';
import CulturalNote from './CulturalNote';
import SectionLabel from './SectionLabel';
import Divider from './Divider';
import SpeakButton from './SpeakButton';
import { useSpeech } from '../../hooks/useSpeech';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

interface Props {
  word: DailyWord;
  saveState: SaveState;
  streakDays: number;
  onSave: () => void;
  onSkip: () => void;
}

export default function WordCard({ word, saveState, streakDays, onSave, onSkip }: Props) {
  const lang = useUserStore((s) => s.nativeLanguage);
  const { speakingId, toggle } = useSpeech();
  const ref = { word: word.word, level: word.cefrBand };
  const meaning = localizedText(lang, 'meaning', ref, word.meaningIt, word.meaningEn);
  const example = localizedText(lang, 'example', ref, word.exampleIt, word.exampleEn);
  const cultural = localizedText(lang, 'note', ref, word.culturalNote, word.culturalNoteEn);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <WordHero word={word.word} article={word.article} ipa={word.ipa} />

      <Divider style={styles.divider} />

      <SectionLabel label={t('word_section_meaning')} />
      {meaning ? (
        <Text style={[typography.body, styles.bodyText]}>{meaning}</Text>
      ) : null}

      <Divider style={styles.divider} />

      <SectionLabel label={t('word_section_example')} />
      {word.example ? (
        <View style={styles.sentenceRow}>
          <ReadingExample
            word={word.word}
            sentence={word.example}
            style={[exampleStyle(), styles.exampleDe, { flex: 1 }]}
            containerStyle={styles.exampleBox}
          />
          <SpeakButton
            kind="sentence"
            speaking={speakingId === 'sentence:example'}
            onPress={() => toggle('sentence:example', word.example as string)}
            testID="speak-example"
          />
        </View>
      ) : null}
      {example ? (
        <Text style={[typography.uiSmall, styles.exampleIt]}>{example}</Text>
      ) : null}

      {cultural ? (
        <CulturalNote text={cultural} style={styles.cultural} />
      ) : null}

      <View style={styles.badgesRow}>
        {word.cefrBand ? <CefrBadge level={word.cefrBand} /> : null}
      </View>

      <StreakRow count={streakDays} style={styles.streak} />

      <PrimaryButton
        label={saveState === 'saved' ? t('word_card_saved') : t('word_card_save')}
        onPress={onSave}
        loading={saveState === 'saving'}
        disabled={saveState === 'saved'}
        style={styles.primaryButton}
      />
      <SecondaryButton
        label={t('word_card_skip')}
        onPress={onSkip}
        style={styles.secondaryButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
  },
  divider: {
    marginVertical: 20,
  },
  bodyText: {
    color: colors.ink,
    marginTop: 8,
  },
  exampleDe: {
    color: colors.ink,
    marginTop: 8,
  },
  exampleBox: { flex: 1, marginTop: 8 },
  sentenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  exampleIt: {
    color: colors.muted,
    marginTop: 4,
  },
  cultural: {
    marginTop: 20,
  },
  badgesRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 8,
  },
  streak: {
    marginTop: 24,
  },
  primaryButton: {
    marginTop: 32,
  },
  secondaryButton: {
    marginTop: 12,
  },
});
