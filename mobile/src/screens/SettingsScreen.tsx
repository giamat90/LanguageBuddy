import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Linking,
  ActivityIndicator, Alert, StyleSheet, Switch, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { t } from '../i18n';
import { dateLocale, type NativeLanguage } from '../i18n/language';
import { applyLayoutDirection } from '../i18n/direction';
import LanguagePicker from '../components/ui/LanguagePicker';
import { useUserStore } from '../store/useUserStore';
import { useAutoBackupStore } from '../store/useAutoBackupStore';
import { useSpeechSettingsStore } from '../store/useSpeechSettingsStore';
import {
  FolderNotWritableError, commitAutoBackupFolder, ensureAutoBackupFolder, requestAutoBackupFolder,
  setAutoBackupEnabled, writeBackupToFolder,
} from '../lib/autoBackup';
import { setUserNativeLanguage } from '../services/profileService';
import { scheduleWordReadyReminder } from '../lib/notifications';
import { refreshReviewReminder } from '../services/reviewService';
import Divider from '../components/ui/Divider';
import NotificationSettings from '../components/ui/NotificationSettings';
import TopicPreferences from '../components/ui/TopicPreferences';
import {
  exportBackup, pickBackup, restoreBackup, RESTART_REQUIRED, type RestorePreview,
} from '../data/backup';
import {
  getProvider, setProvider, getStoredKey, setKey, hasAnyKey, maskKey,
  getOpenAiBaseUrl, setOpenAiBaseUrl, getOpenAiModel, setOpenAiModel,
  InvalidBaseUrlError, DEFAULT_OPENAI_BASE_URL, DEFAULT_OPENAI_MODEL, type AiProvider,
} from '../lib/ai/keys';


const AI_PROVIDERS: AiProvider[] = ['anthropic', 'openai'];
const KEYS_URL: Record<AiProvider, string> = {
  anthropic: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
};
const KEY_PLACEHOLDER: Record<AiProvider, string> = { anthropic: 'sk-ant-...', openai: 'sk-...' };

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export default function SettingsScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState<null | 'export' | 'restore' | 'autobackup'>(null);
  const nativeLanguage = useUserStore((s) => s.nativeLanguage);
  const setNativeLanguage = useUserStore((s) => s.setNativeLanguage);

  const handleLanguageChange = async (lang: NativeLanguage) => {
    if (lang === nativeLanguage) return;
    await setUserNativeLanguage(lang);
    setNativeLanguage(lang);
    // Arabic is right-to-left; Android applies a changed direction only after a restart.
    if (applyLayoutDirection(lang).changed) Alert.alert(t('settings_language_restart_notice'));
    scheduleWordReadyReminder().catch((err) =>
      console.warn('[Settings] scheduleWordReadyReminder after language change failed:', err),
    );
    refreshReviewReminder().catch((err) =>
      console.warn('[Settings] refreshReviewReminder after language change failed:', err),
    );
  };

  const [provider, setProviderState] = useState<AiProvider>(() => getProvider());
  const [maskedKey, setMaskedKey] = useState<string | null>(() => maskKey(getStoredKey(getProvider())));
  const [keyModal, setKeyModal] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [baseUrlDraft, setBaseUrlDraft] = useState('');
  const [modelDraft, setModelDraft] = useState('');
  const [baseUrlInvalid, setBaseUrlInvalid] = useState(false);
  const [revealKey, setRevealKey] = useState(false);

  const chooseProvider = (next: AiProvider) => {
    setProvider(next);
    setProviderState(next);
    setMaskedKey(maskKey(getStoredKey(next)));
  };

  const openKeyModal = () => {
    const baseUrl = getOpenAiBaseUrl();
    const model = getOpenAiModel();
    setKeyDraft('');
    setBaseUrlDraft(baseUrl === DEFAULT_OPENAI_BASE_URL ? '' : baseUrl);
    setModelDraft(model === DEFAULT_OPENAI_MODEL ? '' : model);
    setBaseUrlInvalid(false);
    setRevealKey(false);
    setKeyModal(true);
  };

  const closeKeyModal = () => {
    setKeyModal(false);
    setKeyDraft('');
    setRevealKey(false);
  };

  const clearKey = () => {
    setKey(provider, null);
    setMaskedKey(null);
    closeKeyModal();
  };

  const saveKey = () => {
    if (provider === 'openai') {
      try {
        setOpenAiBaseUrl(baseUrlDraft);
      } catch (err) {
        if (err instanceof InvalidBaseUrlError) {
          setBaseUrlInvalid(true);
          return;
        }
        throw err;
      }
      setOpenAiModel(modelDraft);
    }
    // For OpenAI an empty key field keeps the stored key (only URL/model changed).
    if (keyDraft.trim()) setKey(provider, keyDraft);
    setMaskedKey(maskKey(getStoredKey(provider)));
    closeKeyModal();
  };

  const saveDisabled = provider === 'anthropic' && keyDraft.trim().length === 0;

  const runExport = async (includeAiKey: boolean) => {
    setBusy('export');
    try {
      await exportBackup({ includeAiKey });
    } catch (err) {
      console.error('[Settings] export failed:', err);
      Alert.alert(t('settings_export_failed'), message(err));
    } finally {
      setBusy(null);
    }
  };

  const handleExport = () => {
    if (busy) return;
    if (!hasAnyKey()) {
      runExport(false);
      return;
    }
    Alert.alert(
      t('settings_export_key_title'),
      t('settings_export_key_body'),
      [
        { text: t('common_cancel'), style: 'cancel' },
        { text: t('settings_export_key_without'), onPress: () => runExport(false) },
        { text: t('settings_export_key_with'), onPress: () => runExport(true) },
      ],
    );
  };

  const doRestore = async (preview: RestorePreview) => {
    setBusy('restore');
    try {
      await restoreBackup(preview);
    } catch (err) {
      if (message(err) === RESTART_REQUIRED) {
        Alert.alert(t('settings_restore_done_title'), t('settings_restore_done_body'));
      } else {
        console.error('[Settings] restore failed:', err);
        Alert.alert(t('settings_import_failed'), message(err));
      }
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    if (busy) return;
    setBusy('restore');
    let preview: RestorePreview | null;
    try {
      preview = await pickBackup();
    } catch (err) {
      console.error('[Settings] pick backup failed:', err);
      Alert.alert(t('settings_import_failed'), message(err));
      setBusy(null);
      return;
    }
    setBusy(null);
    if (!preview) return;

    if (!preview.compatible) {
      Alert.alert(t('settings_cannot_restore'), preview.reason ?? '');
      return;
    }

    const when = new Date(preview.data.createdAt).toLocaleDateString(dateLocale(nativeLanguage));
    Alert.alert(
      t('settings_restore_confirm_title'),
      t('settings_restore_confirm_body', { date: when, vocab: preview.data.counts.vocab }),
      [
        { text: t('common_cancel'), style: 'cancel' },
        {
          text: t('settings_restore_confirm_cta'),
          style: 'destructive',
          onPress: () => doRestore(preview as RestorePreview),
        },
      ],
    );
  };

  // ── Automatic backup (Android only, TASK-023) ─────────────────────────────
  // The switch and the "back up now" button are independent: neither needs the other.
  const autoEnabled = useAutoBackupStore((s) => s.enabled);
  const autoPlaySentence = useSpeechSettingsStore((s) => s.autoPlaySentence);
  const setAutoPlaySentence = useSpeechSettingsStore((s) => s.setAutoPlaySentence);
  const autoFolderUri = useAutoBackupStore((s) => s.folderUri);
  const autoLastRunAt = useAutoBackupStore((s) => s.lastRunAt);
  const autoError = useAutoBackupStore((s) => s.error);
  const lastBackupText = autoLastRunAt
    ? new Date(autoLastRunAt).toLocaleString(dateLocale(nativeLanguage))
    : t('settings_autobackup_never');

  /** The saved folder, else the system picker. Null = nothing chosen (also when cancelled). */
  const folderOrAlert = async (): Promise<string | null> => {
    try {
      return await ensureAutoBackupFolder();
    } catch (err) {
      console.error('[Settings] folder picker failed:', (err as Error)?.name);
      Alert.alert(t('settings_autobackup_picker_failed'));
      return null;
    }
  };

  /** The folder does not accept files (Google Drive): forget it and say so, rather than leave a
   *  switch on that can never work. */
  const rejectFolder = () => {
    setAutoBackupEnabled(false);
    const s = useAutoBackupStore.getState();
    s.setFolderUri(null);
    s.setFileUris([]);
    s.setError(false);
    s.setDirty(false);
    Alert.alert(t('settings_autobackup_unusable_title'), t('settings_autobackup_unusable_body'));
  };

  const handleToggleAutoBackup = async (on: boolean) => {
    if (busy) return;
    if (!on) {
      setAutoBackupEnabled(false);
      return;
    }
    setBusy('autobackup');
    try {
      const folderUri = await folderOrAlert();
      if (!folderUri) return; // cancelled: the switch stays off
      setAutoBackupEnabled(true);
      try {
        await writeBackupToFolder(folderUri); // a first copy straight away
      } catch (err) {
        console.error('[Settings] first automatic backup failed:', (err as Error)?.name);
        if (err instanceof FolderNotWritableError) {
          rejectFolder();
        } else {
          useAutoBackupStore.getState().setError(true);
          Alert.alert(t('settings_autobackup_failed'));
        }
      }
    } finally {
      setBusy(null);
    }
  };

  const handleChooseAutoBackupFolder = async () => {
    if (busy) return;
    setBusy('autobackup');
    try {
      let folderUri: string | null;
      try {
        folderUri = await requestAutoBackupFolder();
      } catch (err) {
        console.error('[Settings] folder picker failed:', (err as Error)?.name);
        Alert.alert(t('settings_autobackup_picker_failed'));
        return;
      }
      if (!folderUri) return;
      commitAutoBackupFolder(folderUri);
      if (useAutoBackupStore.getState().enabled) {
        // A first copy tells at once whether the folder works; with the switch off nothing is written.
        try {
          await writeBackupToFolder(folderUri);
        } catch (err) {
          console.error('[Settings] backup after choosing a folder failed:', (err as Error)?.name);
          if (err instanceof FolderNotWritableError) rejectFolder();
          else useAutoBackupStore.getState().setError(true);
        }
      }
    } finally {
      setBusy(null);
    }
  };

  const handleAutoBackupNow = async () => {
    if (busy) return;
    setBusy('autobackup');
    try {
      const folderUri = await folderOrAlert();
      if (!folderUri) return;
      try {
        await writeBackupToFolder(folderUri);
        Alert.alert(t('settings_autobackup_success'));
      } catch (err) {
        console.error('[Settings] backup now failed:', (err as Error)?.name);
        if (err instanceof FolderNotWritableError) {
          rejectFolder();
        } else {
          useAutoBackupStore.getState().setError(true);
          Alert.alert(t('settings_autobackup_failed'));
        }
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('nav_back')}
        >
          <Text style={[typography.body, { color: colors.forest }]}>←</Text>
        </TouchableOpacity>
        <Text style={[typography.wordHero, { color: colors.ink, flex: 1 }]}>
          {t('settings_title')}
        </Text>
      </View>

      <Divider />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[typography.uiSmall, styles.sectionLabel]}>
          {t('settings_language_section')}
        </Text>
        <View style={styles.card}>
          <LanguagePicker value={nativeLanguage} onChange={handleLanguageChange} />
        </View>

        <TopicPreferences />

        <NotificationSettings />

        <Text style={[typography.uiSmall, styles.sectionLabel, { marginTop: 28 }]}>
          {t('settings_data_section')}
        </Text>

        <Text style={[typography.uiSmall, styles.safetyNote]}>
          {t('settings_data_safety_note')}
        </Text>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={handleExport}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel={t('settings_export')}
          >
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, styles.rowLabel]}>{t('settings_export')}</Text>
              <Text style={[typography.uiSmall, styles.rowSub]}>{t('settings_export_desc')}</Text>
            </View>
            {busy === 'export' ? <ActivityIndicator color={colors.forest} /> : null}
          </TouchableOpacity>

          <Divider />

          <TouchableOpacity
            style={styles.row}
            onPress={handleRestore}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel={t('settings_import')}
          >
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, styles.rowLabel]}>{t('settings_import')}</Text>
              <Text style={[typography.uiSmall, styles.rowSub]}>{t('settings_import_desc')}</Text>
            </View>
            {busy === 'restore' ? <ActivityIndicator color={colors.forest} /> : null}
          </TouchableOpacity>
        </View>

        {Platform.OS === 'android' ? (
          <>
            <Text style={[typography.uiSmall, styles.sectionLabel, { marginTop: 28 }]}>
              {t('settings_autobackup_section')}
            </Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, styles.rowLabel]}>{t('settings_autobackup_toggle')}</Text>
                  <Text style={[typography.uiSmall, styles.rowSub]}>{t('settings_autobackup_toggle_hint')}</Text>
                </View>
                <Switch
                  value={autoEnabled}
                  onValueChange={handleToggleAutoBackup}
                  disabled={busy !== null}
                  accessibilityLabel={t('settings_autobackup_toggle')}
                  trackColor={{ false: colors.border, true: colors.forest }}
                />
              </View>

              <Divider />

              <TouchableOpacity
                style={styles.row}
                onPress={handleChooseAutoBackupFolder}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel={t('settings_autobackup_folder')}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, styles.rowLabel]}>{t('settings_autobackup_folder')}</Text>
                  <Text style={[typography.uiSmall, styles.rowSub]}>
                    {autoFolderUri ? t('settings_autobackup_folder_set') : t('settings_autobackup_folder_unset')}
                  </Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 20 }}>›</Text>
              </TouchableOpacity>

              <Divider />

              <TouchableOpacity
                style={styles.row}
                onPress={handleAutoBackupNow}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel={t('settings_autobackup_now')}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, styles.rowLabel]}>{t('settings_autobackup_now')}</Text>
                </View>
                {busy === 'autobackup' ? <ActivityIndicator color={colors.forest} /> : null}
              </TouchableOpacity>

              <Divider />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, styles.rowLabel]}>{t('settings_autobackup_last')}</Text>
                  <Text style={[typography.uiSmall, styles.rowSub]}>{lastBackupText}</Text>
                </View>
              </View>

              {autoError ? (
                <>
                  <Divider />
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.uiSmall, { color: colors.diePink }]}>
                        {t('settings_autobackup_error')}
                      </Text>
                      <TouchableOpacity
                        onPress={handleChooseAutoBackupFolder}
                        disabled={busy !== null}
                        accessibilityRole="button"
                        accessibilityLabel={t('settings_autobackup_error_action')}
                        style={{ marginTop: 8 }}
                      >
                        <Text style={[typography.uiSmall, { color: colors.forest }]}>
                          {t('settings_autobackup_error_action')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : null}
            </View>
            <Text style={[typography.uiSmall, styles.safetyNote, { marginTop: 8 }]}>
              {t('settings_autobackup_hint')}
            </Text>
          </>
        ) : null}

        <Text style={[typography.uiSmall, styles.sectionLabel, { marginTop: 28 }]}>
          {t('settings_speech_section')}
        </Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, styles.rowLabel]}>{t('settings_speech_autoplay')}</Text>
              <Text style={[typography.uiSmall, styles.rowSub]}>{t('settings_speech_autoplay_hint')}</Text>
            </View>
            <Switch
              value={autoPlaySentence}
              onValueChange={setAutoPlaySentence}
              accessibilityLabel={t('settings_speech_autoplay')}
              testID="speech-autoplay-switch"
              trackColor={{ false: colors.border, true: colors.forest }}
            />
          </View>
        </View>

        <Text style={[typography.uiSmall, styles.sectionLabel, { marginTop: 28 }]}>
          {t('settings_ai_section')}
        </Text>
        <Text style={[typography.uiSmall, styles.safetyNote]}>
          {t('settings_ai_note')}
        </Text>

        <View style={[styles.row, { gap: 8, paddingVertical: 0, marginBottom: 12 }]}>
          {AI_PROVIDERS.map((p) => {
            const selected = p === provider;
            return (
              <TouchableOpacity
                key={p}
                onPress={() => chooseProvider(p)}
                style={[styles.languagePill, selected && styles.languagePillSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={t(`settings_ai_provider_${p}`)}
              >
                <Text style={[typography.uiSmall, { color: selected ? colors.paper : colors.ink }]}>
                  {t(`settings_ai_provider_${p}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={openKeyModal}
            accessibilityRole="button"
            accessibilityLabel={t('settings_ai_key_label')}
          >
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, styles.rowLabel]}>{t('settings_ai_key_label')}</Text>
              <Text style={[typography.uiSmall, { color: maskedKey ? colors.muted : colors.diePink, marginTop: 2 }]}>
                {maskedKey ?? t('settings_ai_key_not_set')}
              </Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 20 }}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={keyModal} transparent animationType="fade" onRequestClose={closeKeyModal}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={[typography.uiButton, { color: colors.ink, fontSize: 16 }]}>
              {t('settings_ai_key_label')}
            </Text>
            <Text style={[typography.uiSmall, { color: colors.muted, marginTop: 6, marginBottom: 12 }]}>
              {t('settings_ai_key_hint')}
            </Text>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={keyDraft}
                onChangeText={setKeyDraft}
                placeholder={KEY_PLACEHOLDER[provider]}
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!revealKey}
              />
              <TouchableOpacity onPress={() => setRevealKey((r) => !r)} style={styles.eyeBtn}>
                <Text style={[typography.uiSmall, { color: colors.forest }]}>
                  {revealKey ? t('settings_ai_key_hide') : t('settings_ai_key_show')}
                </Text>
              </TouchableOpacity>
            </View>

            {provider === 'openai' ? (
              <View style={{ marginTop: 12 }}>
                <Text style={[typography.uiSmall, { color: colors.muted, marginBottom: 8 }]}>
                  {t('settings_ai_openai_hint')}
                </Text>
                <View style={[styles.inputRow, { marginBottom: 8 }]}>
                  <TextInput
                    style={styles.input}
                    value={baseUrlDraft}
                    onChangeText={(v) => { setBaseUrlDraft(v); setBaseUrlInvalid(false); }}
                    placeholder={DEFAULT_OPENAI_BASE_URL}
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    accessibilityLabel={t('settings_ai_baseurl_label')}
                  />
                </View>
                {baseUrlInvalid ? (
                  <Text style={[typography.uiSmall, { color: colors.diePink, marginBottom: 8 }]}>
                    {t('settings_ai_baseurl_invalid')}
                  </Text>
                ) : null}
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    value={modelDraft}
                    onChangeText={setModelDraft}
                    placeholder={DEFAULT_OPENAI_MODEL}
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel={t('settings_ai_model_label')}
                  />
                </View>
              </View>
            ) : null}

            <TouchableOpacity onPress={() => Linking.openURL(KEYS_URL[provider])}>
              <Text style={[typography.uiSmall, { color: colors.forest, marginTop: 10 }]}>
                {t('settings_ai_key_get')}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={closeKeyModal} style={styles.modalBtn}>
                <Text style={[typography.uiButton, { color: colors.muted }]}>{t('common_cancel')}</Text>
              </TouchableOpacity>
              {maskedKey ? (
                <TouchableOpacity onPress={clearKey} style={styles.modalBtn}>
                  <Text style={[typography.uiButton, { color: colors.diePink }]}>{t('settings_ai_key_clear')}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={saveKey}
                disabled={saveDisabled}
                style={[styles.modalBtn, styles.modalBtnPrimary, saveDisabled && { opacity: 0.4 }]}
              >
                <Text style={[typography.uiButton, { color: colors.cream }]}>{t('settings_ai_key_save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  safetyNote: {
    color: colors.muted,
    lineHeight: 18,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  rowLabel: { color: colors.ink },
  rowSub: { color: colors.muted, marginTop: 2 },
  languagePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: colors.mist,
  },
  languagePillSelected: {
    backgroundColor: colors.forest,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingLeft: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    ...typography.body,
    color: colors.ink,
  },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 12 },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  modalBtnPrimary: {
    backgroundColor: colors.forest,
  },
});
