import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { t } from '../i18n';
import { fetchTodayWord, saveWord } from '../services/wordService';
import { useWordStore } from '../store/useWordStore';
import WordCard from '../components/ui/WordCard';
import PrimaryButton from '../components/ui/PrimaryButton';
import ErrorBanner from '../components/ErrorBanner';
import { classifyError } from '../lib/errorHandling';

function LoadingView() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.forest} size="large" />
    </View>
  );
}

function EmptyView() {
  return (
    <View style={styles.centered}>
      <Text style={[typography.body, { color: colors.muted, textAlign: 'center' }]}>
        {t('word_card_empty')}
      </Text>
    </View>
  );
}

function ErrorView({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.centered}>
      <Text style={[typography.body, { color: colors.muted, textAlign: 'center', marginBottom: 24 }]}>
        {t('word_card_error')}
      </Text>
      <PrimaryButton label={t('word_card_retry')} onPress={onRetry} style={{ width: '100%' }} />
    </View>
  );
}

export default function WordCardScreen() {
  const router = useRouter();
  const { word, saveState, streakDays, isLoading,
          setWord, setSaveState, setStreak, setLoading } = useWordStore();
  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadWord();
  }, []);

  const goHome = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/');
  };

  const loadWord = async () => {
    setLoading(true);
    setHasError(false);
    try {
      const w = await fetchTodayWord();
      if (!w) {
        setHasError(true);
        return;
      }
      setWord(w);
    } catch (e: unknown) {
      console.error('[WordCardScreen] fetchTodayWord failed:', e);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (saveState !== 'idle') return;
    setSaveState('saving');
    try {
      const res = await saveWord();
      setStreak(res.streak_days);
      setSaveState('saved');
      goHome();
    } catch (e: unknown) {
      console.error('[WordCardScreen] saveWord failed:', e);
      setSaveState('idle');
      setErrorMsg(classifyError(e).message);
    }
  };

  if (isLoading) return <LoadingView />;
  if (hasError) return <ErrorView onRetry={loadWord} />;
  if (!word) return <EmptyView />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={goHome}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={t('nav_back')}
        >
          <Text style={[typography.body, { color: colors.forest }]}>←</Text>
        </TouchableOpacity>
      </View>
      <WordCard
        word={word}
        saveState={saveState}
        streakDays={streakDays}
        onSave={handleSave}
        onSkip={goHome}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
