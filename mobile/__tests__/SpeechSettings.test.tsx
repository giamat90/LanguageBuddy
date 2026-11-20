import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SettingsScreen from '../src/screens/SettingsScreen';
import { useSpeechSettingsStore } from '../src/store/useSpeechSettingsStore';
import { t } from '../src/i18n';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('../src/components/ui/NotificationSettings', () => () => null);
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/', EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn(), readAsStringAsync: jest.fn(),
  StorageAccessFramework: {},
}));

it('the Settings switch turns sentence auto-play on and off (default off)', () => {
  useSpeechSettingsStore.getState().setAutoPlaySentence(false);
  const r = render(<SettingsScreen />);
  expect(r.getByText(t('settings_speech_section'))).toBeTruthy();
  const sw = r.getByTestId('speech-autoplay-switch');
  expect(sw.props.accessibilityLabel).toBe(t('settings_speech_autoplay'));
  expect(sw.props.value).toBe(false);
  fireEvent(sw, 'valueChange', true);
  expect(useSpeechSettingsStore.getState().autoPlaySentence).toBe(true);
  expect(r.getByTestId('speech-autoplay-switch').props.value).toBe(true);
  fireEvent(r.getByTestId('speech-autoplay-switch'), 'valueChange', false);
  expect(useSpeechSettingsStore.getState().autoPlaySentence).toBe(false);
});
