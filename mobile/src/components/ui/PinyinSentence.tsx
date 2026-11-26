import React, { useState } from 'react';
import { View, Text, StyleSheet, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { getActivePack } from '../../languages';
import { bankReading } from '../../lib/reading/lookup';
import { rubyCells, type RubyCell } from '../../lib/reading/ruby';
import { showWhenReading } from '../../lib/reading/visibility';
import { useReadingSettingsStore } from '../../store/useReadingSettingsStore';
import RevealPinyinButton from './RevealPinyinButton';

interface Props {
  cells: RubyCell[];
  /** What a screen reader says instead of reading cell by cell. */
  label: string;
  /** The cell a cloze hides: until filled it shows neither its word nor its pinyin. */
  blank?: { index: number; filled: boolean };
  centered?: boolean;
}

/** A sentence with each word's pinyin above it; cells wrap like words. */
export default function PinyinSentence({ cells, label, blank, centered }: Props) {
  return (
    <View style={[styles.row, centered && styles.centered]} accessible accessibilityLabel={label}>
      {cells.map((cell, i) => {
        const isBlank = blank?.index === i;
        const hidden = isBlank && !blank.filled;
        return (
          <View key={i} style={styles.cell}>
            <Text style={[typography.articleMeta, styles.pinyin]}>{hidden ? ' ' : cell.pinyin}</Text>
            <Text style={styles.word}>
              {cell.lead}
              {isBlank ? <Text style={styles.blank}>{hidden ? '_____' : cell.word}</Text> : cell.word}
              {cell.trail}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * The example sentence of a bank word on a reading screen. A language without a reading layer, or a
 * stored sentence the bank no longer has, gets the plain text it always had.
 */
export function ReadingExample({ word, sentence, style, containerStyle }: {
  word: string;
  sentence: string;
  style: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const mode = useReadingSettingsStore((s) => s.pinyinMode);
  // Remembered per sentence, so the next word starts hidden again.
  const [revealed, setRevealed] = useState<string | null>(null);
  const data = getActivePack().reading ? bankReading(word) : null;
  const cells = data && data.example === sentence ? rubyCells(data.segments, data.examplePinyin) : null;

  if (!cells) return <Text style={style}>{sentence}</Text>;
  return (
    <View style={containerStyle}>
      {showWhenReading(mode) || revealed === sentence ? (
        <PinyinSentence cells={cells} label={sentence} />
      ) : (
        <>
          <Text style={[style, styles.inBox]}>{sentence}</Text>
          <RevealPinyinButton onPress={() => setRevealed(sentence)} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Stretched: in a centred column the row would otherwise be measured at its unwrapped width.
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', alignSelf: 'stretch', columnGap: 6, rowGap: 6 },
  centered: { justifyContent: 'center' },
  cell: { alignItems: 'center' },
  pinyin: { color: colors.muted },
  word: { fontSize: 18, lineHeight: 26, color: colors.ink },
  blank: { color: colors.forest },
  inBox: { flex: 0, marginTop: 0 },
});
