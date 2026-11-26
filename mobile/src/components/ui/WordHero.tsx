import React, { useState } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ArticleBadge from './ArticleBadge';
import { getActivePack } from '../../languages';
import { showWhenReading } from '../../lib/reading/visibility';
import { useReadingSettingsStore } from '../../store/useReadingSettingsStore';
import RevealPinyinButton from './RevealPinyinButton';

interface Props {
  word: string;
  article: string | null | undefined;
  ipa: string | null | undefined;
  style?: ViewStyle;
}

export default function WordHero({ word, article, ipa, style }: Props) {
  const pack = getActivePack();
  const mode = useReadingSettingsStore((s) => s.pinyinMode);
  // Remembered per word, so the next one starts hidden again.
  const [revealed, setRevealed] = useState<string | null>(null);
  const hidden = pack.reading !== null && revealed !== word && !showWhenReading(mode);
  return (
    <View style={[styles.container, style]}>
      {article ? (
        <ArticleBadge article={article} word={word} style={styles.badge} />
      ) : null}
      <Text style={[typography.wordHero, styles.word]}>{word}</Text>
      {ipa ? (
        hidden ? (
          <RevealPinyinButton onPress={() => setRevealed(word)} />
        ) : (
          <Text style={[typography.articleMeta, styles.ipa]}>
            {pack.pronunciation === 'ipa' ? `/${ipa}/` : ipa}
          </Text>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  badge: {
    marginBottom: 6,
  },
  word: {
    color: colors.ink,
  },
  ipa: {
    color: colors.muted,
    marginTop: 4,
  },
});
