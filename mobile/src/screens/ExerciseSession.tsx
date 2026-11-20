import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserStore } from '../store/useUserStore';
import { useRouter } from 'expo-router';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { t } from '../i18n';
import PrimaryButton from '../components/ui/PrimaryButton';
import SecondaryButton from '../components/ui/SecondaryButton';
import TypedClozeView from '../components/exercises/TypedClozeView';
import FlashcardView from '../components/exercises/FlashcardView';
import MultipleChoiceView from '../components/exercises/MultipleChoiceView';
import MatchingView from '../components/exercises/MatchingView';
import SentenceReorderView from '../components/exercises/SentenceReorderView';
import FindMistakeView from '../components/exercises/FindMistakeView';
import type { ReviewCard } from '../services/reviewService';
import {
  DEFAULT_GROUPS, DEFAULT_REGISTRY, createSession, currentEntry, pickExercise, progress,
  submitGroupResult, submitResult,
  type ExerciseDefinition, type ExerciseModel, type GradeInstruction, type GroupExerciseDefinition,
  type SessionState,
} from '../lib/exercises';

interface Props {
  /** Cards for this session (due words for a review, a chosen batch for practice). */
  load: () => Promise<ReviewCard[]>;
  /** Persists one first-attempt result. */
  grade: (cardId: string, quality: number) => Promise<void>;
  registry?: ExerciseDefinition[];
  groups?: GroupExerciseDefinition[];
  /** Only matching-style rounds (see SessionOptions.groupsOnly). */
  groupsOnly?: boolean;
  /** Free practice: badge, own copy, "Ancora" and a schedule note. */
  practice?: boolean;
}

function renderSingle(
  model: ExerciseModel,
  position: number,
  isRetry: boolean,
  onResult: (quality: number) => void,
) {
  switch (model.kind) {
    case 'typed_cloze':
      return <TypedClozeView key={position} model={model} isRetry={isRetry} onResult={onResult} />;
    case 'flashcard':
      return <FlashcardView key={position} model={model} isRetry={isRetry} onResult={onResult} />;
    case 'multiple_choice':
      return <MultipleChoiceView key={position} model={model} isRetry={isRetry} onResult={onResult} />;
    case 'sentence_reorder':
      return <SentenceReorderView key={position} model={model} isRetry={isRetry} onResult={onResult} />;
    case 'find_mistake':
      return <FindMistakeView key={position} model={model} isRetry={isRetry} onResult={onResult} />;
  }
}

export default function ExerciseSession({
  load,
  grade,
  registry = DEFAULT_REGISTRY,
  groups = DEFAULT_GROUPS,
  groupsOnly = false,
  practice = false,
}: Props) {
  const router = useRouter();
  const lang = useUserStore((s) => s.nativeLanguage);
  const [session, setSession] = useState<SessionState | null>(null);
  const [round, setRound] = useState(0);
  // Latest session, readable synchronously: lets a double-tapped "Continue" be
  // recognised as stale instead of grading the next card with the old answer.
  const latest = useRef<SessionState | null>(null);
  const planRef = useRef({ groups, groupsOnly, lang });
  planRef.current = { groups, groupsOnly, lang };

  useEffect(() => {
    let cancelled = false;
    const start = (cards: ReviewCard[]) => {
      if (cancelled) return;
      const s = createSession(cards, planRef.current);
      latest.current = s;
      setSession(s);
    };
    load()
      .then(start)
      .catch((err) => {
        console.error('[ExerciseSession] failed to load cards:', err);
        start([]);
      });
    return () => {
      cancelled = true;
    };
  }, [load, round]);

  const entry = session ? currentEntry(session) : undefined;
  // Re-picked only when the queue entry changes, never on a re-render.
  const model = useMemo(
    () => (entry && entry.kind === 'single' ? pickExercise(entry.card, registry, Math.random, lang) : null),
    [entry, registry, lang],
  );

  const persist = useCallback(
    (grades: GradeInstruction[]) => {
      for (const g of grades) {
        grade(g.cardId, g.quality).catch((err) => console.error('[ExerciseSession] grade failed:', err));
      }
    },
    [grade],
  );

  const handleResult = useCallback(
    (quality: number) => {
      if (!session || latest.current !== session) return; // stale tap
      const { state, grade: g } = submitResult(session, quality);
      latest.current = state;
      if (g) persist([g]);
      setSession(state);
    },
    [session, persist],
  );

  const handleGroupResult = useCallback(
    (qualities: Record<string, number>) => {
      if (!session || latest.current !== session) return; // stale tap
      const { state, grades } = submitGroupResult(session, qualities);
      latest.current = state;
      persist(grades);
      setSession(state);
    },
    [session, persist],
  );

  const again = () => {
    latest.current = null;
    setSession(null);
    setRound((r) => r + 1);
  };

  if (session === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  }

  if (!entry) {
    const anyGraded = session.gradedCount > 0;
    const title = practice
      ? t(anyGraded ? 'practice_done' : 'practice_nothing')
      : t(anyGraded ? 'review_all_done' : 'review_nothing_due');
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={[typography.wordHero, { color: colors.ink, textAlign: 'center' }]}>{title}</Text>
          {session.total > 0 ? (
            <Text style={[typography.body, { color: colors.muted, marginTop: 12, textAlign: 'center' }]}>
              {t('review_summary', { correct: session.firstTryCorrect, total: session.total })}
            </Text>
          ) : null}
          {practice && session.total > 0 ? (
            <Text style={[typography.uiSmall, { color: colors.muted, marginTop: 12, textAlign: 'center' }]}>
              {t('practice_note')}
            </Text>
          ) : null}
          {practice && session.total > 0 ? (
            <SecondaryButton label={t('practice_again')} onPress={again} style={styles.finishButton} />
          ) : null}
          <PrimaryButton
            label={t('review_back')}
            onPress={() => router.back()}
            style={{ marginTop: practice && session.total > 0 ? 12 : 28, width: '100%' }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const { current, total } = progress(session);

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
          {t('review_progress', { current, total })}
        </Text>
        {practice ? (
          <View style={styles.badge}>
            <Text style={[typography.uiSmall, { color: colors.forest }]}>{t('practice_badge')}</Text>
          </View>
        ) : null}
      </View>

      {entry.kind === 'group' ? (
        <MatchingView key={session.position} model={entry.model} onResult={handleGroupResult} />
      ) : model ? (
        renderSingle(model, session.position, entry.retry > 0, handleResult)
      ) : null}
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
  badge: {
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: colors.forest,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  finishButton: { marginTop: 24, width: '100%' },
});
