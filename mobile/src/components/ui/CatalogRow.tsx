import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { STATUS_COLORS, TODO_RING } from '../../theme/statusColors';
import { t } from '../../i18n';
import { localizedText } from '../../i18n/wordContent';
import { useUserStore } from '../../store/useUserStore';
import type { CatalogEntry, CatalogStatus } from '../../lib/catalog';
import ArticleBadge from './ArticleBadge';
import CefrBadge from './CefrBadge';

export const CATALOG_ROW_HEIGHT = 60;

export function statusLabel(status: CatalogStatus): string {
  switch (status) {
    case 'mastered': return t('stats_mastered');
    case 'learning': return t('stats_learning');
    case 'new': return t('stats_new');
    default: return t('catalog_status_todo');
  }
}

/** The status of ONE word (a row): singular, e.g. "Nuova"; the plural labels above stay for counts. */
export function rowStatusLabel(status: CatalogStatus): string {
  switch (status) {
    case 'mastered': return t('catalog_row_mastered');
    case 'new': return t('catalog_row_new');
    default: return statusLabel(status);
  }
}

/** Filled dot for a started word, an empty ring for a word not started yet. */
export function StatusMarker({ status }: { status: CatalogStatus }) {
  return (
    <View
      testID={`status-marker-${status}`}
      style={[
        styles.marker,
        status === 'todo'
          ? { borderWidth: 1.5, borderColor: TODO_RING, backgroundColor: 'transparent' }
          : { backgroundColor: STATUS_COLORS[status] },
      ]}
    />
  );
}

function CatalogRowBase({ entry, showLevel, onOpen, onStart }: {
  entry: CatalogEntry; showLevel: boolean; onOpen: (savedId: string) => void;
  /** When set, an unsaved row is a button that starts learning the word. */
  onStart?: (entry: CatalogEntry) => void;
}) {
  const lang = useUserStore((s) => s.nativeLanguage);
  const meaning = localizedText(lang, 'meaning', { word: entry.word, level: entry.level }, entry.translationIt, entry.translationEn);
  const status = rowStatusLabel(entry.status);
  const color = entry.status === 'todo' ? colors.muted : STATUS_COLORS[entry.status];
  const a11y = t('catalog_row_a11y', {
    word: entry.article ? `${entry.article} ${entry.word}` : entry.word,
    status,
  });
  const body = (
    <>
      <StatusMarker status={entry.status} />
      <View style={styles.main}>
        <View style={styles.wordRow}>
          {entry.article ? <ArticleBadge article={entry.article} style={{ marginRight: 8 }} /> : null}
          <Text style={[typography.exampleDe, { color: colors.ink, flexShrink: 1 }]} numberOfLines={1}>{entry.word}</Text>
          {showLevel && entry.level ? <CefrBadge level={entry.level} style={{ marginLeft: 8 }} /> : null}
        </View>
        {meaning ? (
          <Text style={[typography.uiSmall, { color: colors.muted, marginTop: 2 }]} numberOfLines={1}>{meaning}</Text>
        ) : null}
      </View>
      <Text style={[typography.uiSmall, { color }]}>{status}</Text>
      {!entry.savedId && onStart ? <Text style={styles.plus}>＋</Text> : null}
    </>
  );
  const testID = `catalog-row-${entry.key}`;
  // A saved word opens its detail; an unsaved one starts learning (when the list allows it).
  if (entry.savedId) {
    const id = entry.savedId;
    return (
      <TouchableOpacity
        testID={testID}
        style={styles.row}
        onPress={() => onOpen(id)}
        accessibilityRole="button"
        accessibilityLabel={a11y}
      >
        {body}
      </TouchableOpacity>
    );
  }
  if (onStart) {
    return (
      <TouchableOpacity
        testID={testID}
        style={styles.row}
        onPress={() => onStart(entry)}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityHint={t('catalog_start_hint')}
      >
        {body}
      </TouchableOpacity>
    );
  }
  return (
    <View testID={testID} style={styles.row} accessible accessibilityLabel={a11y}>
      {body}
    </View>
  );
}

export const CatalogRow = React.memo(CatalogRowBase);

const styles = StyleSheet.create({
  marker: { width: 12, height: 12, borderRadius: 6 },
  row: {
    height: CATALOG_ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  main: { flex: 1 },
  plus: { fontSize: 20, color: colors.forest, marginLeft: 4 },
  wordRow: { flexDirection: 'row', alignItems: 'center' },
});
