import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { t } from '../../i18n';
import { fetchProfile, setTopicPreferences } from '../../services/profileService';
import { TOPICS, activeTopicKeys, toggleTopic, topicCountsForLevel, buildTopicPreferences, TOPIC_KEYS } from '../../lib/topics';
import type { CefrLevel } from '../../data/wordbank';

/**
 * Settings section: which topics the daily word is drawn from. Each tap is saved at
 * once. The last active topic cannot be switched off, and a second tap during a save
 * is ignored so writes never overlap.
 */
export default function TopicPreferences() {
  const [prefs, setPrefs] = useState<Record<string, number> | null>(null);
  const [level, setLevel] = useState<CefrLevel>('A1');
  const [message, setMessage] = useState<string | null>(null);
  const saving = useRef(false);

  useEffect(() => {
    let alive = true;
    fetchProfile()
      .then((p) => {
        if (!alive || !p) return;
        // Normalise: an unusable stored map is shown (and later saved) as "all topics".
        setPrefs(buildTopicPreferences(TOPIC_KEYS, activeTopicKeys(p.topicPreferences)));
        setLevel(p.cefrLevel);
      })
      .catch((e) => console.error('[TopicPreferences] load failed:', e));
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => topicCountsForLevel(level), [level]);

  if (!prefs) return null;
  const active = activeTopicKeys(prefs);

  const onToggle = async (key: string) => {
    if (saving.current) return;
    const next = toggleTopic(prefs, key);
    if (!next) {
      setMessage(t('settings_topics_last'));
      return;
    }
    saving.current = true;
    setMessage(null);
    const previous = prefs;
    setPrefs(next);
    try {
      await setTopicPreferences(next);
    } catch (e) {
      console.error('[TopicPreferences] save failed:', e);
      setPrefs(previous);
      setMessage(t('settings_topics_error'));
    } finally {
      saving.current = false;
    }
  };

  return (
    <View>
      <Text style={[typography.uiSmall, styles.sectionLabel]}>{t('settings_topics_section')}</Text>
      <Text style={[typography.uiSmall, styles.note]}>{t('settings_topics_note')}</Text>
      <View style={styles.chips}>
        {TOPICS.map((tp) => {
          const on = active.includes(tp.key);
          const count = counts[tp.key] ?? 0;
          const countText = count > 0 ? t('settings_topics_count', { count }) : t('settings_topics_none');
          return (
            <TouchableOpacity
              key={tp.key}
              testID={`topic-chip-${tp.key}`}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => onToggle(tp.key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${t(tp.labelKey)}, ${countText}`}
            >
              <Text style={styles.emoji}>{tp.emoji}</Text>
              <Text style={[typography.uiSmall, { color: colors.ink }]}>{t(tp.labelKey)}</Text>
              <Text testID={`topic-count-${tp.key}`} style={[typography.uiSmall, styles.count]}>{countText}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {message ? (
        <Text style={[typography.uiSmall, { color: colors.diePink, marginTop: 8 }]}>{message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 28, marginBottom: 8 },
  note: { color: colors.muted, lineHeight: 18, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    width: '47%', flexGrow: 1, minHeight: 64, borderRadius: 12, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.cream, paddingVertical: 10, paddingHorizontal: 12, gap: 2,
  },
  chipOn: { borderColor: colors.forest, backgroundColor: colors.forestLight },
  emoji: { fontSize: 20 },
  count: { color: colors.muted },
});
