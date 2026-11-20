import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import TopicPreferences from '../src/components/ui/TopicPreferences';
import * as profileService from '../src/services/profileService';
import { buildTopicPreferences, TOPIC_KEYS, topicCountsForLevel } from '../src/lib/topics';
import { t } from '../src/i18n';

jest.mock('../src/services/profileService');

const fetchProfile = profileService.fetchProfile as jest.Mock;
const setTopicPreferences = profileService.setTopicPreferences as jest.Mock;

const profile = (selected: string[], cefrLevel = 'A1') => ({
  id: 'p', cefrLevel, topicPreferences: buildTopicPreferences(TOPIC_KEYS, selected),
  streakDays: 0, lastActiveAt: null, totalWordsSeen: 0, nativeLanguage: 'it',
});

beforeEach(() => {
  jest.clearAllMocks();
  setTopicPreferences.mockResolvedValue(undefined);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('TopicPreferences', () => {
  it('shows every topic with its current state', async () => {
    fetchProfile.mockResolvedValue(profile(['food', 'work']));
    const { findByTestId } = render(<TopicPreferences />);
    expect((await findByTestId('topic-chip-food')).props.accessibilityState.checked).toBe(true);
    expect((await findByTestId('topic-chip-home')).props.accessibilityState.checked).toBe(false);
  });

  it('saves a toggle immediately with the new selection', async () => {
    fetchProfile.mockResolvedValue(profile(['food']));
    const { findByTestId } = render(<TopicPreferences />);
    fireEvent.press(await findByTestId('topic-chip-work'));
    await waitFor(() => expect(setTopicPreferences).toHaveBeenCalledWith(buildTopicPreferences(TOPIC_KEYS, ['food', 'work'])));
    expect((await findByTestId('topic-chip-work')).props.accessibilityState.checked).toBe(true);
  });

  it('does not let the last topic be switched off', async () => {
    fetchProfile.mockResolvedValue(profile(['food']));
    const { findByTestId, getByText } = render(<TopicPreferences />);
    fireEvent.press(await findByTestId('topic-chip-food'));
    expect(setTopicPreferences).not.toHaveBeenCalled();
    expect(getByText(t('settings_topics_last'))).toBeTruthy();
    expect((await findByTestId('topic-chip-food')).props.accessibilityState.checked).toBe(true);
  });

  it('reverts and shows a generic message when saving fails', async () => {
    fetchProfile.mockResolvedValue(profile(['food']));
    setTopicPreferences.mockRejectedValue(new Error('disk exploded: /data/secret'));
    const { findByTestId, findByText, queryByText } = render(<TopicPreferences />);
    fireEvent.press(await findByTestId('topic-chip-work'));
    expect(await findByText(t('settings_topics_error'))).toBeTruthy();
    expect(queryByText(/disk exploded/)).toBeNull();
    expect((await findByTestId('topic-chip-work')).props.accessibilityState.checked).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it('ignores a second tap while a save is in flight', async () => {
    fetchProfile.mockResolvedValue(profile(['food']));
    let release: () => void = () => {};
    setTopicPreferences.mockImplementation(() => new Promise<void>((r) => { release = r; }));
    const { findByTestId } = render(<TopicPreferences />);
    fireEvent.press(await findByTestId('topic-chip-work'));
    fireEvent.press(await findByTestId('topic-chip-home'));
    expect(setTopicPreferences).toHaveBeenCalledTimes(1);
    await act(async () => { release(); });
  });

  it('shows how many words each topic has at the learner level, and flags empty ones', async () => {
    fetchProfile.mockResolvedValue(profile(['culture'], 'C1'));
    const { findByTestId } = render(<TopicPreferences />);
    const counts = topicCountsForLevel('C1');
    expect((await findByTestId('topic-count-culture')).props.children).toBe(t('settings_topics_count', { count: counts.culture }));
    expect((await findByTestId('topic-count-food')).props.children).toBe(t('settings_topics_none'));
  });

  it('renders nothing without a profile', async () => {
    fetchProfile.mockResolvedValue(null);
    const { queryByTestId } = render(<TopicPreferences />);
    await act(async () => {});
    expect(queryByTestId('topic-chip-food')).toBeNull();
  });
});
