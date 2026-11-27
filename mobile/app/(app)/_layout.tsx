import { Redirect, Stack } from 'expo-router';
import { useUserStore } from '../../src/store/useUserStore';

export default function AppLayout() {
  const hasProfile = useUserStore((s) => s.hasProfile);
  const nativeLanguage = useUserStore((s) => s.nativeLanguage);
  if (!hasProfile) return <Redirect href="/onboarding" />;
  return (
    <Stack key={nativeLanguage} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="today" />
      <Stack.Screen name="review" />
      <Stack.Screen name="grammar" />
      <Stack.Screen name="primer" />
      <Stack.Screen name="practice" />
      <Stack.Screen name="practice-session" />
      <Stack.Screen name="stats" />
      <Stack.Screen name="stats-words" />
      <Stack.Screen name="catalog" />
      <Stack.Screen name="word" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
