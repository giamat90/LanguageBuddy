import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { t } from '../../i18n';
import { localizedText } from '../../i18n/wordContent';
import { useUserStore } from '../../store/useUserStore';
import { useSpeech } from '../../hooks/useSpeech';
import SpeakButton from '../ui/SpeakButton';
import PrimaryButton from '../ui/PrimaryButton';
import { FORMAT_QUALITY } from '../../lib/exercises/quality';
import type { ToneChoiceModel } from '../../lib/exercises/types';

interface Props {
  model: ToneChoiceModel;
  isRetry: boolean;
  onResult: (quality: number) => void;
}

export default function ToneChoiceView({ model, isRetry, onResult }: Props) {
  const lang = useUserStore((s) => s.nativeLanguage);
  const { card, options, correctIndex } = model;
  const [chosen, setChosen] = useState<number | null>(null);
  const { speakingId, toggle } = useSpeech();

  const answered = chosen !== null;
  const correct = chosen === correctIndex;

  return (
    <>
      <View style={styles.cardArea}>
        {isRetry ? (
          <Text style={[typography.uiSmall, styles.retryTag]}>{t('review_retry_label')}</Text>
        ) : null}
        <Text style={[typography.uiSmall, { color: colors.muted, marginBottom: 16 }]}>
          {t('reading_tone_prompt')}
        </Text>

        <View style={styles.wordRow}>
          <Text style={[typography.wordHero, { color: colors.ink }]}>{card.word}</Text>
          <SpeakButton
            word={card.word}
            speaking={speakingId === 'tone'}
            onPress={() => toggle('tone', card.word)}
            testID="speak-tone"
          />
        </View>

        <View style={styles.options}>
          {options.map((option, i) => {
            const isRight = answered && i === correctIndex;
            const isWrongPick = answered && i === chosen && !correct;
            return (
              <TouchableOpacity
                key={option}
                testID={`tone-option-${i}`}
                style={[styles.option, isRight && styles.optionRight, isWrongPick && styles.optionWrong]}
                onPress={() => setChosen(i)}
                disabled={answered}
                accessibilityRole="button"
                accessibilityLabel={option}
                accessibilityState={{ disabled: answered, selected: i === chosen }}
                activeOpacity={0.75}
              >
                <Text style={styles.optionText}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {answered ? (
          <>
            <Text
              style={[
                typography.body,
                { color: correct ? colors.forest : colors.ink, marginTop: 16, textAlign: 'center' },
              ]}
            >
              {correct ? t('review_correct') : t('review_mc_answer_was', { answer: options[correctIndex] })}
            </Text>
            <Text style={[typography.uiSmall, { color: colors.muted, marginTop: 4, textAlign: 'center' }]}>
              {localizedText(lang, 'meaning', { word: card.word, level: card.cefrBand }, card.translationIt, card.translationEn) ?? ''}
            </Text>
          </>
        ) : null}
      </View>

      <View style={styles.footer}>
        {answered ? (
          <PrimaryButton
            label={t('review_continue')}
            onPress={() => onResult(correct ? FORMAT_QUALITY.tone_choice : 0)}
          />
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  options: { width: '100%', gap: 10, marginTop: 24 },
  option: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRight: { borderColor: colors.forest, backgroundColor: colors.mist },
  optionWrong: { borderColor: colors.diePink },
  // Large enough to tell the tone marks apart.
  optionText: { fontSize: 20, lineHeight: 28, color: colors.ink },
  footer: { padding: 24, minHeight: 104 },
  retryTag: {
    color: colors.forest,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
});
