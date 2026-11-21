import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { getActivePack, type Gender } from '../../languages';

interface Props {
  article: string | null | undefined;
  word?: string;
  style?: ViewStyle;
}

// Token names keep the German articles they were drawn for; the gender comes from the language pack.
const GENDER_STYLE: Record<Gender, { bg: string; text: string }> = {
  m: { bg: colors.derBlueBg, text: colors.derBlue },
  f: { bg: colors.diePinkBg, text: colors.diePink },
  n: { bg: colors.dasGrayBg, text: colors.dasGray },
};

export default function ArticleBadge({ article, word, style }: Props) {
  if (!article) return null;
  const gender = getActivePack().articles?.genderOf(article);
  const genderStyle = (gender && GENDER_STYLE[gender]) || { bg: colors.mist, text: colors.muted };
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
