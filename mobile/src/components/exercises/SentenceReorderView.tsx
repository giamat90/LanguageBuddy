import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { t } from '../../i18n';
import { localizedText } from '../../i18n/wordContent';
import { useUserStore } from '../../store/useUserStore';
import SentenceSpeaker from './SentenceSpeaker';
import { reorderSentence } from '../../lib/sentenceSpeech';
import { joinTokens } from '../../lib/sentence';
import PrimaryButton from '../ui/PrimaryButton';
import SecondaryButton from '../ui/SecondaryButton';
import { FORMAT_QUALITY, pinyinQuality } from '../../lib/exercises/quality';
import { getActivePack } from '../../languages';
import { rubyCells } from '../../lib/reading/ruby';
import { tilePinyin } from '../../lib/reading/tiles';
import RevealPinyinButton from '../ui/RevealPinyinButton';
import { useExercisePinyin } from './useExercisePinyin';
import { gradeReorder, type ReorderResult } from '../../lib/exercises/reorder';
import type { SentenceReorderModel } from '../../lib/exercises/types';

interface Props {
  model: SentenceReorderModel;
  isRetry: boolean;
  onResult: (quality: number) => void;
}

export default function SentenceReorderView({ model, isRetry, onResult }: Props) {
  const lang = useUserStore((s) => s.nativeLanguage);
  const { card, tokens, solution } = model;
  // Tiles are identified by their index in `tokens`.
  const [placed, setPlaced] = useState<number[]>([]);
  const [result, setResult] = useState<ReorderResult | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  const pool = tokens.map((_, i) => i).filter((i) => !placed.includes(i));
  const done = result !== null;
  const sentence = joinTokens(solution);
  const pinyin = useExercisePinyin(done);
  const cells = getActivePack().reading ? rubyCells(card.segments, card.examplePinyin) : null;
  const above = tilePinyin(tokens, solution, cells);
  const face = (i: number) => (
    <>
      {pinyin.shows(card) && above[i] ? (
        <Text style={[typography.articleMeta, { color: colors.muted, textAlign: 'center' }]}>{above[i]}</Text>
      ) : null}
      <Text style={[typography.body, { color: colors.ink, textAlign: 'center' }]}>{tokens[i]}</Text>
    </>
  );
  const give = (quality: number) => onResult(pinyinQuality(quality, pinyin.peeked(card)));

  const check = () => setResult(gradeReorder(placed.map((i) => tokens[i]), solution));
  const giveUp = () => {
    setGaveUp(true);
    setResult('wrong');
  };

  return (
    <>
      <View style={styles.cardArea}>
        {isRetry ? (
          <Text style={[typography.uiSmall, styles.retryTag]}>{t('review_retry_label')}</Text>
        ) : null}
        <Text style={[typography.uiSmall, { color: colors.muted, marginBottom: 12 }]}>
          {t('review_reorder_prompt')}
        </Text>
        <Text style={[typography.body, { color: colors.ink, textAlign: 'center' }]}>
          {localizedText(lang, 'example', { word: card.word, level: card.cefrBand }, card.exampleIt, card.exampleEn) ?? ''}
        </Text>

        <View style={styles.answerLine} accessibilityLabel={t('review_reorder_prompt')}>
          {placed.map((i, slot) => (
            <TouchableOpacity
              key={`placed-${i}`}
              testID={`reorder-placed-${slot}`}
              style={[styles.tile, styles.tilePlaced]}
              onPress={() => setPlaced(placed.filter((p) => p !== i))}
              disabled={done}
              accessibilityRole="button"
              accessibilityLabel={tokens[i]}
              activeOpacity={0.75}
            >
              {face(i)}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.pool}>
          {pool.map((i) => (
            <TouchableOpacity
              key={`pool-${i}`}
              testID={`reorder-pool-${i}`}
              style={styles.tile}
              onPress={() => setPlaced([...placed, i])}
              disabled={done}
              accessibilityRole="button"
              accessibilityLabel={tokens[i]}
              activeOpacity={0.75}
            >
              {face(i)}
            </TouchableOpacity>
          ))}
        </View>
        {cells && pinyin.offers([card]) ? <RevealPinyinButton onPress={pinyin.reveal} /> : null}

        {!done && placed.length > 0 ? (
          <TouchableOpacity
            onPress={() => setPlaced([])}
            style={styles.clear}
            accessibilityRole="button"
            accessibilityLabel={t('review_reorder_clear')}
          >
            <Text style={[typography.uiSmall, { color: colors.forest }]}>{t('review_reorder_clear')}</Text>
          </TouchableOpacity>
        ) : null}

        {done ? (
          <Text
            style={[
              typography.body,
              { color: result === 'exact' ? colors.forest : colors.ink, marginTop: 16, textAlign: 'center' },
            ]}
          >
            {result === 'exact' ? t('review_correct') : t('review_reorder_correct_was', { sentence })}
          </Text>
        ) : null}
        {done ? <SentenceSpeaker sentence={reorderSentence(solution)} /> : null}
      </View>

      <View style={styles.footer}>
        {!done ? (
          <View style={styles.row}>
            <SecondaryButton label={t('review_dont_know')} onPress={giveUp} style={styles.rowButton} />
            <PrimaryButton
              label={t('review_check')}
              onPress={check}
              disabled={placed.length !== tokens.length}
              style={styles.rowButton}
            />
          </View>
        ) : result === 'exact' ? (
          <PrimaryButton
            label={t('review_continue')}
            onPress={() => give(FORMAT_QUALITY.sentence_reorder.exact)}
          />
        ) : (
          <View style={styles.row}>
            {!gaveUp ? (
              <SecondaryButton
                label={t('review_reorder_mine_ok')}
                onPress={() => give(FORMAT_QUALITY.sentence_reorder.selfApproved)}
                style={styles.rowButton}
              />
            ) : null}
            <PrimaryButton
              label={t('review_continue')}
              onPress={() => give(FORMAT_QUALITY.sentence_reorder.wrong)}
              style={styles.rowButton}
            />
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  answerLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    minHeight: 64,
    width: '100%',
    marginTop: 20,
    paddingVertical: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
  },
  pool: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 20 },
  tile: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  tilePlaced: { borderColor: colors.forest, backgroundColor: colors.mist },
  clear: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 12 },
  footer: { padding: 24, minHeight: 104 },
  row: { flexDirection: 'row', gap: 12 },
  rowButton: { flex: 1 },
  retryTag: {
    color: colors.forest,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
});
