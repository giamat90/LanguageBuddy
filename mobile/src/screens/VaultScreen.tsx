import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MMKV } from 'react-native-mmkv';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { t } from '../i18n';
import { localizedText } from '../i18n/wordContent';
import { useUserStore } from '../store/useUserStore';
import { fetchVault } from '../services/vaultService';
import { dueCount } from '../services/reviewService';
import { useVaultStore } from '../store/useVaultStore';
import { VaultItem } from '../types/domain';
import ArticleBadge from '../components/ui/ArticleBadge';
import Divider from '../components/ui/Divider';
import SpeakButton from '../components/ui/SpeakButton';
import { useSpeech } from '../hooks/useSpeech';
import { speechText } from '../lib/speech';

const storage = new MMKV({ id: 'vault-store' });
const CACHE_KEY = 'vault_cache';

function daysUntilReview(nextReviewAt: string): { isToday: boolean; count: number } {
  const now = new Date();
  const next = new Date(nextReviewAt);
  const diffMs = next.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return { isToday: days <= 0, count: days };
}

function ReviewChip({ nextReviewAt }: { nextReviewAt: string }) {
  const { isToday, count } = daysUntilReview(nextReviewAt);
  return (
    <View style={styles.reviewChip}>
      <Text style={[typography.uiSmall, { color: colors.gold }]}>
        {isToday ? t('vault_review_chip_today') : t('vault_review_chip_days', { count })}
      </Text>
    </View>
  );
}

function RetentionBar({ score }: { score: number }) {
  return (
    <View style={styles.retentionTrack}>
      <View style={[styles.retentionFill, { width: `${Math.round(score * 100)}%` as any }]} />
    </View>
  );
}

const VaultRow = React.memo(function VaultRow({ item, speaking, onPress, onSpeak }: {
  item: VaultItem; speaking: boolean; onPress: () => void; onSpeak: (item: VaultItem) => void;
}) {
  const lang = useUserStore((s) => s.nativeLanguage);
  const translation = localizedText(lang, 'meaning', { word: item.word }, item.translationIt, item.translationEn);
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.rowTouch}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={item.word}
      >
        <View style={styles.rowMain}>
          <View style={styles.wordRow}>
            {item.article ? (
              <ArticleBadge article={item.article} style={styles.articleBadge} />
            ) : null}
            <Text style={[typography.exampleDe, { color: colors.ink }]}>{item.word}</Text>
          </View>
          {translation ? (
            <Text style={[typography.uiSmall, { color: colors.muted, marginTop: 2 }]}>
              {translation}
            </Text>
          ) : null}
          <RetentionBar score={item.retentionScore} />
        </View>
        <View style={styles.rowRight}>
          <ReviewChip nextReviewAt={item.nextReviewAt} />
        </View>
      </TouchableOpacity>
      <SpeakButton
        word={item.word}
        speaking={speaking}
        onPress={() => onSpeak(item)}
        testID={`speak-${item.id}`}
      />
    </View>
  );
});

export default function VaultScreen() {
  const router = useRouter();
  const { items, page, total, isLoading, error, appendItems, nextPage, setLoading, setError, reset } = useVaultStore();
  const [due, setDue] = useState(0);
  const { speakingId, toggle, stop } = useSpeech();
  const onSpeak = useCallback(
    (item: VaultItem) => toggle(item.id, speechText(item.word, item.article)),
    [toggle],
  );

  const loadPage = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const result = await fetchVault(pageNum);
      if (pageNum === 1) {
        useVaultStore.setState({ items: result.items, total: result.total, page: 1 });
        storage.set(CACHE_KEY, JSON.stringify(result.items));
      } else {
        appendItems(result.items, result.total);
      }
    } catch (e) {
      // The UI never shows provider/native text; the cause goes to the log.
      console.error('[Vault] load failed:', e);
      setError(t('vault_error'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Instant paint from the last cached list.
  useEffect(() => {
    reset();
    const cached = storage.getString(CACHE_KEY);
    if (cached) {
      try {
        const parsed: VaultItem[] = JSON.parse(cached);
        appendItems(parsed, parsed.length);
      } catch (_) {}
    }
  }, []);

  // Refresh whenever the screen regains focus (e.g. after saving today's word).
  useFocusEffect(
    useCallback(() => {
      loadPage(1);
      dueCount().then(setDue).catch(() => setDue(0));
      return stop;
    }, [loadPage, stop]),
  );

  const handleEndReached = () => {
    if (isLoading || items.length >= total) return;
    const nextPageNum = page + 1;
    nextPage();
    loadPage(nextPageNum);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={styles.header}>
        {router.canGoBack() ? (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={t('nav_back')}
          >
            <Text style={[typography.body, { color: colors.forest }]}>←</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={[typography.wordHero, { color: colors.ink, flex: 1 }]}>
          {t('vault_title')}
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/(app)/catalog')}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={t('catalog_open')}
        >
          <Text style={{ fontSize: 20 }}>📖</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/(app)/stats')}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={t('vault_stats_cta')}
        >
          <Text style={{ fontSize: 20 }}>📊</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/(app)/settings')}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={t('settings_open')}
        >
          <Text style={{ color: colors.muted, fontSize: 20 }}>⚙</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={() => router.push('/(app)/today')}
          style={[styles.action, styles.actionPrimary]}
          accessibilityRole="button"
          accessibilityLabel={t('vault_today_cta')}
        >
          <Text style={[typography.uiSmall, { color: colors.cream }]}>
            {t('vault_today_cta')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/(app)/grammar')}
          style={[styles.action, styles.actionReview]}
          accessibilityRole="button"
          accessibilityLabel={t('vault_grammar_cta')}
        >
          <Text style={[typography.uiSmall, { color: colors.gold }]}>
            {t('vault_grammar_cta')}
          </Text>
        </TouchableOpacity>
        {total > 0 ? (
          <TouchableOpacity
            onPress={() => router.push('/(app)/practice')}
            style={[styles.action, styles.actionReview]}
            accessibilityRole="button"
            accessibilityLabel={t('vault_practice_cta')}
          >
            <Text style={[typography.uiSmall, { color: colors.gold }]}>
              {t('vault_practice_cta')}
            </Text>
          </TouchableOpacity>
        ) : null}
        {due > 0 ? (
          <TouchableOpacity
            onPress={() => router.push('/(app)/review')}
            style={[styles.action, styles.actionReview]}
            accessibilityRole="button"
            accessibilityLabel={t('vault_review_cta', { count: due })}
          >
            <Text style={[typography.uiSmall, { color: colors.gold }]}>
              {t('vault_review_cta', { count: due })}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Divider />

      {error ? (
        <View style={styles.errorRow}>
          <Text style={[typography.body, { color: colors.diePink }]}>{error}</Text>
          <TouchableOpacity
            onPress={() => loadPage(1)}
            style={styles.retryButton}
            accessibilityRole="button"
          >
            <Text style={[typography.body, { color: colors.forest, marginLeft: 8 }]}>
              {t('vault_retry')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <VaultRow
            item={item}
            speaking={speakingId === item.id}
            onSpeak={onSpeak}
            onPress={() => router.push({ pathname: '/(app)/word', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <Text style={[typography.body, { color: colors.muted, textAlign: 'center' }]}>
                {t('vault_empty')}
              </Text>
            </View>
          )
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          isLoading ? <ActivityIndicator color={colors.forest} style={{ padding: 16 }} /> : null
        }
        ItemSeparatorComponent={() => <Divider />}
      />
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
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 10,
  },
  action: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  actionPrimary: {
    backgroundColor: colors.forest,
  },
  actionReview: {
    backgroundColor: colors.goldLight,
  },
  errorRow: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 16,
    alignItems: 'center',
  },
  rowTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  articleBadge: {
    marginRight: 4,
  },
  rowRight: {
    marginLeft: 12,
    alignItems: 'flex-end',
  },
  reviewChip: {
    backgroundColor: colors.goldLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  retentionTrack: {
    height: 3,
    backgroundColor: colors.mist,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 6,
  },
  retentionFill: {
    height: '100%',
    backgroundColor: colors.forest,
    borderRadius: 2,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    minHeight: 200,
  },
});
