import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { t } from '../i18n';
import Divider from '../components/ui/Divider';
import { fetchVaultCards } from '../services/reviewService';
import { PRACTICE_FORMATS, practiceAvailability, type PracticeFormat } from '../lib/exercises';

type Availability = Record<PracticeFormat, boolean>;

export default function PracticeMenuScreen() {
  const router = useRouter();
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    fetchVaultCards()
      .then((cards) => {
        setEmpty(cards.length === 0);
        setAvailability(practiceAvailability(cards));
      })
      .catch((err) => {
        console.error('[Practice] failed to load saved words:', err);
        setEmpty(true);
        setAvailability(practiceAvailability([]));
      });
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('nav_back')}
        >
          <Text style={[typography.body, { color: colors.forest }]}>←</Text>
        </TouchableOpacity>
        <Text style={[typography.wordHero, { color: colors.ink, flex: 1 }]}>{t('practice_title')}</Text>
      </View>
      <Divider />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[typography.uiSmall, styles.note]}>{t('practice_note')}</Text>

        {availability === null ? (
          <ActivityIndicator color={colors.forest} style={{ marginTop: 24 }} />
        ) : (
          <>
            {empty ? (
              <Text style={[typography.body, { color: colors.ink, marginBottom: 16 }]}>
                {t('practice_need_words')}
              </Text>
            ) : null}
            {PRACTICE_FORMATS.map((format) => {
              const enabled = availability[format];
              const reason = enabled || empty
                ? null
                : t(format === 'matching' ? 'practice_need_four' : 'practice_nothing');
              return (
                <TouchableOpacity
                  key={format}
                  testID={`practice-format-${format}`}
                  style={[styles.row, !enabled && styles.rowDisabled]}
                  onPress={() =>
                    router.push({ pathname: '/(app)/practice-session', params: { format } })
                  }
                  disabled={!enabled}
                  accessibilityRole="button"
                  accessibilityLabel={t(`practice_format_${format}`)}
                  accessibilityHint={t(`practice_desc_${format}`)}
                  accessibilityState={{ disabled: !enabled }}
                  activeOpacity={0.75}
                >
                  <Text style={[typography.body, { color: enabled ? colors.ink : colors.muted }]}>
                    {t(`practice_format_${format}`)}
                  </Text>
                  <Text style={[typography.uiSmall, { color: colors.muted, marginTop: 2 }]}>
                    {t(`practice_desc_${format}`)}
                  </Text>
                  {reason ? (
                    <Text style={[typography.uiSmall, { color: colors.diePink, marginTop: 4 }]}>{reason}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  note: { color: colors.muted, lineHeight: 18, marginBottom: 20 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    minHeight: 64,
    justifyContent: 'center',
  },
  rowDisabled: { opacity: 0.6 },
});
