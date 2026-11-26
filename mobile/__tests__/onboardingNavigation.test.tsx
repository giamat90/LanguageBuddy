/**
 * TASK-069: after onboarding the vault is the home screen. The onboarding screens must not stay in
 * the history: they showed a back arrow on the vault (squeezing its title until a word broke in
 * half) and "back" returned to the quiz. Runs the real expo-router, not a mocked one.
 */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { Slot, Stack, useRouter, router } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import TopicsScreen from '../src/screens/TopicsScreen';
import { t } from '../src/i18n';

jest.mock('../src/services/profileService', () => ({ submitOnboarding: jest.fn().mockResolvedValue(undefined) }));

/** A stand-in for the welcome and quiz screens: one button that pushes the next step. */
const step = (label: string, next: string) =>
  function Step() {
    const r = useRouter();
    return (
      <TouchableOpacity onPress={() => r.push(next as never)}>
        <Text>{label}</Text>
      </TouchableOpacity>
    );
  };

describe('finishing onboarding', () => {
  it('leaves nothing to go back to from the vault', async () => {
    renderRouter(
      {
        _layout: () => <Slot />,
        onboarding: step('welcome', '/quiz'),
        quiz: step('quiz', '/topics?cefrLevel=A1&nativeLanguage=it'),
        topics: TopicsScreen,
        '(app)/_layout': () => <Stack />,
        '(app)/index': () => <Text>vault</Text>,
      },
      { initialUrl: '/onboarding' },
    );
    fireEvent.press(screen.getByText('welcome'));
    fireEvent.press(await screen.findByText('quiz'));
    await screen.findByText(t('topics_cta'));
    const boxes = screen.getAllByRole('checkbox');
    fireEvent.press(boxes[0]);
    fireEvent.press(boxes[1]);
    await act(async () => {
      fireEvent.press(screen.getByText(t('topics_cta')));
    });
    await waitFor(() => expect(screen.getByText('vault')).toBeTruthy());
    expect(router.canGoBack()).toBe(false);
  });
});
