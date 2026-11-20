import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface Props {
  label: string;
  style?: TextStyle;
}

export default function SectionLabel({ label, style }: Props) {
  return (
    <Text style={[typography.sectionLabel, styles.text, style]}>{label}</Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: colors.muted,
  },
});
