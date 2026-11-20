import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { LANGUAGES, type NativeLanguage } from '../../i18n/language';

interface Props {
  value: NativeLanguage;
  onChange: (lang: NativeLanguage) => void;
  disabled?: boolean;
}

/** The app-language choice: wrapping radio pills, each labelled in its own language. */
export default function LanguagePicker({ value, onChange, disabled }: Props) {
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {LANGUAGES.map(({ code, label }) => {
        const selected = code === value;
        return (
          <Pressable
            key={code}
            testID={`lang-${code}`}
            onPress={() => {
              if (!disabled) onChange(code);
            }}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ selected, disabled: !!disabled }}
            style={[styles.pill, selected && styles.pillSelected]}
          >
            <Text
              style={[typography.uiSmall, styles.label, selected && styles.labelSelected]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  pill: {
    // three per row; no flexGrow so the last row (13 languages = 4x3 + 1) keeps the same width
    width: '31.5%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.mist,
    alignItems: 'center',
  },
  pillSelected: { backgroundColor: colors.forest, borderColor: colors.forest },
  label: { color: colors.ink },
  labelSelected: { color: colors.paper },
});
