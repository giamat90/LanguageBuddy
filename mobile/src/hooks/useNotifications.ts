import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { NOTIFICATION_CHANNEL_ID } from '../lib/notifications';

export interface UseNotificationsResult {
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
}

async function setupChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: 'Promemoria',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200, 200, 200],
      lightColor: '#1E4A67',
    });
  } catch (err) {
    console.warn('useNotifications: could not set notification channel', err);
  }
}

/**
 * Manages local-notification permission + the Android notification channel.
 * The app is fully offline — there is no server to receive a push token, so
 * only the local-notification permission is relevant. Scheduling itself
 * lives in `src/lib/notifications.ts`.
 */
export function useNotifications(): UseNotificationsResult {
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status === 'granted') {
          setHasPermission(true);
          await setupChannel();
        }
      } catch (err) {
        console.warn('useNotifications: failed to check permissions', err);
      }
    })();
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      const granted = status === 'granted';
      setHasPermission(granted);
      if (granted) await setupChannel();
      return granted;
    } catch (err) {
      console.warn('useNotifications: requestPermission failed', err);
      return false;
    }
  }, []);

  return { hasPermission, requestPermission };
}
