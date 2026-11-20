import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { t } from '../../i18n';
import { localizedText } from '../../i18n/wordContent';
import { useUserStore } from '../../store/useUserStore';
import SentenceSpeaker from './SentenceSpeaker';
import { clozeSentence } from '../../lib/sentenceSpeech';
import PrimaryButton from '../ui/PrimaryButton';
import SecondaryButton from '../ui/SecondaryButton';
import { gradeTypedAnswer } from '../../lib/cloze';
import { typedQuality, type TypedResult } from '../../lib/exercises/quality';
import type { TypedClozeModel } from '../../lib/exercises/types';

interface Props {
  model: TypedClozeModel;
  isRetry: boolean;
  onResult: (quality: number) => void;
}

function letterCount(word: string): number {
  return word.replace(/[^A-Za-zÄÖÜäöüß]/g, '').length;
}

export default function TypedClozeView({ model, isRetry, onResult }: Props) {
  const lang = useUserStore((s) => s.nativeLanguage);
  const { card, before, after } = model;
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<TypedResult | null>(null);
  const [hintUsed, setHintUsed] = useState(false);

  const check = () => {
    if (!answer.trim()) return;
    setResult(gradeTypedAnswer(answer, card.word));
  };

  // Nouns are capitalised in German; show the initial the way it is written.
  const hintLetter = card.article ? card.word.charAt(0).toUpperCase() : card.word.charAt(0);

  return (
    <>
      <View style={styles.cardArea}>
        {isRetry ? (
          <Text style={[typography.uiSmall, styles.retryTag]}>{t('review_retry_label')}</Text>
        ) : null}
        <Text style={[typography.uiSmall, { color: colors.muted, marginBottom: 16 }]}>
          {t('review_cloze_prompt')}
        </Text>
        <Text style={[typography.body, { color: colors.ink, textAlign: 'center' }]}>
          {before}
          <Text style={{ color: colors.forest }}>{result === null ? '_____' : card.word}</Text>
          {after}
        </Text>
        <Text style={[typography.uiSmall, { color: colors.muted, marginTop: 12, textAlign: 'center' }]}>
          {localizedText(lang, 'example', { word: card.word, level: card.cefrBand }, card.exampleIt, card.exampleEn) ?? ''}
        </Text>
        <Text style={[typography.uiSmall, { color: colors.muted, marginTop: 4 }]}>
          {localizedText(lang, 'meaning', { word: card.word, level: card.cefrBand }, card.translationIt, card.translationEn) ?? ''}
        </Text>

        {result === null ? (
          <>
            {hintUsed ? (
              <Text style={[typography.uiSmall, { color: colors.forest, marginTop: 16 }]}>
                {t('review_hint_text', { letter: hintLetter, count: letterCount(card.word) })}
              </Text>
            ) : (
              <TouchableOpacity
                onPress={() => setHintUsed(true)}
                style={styles.hintButton}
                accessibilityRole="button"
                accessibilityLabel={t('review_hint')}
              >
                <Text style={[typography.uiSmall, { color: colors.forest }]}>{t('review_hint')}</Text>
              </TouchableOpacity>
            )}
            <TextInput
              style={styles.input}
              value={answer}
              onChangeText={setAnswer}
              placeholder={t('review_cloze_placeholder')}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={check}
              accessibilityLabel={t('review_cloze_placeholder')}
            />
          </>
        ) : (
          <Text
            style={[
              typography.body,
              { color: result === 'wrong' ? colors.ink : colors.forest, marginTop: 20, textAlign: 'center' },
            ]}
          >
            {result === 'exact'
              ? t('review_correct')
              : result === 'close'
                ? t('review_almost', { word: card.word })
                : t('review_answer_was', { word: card.word })}
          </Text>
        )}
        {result !== null ? <SentenceSpeaker sentence={clozeSentence(before, card.word, after)} /> : null}
      </View>

      <View style={styles.footer}>
        {result === null ? (
          <View style={styles.gradeRow}>
            <SecondaryButton
              label={t('review_dont_know')}
              onPress={() => setResult('wrong')}
              style={styles.gradeButton}
            />
            <PrimaryButton label={t('review_check')} onPress={check} style={styles.gradeButton} />
          </View>
        ) : (
          <PrimaryButton
            label={t('review_continue')}
            onPress={() => onResult(typedQuality(result, hintUsed))}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  footer: { padding: 24 },
  gradeRow: { flexDirection: 'row', gap: 12 },
  gradeButton: { flex: 1 },
  retryTag: {
    color: colors.forest,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  hintButton: { marginTop: 16, paddingVertical: 8, paddingHorizontal: 12 },
  input: {
    marginTop: 16,
    width: '100%',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    borderRadius: 14,
    padding: 16,
    fontSize: 18,
    color: colors.ink,
    textAlign: 'center',
  },
});
