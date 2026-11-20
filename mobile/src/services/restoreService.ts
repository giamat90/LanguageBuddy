import { fetchProfile } from './profileService';
import { refreshReviewReminder } from './reviewService';
import { useUserStore } from '../store/useUserStore';
import { useWordStore } from '../store/useWordStore';
import { applyLayoutDirection } from '../i18n/direction';

/**
 * After restoreBackup() has replaced the DB and MMKV values, the in-memory
 * stores are still stale. Re-reads the profile from the restored DB and syncs
 * them so the app can continue without a relaunch. Returns false if the backup
 * held no profile (the user still has to onboard).
 */
export async function rehydrateAfterRestore(): Promise<boolean> {
  const profile = await fetchProfile();
  const user = useUserStore.getState();
  if (!profile) {
    user.setHasProfile(false);
    return false;
  }
  user.setCefrLevel(profile.cefrLevel);
  user.setNativeLanguage(profile.nativeLanguage);
  // Takes effect at the next launch (Android applies a changed direction only then).
  applyLayoutDirection(profile.nativeLanguage);
  user.setHasProfile(true);
  useWordStore.getState().setStreak(profile.streakDays);
  refreshReviewReminder().catch((err) =>
    console.error('[restoreService] refreshReviewReminder failed:', err),
  );
  return true;
}
