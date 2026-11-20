import { useSpeechSettingsStore } from '../src/store/useSpeechSettingsStore';

it('auto-play defaults to off and can be switched', () => {
  expect(useSpeechSettingsStore.getState().autoPlaySentence).toBe(false);
  useSpeechSettingsStore.getState().setAutoPlaySentence(true);
  expect(useSpeechSettingsStore.getState().autoPlaySentence).toBe(true);
  useSpeechSettingsStore.getState().setAutoPlaySentence(false);
  expect(useSpeechSettingsStore.getState().autoPlaySentence).toBe(false);
});
