import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { t } from '../../i18n';
import { localizedText } from '../../i18n/wordContent';
import { useUserStore } from '../../store/useUserStore';
import ArticleBadge from '../ui/ArticleBadge';
import PrimaryButton from '../ui/PrimaryButton';
import { matchingQuality } from '../../lib/exercises/quality';
import type { MatchingModel } from '../../lib/exercises/types';

interface Props {
  model: MatchingModel;
  onResult: (qualities: Record<string, number>) => void;
}

type Side = 'left' | 'right';

export default function MatchingView({ model, onResult }: Props) {
  const lang = useUserStore((s) => s.nativeLanguage);
  const { cards, leftOrder, rightOrder } = model;
  const byId = new Map(cards.map((c) => [c.id, c]));

  const [selected, setSelected] = useState<{ left: string | null; right: string | null }>({
    left: null,
    right: null,
  });
  const [matched, setMatched] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState<Record<string, number>>({});
  const [wrongPair, setWrongPair] = useState<{ left: string; right: string } | null>(null);

  const allMatched = matched.length === cards.length;

  const choose = (side: Side, id: string) => {
    if (matched.includes(id)) return;
    const next = { ...selected, [side]: selected[side] === id ? null : id };
    setWrongPair(null);

    if (next.left && next.right) {
      if (next.left === next.right) {
        setMatched([...matched, next.left]);
      } else {
        const { left, right } = next as { left: string; right: string };
        setMistakes((m) => ({ ...m, [left]: (m[left] ?? 0) + 1, [right]: (m[right] ?? 0) + 1 }));
        setWrongPair({ left, right });
      }
      setSelected({ left: null, right: null });
      return;
    }
    setSelected(next);
  };

  const tileStyle = (side: Side, id: string) => {
    if (matched.includes(id)) return styles.tileMatched;
    if (wrongPair && wrongPair[side] === id) return styles.tileWrong;
    if (selected[side] === id) return styles.tileSelected;
    return null;
  };

  const finish = () =>
    onResult(Object.fromEntries(cards.map((c) => [c.id, matchingQuality(mistakes[c.id] ?? 0)])));

  return (
    <>
      <View style={styles.cardArea}>
        <Text style={[typography.uiSmall, { color: colors.muted, marginBottom: 16 }]}>
          {t('review_match_prompt')}
        </Text>
        <View style={styles.columns}>
          <View style={styles.column}>
            {leftOrder.map((id) => {
              const card = byId.get(id)!;
              return (
                <TouchableOpacity
                  key={id}
                  testID={`match-left-${id}`}
                  style={[styles.tile, tileStyle('left', id)]}
                  onPress={() => choose('left', id)}
                  disabled={matched.includes(id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${card.article ? `${card.article} ` : ''}${card.word}`}
                  accessibilityState={{ selected: selected.left === id, disabled: matched.includes(id) }}
                  activeOpacity={0.75}
                >
                  <View style={styles.wordRow}>
                    {card.article ? <ArticleBadge article={card.article} /> : null}
                    <Text style={[typography.body, { color: colors.ink }]}>{card.word}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.column}>
            {rightOrder.map((id) => {
              const card = byId.get(id)!;
              const meaning = localizedText(lang, 'meaning', { word: card.word, level: card.cefrBand }, card.translationIt, card.translationEn) ?? '';
              return (
                <TouchableOpacity
                  key={id}
                  testID={`match-right-${id}`}
                  style={[styles.tile, tileStyle('right', id)]}
                  onPress={() => choose('right', id)}
                  disabled={matched.includes(id)}
                  accessibilityRole="button"
                  accessibilityLabel={meaning}
                  accessibilityState={{ selected: selected.right === id, disabled: matched.includes(id) }}
                  activeOpacity={0.75}
                >
                  <Text style={[typography.body, { color: colors.ink, textAlign: 'center' }]}>{meaning}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        {allMatched ? <PrimaryButton label={t('review_continue')} onPress={finish} /> : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  columns: { flexDirection: 'row', gap: 12, width: '100%' },
  column: { flex: 1, gap: 10 },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  tile: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileSelected: { borderColor: colors.forest, backgroundColor: colors.mist },
  tileMatched: { borderColor: colors.forest, backgroundColor: colors.mist, opacity: 0.5 },
  tileWrong: { borderColor: colors.diePink },
  footer: { padding: 24, minHeight: 104 },
});
