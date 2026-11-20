import React from 'react';
import { Alert, I18nManager } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import WelcomeScreen from '../src/screens/WelcomeScreen';
import * as backup from '../src/data/backup';
import { getDb, resetDbHandle } from '../src/data/db';
import { rehydrateAfterRestore } from '../src/services/restoreService';
import { useUserStore } from '../src/store/useUserStore';
import { useWordStore } from '../src/store/useWordStore';

jest.mock('../src/data/backup', () => ({
  pickBackup: jest.fn(),
  restoreBackup: jest.fn(),
  RESTART_REQUIRED: 'RESTART_REQUIRED',
}));

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require('expo-sqlite');

const preview = {
  compatible: true,
  data: { createdAt: '2026-09-01T00:00:00.000Z', counts: { vocab: 7, daysLearned: 3 } },
};

async function seedProfile(nativeLanguage = 'en') {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO learner_profile (id, cefr_level, topic_preferences, created_at, streak_days, total_words_seen, native_language)
     VALUES ('p1', 'B2', '{}', '2026-09-01', 4, 10, ?)`,
    [nativeLanguage],
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  sqlite.__reset();
  resetDbHandle();
  useUserStore.setState({ hasProfile: false, cefrLevel: null, nativeLanguage: 'it' });
  useWordStore.setState({ streakDays: 0 });
});

describe('rehydrateAfterRestore', () => {
  it('syncs the in-memory stores from the restored profile', async () => {
    await seedProfile('en');
    await expect(rehydrateAfterRestore()).resolves.toBe(true);
    const u = useUserStore.getState();
    expect(u.hasProfile).toBe(true);
    expect(u.cefrLevel).toBe('B2');
    expect(u.nativeLanguage).toBe('en');
    expect(useWordStore.getState().streakDays).toBe(4);
  });

  it('applies the restored language direction (Arabic is right-to-left)', async () => {
    const force = jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => {});
    jest.spyOn(I18nManager, 'allowRTL').mockImplementation(() => {});
    Object.defineProperty(I18nManager, 'isRTL', { value: false, configurable: true });
    await seedProfile('ar');
    await rehydrateAfterRestore();
    expect(force).toHaveBeenCalledWith(true);
  });

  it('returns false and leaves onboarding required when the backup has no profile', async () => {
    await expect(rehydrateAfterRestore()).resolves.toBe(false);
    expect(useUserStore.getState().hasProfile).toBe(false);
  });
});

describe('WelcomeScreen restore', () => {
  it('restores a picked backup and goes straight into the app', async () => {
    await seedProfile();
    (backup.pickBackup as jest.Mock).mockResolvedValueOnce(preview);
    (backup.restoreBackup as jest.Mock).mockRejectedValueOnce(new Error('RESTART_REQUIRED'));
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style !== 'cancel')?.onPress?.();
    });

    const { getByText } = render(<WelcomeScreen />);
    fireEvent.press(getByText('I already have a backup'));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/'));
    expect(useUserStore.getState().hasProfile).toBe(true);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('does nothing when the picker is cancelled', async () => {
    (backup.pickBackup as jest.Mock).mockResolvedValueOnce(null);
    const { getByText } = render(<WelcomeScreen />);
    fireEvent.press(getByText('I already have a backup'));
    await waitFor(() => expect(backup.pickBackup).toHaveBeenCalled());
    expect(backup.restoreBackup).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('shows a generic error and stays put when restore fails', async () => {
    (backup.pickBackup as jest.Mock).mockResolvedValueOnce(preview);
    (backup.restoreBackup as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style !== 'cancel')?.onPress?.();
    });

    const { getByText } = render(<WelcomeScreen />);
    fireEvent.press(getByText('I already have a backup'));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith("Couldn't restore the backup. Check the file and try again."),
    );
    expect(errSpy).toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
