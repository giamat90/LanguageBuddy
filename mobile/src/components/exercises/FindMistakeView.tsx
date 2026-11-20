import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { t } from '../../i18n';
import { localizedText } from '../../i18n/wordContent';
import { useUserStore } from '../../store/useUserStore';
import SentenceSpeaker from './SentenceSpeaker';
import { correctedSentence } from '../../lib/sentenceSpeech';
import PrimaryButton from '../ui/PrimaryButton';
import { mistakeQuality, splitToken } from '../../lib/exercises/mistake';
import type { FindMistakeModel } from '../../lib/exercises/types';

interface Props {
  model: FindMistakeModel;
  isRetry: boolean;
  onResult: (quality: number) => void;
}

export default function FindMistakeView({ model, isRetry, onResult }: Props) {
  const lang = useUserStore((s) => s.nativeLanguage);
  const { card, tokens, wrongIndex, options, correctOption, ruleCode } = model;
  // Step 1: tap the wrong word. Step 2 (only if it was the right one): pick the right form.
  const [tapped, setTapped] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);

  const found = tapped === wrongIndex;
  const missed = tapped !== null && !found;
  const fixed = chosen !== null && chosen === correctOption;
  const done = missed || chosen !== null;

  const wrongWord = splitToken(tokens[wrongIndex]).core;
  const rightWord = splitToken(model.correctToken).core;

  const chipStyle = (i: number) => {
    if (i === wrongIndex && (found || missed)) return styles.chipError;
    if (i === tapped && missed) return styles.chipDimmed;
    return null;
  };

  return (
    <>
      <View style={styles.cardArea}>
        {isRetry ? (
          <Text style={[typography.uiSmall, styles.retryTag]}>{t('review_retry_label')}</Text>
        ) : null}
        <Text style={[typography.uiSmall, { color: colors.muted, marginBottom: 12 }]}>
          {t('review_mistake_prompt')}
        </Text>

        <View style={styles.sentence}>
          {tokens.map((token, i) => (
            <TouchableOpacity
              key={`${i}-${token}`}
              testID={`mistake-token-${i}`}
              style={[styles.chip, chipStyle(i)]}
              onPress={() => setTapped(i)}
              disabled={tapped !== null}
              accessibilityRole="button"
              accessibilityLabel={token}
              accessibilityState={{ disabled: tapped !== null }}
              activeOpacity={0.75}
            >
              <Text style={[typography.body, { color: colors.ink }]}>{token}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[typography.uiSmall, { color: colors.muted, marginTop: 12, textAlign: 'center' }]}>
          {localizedText(lang, 'example', { word: card.word, level: card.cefrBand }, card.exampleIt, card.exampleEn) ?? ''}
        </Text>

        {found ? (
          <View style={styles.options}>
            <Text style={[typography.uiSmall, { color: colors.muted, marginBottom: 8 }]}>
              {t('review_mistake_fix_prompt')}
            </Text>
            {options.map((option, k) => {
              const isRight = chosen !== null && k === correctOption;
              const isWrongPick = chosen !== null && k === chosen && !fixed;
              return (
                <TouchableOpacity
                  key={option}
                  testID={`mistake-option-${k}`}
                  style={[styles.option, isRight && styles.optionRight, isWrongPick && styles.optionWrong]}
                  onPress={() => setChosen(k)}
                  disabled={chosen !== null}
                  accessibilityRole="button"
                  accessibilityLabel={option}
                  accessibilityState={{ disabled: chosen !== null, selected: k === chosen }}
                  activeOpacity={0.75}
                >
                  <Text style={[typography.body, { color: colors.ink }]}>{option}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {done ? (
          <View style={{ marginTop: 16, alignItems: 'center' }}>
            <Text
              style={[typography.body, { color: fixed ? colors.forest : colors.ink, textAlign: 'center' }]}
            >
              {missed
                ? t('review_mistake_missed', { wrong: wrongWord, right: rightWord })
                : fixed
                  ? t('review_correct')
                  : t('review_mistake_fix_was', { form: options[correctOption] })}
            </Text>
            <Text style={[typography.uiSmall, { color: colors.muted, marginTop: 8, textAlign: 'center' }]}>
              {t(`grammar_rule_${ruleCode}` as Parameters<typeof t>[0])}
            </Text>
            <SentenceSpeaker sentence={correctedSentence(tokens, wrongIndex, model.correctToken)} />
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        {done ? (
          <PrimaryButton
            label={t('review_continue')}
            onPress={() => onResult(mistakeQuality(found, fixed))}
          />
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  sentence: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  chip: {
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    minHeight: 44,
    minWidth: 44, // short words like "ist" must still be an easy tap target
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipError: { borderColor: colors.diePink, backgroundColor: colors.cream },
  chipDimmed: { opacity: 0.5 },
  options: { width: '100%', gap: 8, marginTop: 20 },
  option: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 52,
    justifyContent: 'center',
  },
  optionRight: { borderColor: colors.forest, backgroundColor: colors.mist },
  optionWrong: { borderColor: colors.diePink },
  footer: { padding: 24, minHeight: 104 },
  retryTag: {
    color: colors.forest,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
});
