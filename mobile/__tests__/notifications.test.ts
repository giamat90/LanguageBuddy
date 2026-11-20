import { Platform } from 'react-native';
import {
  isNotificationsEnabled,
  setNotificationsEnabled,
  getReminderTime,
  setReminderTime,
  scheduleWordReadyReminder,
  cancelWordReadyReminder,
  scheduleReviewReminder,
  cancelReviewReminder,
  cancelAllReminders,
  sendTestNotification,
  NOTIFICATION_CHANNEL_ID,
} from '../src/lib/notifications';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const notifs = require('expo-notifications');

beforeEach(() => {
  notifs.__reset();
  setNotificationsEnabled(true);
  setReminderTime(9, 0);
});

describe('preferences', () => {
  it('defaults to enabled at 09:00', () => {
    expect(isNotificationsEnabled()).toBe(true);
    expect(getReminderTime()).toEqual({ hour: 9, minute: 0 });
  });

  it('persists a new reminder time', () => {
    setReminderTime(20, 30);
    expect(getReminderTime()).toEqual({ hour: 20, minute: 30 });
  });
});

describe('scheduleWordReadyReminder', () => {
  it('schedules a daily trigger at the preferred time', async () => {
    setReminderTime(8, 15);
    await scheduleWordReadyReminder();

    const scheduled = Object.values(notifs.__scheduled());
    expect(scheduled).toHaveLength(1);
    const [{ trigger, content }] = scheduled as any[];
    expect(trigger).toMatchObject({ type: 'daily', hour: 8, minute: 15 });
    expect(content.data).toEqual({ type: 'word_ready' });
  });

  it('cancels the previous one before scheduling a new one', async () => {
    await scheduleWordReadyReminder();
    await scheduleWordReadyReminder();
    expect(Object.keys(notifs.__scheduled())).toHaveLength(1);
  });

  it('schedules nothing when notifications are disabled', async () => {
    setNotificationsEnabled(false);
    await scheduleWordReadyReminder();
    expect(Object.keys(notifs.__scheduled())).toHaveLength(0);
  });
});

describe('scheduleReviewReminder', () => {
  it('schedules a one-shot DATE trigger on the due date at the preferred time', async () => {
    const future = new Date('2026-01-10T00:00:00.000Z');
    await scheduleReviewReminder(future, 0);

    const [{ trigger, content }] = Object.values(notifs.__scheduled()) as any[];
    expect(trigger.type).toBe('date');
    const fireDate = new Date(trigger.date);
    expect(fireDate.getHours()).toBe(9);
    expect(fireDate.getMinutes()).toBe(0);
    expect(content.data).toEqual({ type: 'review_ready' });
  });

  it('schedules nothing when the vault is empty and nothing is due', async () => {
    await scheduleReviewReminder(null, 0);
    expect(Object.keys(notifs.__scheduled())).toHaveLength(0);
  });

  it('replaces a previously scheduled review reminder', async () => {
    await scheduleReviewReminder(new Date('2026-01-10T00:00:00.000Z'), 0);
    await scheduleReviewReminder(new Date('2026-02-01T00:00:00.000Z'), 0);
    expect(Object.keys(notifs.__scheduled())).toHaveLength(1);
  });
});

describe('cancelAllReminders', () => {
  it('clears every scheduled reminder', async () => {
    await scheduleWordReadyReminder();
    await scheduleReviewReminder(new Date('2026-01-10T00:00:00.000Z'), 0);
    await cancelAllReminders();
    expect(Object.keys(notifs.__scheduled())).toHaveLength(0);
  });
});

describe('sendTestNotification', () => {
  it('fires via a 1-second interval trigger (a bare null trigger cannot carry a channel on Android)', async () => {
    await sendTestNotification();
    const [{ trigger }] = Object.values(notifs.__scheduled()) as any[];
    expect(trigger).toMatchObject({ type: 'timeInterval', seconds: 1 });
  });
});

describe('Android channel tagging', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  it('tags every trigger with the daily-reminders channel on Android', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });

    await scheduleWordReadyReminder();
    await scheduleReviewReminder(new Date('2026-01-10T00:00:00.000Z'), 0);
    await sendTestNotification();

    const triggers = Object.values(notifs.__scheduled()).map((s: any) => s.trigger);
    expect(triggers).toHaveLength(3);
    for (const trigger of triggers) {
      expect(trigger.channelId).toBe(NOTIFICATION_CHANNEL_ID);
    }
  });

  it('omits channelId off Android', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });

    await scheduleWordReadyReminder();
    await sendTestNotification();

    const scheduled = Object.values(notifs.__scheduled()) as any[];
    expect(scheduled[0].trigger.channelId).toBeUndefined();
    expect(scheduled[1].trigger.channelId).toBeUndefined();
  });
});

describe('cancelWordReadyReminder / cancelReviewReminder', () => {
  it('cancel individually without touching the other', async () => {
    await scheduleWordReadyReminder();
    await scheduleReviewReminder(new Date('2026-01-10T00:00:00.000Z'), 0);
    await cancelWordReadyReminder();
    expect(Object.keys(notifs.__scheduled())).toHaveLength(1);
    await cancelReviewReminder();
    expect(Object.keys(notifs.__scheduled())).toHaveLength(0);
  });
});
