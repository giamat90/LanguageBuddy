import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SpeakButton from '../src/components/ui/SpeakButton';
import { t } from '../src/i18n';

describe('SpeakButton', () => {
  it('shows the play label with the word and fires onPress', () => {
    const onPress = jest.fn();
    const { getByLabelText, getByRole } = render(<SpeakButton word="Tisch" speaking={false} onPress={onPress} testID="sp" />);
    expect(getByLabelText(t('speech_play_a11y', { word: 'Tisch' }))).toBeTruthy();
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the stop label while speaking', () => {
    const { getByLabelText } = render(<SpeakButton word="Tisch" speaking onPress={() => {}} />);
    expect(getByLabelText(t('speech_stop_a11y', { word: 'Tisch' }))).toBeTruthy();
  });
});
