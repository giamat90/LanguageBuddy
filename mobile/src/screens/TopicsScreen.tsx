import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useUserStore } from '../store/useUserStore';
import { submitOnboarding } from '../services/profileService';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { t } from '../i18n';
import { coerceNativeLanguage } from '../i18n/language';
import PrimaryButton from '../components/ui/PrimaryButton';
import { TOPICS, buildTopicPreferences } from '../lib/topics';

// Kept as a re-export: the onboarding tests import it from here.
export { buildTopicPreferences };

export default function TopicsScreen() {
  const router = useRouter();
  const { cefrLevel, nativeLanguage } = useLocalSearchParams<{ cefrLevel: string; nativeLanguage?: string }>();
  const setHasProfile = useUserStore((s) => s.setHasProfile);
  const setCefrLevel = useUserStore((s) => s.setCefrLevel);
  const setNativeLanguage = useUserStore((s) => s.setNativeLanguage);

  const [selected, setSelected] = useState<string[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const toggle = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const prefs = buildTopicPreferences(TOPICS.map((tp) => tp.key), selected);
      const lang = coerceNativeLanguage(nativeLanguage);
      await submitOnboarding({ cefr_level: cefrLevel ?? 'A1', topic_preferences: prefs, native_language: lang });
      setCefrLevel(cefrLevel ?? 'A1');
      setNativeLanguage(lang);
      setHasProfile(true);
      router.replace('/(app)/');
    } catch (e) {
      console.error('[Topics] saving the profile failed:', e);
      setError(t('topics_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[typography.wordHero, { color: colors.ink }]}>
          {t('topics_title')}
        </Text>
        <Text style={[typography.body, { color: colors.muted, marginTop: 8 }]}>
          {t('topics_subtitle')}
        </Text>
      </View>

      <FlatList
        data={TOPICS}
        keyExtractor={(item) => item.key}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.columnWrapper}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => {
          const isSelected = selected.includes(item.key);
          return (
            <TouchableOpacity
              style={[styles.topicCard, isSelected && styles.topicCardSelected]}
              onPress={() => toggle(item.key)}
              activeOpacity={0.75}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
            >
              <Text style={styles.emoji}>{item.emoji}</Text>
              <Text style={[typography.uiSmall, { color: colors.ink, marginTop: 6 }]}>
                {t(item.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.footer}>
        <PrimaryButton
          label={t('topics_cta')}
          onPress={handleSubmit}
          disabled={selected.length < 2 || loading}
          loading={loading}
        />
        {error ? (
          <Text style={[typography.body, { color: colors.diePink, marginTop: 12, textAlign: 'center' }]}>
            {error}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  grid: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  columnWrapper: {
    gap: 12,
  },
  topicCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
  },
  topicCardSelected: {
    borderColor: colors.forest,
    backgroundColor: colors.forestLight,
  },
  emoji: {
    fontSize: 28,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 8,
  },
});
