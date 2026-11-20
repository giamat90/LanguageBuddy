import { t } from '../../i18n';
import { CEFR_ORDER } from '../../data/wordbank';
import { TOPICS } from '../../lib/topics';
import { CATALOG_STATUSES, type CatalogStatus, type CatalogView } from '../../lib/catalog';
import { statusLabel } from './CatalogRow';
import type { FilterSection } from './FilterSheet';

/** Level options; `allowAll` is false where a level must always be chosen (the catalog). */
export function levelSection(
  counts: Record<string, number>, selected: string | null, onSelect: (k: string | null) => void, allowAll: boolean,
): FilterSection {
  const total = CEFR_ORDER.reduce((n, l) => n + counts[l], 0);
  return {
    id: 'level',
    title: t('filter_section_level'),
    selected,
    onSelect,
    options: [
      ...(allowAll ? [{ key: null, label: t('stats_words_all_levels'), count: total, testID: 'filter-opt-level-all' }] : []),
      ...CEFR_ORDER.map((l) => ({ key: l as string, label: l as string, count: counts[l], testID: `filter-opt-level-${l}` })),
    ],
  };
}

export function topicSection(
  counts: Record<string, number>, selected: string | null, onSelect: (k: string | null) => void,
): FilterSection {
  const total = TOPICS.reduce((n, tp) => n + counts[tp.key], 0);
  return {
    id: 'topic',
    title: t('filter_section_topic'),
    selected,
    onSelect,
    options: [
      { key: null, label: t('stats_words_all_topics'), count: total, testID: 'filter-opt-topic-all' },
      ...TOPICS.map((tp) => ({
        key: tp.key as string,
        label: `${tp.emoji} ${t(tp.labelKey)}`,
        a11yName: t(tp.labelKey),
        count: counts[tp.key],
        testID: `filter-opt-topic-${tp.key}`,
      })),
    ],
  };
}

export function statusSection(
  view: CatalogView, selected: CatalogStatus | null, onSelect: (k: CatalogStatus | null) => void,
): FilterSection {
  return {
    id: 'status',
    title: t('filter_section_status'),
    selected,
    onSelect: (k) => onSelect(k as CatalogStatus | null),
    options: [
      { key: null, label: t('catalog_all'), count: view.total, testID: 'filter-opt-status-all' },
      ...CATALOG_STATUSES.map((s) => ({
        key: s as string, label: statusLabel(s), count: view.counts[s], marker: s, testID: `filter-opt-status-${s}`,
      })),
    ],
  };
}

/** The "A2 · Da iniziare" line under the title (level · topic · status), null when nothing is chosen. */
export function filterSummary(parts: (string | null)[]): string | null {
  const active = parts.filter((p): p is string => !!p);
  return active.length ? active.join(' · ') : null;
}
