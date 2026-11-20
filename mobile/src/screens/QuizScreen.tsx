import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { t } from '../i18n';
import it from '../i18n/it';
import SectionLabel from '../components/ui/SectionLabel';

interface Question {
  questionKey: keyof typeof it;
  optionAKey:  keyof typeof it;
  optionBKey:  keyof typeof it;
  correctIndex: 0 | 1;
}

const QUESTIONS: Question[] = [
  { questionKey: 'quiz_q1', optionAKey: 'quiz_q1_a', optionBKey: 'quiz_q1_b', correctIndex: 0 },
  { questionKey: 'quiz_q2', optionAKey: 'quiz_q2_a', optionBKey: 'quiz_q2_b', correctIndex: 0 },
  { questionKey: 'quiz_q3', optionAKey: 'quiz_q3_a', optionBKey: 'quiz_q3_b', correctIndex: 0 },
  { questionKey: 'quiz_q4', optionAKey: 'quiz_q4_a', optionBKey: 'quiz_q4_b', correctIndex: 1 },
  { questionKey: 'quiz_q5', optionAKey: 'quiz_q5_a', optionBKey: 'quiz_q5_b', correctIndex: 0 },
];

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
          {([q.optionAKey, q.optionBKey] as (keyof typeof it)[]).map((key, i) => (
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
