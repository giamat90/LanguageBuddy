import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ArticleBadge from './ArticleBadge';
import { getActivePack } from '../../languages';

interface Props {
  word: string;
  article: string | null | undefined;
  ipa: string | null | undefined;
  style?: ViewStyle;
}

export default function WordHero({ word, article, ipa, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      {article ? (
        <ArticleBadge article={article} word={word} style={styles.badge} />
      ) : null}
      <Text style={[typography.wordHero, styles.word]}>{word}</Text>
      {ipa ? (
        <Text style={[typography.articleMeta, styles.ipa]}>
          {getActivePack().pronunciation === 'ipa' ? `/${ipa}/` : ipa}
        </Text>
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
