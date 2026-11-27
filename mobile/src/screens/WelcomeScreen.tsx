import React, { useState } from 'react';
import { View, Text, Alert, I18nManager, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { t, setAppLocale } from '../i18n';
import { getActivePack } from '../languages';
import { dateLocale, detectDeviceLanguage, type NativeLanguage } from '../i18n/language';
import { applyLayoutDirection } from '../i18n/direction';
import LanguagePicker from '../components/ui/LanguagePicker';
import PrimaryButton from '../components/ui/PrimaryButton';
import SecondaryButton from '../components/ui/SecondaryButton';
import { pickBackup, restoreBackup, RESTART_REQUIRED, backupErrorText, type RestorePreview } from '../data/backup';
import { rehydrateAfterRestore } from '../services/restoreService';

export default function WelcomeScreen() {
  const router = useRouter();
  // Preselect the phone's language when the app supports it (English otherwise).
  const [nativeLanguage, setNativeLanguage] = useState<NativeLanguage>(() => {
    const lang = detectDeviceLanguage(I18nManager.getConstants?.().localeIdentifier);
    setAppLocale(lang);
    return lang;
  });
  const [busy, setBusy] = useState(false);

  function handlePick(lang: NativeLanguage) {
    setAppLocale(lang);
    setNativeLanguage(lang);
    // Arabic is right-to-left; Android applies a changed direction only after a restart.
    if (applyLayoutDirection(lang).changed) Alert.alert(t('settings_language_restart_notice'));
  }

  // A language without a placement quiz has one level: straight to the topics, after the
  // pronunciation primer where the language has one.
  const start = () => {
    const { quiz, levels, primer } = getActivePack();
    if (quiz.length > 0) router.push({ pathname: '/quiz', params: { nativeLanguage } });
    else if (primer) router.push({ pathname: '/primer-intro', params: { from: 'onboarding', nativeLanguage } });
    else router.push({ pathname: '/topics', params: { cefrLevel: levels[0], nativeLanguage } });
  };

  const failed = (err: unknown) => {
    console.error('[Welcome] restore failed:', err);
    Alert.alert(t('welcome_restore_failed'));
  };

  const doRestore = async (preview: RestorePreview) => {
    setBusy(true);
    try {
      await restoreBackup(preview);
    } catch (err) {
      if (!(err instanceof Error) || err.message !== RESTART_REQUIRED) {
        failed(err);
        setBusy(false);
        return;
      }
    }
    try {
      if (await rehydrateAfterRestore()) {
        router.replace('/(app)/');
        return;
      }
      Alert.alert(t('welcome_restore_no_profile'));
    } catch (err) {
      failed(err);
    }
    setBusy(false);
  };

  const handleRestore = async () => {
    if (busy) return;
    setBusy(true);
    let preview: RestorePreview | null;
    try {
      preview = await pickBackup();
    } catch (err) {
      failed(err);
      setBusy(false);
      return;
    }
    setBusy(false);
    if (!preview) return;
    if (!preview.compatible) {
      Alert.alert(t('welcome_restore_incompatible'));
      return;
    }

    const when = new Date(preview.data.createdAt).toLocaleDateString(dateLocale(nativeLanguage));
    Alert.alert(
      t('welcome_restore_confirm_title'),
      t('welcome_restore_confirm_body', { date: when, vocab: preview.data.counts.vocab }),
      [
        { text: t('common_cancel'), style: 'cancel' },
        { text: t('settings_restore_confirm_cta'), onPress: () => doRestore(preview as RestorePreview) },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={[typography.wordHero, { color: colors.ink }]}>{getActivePack().app.name}</Text>
        <Text style={[typography.body, { color: colors.muted, marginTop: 12 }]}>
          {t('welcome_subtitle')}
        </Text>

        <LanguagePicker value={nativeLanguage} onChange={handlePick} disabled={busy} />
      </View>
      <View style={styles.footer}>
        <PrimaryButton
          label={t('welcome_cta')}
          onPress={start}
          disabled={busy}
        />
        <SecondaryButton
          label={t('welcome_restore_cta')}
          onPress={handleRestore}
          disabled={busy}
          style={{ marginTop: 8 }}
        />
        <Text style={[typography.uiSmall, { color: colors.muted, textAlign: 'center', marginTop: 12 }]}>
          {t('welcome_offline_note')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  inner: { flex: 1, padding: 32, justifyContent: 'center' },
  footer: { paddingHorizontal: 24, paddingBottom: 32 },
});
