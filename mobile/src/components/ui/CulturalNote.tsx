import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { exampleStyle } from '../../theme/typography';

interface Props {
  text: string;
  style?: ViewStyle;
}

export default function CulturalNote({ text, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <Text style={[exampleStyle(), { color: colors.ink }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.goldLight,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
});
