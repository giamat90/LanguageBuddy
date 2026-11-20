import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { t } from '../../i18n';

interface Props {
  count: number;
  style?: ViewStyle;
}

export default function StreakRow({ count, style }: Props) {
  const filled = Math.min(count, 7);
  return (
    <View style={[styles.row, style]} accessibilityLabel={t('streak_label', { count })}>
      <View style={styles.dots}>
        {Array.from({ length: 7 }, (_, i) => (
          <View
            key={i}
            style={[styles.dot, { backgroundColor: i < filled ? colors.gold : colors.mist }]}
          />
        ))}
      </View>
      <Text style={[typography.uiSmall, styles.label]}>{t('streak_label', { count })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    color: colors.muted,
  },
});
