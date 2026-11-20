import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface Props {
  article: 'der' | 'die' | 'das' | string | null | undefined;
  word?: string;
  style?: ViewStyle;
}

const GENDER_STYLE: Record<string, { bg: string; text: string }> = {
  der: { bg: colors.derBlueBg, text: colors.derBlue },
  die: { bg: colors.diePinkBg, text: colors.diePink },
  das: { bg: colors.dasGrayBg, text: colors.dasGray },
};

export default function ArticleBadge({ article, word, style }: Props) {
  if (!article) return null;
  const genderStyle = GENDER_STYLE[article] ?? { bg: colors.mist, text: colors.muted };
  return (
    <View
      style={[styles.pill, { backgroundColor: genderStyle.bg }, style]}
      accessibilityLabel={word ? `${article} ${word}` : article}
    >
      <Text style={[typography.uiSmall, { color: genderStyle.text }]}>{article}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
});
