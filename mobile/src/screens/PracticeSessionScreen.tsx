import React, { useCallback, useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import ExerciseSession from './ExerciseSession';
import { fetchVaultCards, gradePractice } from '../services/reviewService';
import { parsePracticeFormat, practiceConfig, selectPracticeCards } from '../lib/exercises';

/** Free practice in one chosen format; results only ever make the schedule stricter. */
export default function PracticeSessionScreen() {
  const params = useLocalSearchParams<{ format?: string | string[] }>();
  const format = parsePracticeFormat(params.format);
  const config = useMemo(() => practiceConfig(format), [format]);
  const load = useCallback(async () => selectPracticeCards(await fetchVaultCards(), format), [format]);

  return (
    <ExerciseSession
      practice
      load={load}
      grade={gradePractice}
      registry={config.registry}
      groups={config.groups}
      groupsOnly={config.groupsOnly}
    />
  );
}
