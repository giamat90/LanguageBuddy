/**
 * Local (on-device) reminder notifications — no server, no push token.
 *
 * Two kinds:
 *  - "word ready": a daily recurring reminder that today's word is waiting.
 *  - "review ready" (ripasso): a one-shot reminder for the next time an SRS
 *    review becomes due, rescheduled whenever the vault's due dates change.
 *
 * Preferences and the Expo notification identifiers of the currently
 * scheduled reminders are persisted in MMKV so they survive app restarts and
 * can be cancelled/rescheduled individually.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { t } from '../i18n';

const storage = new MMKV({ id: 'notifications-store' });

const ENABLED_KEY = 'notifications_enabled';
const HOUR_KEY = 'reminder_hour';
const MINUTE_KEY = 'reminder_minute';
const WORD_NOTIF_ID_KEY = 'word_notification_id';
const REVIEW_NOTIF_ID_KEY = 'review_notification_id';

export const NOTIFICATION_CHANNEL_ID = 'daily-reminders';
export const DEFAULT_REMINDER_HOUR = 9;
export const DEFAULT_REMINDER_MINUTE = 0;

// ─── Preferences ──────────────────────────────────────────────────────────

export function isNotificationsEnabled(): boolean {
  return storage.getBoolean(ENABLED_KEY) ?? true;
}

export function setNotificationsEnabled(value: boolean): void {
  storage.set(ENABLED_KEY, value);
}

export function getReminderTime(): { hour: number; minute: number } {
  return {
    hour: storage.getNumber(HOUR_KEY) ?? DEFAULT_REMINDER_HOUR,
    minute: storage.getNumber(MINUTE_KEY) ?? DEFAULT_REMINDER_MINUTE,
  };
}

export function setReminderTime(hour: number, minute: number): void {
  storage.set(HOUR_KEY, hour);
  storage.set(MINUTE_KEY, minute);
}

// expo-notifications reads channelId off the *trigger*, not the content — a
// trigger with no channelId (or an unknown one) silently falls back to a
// generic "Miscellaneous" channel on Android.
function androidChannel(): { channelId: string } | Record<string, never> {
  return Platform.OS === 'android' ? { channelId: NOTIFICATION_CHANNEL_ID } : {};
}

// ─── Word-of-the-day reminder (daily, repeating) ───────────────────────────

/** (Re)schedules the daily "your word is ready" reminder at the preferred time. */
export async function scheduleWordReadyReminder(): Promise<void> {
  await cancelWordReadyReminder();
  if (!isNotificationsEnabled()) return;

  const { hour, minute } = getReminderTime();
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: t('notif_word_title'),
        body: t('notif_word_body'),
        data: { type: 'word_ready' },
        sound: 'default',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, ...androidChannel() },
    });
    storage.set(WORD_NOTIF_ID_KEY, id);
  } catch (err) {
    console.warn('notifications: failed to schedule word-ready reminder', err);
  }
}

export async function cancelWordReadyReminder(): Promise<void> {
  const id = storage.getString(WORD_NOTIF_ID_KEY);
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (err) {
    console.warn('notifications: failed to cancel word-ready reminder', err);
  }
  storage.delete(WORD_NOTIF_ID_KEY);
}

// ─── Review (ripasso) reminder — one-shot, tied to the earliest due date ───

/**
 * (Re)schedules the "you have words to review" reminder.
 *
 * `earliestNextReviewAt` is the smallest `next_review_at` across the vault
 * (null if the vault is empty). `dueNow` is how many items are already due —
 * when > 0 the reminder fires at the next occurrence of the preferred time
 * rather than instantly, since the app was presumably just opened.
 */
export async function scheduleReviewReminder(
  earliestNextReviewAt: Date | null,
  dueNow: number,
): Promise<void> {
  await cancelReviewReminder();
  if (!isNotificationsEnabled()) return;
  if (!earliestNextReviewAt && dueNow === 0) return;

  const { hour, minute } = getReminderTime();
  const now = new Date();

  const triggerDate = dueNow > 0 ? new Date(now) : new Date(earliestNextReviewAt as Date);
  triggerDate.setHours(hour, minute, 0, 0);
  if (triggerDate <= now) {
    triggerDate.setDate(triggerDate.getDate() + 1);
  }

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: t('notif_review_title'),
        body: t('notif_review_body'),
        data: { type: 'review_ready' },
        sound: 'default',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate, ...androidChannel() },
    });
    storage.set(REVIEW_NOTIF_ID_KEY, id);
  } catch (err) {
    console.warn('notifications: failed to schedule review reminder', err);
  }
}

export async function cancelReviewReminder(): Promise<void> {
  const id = storage.getString(REVIEW_NOTIF_ID_KEY);
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (err) {
    console.warn('notifications: failed to cancel review reminder', err);
  }
  storage.delete(REVIEW_NOTIF_ID_KEY);
}

// ─── Bulk operations ────────────────────────────────────────────────────────

/** Cancels every scheduled reminder and clears stored identifiers. */
export async function cancelAllReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.warn('notifications: failed to cancel all reminders', err);
  }
  storage.delete(WORD_NOTIF_ID_KEY);
  storage.delete(REVIEW_NOTIF_ID_KEY);
}

/** Fires an immediate-ish notification — used by the "send test" button in Settings. */
export async function sendTestNotification(): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t('notif_test_title'),
        body: t('notif_test_body'),
        sound: 'default',
      },
      // A bare `null` trigger fires immediately but on Android can't carry a
      // channel — expo-notifications silently falls back to a generic
      // channel for it (confirmed on-device). A 1-second interval trigger
      // *can* carry `channelId` and still fires effectively instantly.
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, ...androidChannel() },
    });
  } catch (err) {
    console.warn('notifications: sendTestNotification failed', err);
  }
}
