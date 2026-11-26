import React from 'react';
import { Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { t } from '../../i18n';

/** "Show pinyin": only rendered by a language with a reading layer, when something is hidden. */
export default function RevealPinyinButton({ onPress, style }: { onPress: () => void; style?: ViewStyle }) {
  return (
    <TouchableOpacity
      testID="reveal-pinyin"
      onPress={onPress}
      style={[styles.button, style]}
      hitSlop={{ top: 6, bottom: 6 }}
      accessibilityRole="button"
      accessibilityLabel={t('reading_show_pinyin')}
    >
      <Text style={[typography.uiSmall, { color: colors.forest }]}>{t('reading_show_pinyin')}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { marginTop: 8, paddingVertical: 8, paddingRight: 12, minHeight: 32 },
});
