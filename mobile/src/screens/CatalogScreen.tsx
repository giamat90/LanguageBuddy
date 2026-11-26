import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { t } from '../i18n';
import { useUserStore } from '../store/useUserStore';
import Divider from '../components/ui/Divider';
import { CatalogRow, statusLabel, CATALOG_ROW_HEIGHT } from '../components/ui/CatalogRow';
import { FilterButton, FilterSheet } from '../components/ui/FilterSheet';
import { levelSection, topicSection, statusSection, filterSummary } from '../components/ui/filterSections';
import { useStartLearning } from '../hooks/useStartLearning';
import { fetchSavedStates } from '../services/statsService';
import { buildCatalog, scopeCounts, type CatalogEntry, type CatalogStatus, type SavedState } from '../lib/catalog';
import type { CefrLevel } from '../data/wordbank';
import { getActivePack } from '../languages';
import { coerceLevel } from '../lib/levels';
import { TOPICS } from '../lib/topics';

const EMPTY: ReadonlyMap<string, SavedState> = new Map();

/** The whole word bank by level and topic, each word marked with its learning status (read-only). */
export default function CatalogScreen() {
  const router = useRouter();
  const ownLevel = useUserStore((s) => s.cefrLevel);
  const ownLevelKey = coerceLevel(ownLevel);
  const [level, setLevel] = useState<CefrLevel>(ownLevelKey);
  const oneLevel = getActivePack().levels.length === 1;
  const [topic, setTopic] = useState<string | null>(null);
  const [status, setStatus] = useState<CatalogStatus | null>(null);
  const [saved, setSaved] = useState<ReadonlyMap<string, SavedState> | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setSaved(await fetchSavedStates());
    } catch (e) {
      console.error('[Catalog] load failed:', e);
      setFailed(true);
    }
  }, []);

  // A word may have been saved since the last visit.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { start } = useStartLearning(load);

  const view = useMemo(
    () => buildCatalog({ level, topic }, status, saved ?? EMPTY),
    [level, topic, status, saved],
  );
  const levelCounts = useMemo(() => scopeCounts('level', { level: null, topic }, saved ?? EMPTY), [topic, saved]);
  const topicCounts = useMemo(() => scopeCounts('topic', { level, topic: null }, saved ?? EMPTY), [level, saved]);
  const sections = [
    ...(oneLevel ? [] : [levelSection(levelCounts, level, (k) => { if (k) setLevel(k as CefrLevel); }, false)]),
    topicSection(topicCounts, topic, setTopic),
    statusSection(view, status, setStatus),
  ];
  // The level always has a value, so it is not counted as an "active" filter.
  const activeCount = (topic ? 1 : 0) + (status ? 1 : 0);
  const summary = filterSummary([
    level !== ownLevelKey || topic || status ? level : null,
    topic ? t(TOPICS.find((x) => x.key === topic)?.labelKey ?? 'catalog_all') : null,
    status ? statusLabel(status) : null,
  ]);
  const resetFilters = () => { setLevel(ownLevelKey); setTopic(null); setStatus(null); };

  const open = useCallback(
    (id: string) => router.push({ pathname: '/(app)/word', params: { id } }),
    [router],
  );

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
          <Text style={[typography.wordHero, { color: colors.ink }]}>{t('catalog_title')}</Text>
          <Text testID="catalog-count" style={[typography.uiSmall, { color: colors.muted }]}>
            {t('stats_words_count', { count: view.total })}
          </Text>
          {summary ? (
            <Text testID="filter-summary" style={[typography.uiSmall, { color: colors.muted }]}>{summary}</Text>
          ) : null}
        </View>
        <FilterButton activeCount={activeCount} onPress={() => setSheetOpen(true)} />
      </View>
      <FilterSheet
        visible={sheetOpen}
        title={t('filter_open')}
        sections={sections}
        onClose={() => setSheetOpen(false)}
        onReset={resetFilters}
      />

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
      ) : !saved ? (
        <View style={styles.center}><ActivityIndicator color={colors.forest} /></View>
      ) : (
        <FlatList
          data={view.entries}
          keyExtractor={(e: CatalogEntry) => e.key}
          renderItem={({ item }) => <CatalogRow entry={item} showLevel={false} onOpen={open} onStart={start} />}
          getItemLayout={(_, index) => ({ length: CATALOG_ROW_HEIGHT, offset: CATALOG_ROW_HEIGHT * index, index })}
          initialNumToRender={20}
          windowSize={10}
          ListEmptyComponent={<Text style={[typography.body, styles.empty]}>{t('catalog_empty')}</Text>}
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
  empty: { color: colors.muted, textAlign: 'center', marginTop: 32, paddingHorizontal: 24 },
});
