import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { t } from '../i18n';
import { dateLocale } from '../i18n/language';
import { localizedText } from '../i18n/wordContent';
import { useUserStore } from '../store/useUserStore';
import {
  fetchVaultWord, getWordInsight, saveWordInsight,
} from '../services/vaultService';
import { VaultWordDetail } from '../types/domain';
import { generateWordInsight, type WordInsightResult } from '../lib/ai/wordInsight';
import WordHero from '../components/ui/WordHero';
import SectionLabel from '../components/ui/SectionLabel';
import CulturalNote from '../components/ui/CulturalNote';
import CefrBadge from '../components/ui/CefrBadge';
import PrimaryButton from '../components/ui/PrimaryButton';
import SecondaryButton from '../components/ui/SecondaryButton';
import Divider from '../components/ui/Divider';
import SpeakButton from '../components/ui/SpeakButton';
import { useSpeech } from '../hooks/useSpeech';
import { speechText } from '../lib/speech';
import { filledExercise } from '../lib/sentenceSpeech';

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

type InsightError = 'missing_key' | 'failed' | null;

export default function WordDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { speakingId, toggle } = useSpeech();
  const lang = useUserStore((s) => s.nativeLanguage);
  const [item, setItem] = useState<VaultWordDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [insight, setInsight] = useState<WordInsightResult | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<InsightError>(null);
  const [answerShown, setAnswerShown] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setInsight(null);
    setInsightError(null);
    setAnswerShown(false);
    fetchVaultWord(String(id))
      .then((res) => {
        if (!active) return;
        setItem(res);
        if (res) getWordInsight(res.word, lang).then((c) => { if (active) setInsight(c); }).catch(() => {});
      })
      .catch((e) => { console.error('[WordDetail] load failed:', e); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, lang]);

  const ref = { word: item?.word ?? '', level: item?.cefrBand ?? null };
  const meaning = item ? localizedText(lang, 'meaning', ref, item.meaningIt, item.meaningEn) : null;
  const example = item ? localizedText(lang, 'example', ref, item.exampleIt, item.exampleEn) : null;
  const note = item ? localizedText(lang, 'note', ref, item.culturalNote, item.culturalNoteEn) : null;

  const loadInsight = async () => {
    if (!item || insightLoading) return;
    setInsightLoading(true);
    setInsightError(null);
    setAnswerShown(false);
    try {
      const result = await generateWordInsight({
        word: item.word,
        article: item.article,
        meaningNative: localizedText(lang, 'meaning', ref, item.meaningIt, item.meaningEn),
        cefrLevel: item.cefrBand ?? 'A1',
        nativeLanguage: lang,
      });
      await saveWordInsight(item.word, result, lang);
      setInsight(result);
    } catch (e: any) {
      console.error('[WordDetail] insight failed:', e);
      setInsightError(e?.name === 'MissingApiKeyError' ? 'missing_key' : 'failed');
    } finally {
      setInsightLoading(false);
    }
  };

  const reviewIn = item ? daysUntil(item.nextReviewAt) : 0;

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
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.forest} size="large" />
        </View>
      ) : !item ? (
        <View style={styles.centered}>
          <Text style={[typography.body, { color: colors.muted }]}>
            {t('word_detail_not_found')}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <WordHero word={item.word} article={item.article} ipa={item.ipa} />
            </View>
            <SpeakButton
              word={item.word}
              speaking={speakingId === item.id}
              onPress={() => toggle(item.id, speechText(item.word, item.article))}
              testID="speak-detail"
            />
          </View>

          <Divider style={styles.divider} />

          <SectionLabel label={t('word_detail_translation')} />
          {meaning ? <Text style={[typography.body, styles.bodyText]}>{meaning}</Text> : null}

          {item.example ? (
            <>
              <Divider style={styles.divider} />
              <SectionLabel label={t('word_section_example')} />
              <View style={styles.sentenceRow}>
                <Text style={[typography.exampleDe, styles.bodyText, { flex: 1 }]}>{item.example}</Text>
                <SpeakButton
                  kind="sentence"
                  speaking={speakingId === 'sentence:example'}
                  onPress={() => toggle('sentence:example', item.example as string)}
                  testID="speak-example"
                />
              </View>
              {example ? <Text style={[typography.uiSmall, styles.exampleIt]}>{example}</Text> : null}
            </>
          ) : null}

          {note ? (
            <>
              <Divider style={styles.divider} />
              <SectionLabel label={t('word_section_cultural')} />
              <CulturalNote
                text={note}
                style={{ marginTop: 8 }}
              />
            </>
          ) : null}

          <Divider style={styles.divider} />

          <SectionLabel label={t('word_detail_progress_section')} />
          <View style={styles.progressRow}>
            <Text style={[typography.uiSmall, { color: colors.muted }]}>
              {t('word_detail_retention')}
            </Text>
            <View style={styles.retentionTrack}>
              <View
                style={[
                  styles.retentionFill,
                  { width: `${Math.round(item.retentionScore * 100)}%` as any },
                ]}
              />
            </View>
          </View>
          <Text style={[typography.uiSmall, styles.metaLine]}>
            {reviewIn <= 0
              ? t('word_detail_next_review_today')
              : t('word_detail_next_review_days', { count: reviewIn })}
          </Text>
          <Text style={[typography.uiSmall, styles.metaLine]}>
            {t('word_detail_added', {
              date: new Date(item.firstSeenAt).toLocaleDateString(dateLocale(lang)),
            })}
          </Text>

          {item.cefrBand ? (
            <View style={styles.badgeRow}>
              <CefrBadge level={item.cefrBand} />
            </View>
          ) : null}

          <Divider style={styles.divider} />

          <SectionLabel label={t('insight_section')} />
          {insight ? (
            <View style={{ marginTop: 8 }}>
              {insight.examples.map((ex, i) => (
                <View key={i} style={styles.coachExample}>
                  <View style={styles.sentenceRow}>
                    <Text style={[typography.exampleDe, { color: colors.ink, flex: 1 }]}>{ex.target}</Text>
                    <SpeakButton
                      kind="sentence"
                      speaking={speakingId === `sentence:insight-${i}`}
                      onPress={() => toggle(`sentence:insight-${i}`, ex.target)}
                      testID={`speak-insight-${i}`}
                    />
                  </View>
                  <Text style={[typography.uiSmall, styles.exampleIt]}>{ex.native}</Text>
                </View>
              ))}
              <CulturalNote text={insight.note} style={{ marginTop: 12 }} />

              {insight.exercise ? (
                <View style={styles.exerciseBox}>
                  <Text style={[typography.uiSmall, styles.sectionLabelSm]}>
                    {t('insight_exercise_label')}
                  </Text>
                  <Text style={[typography.exampleDe, { color: colors.ink, marginTop: 6 }]}>
                    {insight.exercise.sentence}
                  </Text>
                  {answerShown ? (
                    <View style={styles.sentenceRow}>
                      <Text style={[typography.body, { color: colors.forest, marginTop: 8, flex: 1 }]}>
                        {insight.exercise.answer}
                      </Text>
                      <SpeakButton
                        kind="sentence"
                        speaking={speakingId === 'sentence:insight-exercise'}
                        onPress={() =>
                          toggle('sentence:insight-exercise', filledExercise(insight.exercise!.sentence, insight.exercise!.answer))
                        }
                        testID="speak-insight-exercise"
                      />
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setAnswerShown(true)}
                      style={{ marginTop: 8, paddingVertical: 4 }}
                      accessibilityRole="button"
                    >
                      <Text style={[typography.uiButton, { color: colors.forest }]}>
                        {t('insight_exercise_reveal')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={[typography.uiSmall, styles.metaLine]}>{t('insight_blurb')}</Text>
          )}

          {insightError === 'missing_key' ? (
            <Text style={[typography.uiSmall, { color: colors.diePink, marginTop: 8 }]}>
              {t('insight_missing_key')}
            </Text>
          ) : null}
          {insightError === 'failed' ? (
            <Text style={[typography.uiSmall, { color: colors.diePink, marginTop: 8 }]}>
              {t('insight_failed')}
            </Text>
          ) : null}

          {insightError === 'missing_key' ? (
            <SecondaryButton
              label={t('insight_open_settings')}
              onPress={() => router.push('/(app)/settings')}
              style={{ marginTop: 12 }}
            />
          ) : (
            <PrimaryButton
              label={insight ? t('insight_regenerate') : t('insight_cta')}
              onPress={loadInsight}
              loading={insightLoading}
              style={{ marginTop: 12 }}
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'flex-start' },
  header: {
    paddingHorizontal: 12,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  divider: {
    marginVertical: 20,
  },
  bodyText: {
    color: colors.ink,
    marginTop: 8,
  },
  sentenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  exampleIt: {
    color: colors.muted,
    marginTop: 4,
  },
  progressRow: {
    marginTop: 12,
    gap: 6,
  },
  retentionTrack: {
    height: 4,
    backgroundColor: colors.mist,
    borderRadius: 2,
    overflow: 'hidden',
  },
  retentionFill: {
    height: '100%',
    backgroundColor: colors.forest,
    borderRadius: 2,
  },
  metaLine: {
    color: colors.muted,
    marginTop: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 20,
  },
  coachExample: {
    marginBottom: 12,
  },
  exerciseBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabelSm: {
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
