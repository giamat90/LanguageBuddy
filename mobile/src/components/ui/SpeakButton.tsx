import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { t } from '../../i18n';

interface Props {
  /** Used in the label of a word button; ignored for sentences (a screen reader should not read the whole sentence twice). */
  word?: string;
  kind?: 'word' | 'sentence';
  speaking: boolean;
  onPress: () => void;
  testID?: string;
}

export default function SpeakButton({ word = '', kind = 'word', speaking, onPress, testID }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.button}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={
        kind === 'sentence'
          ? t(speaking ? 'speech_sentence_stop_a11y' : 'speech_sentence_play_a11y')
          : t(speaking ? 'speech_stop_a11y' : 'speech_play_a11y', { word })
      }
      testID={testID}
    >
      <Text style={styles.glyph}>{speaking ? '⏹' : '🔊'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 20 },
});
