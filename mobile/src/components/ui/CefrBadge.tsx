import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface Props {
  level: string;
  style?: ViewStyle;
}

export default function CefrBadge({ level, style }: Props) {
  return (
    <View style={[styles.pill, style]}>
      <Text style={[typography.uiSmall, { color: colors.cream }]}>{level}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.forest,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
});
