import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { t } from '../../i18n';
import { localizedText } from '../../i18n/wordContent';
import { useUserStore } from '../../store/useUserStore';
import ArticleBadge from '../ui/ArticleBadge';
import PrimaryButton from '../ui/PrimaryButton';
import { FORMAT_QUALITY, pinyinQuality } from '../../lib/exercises/quality';
import RevealPinyinButton from '../ui/RevealPinyinButton';
import { useExercisePinyin } from './useExercisePinyin';
import type { MultipleChoiceModel, MultipleChoiceOption } from '../../lib/exercises/types';

interface Props {
  model: MultipleChoiceModel;
  isRetry: boolean;
  onResult: (quality: number) => void;
}

export default function MultipleChoiceView({ model, isRetry, onResult }: Props) {
  const lang = useUserStore((s) => s.nativeLanguage);
  const { card, direction, options, correctIndex } = model;
  const [chosen, setChosen] = useState<number | null>(null);

  const meaning = (o: MultipleChoiceOption) =>
    localizedText(lang, 'meaning', { word: o.word, level: o.cefrBand }, o.meaningIt, o.meaningEn) ?? '';
  const label = (o: MultipleChoiceOption) =>
    direction === 'to_native' ? meaning(o) : `${o.article ? `${o.article} ` : ''}${o.word}`;

  const answered = chosen !== null;
  const correct = chosen === correctIndex;
  const answerLabel = label(options[correctIndex]);
  const pinyin = useExercisePinyin(answered);

  return (
    <>
      <View style={styles.cardArea}>
        {isRetry ? (
          <Text style={[typography.uiSmall, styles.retryTag]}>{t('review_retry_label')}</Text>
        ) : null}
        <Text style={[typography.uiSmall, { color: colors.muted, marginBottom: 16 }]}>
          {t(direction === 'to_native' ? 'review_mc_prompt_native' : 'review_mc_prompt_target')}
        </Text>

        {direction === 'to_native' ? (
          <View style={styles.wordRow}>
            {card.article ? <ArticleBadge article={card.article} /> : null}
            <Text style={[typography.wordHero, { color: colors.ink }]}>{card.word}</Text>
          </View>
        ) : (
          <Text style={[typography.wordHero, { color: colors.ink, textAlign: 'center' }]}>
            {localizedText(lang, 'meaning', { word: card.word, level: card.cefrBand }, card.translationIt, card.translationEn) ?? ''}
          </Text>
        )}

        {direction === 'to_native' && pinyin.shows(card) && card.pronunciation ? (
          <Text style={[typography.body, { color: colors.muted }]}>{card.pronunciation}</Text>
        ) : null}
        {pinyin.offers([card]) ? <RevealPinyinButton onPress={pinyin.reveal} /> : null}

        <View style={styles.options}>
          {options.map((o, i) => {
            const isRight = answered && i === correctIndex;
            const isWrongPick = answered && i === chosen && !correct;
            return (
              <TouchableOpacity
                key={o.id}
                testID={`mc-option-${i}`}
                style={[styles.option, isRight && styles.optionRight, isWrongPick && styles.optionWrong]}
                onPress={() => setChosen(i)}
                disabled={answered}
                accessibilityRole="button"
                accessibilityLabel={label(o)}
                accessibilityState={{ disabled: answered, selected: i === chosen }}
                activeOpacity={0.75}
              >
                <Text style={[typography.body, { color: colors.ink }]}>{label(o)}</Text>
                {direction === 'to_german' && pinyin.shows(card) && o.pronunciation ? (
                  <Text style={[typography.uiSmall, { color: colors.muted }]}>{o.pronunciation}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {answered ? (
          <Text
            style={[
              typography.body,
              { color: correct ? colors.forest : colors.ink, marginTop: 16, textAlign: 'center' },
            ]}
          >
            {correct ? t('review_correct') : t('review_mc_answer_was', { answer: answerLabel })}
          </Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        {answered ? (
          <PrimaryButton
            label={t('review_continue')}
            onPress={() =>
              onResult(correct ? pinyinQuality(FORMAT_QUALITY.multiple_choice, pinyin.peeked(card)) : 0)
            }
          />
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  options: { width: '100%', gap: 10, marginTop: 24 },
  option: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 56,
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
