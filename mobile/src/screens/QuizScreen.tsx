import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { t } from '../i18n';
import { getActivePack } from '../languages';
import type { StringKey } from '../i18n';
import SectionLabel from '../components/ui/SectionLabel';

interface Question {
  questionKey: StringKey;
  optionAKey:  StringKey;
  optionBKey:  StringKey;
  correctIndex: 0 | 1;
}

/** The questions of the active language pack: its sentences are strings, its right answers are data. */
function questions(): Question[] {
  return getActivePack().quiz.map(({ n, correctIndex }) => ({
    questionKey: `quiz_q${n}`,
    optionAKey: `quiz_q${n}_a`,
    optionBKey: `quiz_q${n}_b`,
    correctIndex,
  } as Question));
}

export function inferCefrLevel(correctCount: number): string {
  if (correctCount <= 1) return 'A1';
  if (correctCount === 2) return 'A2';
  if (correctCount === 3) return 'B1';
  return 'B2';
}

export default function QuizScreen() {
  const router = useRouter();
  const { nativeLanguage } = useLocalSearchParams<{ nativeLanguage?: string }>();
  const [step, setStep]   = useState(0);
  const [score, setScore] = useState(0);
  const QUESTIONS = useMemo(questions, []);

  const handleAnswer = (selectedIndex: 0 | 1) => {
    const correct = QUESTIONS[step].correctIndex === selectedIndex;
    const newScore = correct ? score + 1 : score;
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
      setScore(newScore);
    } else {
      const level = inferCefrLevel(newScore);
      router.push({ pathname: '/topics', params: { cefrLevel: level, nativeLanguage } });
    }
  };

  const q = QUESTIONS[step];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {/* Progress dots */}
        <View style={styles.progressRow}>
          {Array.from({ length: 5 }, (_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                { backgroundColor: i <= step ? colors.forest : colors.mist },
              ]}
            />
          ))}
        </View>
        <SectionLabel
          label={t('quiz_progress', { current: step + 1, total: QUESTIONS.length })}
          style={styles.progressLabel}
        />

        {/* Question */}
        <Text style={[typography.wordHero, styles.question]}>
          {t(q.questionKey)}
        </Text>

        {/* Options */}
        <View style={styles.options}>
          {[q.optionAKey, q.optionBKey].map((key, i) => (
            <TouchableOpacity
              key={key}
              style={styles.option}
              onPress={() => handleAnswer(i as 0 | 1)}
              activeOpacity={0.75}
              accessibilityRole="button"
            >
              <Text style={[typography.body, { color: colors.ink }]}>{t(key)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  inner: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  progressLabel: {
    marginBottom: 32,
  },
  question: {
    color: colors.ink,
    marginBottom: 40,
  },
  options: {
    gap: 12,
  },
  option: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    borderRadius: 14,
    padding: 18,
    minHeight: 60,
    justifyContent: 'center',
  },
});
