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
import { gradeTypedAnswer, letterCount } from '../../lib/cloze';
import { pinyinQuality, typedQuality, type TypedResult } from '../../lib/exercises/quality';
import { getActivePack } from '../../languages';
import { rubyCells, blankCell, neutralCells } from '../../lib/reading/ruby';
import type { PinyinResult } from '../../lib/reading/pinyin';
import PinyinSentence from '../ui/PinyinSentence';
import RevealPinyinButton from '../ui/RevealPinyinButton';
import { useExercisePinyin } from './useExercisePinyin';
import type { TypedClozeModel } from '../../lib/exercises/types';

interface Props {
  model: TypedClozeModel;
  isRetry: boolean;
  onResult: (quality: number) => void;
}

export default function TypedClozeView({ model, isRetry, onResult }: Props) {
  const lang = useUserStore((s) => s.nativeLanguage);
  const { card, before, after } = model;
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<TypedResult | PinyinResult | null>(null);
  const [hintUsed, setHintUsed] = useState(false);

  // A language with a reading layer also takes the answer written in Latin letters.
  const { reading } = getActivePack();
  const syllables = reading ? card.syllables : null;
  const pinyin = useExercisePinyin(result !== null);
  const cells = reading ? rubyCells(card.segments, card.examplePinyin) : null;
  const blank = cells ? blankCell(cells, card.word, before) : -1;
  const ruby = blank >= 0 ? cells : null;
  const rubyShown = ruby !== null && pinyin.shows(card);

  const check = () => {
    if (!answer.trim()) return;
    setResult(
      reading && syllables && reading.isInput(answer)
        ? reading.grade(answer, syllables, ruby?.[blank].pinyin)
        : gradeTypedAnswer(answer, card.word),
    );
  };

  const quality = (outcome: TypedResult | PinyinResult) => {
    // Right letters without the tones is a near miss; a wrong tone is a wrong word.
    const graded = outcome === 'missing_tones' ? 'close' : outcome === 'wrong_tone' ? 'wrong' : outcome;
    return pinyinQuality(typedQuality(graded, hintUsed), pinyin.peeked(card));
  };

  const feedback = (outcome: TypedResult | PinyinResult) => {
    switch (outcome) {
      case 'exact': return t('review_correct');
      case 'close': return t('review_almost', { word: card.word });
      case 'missing_tones': return t('reading_missing_tones');
      case 'wrong_tone': return t('reading_wrong_tone');
      case 'wrong': return t('review_answer_was', { word: card.word });
    }
  };
  const placeholder = syllables ? t('reading_cloze_placeholder') : t('review_cloze_placeholder');

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
        {ruby && rubyShown ? (
          <PinyinSentence
            // Until the answer, the word before the blank does not tell the blank's tone.
            cells={result === null ? neutralCells(ruby, reading!.citations, blank) : ruby}
            blank={{ index: blank, filled: result !== null }}
            label={`${before}${result === null ? '_____' : card.word}${after}`}
            centered
          />
        ) : (
          <Text style={[typography.body, { color: colors.ink, textAlign: 'center' }]}>
            {before}
            <Text style={{ color: colors.forest }}>{result === null ? '_____' : card.word}</Text>
            {after}
          </Text>
        )}
        {ruby && pinyin.offers([card]) ? <RevealPinyinButton onPress={pinyin.reveal} /> : null}
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
                {reading && syllables
                  ? t('reading_hint_text', reading.hint(syllables))
                  : t('review_hint_text', { letter: hintLetter, count: letterCount(card.word) })}
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
              placeholder={placeholder}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={check}
              accessibilityLabel={placeholder}
            />
          </>
        ) : (
          <>
            <Text
              style={[
                typography.body,
                {
                  color: result === 'wrong' || result === 'wrong_tone' ? colors.ink : colors.forest,
                  marginTop: 20,
                  textAlign: 'center',
                },
              ]}
            >
              {feedback(result)}
            </Text>
            {/* Without the sentence cells the pronunciation still has to appear once answered. */}
            {syllables && !ruby ? (
              <Text style={[typography.body, { color: colors.muted, marginTop: 4 }]}>{card.pronunciation}</Text>
            ) : null}
          </>
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
            onPress={() => onResult(quality(result))}
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
