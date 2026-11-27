import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { t } from '../i18n';
import { getActivePack } from '../languages';
import { useSpeech } from '../hooks/useSpeech';
import PrimaryButton from '../components/ui/PrimaryButton';
import Divider from '../components/ui/Divider';

/**
 * A short guide to the pronunciation, for a language whose pack has one (TASK-076). In onboarding it
 * stands where the placement quiz would be; later the grammar screen opens it.
 */
export default function PrimerScreen() {
  const router = useRouter();
  const { from, nativeLanguage } = useLocalSearchParams<{ from?: string; nativeLanguage?: string }>();
  const { primer, levels } = getActivePack();
  const { speakingId, toggle } = useSpeech();
  const onboarding = from === 'onboarding';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('nav_back')}
        >
          <Text style={[typography.body, { color: colors.forest }]}>←</Text>
        </TouchableOpacity>
        <Text style={[typography.wordHero, styles.title]}>{primer ? t('primer_title') : ''}</Text>
      </View>

      <Divider />

      <ScrollView contentContainerStyle={styles.content}>
        {primer ? (
          <>
            <Text style={[typography.body, { color: colors.ink }]}>{t('primer_intro')}</Text>
            {primer.sections.map((section) => (
              <View key={section.id} style={styles.section}>
                <Text style={[typography.body, styles.sectionTitle]}>{t(`primer_${section.id}_title`)}</Text>
                <Text style={[typography.uiSmall, styles.text]}>{t(`primer_${section.id}_text`)}</Text>
                <View style={styles.examples}>
                  {section.examples.map((example, i) => {
                    const id = `${section.id}-${i}`;
                    return (
                      <TouchableOpacity
                        key={id}
                        testID={`primer-example-${id}`}
                        style={[styles.example, speakingId === id && styles.speaking]}
                        onPress={() => toggle(id, example.text)}
                        accessibilityRole="button"
                        accessibilityLabel={`${example.text} ${example.reading}`}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.character}>{example.text}</Text>
                        <Text style={[typography.uiSmall, { color: colors.muted }]}>{example.reading}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>

      {primer && onboarding ? (
        <View style={styles.footer}>
          <PrimaryButton
            label={t('primer_continue')}
            onPress={() => router.push({ pathname: '/topics', params: { cefrLevel: levels[0], nativeLanguage } })}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  backButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, flex: 1, fontSize: 24, lineHeight: 32 },
  content: { padding: 24, paddingBottom: 40 },
  section: { marginTop: 28 },
  sectionTitle: { color: colors.forest },
  text: { color: colors.ink, marginTop: 6, lineHeight: 20 },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  example: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 64,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speaking: { borderColor: colors.forest, backgroundColor: colors.mist },
  character: { fontSize: 22, lineHeight: 30, color: colors.ink },
  footer: { padding: 24 },
});
