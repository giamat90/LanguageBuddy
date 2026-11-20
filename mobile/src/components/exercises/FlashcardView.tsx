import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { t } from '../../i18n';
import { localizedText } from '../../i18n/wordContent';
import { useUserStore } from '../../store/useUserStore';
import ArticleBadge from '../ui/ArticleBadge';
import PrimaryButton from '../ui/PrimaryButton';
import SecondaryButton from '../ui/SecondaryButton';
import type { FlashcardModel } from '../../lib/exercises/types';

interface Props {
  model: FlashcardModel;
  isRetry: boolean;
  onResult: (quality: number) => void;
}

export default function FlashcardView({ model, isRetry, onResult }: Props) {
  const lang = useUserStore((s) => s.nativeLanguage);
  const { card } = model;
  const [revealed, setRevealed] = useState(false);

  return (
    <>
      <View style={styles.cardArea}>
        {isRetry ? (
          <Text style={[typography.uiSmall, styles.retryTag]}>{t('review_retry_label')}</Text>
        ) : null}
        <View style={styles.wordRow}>
          {card.article ? <ArticleBadge article={card.article} /> : null}
          <Text style={[typography.wordHero, { color: colors.ink }]}>{card.word}</Text>
        </View>

        {revealed ? (
          <Text style={[typography.body, { color: colors.forest, marginTop: 16, textAlign: 'center' }]}>
            {localizedText(lang, 'meaning', { word: card.word, level: card.cefrBand }, card.translationIt, card.translationEn) ?? '—'}
          </Text>
        ) : (
          <Text style={[typography.uiSmall, { color: colors.muted, marginTop: 16 }]}>
            {t('review_tap_to_reveal')}
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        {revealed ? (
          <View style={styles.gradeRow}>
            <SecondaryButton label={t('review_forgot')} onPress={() => onResult(0)} style={styles.gradeButton} />
            <PrimaryButton label={t('review_knew')} onPress={() => onResult(1)} style={styles.gradeButton} />
          </View>
        ) : (
          <PrimaryButton label={t('review_reveal')} onPress={() => setRevealed(true)} />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  footer: { padding: 24 },
  gradeRow: { flexDirection: 'row', gap: 12 },
  gradeButton: { flex: 1 },
  retryTag: {
    color: colors.forest,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
});
