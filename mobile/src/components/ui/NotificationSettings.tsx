import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity, Linking, Platform, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { t } from '../../i18n';
import { useNotifications } from '../../hooks/useNotifications';
import {
  isNotificationsEnabled,
  setNotificationsEnabled,
  getReminderTime,
  setReminderTime,
  scheduleWordReadyReminder,
  cancelAllReminders,
  sendTestNotification,
} from '../../lib/notifications';
import { refreshReviewReminder } from '../../services/reviewService';
import Divider from './Divider';

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function buildPickerDate(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

export default function NotificationSettings() {
  const { hasPermission, requestPermission } = useNotifications();
  const [enabled, setEnabled] = useState(isNotificationsEnabled());
  const [{ hour, minute }, setTime] = useState(getReminderTime());
  const [showPicker, setShowPicker] = useState(false);

  async function rescheduleAll() {
    await scheduleWordReadyReminder();
    await refreshReviewReminder();
  }

  async function handleToggle(value: boolean) {
    if (value && !hasPermission) {
      const granted = await requestPermission();
      if (!granted) return; // Switch stays off; system settings row explains why.
    }
    setEnabled(value);
    setNotificationsEnabled(value);
    if (value) {
      await rescheduleAll();
    } else {
      await cancelAllReminders();
    }
  }

  async function applyNewTime(h: number, m: number) {
    setTime({ hour: h, minute: m });
    setReminderTime(h, m);
    if (enabled) await rescheduleAll();
  }

  function handlePickerChange(_event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) applyNewTime(selected.getHours(), selected.getMinutes());
  }

  const pickerDate = buildPickerDate(hour, minute);
  const permissionBlocked = enabled && !hasPermission;

  return (
    <View>
      <Text style={[typography.uiSmall, styles.sectionLabel]}>
        {t('settings_notif_section')}
      </Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.body, styles.rowLabel]}>
              {t('settings_notif_toggle_label')}
            </Text>
            <Text style={[typography.uiSmall, styles.rowSub]}>
              {t('settings_notif_toggle_desc')}
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            trackColor={{ false: colors.mist, true: colors.forestLight }}
            thumbColor={enabled ? colors.forest : '#fff'}
            accessibilityLabel={t('settings_notif_toggle_label')}
          />
        </View>

        {enabled ? (
          <>
            <Divider />
            <TouchableOpacity
              style={styles.row}
              onPress={() => setShowPicker(true)}
              accessibilityRole="button"
              accessibilityLabel={`${t('settings_notif_time_label')}, ${formatTime(hour, minute)}`}
            >
              <Text style={[typography.body, styles.rowLabel, { flex: 1 }]}>
                {t('settings_notif_time_label')}
              </Text>
              <View style={styles.timePill}>
                <Text style={[typography.uiSmall, { color: colors.forest }]}>
                  {formatTime(hour, minute)}
                </Text>
              </View>
            </TouchableOpacity>

            {showPicker ? (
              <DateTimePicker
                value={pickerDate}
                mode="time"
                is24Hour
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handlePickerChange}
              />
            ) : null}
          </>
        ) : null}

        {permissionBlocked ? (
          <>
            <Divider />
            <View style={styles.row}>
              <Text style={[typography.uiSmall, { color: colors.diePink, flex: 1 }]}>
                {t('settings_notif_permission_denied')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => Linking.openSettings()}
              style={[styles.row, { paddingTop: 0 }]}
              accessibilityRole="button"
            >
              <Text style={[typography.uiSmall, { color: colors.forest }]}>
                {t('settings_notif_open_system_settings')}
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      {__DEV__ && enabled && hasPermission ? (
        <TouchableOpacity
          onPress={() => sendTestNotification()}
          style={styles.testButton}
          accessibilityRole="button"
        >
          <Text style={[typography.uiSmall, { color: colors.forest }]}>
            {t('settings_notif_send_test')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
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
  timePill: {
    backgroundColor: colors.forestLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  testButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
});
