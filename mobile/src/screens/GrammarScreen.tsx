import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { t } from '../i18n';
import { localizedText } from '../i18n/wordContent';
import { useUserStore } from '../store/useUserStore';
import PrimaryButton from '../components/ui/PrimaryButton';
import { articleRule, type GrammarQuestion } from '../lib/grammar';
import { getActivePack } from '../languages';
import { showWhenReading } from '../lib/reading/visibility';
import { useReadingSettingsStore } from '../store/useReadingSettingsStore';
import PinyinSentence from '../components/ui/PinyinSentence';
import RevealPinyinButton from '../components/ui/RevealPinyinButton';
import type { CefrLevel } from '../data/wordbank';
import { buildDrill, recordAnswer } from '../services/grammarService';

const DRILL_SIZE = 10;

export default function GrammarScreen() {
  const router = useRouter();
  const lang = useUserStore((s) => s.nativeLanguage);
  const cefrLevel = useUserStore((s) => s.cefrLevel);
  const [questions, setQuestions] = useState<GrammarQuestion[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const pinyinMode = useReadingSettingsStore((s) => s.pinyinMode);
  // By question, so the next one starts hidden again.
  const [revealed, setRevealed] = useState<string | null>(null);

  const load = useCallback(() => {
    setQuestions(null);
    setFailed(false);
    setIndex(0);
    setChosen(null);
    setScore(0);
    setRevealed(null);
    buildDrill((cefrLevel as CefrLevel) ?? 'A1', DRILL_SIZE)
      .then(setQuestions)
      .catch((err) => {
        console.error('[GrammarScreen] buildDrill failed:', err);
        setFailed(true);
      });
  }, [cefrLevel]);

  useEffect(load, [load]);

  const current = questions?.[index];

  const primerLink = getActivePack().primer ? (
    <TouchableOpacity
      testID="grammar-primer"
      onPress={() => router.push('/(app)/primer')}
      style={styles.primerLink}
      accessibilityRole="button"
      accessibilityLabel={t('primer_title')}
    >
      <Text style={[typography.uiSmall, { color: colors.forest, textAlign: 'right' }]}>{t('primer_title')}</Text>
    </TouchableOpacity>
  ) : null;

  const choose = (option: string) => {
    if (!current || chosen !== null) return;
    const correct = option === current.answer;
    setChosen(option);
    if (correct) setScore((s) => s + 1);
    recordAnswer(current.ruleCode, correct).catch((err) =>
      console.error('[GrammarScreen] recordAnswer failed:', err),
    );
  };

  const next = () => {
    setChosen(null);
    setIndex((i) => i + 1);
  };

  if (failed || (questions && questions.length === 0)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={[typography.body, { color: colors.ink, textAlign: 'center' }]}>
            {failed ? t('grammar_load_error') : t('grammar_empty')}
          </Text>
          <PrimaryButton
            label={t('review_back')}
            onPress={() => router.back()}
            style={{ marginTop: 28, width: '100%' }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (questions === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  }

  if (!current) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={[typography.wordHero, { color: colors.ink, textAlign: 'center' }]}>
            {t('grammar_score', { score, total: questions.length })}
          </Text>
          <PrimaryButton label={t('grammar_again')} onPress={load} style={{ marginTop: 28, width: '100%' }} />
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.linkButton}
            accessibilityRole="button"
            // Android reuses the header link's view here and would keep its label.
            accessibilityLabel={t('review_back')}
          >
            <Text style={[typography.body, { color: colors.forest }]}>{t('review_back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const answered = chosen !== null;
  const correct = chosen === current.answer;
  const isArticle = current.ruleCode === articleRule();
  const isMeasure = current.ruleCode === getActivePack().classifiers?.rule;
  // Article and measure questions hint the word's meaning; the others hint the example sentence.
  const hint = localizedText(
    lang,
    isArticle || isMeasure ? 'meaning' : 'example',
    { word: current.word, level: current.cefrBand },
    current.translationIt,
    current.translationEn,
  );
  // Languages with a reading layer: pinyin as on a reading screen, and always once answered.
  const pinyin = current.cells !== undefined && (showWhenReading(pinyinMode) || revealed === current.id || answered);
  const prompt = isArticle
    ? t('grammar_prompt_article')
    : isMeasure ? t('grammar_prompt_measure') : t('grammar_prompt_case');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('review_back')}
        >
          <Text style={[typography.body, { color: colors.forest }]}>←</Text>
        </TouchableOpacity>
        <Text style={[typography.uiSmall, { color: colors.muted }]}>
          {t('review_progress', { current: index + 1, total: questions.length })}
        </Text>
        {primerLink}
      </View>

      <View style={styles.cardArea}>
        <Text style={[typography.uiSmall, { color: colors.muted, marginBottom: 16 }]}>
          {prompt}
        </Text>
        {pinyin ? (
          <PinyinSentence
            cells={current.cells!}
            blank={{ index: current.blank!, filled: answered }}
            label={`${current.before}${answered ? current.answer : '_____'}${current.after}`}
            centered
          />
        ) : (
          <Text style={[isArticle ? typography.wordHero : typography.body, styles.sentence]}>
            {current.before}
            <Text style={{ color: answered && !correct ? colors.diePink : colors.forest }}>
              {answered ? current.answer : '_____'}
            </Text>
            {current.after}
          </Text>
        )}
        {current.cells && !pinyin ? <RevealPinyinButton onPress={() => setRevealed(current.id)} /> : null}
        {hint ? (
          <Text style={[typography.uiSmall, { color: colors.muted, marginTop: 12, textAlign: 'center' }]}>
            {hint}
          </Text>
        ) : null}

        {answered ? (
          <View style={styles.feedback}>
            <Text style={[typography.body, { color: correct ? colors.forest : colors.diePink }]}>
              {correct ? t('grammar_correct') : t('grammar_wrong', { answer: current.answer })}
            </Text>
            {!correct ? (
              <Text style={[typography.uiSmall, { color: colors.muted, marginTop: 8, textAlign: 'center' }]}>
                {t(`grammar_rule_${current.ruleCode}` as Parameters<typeof t>[0])}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        {answered ? (
          <PrimaryButton
            label={index + 1 < questions.length ? t('grammar_next') : t('grammar_finish')}
            onPress={next}
          />
        ) : (
          <View style={styles.options}>
            {current.options.map((option, k) => (
              <TouchableOpacity
                key={option}
                style={styles.option}
                onPress={() => choose(option)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={option}
              >
                {pinyin && current.optionReadings?.[k] ? (
                  <Text style={[typography.articleMeta, { color: colors.muted }]}>{current.optionReadings[k]}</Text>
                ) : null}
                <Text style={[typography.body, { color: colors.ink }]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  centered: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  backButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  primerLink: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' },
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  sentence: { color: colors.ink, textAlign: 'center' },
  feedback: { marginTop: 24, alignItems: 'center' },
  footer: { padding: 24 },
  options: { flexDirection: 'row', gap: 10 },
  option: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    borderRadius: 14,
    paddingVertical: 18,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButton: { minHeight: 44, justifyContent: 'center', marginTop: 12 },
});
