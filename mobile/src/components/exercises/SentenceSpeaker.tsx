import React, { useEffect } from 'react';
import { View } from 'react-native';
import SpeakButton from '../ui/SpeakButton';
import { useSpeech } from '../../hooks/useSpeech';
import { useSpeechSettingsStore } from '../../store/useSpeechSettingsStore';

/**
 * Speaker for the sentence of an exercise. Mount it only once the answer is revealed: on mount it
 * reads the sentence by itself when the learner turned auto-play on. Unmounting (next card) stops
 * the speech through useSpeech's cleanup.
 */
export default function SentenceSpeaker({ sentence }: { sentence: string }) {
  const { speakingId, toggle } = useSpeech();
  const autoPlay = useSpeechSettingsStore((s) => s.autoPlaySentence);

  useEffect(() => {
    if (autoPlay) toggle('sentence', sentence);
    // once per reveal: the sentence of a card does not change while it is on screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ marginTop: 8 }}>
      <SpeakButton
        kind="sentence"
        speaking={speakingId === 'sentence'}
        onPress={() => toggle('sentence', sentence)}
        testID="speak-sentence"
      />
    </View>
  );
}
