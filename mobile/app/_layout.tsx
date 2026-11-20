import React, { useEffect, useRef } from 'react';
import { AppState, Platform, View } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
} from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import * as SplashScreenNative from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import AppErrorBoundary from '../src/components/AppErrorBoundary';
import SplashScreen from '../src/components/SplashScreen';
import { useUserStore } from '../src/store/useUserStore';
import { bootstrapLocalData } from '../src/data/bootstrap';
import { fetchProfile } from '../src/services/profileService';
import { useNotifications } from '../src/hooks/useNotifications';
import { isNotificationsEnabled, scheduleWordReadyReminder } from '../src/lib/notifications';
import { refreshReviewReminder } from '../src/services/reviewService';
import { initAutoBackup } from '../src/lib/autoBackup';
import { applyLayoutDirection } from '../src/i18n/direction';

SplashScreenNative.preventAutoHideAsync();

// Layout direction follows the persisted app language (Arabic is right-to-left). A change
// only takes effect after a restart, which is why the language pickers also warn.
applyLayoutDirection(useUserStore.getState().nativeLanguage);

// Configure how notifications behave while the app is in the foreground.
// Must run at module level, before any notification can arrive.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const { bootReady, setBootReady, setHasProfile, setCefrLevel } = useUserStore();
  const router = useRouter();
  const { hasPermission, requestPermission } = useNotifications();
  const responseListener = useRef<Notifications.Subscription | null>(null);

  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    Inter_400Regular,
    Inter_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreenNative.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    (async () => {
      try {
        await bootstrapLocalData();
        const profile = await fetchProfile();
        setHasProfile(profile !== null);
        setCefrLevel(profile?.cefrLevel ?? null);
      } catch (e) {
        console.error('[RootLayout] local bootstrap failed:', e);
        setHasProfile(false);
      } finally {
        setBootReady(true);
      }
    })();
  }, []);

  // Automatic backup (Android only): once the database is open, start listening for data changes
  // (and, in the background, drop a folder whose permission grant is gone, e.g. after a reinstall).
  // Never blocks the app from starting.
  useEffect(() => {
    if (!bootReady || Platform.OS !== 'android') return;
    return initAutoBackup();
  }, [bootReady]);

  // Ask for notification permission once onboarding is done and the app is
  // ready, then (re)schedule the local reminders — daily word-ready, and
  // ripasso if there's already a vault. A denied prompt just leaves
  // notifications off; the user can grant it later from Settings.
  useEffect(() => {
    if (!bootReady) return;
    (async () => {
      const granted = hasPermission || (await requestPermission());
      if (!granted || !isNotificationsEnabled()) return;
      await scheduleWordReadyReminder();
      await refreshReviewReminder();
    })();
  }, [bootReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to the relevant screen when the user taps a reminder notification.
  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: string };
      if (data?.type === 'review_ready') {
        router.push('/(app)/review');
      } else if (data?.type === 'word_ready') {
        router.push('/(app)/today');
      }
    });
    return () => {
      try {
        responseListener.current?.remove();
      } catch {}
    };
  }, [router]);

  // Clear the badge whenever the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        Notifications.setBadgeCountAsync(0).catch(() => {});
      }
    });
    return () => {
      try {
        sub.remove();
      } catch {}
    };
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (!bootReady) return <SplashScreen />;

  return (
    <AppErrorBoundary>
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    </AppErrorBoundary>
  );
}
