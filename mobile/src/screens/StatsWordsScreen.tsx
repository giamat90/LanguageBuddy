import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { t } from '../i18n';
import Divider from '../components/ui/Divider';
import { CatalogRow, statusLabel, CATALOG_ROW_HEIGHT } from '../components/ui/CatalogRow';
import { FilterButton, FilterSheet } from '../components/ui/FilterSheet';
import { levelSection, topicSection, statusSection, filterSummary } from '../components/ui/filterSections';
import { useStartLearning } from '../hooks/useStartLearning';
import { fetchStatWords, fetchSavedStates } from '../services/statsService';
import { parseWordFilter, type StatTier, type WordFilter } from '../lib/stats';
import { buildCatalog, scopeCounts, type CatalogEntry, type CatalogStatus, type CatalogView, type SavedState } from '../lib/catalog';
import { TOPICS } from '../lib/topics';
import type { CefrLevel } from '../data/wordbank';

const TIER_LABEL: Record<StatTier, 'stats_mastered' | 'stats_learning' | 'stats_new'> = {
  mastered: 'stats_mastered', learning: 'stats_learning', new: 'stats_new',
};

function titleOf(f: WordFilter | null): string {
  if (!f) return t('stats_title');
  if (f.kind === 'all') return t('stats_saved');
  if (f.kind === 'tier') return t(TIER_LABEL[f.tier]);
  if (f.kind === 'level') return f.key;
  const tp = TOPICS.find((x) => x.key === f.key);
  return tp ? `${tp.emoji} ${t(tp.labelKey)}` : t('stats_title');
}

/** What one open screen shows: either the whole bank of a level/topic, or saved words only. */
type Loaded =
  | { kind: 'bank'; saved: ReadonlyMap<string, SavedState> }
  | { kind: 'saved'; entries: CatalogEntry[] };

/**
 * The words behind one number of the statistics screen (read-only list). A level or a topic
 * lists EVERY bank word of it, saved or not, each with its status; a tier or "saved" lists
 * only saved words (a word that is not saved has no tier).
 */
export default function StatsWordsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string | string[]; value?: string | string[] }>();
  const filter = useMemo(() => parseWordFilter(params.kind, params.value), [params.kind, params.value]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [status, setStatus] = useState<CatalogStatus | null>(null);
  // The other dimension inside the bucket: a level key in a topic list, a topic key in a level list.
  const [secondary, setSecondary] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    if (!filter) { setLoaded({ kind: 'saved', entries: [] }); return; }
    setFailed(false);
    try {
      if (filter.kind === 'level' || filter.kind === 'topic') {
        setLoaded({ kind: 'bank', saved: await fetchSavedStates() });
      } else {
        const words = await fetchStatWords(filter);
        setLoaded({
          kind: 'saved',
          entries: words.map((w) => ({
            key: w.id, word: w.word, article: w.article, level: null,
            translationIt: w.translationIt ?? '', translationEn: w.translationEn ?? '',
            status: w.tier, savedId: w.id,
          })),
        });
      }
    } catch (e) {
      console.error('[StatsWords] load failed:', e);
      setFailed(true);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const { start } = useStartLearning(load);

  const view: CatalogView | null = useMemo(() => {
    if (!loaded) return null;
    if (loaded.kind === 'saved') {
      const counts = { mastered: 0, learning: 0, new: 0, todo: 0 };
      for (const e of loaded.entries) counts[e.status] += 1;
      return { entries: loaded.entries, counts, total: loaded.entries.length };
    }
    const scope = filter?.kind === 'level'
      ? { level: filter.key, topic: secondary }
      : { level: secondary as CefrLevel | null, topic: filter?.kind === 'topic' ? filter.key : null };
    return buildCatalog(scope, status, loaded.saved);
  }, [loaded, filter, status, secondary]);

  // Chip numbers: words per level (topic list) or per topic (level list), ignoring status.
  const secondaryCounts = useMemo(() => {
    if (loaded?.kind !== 'bank' || !filter) return null;
    if (filter.kind === 'topic') return scopeCounts('level', { level: null, topic: filter.key }, loaded.saved);
    if (filter.kind === 'level') return scopeCounts('topic', { level: filter.key, topic: null }, loaded.saved);
    return null;
  }, [loaded, filter]);

  const open = useCallback(
    (id: string) => router.push({ pathname: '/(app)/word', params: { id } }),
    [router],
  );
  const isBank = loaded?.kind === 'bank';
  const sections = isBank && view && secondaryCounts && filter
    ? [
      filter.kind === 'topic'
        ? levelSection(secondaryCounts, secondary, setSecondary, true)
        : topicSection(secondaryCounts, secondary, setSecondary),
      statusSection(view, status, setStatus),
    ]
    : null;
  const activeCount = (secondary ? 1 : 0) + (status ? 1 : 0);
  const summary = filterSummary([
    filter?.kind === 'level' && secondary ? t(TOPICS.find((x) => x.key === secondary)?.labelKey ?? 'catalog_all') : secondary,
    status ? statusLabel(status) : null,
  ]);
  const savedCount = view ? view.counts.mastered + view.counts.learning + view.counts.new : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={t('nav_back')}
        >
          <Text style={[typography.body, { color: colors.forest }]}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[typography.wordHero, { color: colors.ink }]}>{titleOf(filter)}</Text>
          {view ? (
            <Text testID="stats-words-count" style={[typography.uiSmall, { color: colors.muted }]}>
              {t('stats_words_count', { count: isBank ? view.total : view.entries.length })}
            </Text>
          ) : null}
          {view && isBank ? (
            <Text testID="stats-words-progress" style={[typography.uiSmall, { color: colors.muted }]}>
              {t('stats_progress', { saved: savedCount, total: view.total })}
            </Text>
          ) : null}
          {summary ? (
            <Text testID="filter-summary" style={[typography.uiSmall, { color: colors.muted }]}>{summary}</Text>
          ) : null}
        </View>
        {sections ? <FilterButton activeCount={activeCount} onPress={() => setSheetOpen(true)} /> : null}
      </View>
      {sections ? (
        <FilterSheet
          visible={sheetOpen}
          title={t('filter_open')}
          sections={sections}
          onClose={() => setSheetOpen(false)}
          onReset={() => { setSecondary(null); setStatus(null); }}
        />
      ) : null}
      <Divider />

      {failed ? (
        <View style={styles.center}>
          <Text style={[typography.body, { color: colors.diePink, textAlign: 'center' }]}>{t('stats_error')}</Text>
          <TouchableOpacity
            onPress={load}
            style={styles.retry}
            accessibilityRole="button"
            accessibilityLabel={t('vault_retry')}
          >
            <Text style={[typography.body, { color: colors.forest }]}>{t('vault_retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : !view ? (
        <View style={styles.center}><ActivityIndicator color={colors.forest} /></View>
      ) : (
        <FlatList
          data={view.entries}
          keyExtractor={(e) => e.key}
          renderItem={({ item }) => <CatalogRow entry={item} showLevel={filter?.kind === 'topic'} onOpen={open} onStart={isBank ? start : undefined} />}
          getItemLayout={(_, index) => ({ length: CATALOG_ROW_HEIGHT, offset: CATALOG_ROW_HEIGHT * index, index })}
          initialNumToRender={20}
          windowSize={10}
          ListEmptyComponent={
            <Text style={[typography.body, styles.empty]}>{t('stats_words_empty')}</Text>
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  retry: { minHeight: 44, justifyContent: 'center', marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, minHeight: 56, gap: 12 },
  wordRow: { flexDirection: 'row', alignItems: 'center' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 32, paddingHorizontal: 24 },
});
