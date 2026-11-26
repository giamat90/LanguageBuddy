import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { t } from '../i18n';
import Divider from '../components/ui/Divider';
import { fetchStats, type StatsSnapshot } from '../services/statsService';
import type { GroupStat, WordFilter } from '../lib/stats';
import { TOPICS } from '../lib/topics';
import type { CefrLevel } from '../data/wordbank';
import { getActivePack } from '../languages';
import { STATUS_COLORS } from '../theme/statusColors';


/** A number tile; with `onPress` it opens the list of words behind the number (disabled at 0). */
function BigNumber({ id, value, label, onPress }: {
  id: string; value: number | string; label: string; onPress?: () => void;
}) {
  const body = (
    <>
      <Text testID={id} style={[typography.wordHero, { color: colors.ink }]}>{value}</Text>
      <Text style={[typography.uiSmall, { color: colors.muted, textAlign: 'center' }]}>{label}</Text>
    </>
  );
  if (!onPress) return <View style={styles.bigCell}>{body}</View>;
  const disabled = value === 0;
  return (
    <TouchableOpacity
      testID={`${id}-button`}
      style={styles.bigCell}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityState={{ disabled }}
    >
      {body}
    </TouchableOpacity>
  );
}

/** Stacked bar: mastered | learning | new, drawn against the group's bank size. */
function TierBar({ group }: { group: GroupStat }) {
  const pct = (n: number) => `${group.bankTotal > 0 ? Math.min(100, (n / group.bankTotal) * 100) : 0}%` as const;
  return (
    <View style={styles.track}>
      <View style={[styles.segment, { width: pct(group.mastered), backgroundColor: STATUS_COLORS.mastered }]} />
      <View style={[styles.segment, { width: pct(group.learning), backgroundColor: STATUS_COLORS.learning }]} />
      <View style={[styles.segment, { width: pct(group.new), backgroundColor: STATUS_COLORS.new }]} />
    </View>
  );
}

function GroupRow({ id, label, group, onPress }: {
  id: string; label: string; group: GroupStat; onPress: () => void;
}) {
  const progress = t('stats_progress', { saved: group.total, total: group.bankTotal });
  const disabled = false; // the list shows every bank word of the group, saved or not
  return (
    <TouchableOpacity
      testID={`${id}-button`}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${progress}`}
      accessibilityState={{ disabled }}
    >
      <View testID={id} style={styles.groupRow}>
        <View style={styles.groupHeader}>
          <Text style={[typography.body, { color: colors.ink, flex: 1 }]}>{label}</Text>
          <Text testID={`${id}-count`} style={[typography.uiSmall, { color: colors.muted }]}>{progress}</Text>
        </View>
        <TierBar group={group} />
      </View>
    </TouchableOpacity>
  );
}

function Legend() {
  const items: [string, string][] = [
    [STATUS_COLORS.mastered, t('stats_mastered')],
    [STATUS_COLORS.learning, t('stats_learning')],
    [STATUS_COLORS.new, t('stats_new')],
  ];
  return (
    <View style={styles.legend}>
      {items.map(([color, label]) => (
        <View key={label} style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[typography.uiSmall, { color: colors.muted }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function StatsScreen() {
  const router = useRouter();
  const { levels } = getActivePack();
  const [stats, setStats] = useState<StatsSnapshot | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setStats(await fetchStats());
    } catch (e) {
      console.error('[Stats] load failed:', e);
      setFailed(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const accuracy = stats?.reviews.accuracy;
  const openWords = (f: WordFilter) =>
    router.push({
      pathname: '/(app)/stats-words',
      params: f.kind === 'all' ? { kind: 'all' }
        : { kind: f.kind, value: f.kind === 'tier' ? f.tier : f.key },
    });

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
        <Text style={[typography.wordHero, { color: colors.ink, flex: 1 }]}>{t('stats_title')}</Text>
      </View>
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
      ) : !stats ? (
        <View style={styles.center}><ActivityIndicator color={colors.forest} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.bigRow}>
            <BigNumber id="stats-saved" value={stats.saved.total} label={t('stats_saved')} onPress={() => openWords({ kind: 'all' })} />
            <BigNumber id="stats-streak" value={stats.streakDays} label={t('stats_streak_days')} />
          </View>
          <View style={styles.bigRow}>
            <BigNumber id="stats-mastered" value={stats.saved.mastered} label={t('stats_mastered')} onPress={() => openWords({ kind: 'tier', tier: 'mastered' })} />
            <BigNumber id="stats-learning" value={stats.saved.learning} label={t('stats_learning')} onPress={() => openWords({ kind: 'tier', tier: 'learning' })} />
            <BigNumber id="stats-new" value={stats.saved.new} label={t('stats_new')} onPress={() => openWords({ kind: 'tier', tier: 'new' })} />
          </View>

          {stats.reviews.total > 0 && accuracy != null ? (
            <View style={styles.bigRow}>
              <BigNumber id="stats-reviews" value={stats.reviews.total} label={t('stats_reviews')} />
              <BigNumber id="stats-accuracy" value={`${Math.round(accuracy * 100)}%`} label={t('stats_accuracy')} />
            </View>
          ) : null}

          {stats.saved.total === 0 ? (
            <Text style={[typography.body, styles.empty]}>{t('stats_empty')}</Text>
          ) : (
            <>
              <Text style={[typography.uiSmall, styles.sectionLabel]}>{t('stats_by_topic')}</Text>
              <Legend />
              {TOPICS.map((tp) => {
                const g = stats.byTopic.find((x) => x.key === tp.key);
                return g ? (
                  <GroupRow
                    key={tp.key}
                    id={`stats-topic-${tp.key}`}
                    label={`${tp.emoji} ${t(tp.labelKey)}`}
                    group={g}
                    onPress={() => openWords({ kind: 'topic', key: tp.key })}
                  />
                ) : null;
              })}

              {levels.length > 1 ? (
                <>
                  <Text style={[typography.uiSmall, styles.sectionLabel, { marginTop: 24 }]}>{t('stats_by_level')}</Text>
                  {stats.byLevel.filter((g) => (levels as readonly string[]).includes(g.key)).map((g) => (
                    <GroupRow
                      key={g.key}
                      id={`stats-level-${g.key}`}
                      label={g.key}
                      group={g}
                      onPress={() => openWords({ kind: 'level', key: g.key as CefrLevel })}
                    />
                  ))}
                </>
              ) : null}
              <Text style={[typography.uiSmall, { color: colors.muted, marginTop: 12 }]}>{t('stats_legend_note')}</Text>
              <Text style={[typography.uiSmall, { color: colors.muted, marginTop: 4 }]}>{t('stats_tap_hint')}</Text>
              <TouchableOpacity
                onPress={() => router.push('/(app)/catalog')}
                style={styles.catalogLink}
                accessibilityRole="button"
                accessibilityLabel={t('catalog_open')}
              >
                <Text style={[typography.body, { color: colors.forest }]}>{t('catalog_open')}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  catalogLink: { minHeight: 44, justifyContent: 'center', marginTop: 16 },
  retry: { minHeight: 44, justifyContent: 'center', marginTop: 8 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  bigRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  bigCell: {
    flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6, gap: 2,
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: colors.border,
  },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 24 },
  sectionLabel: { color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 12, marginBottom: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  groupRow: { paddingVertical: 8 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  track: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.mist },
  segment: { height: 8 },
});
