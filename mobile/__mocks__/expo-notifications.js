/**
 * Minimal stand-in for expo-notifications under Jest (no native module
 * available in the test environment). Records scheduled/cancelled
 * notifications in-memory so tests can assert on them via `__scheduled()`.
 */

let idCounter = 0;
let scheduled = {};
let permissionStatus = 'undetermined';

function reset() {
  idCounter = 0;
  scheduled = {};
  permissionStatus = 'undetermined';
}

async function scheduleNotificationAsync({ content, trigger }) {
  const id = `mock-notif-${++idCounter}`;
  scheduled[id] = { content, trigger };
  return id;
}

async function cancelScheduledNotificationAsync(id) {
  delete scheduled[id];
}

async function cancelAllScheduledNotificationsAsync() {
  scheduled = {};
}

async function getAllScheduledNotificationsAsync() {
  return Object.entries(scheduled).map(([identifier, v]) => ({ identifier, ...v }));
}

async function getPermissionsAsync() {
  return { status: permissionStatus, granted: permissionStatus === 'granted' };
}

async function requestPermissionsAsync() {
  permissionStatus = 'granted';
  return { status: permissionStatus, granted: true };
}

async function setNotificationChannelAsync() {
  return null;
}

function setNotificationHandler() {}

function addNotificationResponseReceivedListener() {
  return { remove() {} };
}

async function setBadgeCountAsync() {
  return true;
}

const AndroidImportance = { MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4, MAX: 5 };

const SchedulableTriggerInputTypes = {
  CALENDAR: 'calendar',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  DATE: 'date',
  TIME_INTERVAL: 'timeInterval',
};

module.exports = {
  __reset: reset,
  __scheduled: () => scheduled,
  __setPermissionStatus: (status) => { permissionStatus = status; },
  scheduleNotificationAsync,
  cancelScheduledNotificationAsync,
  cancelAllScheduledNotificationsAsync,
  getAllScheduledNotificationsAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
  addNotificationResponseReceivedListener,
  setBadgeCountAsync,
  AndroidImportance,
  SchedulableTriggerInputTypes,
};
