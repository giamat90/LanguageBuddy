import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { t } from '../../i18n';
import type { CatalogStatus } from '../../lib/catalog';
import { StatusMarker } from './CatalogRow';

export interface FilterOption {
  /** null = "all" (clears the section). */
  key: string | null;
  label: string;
  /** Name used in the accessibility label when it differs from the visible label (emoji). */
  a11yName?: string;
  count: number;
  /** Shows a status marker next to the radio: the status rows double as the color legend. */
  marker?: CatalogStatus;
  testID: string;
}

export interface FilterSection {
  id: string;
  title: string;
  options: FilterOption[];
  selected: string | null;
  onSelect: (key: string | null) => void;
}

/** The header icon that opens the sheet; the badge is the number of active filters. */
export function FilterButton({ activeCount, onPress }: { activeCount: number; onPress: () => void }) {
  return (
    <TouchableOpacity
      testID="filter-button"
      onPress={onPress}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={activeCount > 0 ? t('filter_open_active', { count: activeCount }) : t('filter_open')}
    >
      <MaterialIcons name="filter-list" size={28} color={colors.forest} />
      {activeCount > 0 ? (
        <View style={styles.badge}>
          <Text testID="filter-badge" style={styles.badgeText}>{activeCount}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function OptionRow({ option, selected, onPress }: { option: FilterOption; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      testID={option.testID}
      onPress={onPress}
      style={styles.option}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={t('stats_words_filter_a11y', { name: option.a11yName ?? option.label, count: option.count })}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      {option.marker ? <StatusMarker status={option.marker} /> : null}
      <Text style={[typography.body, { color: colors.ink, flex: 1 }]}>{option.label}</Text>
      <Text style={[typography.uiSmall, { color: colors.muted }]}>{option.count}</Text>
    </TouchableOpacity>
  );
}

/** Bottom sheet with the filter sections; a choice applies at once and the sheet stays open. */
export function FilterSheet({ visible, title, sections, onClose, onReset }: {
  visible: boolean; title: string; sections: FilterSection[]; onClose: () => void; onReset: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          testID="filter-backdrop"
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('filter_close')}
        />
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={[typography.body, { color: colors.ink, flex: 1, fontWeight: '600' }]}>{title}</Text>
            <TouchableOpacity
              testID="filter-reset"
              onPress={onReset}
              style={styles.textButton}
              accessibilityRole="button"
              accessibilityLabel={t('filter_reset')}
            >
              <Text style={[typography.body, { color: colors.muted }]}>{t('filter_reset')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="filter-done"
              onPress={onClose}
              style={styles.textButton}
              accessibilityRole="button"
              accessibilityLabel={t('filter_done')}
            >
              <Text style={[typography.body, { color: colors.forest, fontWeight: '600' }]}>{t('filter_done')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            {sections.map((section) => (
              <View key={section.id}>
                <Text style={[typography.uiSmall, styles.sectionLabel]}>{section.title}</Text>
                {section.options.map((o) => {
                  const selected = section.selected === o.key;
                  return (
                    <OptionRow
                      key={o.key ?? 'all'}
                      option={o}
                      selected={selected}
                      onPress={() => section.onSelect(selected ? null : o.key)}
                    />
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 4, right: 2, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { color: colors.cream, fontSize: 11, fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12,42,62,0.4)' },
  panel: {
    maxHeight: '75%', backgroundColor: colors.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 8,
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 4 },
  textButton: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
  sectionLabel: { color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 12, marginBottom: 4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.muted,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: colors.forest },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.forest },
});
