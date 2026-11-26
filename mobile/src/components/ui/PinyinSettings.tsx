import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { t } from '../../i18n';
import { getActivePack } from '../../languages';
import { PINYIN_MODES } from '../../lib/reading/visibility';
import { useReadingSettingsStore } from '../../store/useReadingSettingsStore';

/** The settings section "Pinyin": nothing for a language without a reading layer. */
export default function PinyinSettings() {
  const mode = useReadingSettingsStore((s) => s.pinyinMode);
  const setMode = useReadingSettingsStore((s) => s.setPinyinMode);
  if (!getActivePack().reading) return null;

  return (
    <View style={styles.section}>
      <Text style={[typography.sectionLabel, styles.title]}>{t('settings_pinyin_title')}</Text>
      <Text style={[typography.uiSmall, styles.description]}>{t('settings_pinyin_desc')}</Text>
      <View style={styles.card} accessibilityRole="radiogroup">
        {PINYIN_MODES.map((option) => {
          const selected = option === mode;
          return (
            <TouchableOpacity
              key={option}
              testID={`pinyin-mode-${option}`}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => setMode(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={t(`settings_pinyin_${option}`)}
            >
              <Text style={[typography.body, { color: selected ? colors.forest : colors.ink }]}>
                {t(`settings_pinyin_${option}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28 },
  title: { color: colors.muted, marginBottom: 8 },
  description: { color: colors.muted, lineHeight: 18, marginBottom: 12 },
  card: { gap: 8 },
  option: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
    justifyContent: 'center',
  },
  optionSelected: { borderColor: colors.forest, backgroundColor: colors.mist },
});
