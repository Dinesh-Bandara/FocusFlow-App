import { NativeModules, PermissionsAndroid, Platform, Alert, Linking } from 'react-native';
import SQLite from 'react-native-sqlite-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { ReminderModule } = NativeModules;
const db = SQLite.openDatabase({ name: 'focusflow.db', location: 'default' });

const KEY_LAST_SYNC_TIME = '@focusflow_calendar_last_sync';

let dbInitialized = false;
const ensureDbInit = () => {
  if (dbInitialized) return Promise.resolve();
  return new Promise((resolve) => {
    db.transaction(tx => {
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS calendar_events (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          start_time INTEGER NOT NULL,
          end_time INTEGER NOT NULL,
          reminder_mode INTEGER DEFAULT 0,
          offset_min INTEGER DEFAULT 0,
          is_all_day INTEGER DEFAULT 0
        );
      `, [], () => {
        // Ensure is_all_day column exists in case created with older schema
        tx.executeSql('PRAGMA table_info(calendar_events);', [], (t, result) => {
          const cols = new Set();
          for (let i = 0; i < result.rows.length; i++) {
            cols.add(result.rows.item(i).name);
          }
          if (!cols.has('is_all_day')) {
            t.executeSql('ALTER TABLE calendar_events ADD COLUMN is_all_day INTEGER DEFAULT 0;');
          }
          dbInitialized = true;
          resolve();
        }, () => {
          dbInitialized = true;
          resolve();
        });
      }, (t, err) => {
        console.warn('DB init warning:', err);
        resolve();
      });
    });
  });
};

export const requestNotificationPermission = async () => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    try {
      const hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      if (!hasPermission) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Notification Permission',
            message: 'FocusFlow needs notifications to alert you before your focus sessions.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    } catch (e) {
      console.warn('Failed to check/request notification permission:', e);
      return false;
    }
  }
  return true;
};

export const checkExactAlarmPermission = async () => {
  if (Platform.OS === 'android' && ReminderModule?.canScheduleExact) {
    try {
      return await ReminderModule.canScheduleExact();
    } catch (e) {
      return true;
    }
  }
  return true;
};

export const ReminderService = {
  syncEvents: async (apiEvents) => {
    await ensureDbInit();
    return new Promise((resolve) => {
      db.transaction(tx => {
        tx.executeSql('SELECT id, title, start_time, end_time, reminder_mode, offset_min, is_all_day FROM calendar_events', [], (tx, results) => {
          const localEvents = {};
          for (let i = 0; i < results.rows.length; i++) {
            const row = results.rows.item(i);
            localEvents[row.id] = row;
          }

          const apiEventIds = new Set();

          apiEvents.forEach(apiEvent => {
            const isAllDay = !apiEvent.start?.dateTime && !!apiEvent.start?.date;
            let startMs, endMs;

            if (isAllDay) {
              const [y, m, d] = (apiEvent.start.date || '').split('-').map(Number);
              startMs = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).getTime();
              const endParts = (apiEvent.end?.date || apiEvent.start.date || '').split('-').map(Number);
              endMs = new Date(endParts[0], (endParts[1] || 1) - 1, endParts[2] || 1, 23, 59, 59, 999).getTime();
            } else {
              startMs = new Date(apiEvent.start?.dateTime || Date.now()).getTime();
              endMs = new Date(apiEvent.end?.dateTime || (startMs + 3600000)).getTime();
            }

            const id = apiEvent.id;
            const title = apiEvent.summary || 'Scheduled Event';
            apiEventIds.add(id);

            const current = localEvents[id];

            if (current) {
              const mode = current.reminder_mode;
              const offset = current.offset_min;

              // If event moved or mode active, reconcile native reminder
              if (!isAllDay && current.start_time !== startMs && mode > 0) {
                ReminderService.setReminder(id, title, startMs, endMs, mode, offset);
              }

              tx.executeSql(
                'UPDATE calendar_events SET start_time=?, end_time=?, title=?, is_all_day=? WHERE id=?',
                [startMs, endMs, title, isAllDay ? 1 : 0, id]
              );
              delete localEvents[id];
            } else {
              tx.executeSql(
                'INSERT OR IGNORE INTO calendar_events (id, title, start_time, end_time, reminder_mode, offset_min, is_all_day) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [id, title, startMs, endMs, 0, 0, isAllDay ? 1 : 0]
              );
            }
          });

          // Any local event that was in the fetched time range but is now removed/cancelled
          Object.keys(localEvents).forEach(deletedId => {
            const deleted = localEvents[deletedId];
            if (deleted && deleted.reminder_mode > 0 && ReminderModule?.cancelAlarm) {
              ReminderModule.cancelAlarm(deletedId);
            }
            tx.executeSql('DELETE FROM calendar_events WHERE id=?', [deletedId]);
          });

          AsyncStorage.setItem(KEY_LAST_SYNC_TIME, String(Date.now())).catch(() => {});
          resolve();
        }, (t, err) => {
          console.warn('syncEvents query error:', err);
          resolve();
        });
      });
    });
  },

  setReminder: async (eventId, title, startMs, endMs, mode, offsetMin = 0) => {
    await ensureDbInit();

    if (mode > 0) {
      const hasNotif = await requestNotificationPermission();
      if (!hasNotif) {
        Alert.alert(
          'Permission Required',
          'FocusFlow needs Notification permission to show event reminders.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return false;
      }

      if (mode === 2) {
        const canExact = await checkExactAlarmPermission();
        if (!canExact) {
          Alert.alert(
            'Exact Alarm Required',
            'To play loud alarms precisely at event time, Android requires Exact Alarm permission.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Settings', onPress: () => Linking.openSettings() },
            ]
          );
        }
      }
    }

    const offsetMs = offsetMin * 60 * 1000;
    let triggerTime = startMs - offsetMs;
    const nowMs = Date.now();

    try {
      if (mode === 0) {
        if (ReminderModule?.cancelAlarm) {
          await ReminderModule.cancelAlarm(eventId);
        }
      } else {
        if (triggerTime <= nowMs) {
          // If trigger time has already passed, but event is currently ongoing: trigger in 3s
          if (nowMs < endMs) {
            triggerTime = nowMs + 3000;
          } else {
            // Event has already completely ended, don't trigger alarm
            mode = 0;
          }
        }

        if (mode > 0 && ReminderModule?.scheduleAlarm) {
          await ReminderModule.scheduleAlarm(
            eventId,
            title || 'Focus Session',
            triggerTime,
            mode,
            startMs,
            endMs
          );
        }
      }

      return new Promise((resolve, reject) => {
        db.transaction(tx => {
          tx.executeSql(
            'UPDATE calendar_events SET reminder_mode=?, offset_min=? WHERE id=?',
            [mode, offsetMin, eventId],
            () => resolve({ triggerTime, mode }),
            (t, err) => {
              console.warn('Failed to update reminder_mode:', err);
              resolve({ triggerTime, mode });
            }
          );
        });
      });
    } catch (error) {
      console.error('Failed to set reminder natively:', error);
      throw error;
    }
  },

  testReminder: async (mode = 2) => {
    await requestNotificationPermission();
    if (ReminderModule?.testAlarm) {
      return await ReminderModule.testAlarm(mode);
    } else {
      throw new Error('ReminderModule is not loaded on this build.');
    }
  },

  getRemindersPreferences: async () => {
    await ensureDbInit();
    return new Promise((resolve) => {
      db.transaction(tx => {
        tx.executeSql('SELECT id, reminder_mode, offset_min FROM calendar_events', [], (tx, results) => {
          const prefs = {};
          for (let i = 0; i < results.rows.length; i++) {
            const row = results.rows.item(i);
            prefs[row.id] = { mode: row.reminder_mode, offset: row.offset_min };
          }
          resolve(prefs);
        }, (t, err) => {
          console.warn('getRemindersPreferences query error:', err);
          resolve({});
        });
      });
    });
  },

  getEventsForDateRange: async (startMs, endMs) => {
    await ensureDbInit();
    return new Promise((resolve) => {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT id, title, start_time, end_time, reminder_mode, offset_min, is_all_day FROM calendar_events WHERE start_time < ? AND end_time > ? ORDER BY is_all_day DESC, start_time ASC',
          [endMs, startMs],
          (tx, results) => {
            const list = [];
            for (let i = 0; i < results.rows.length; i++) {
              list.push(results.rows.item(i));
            }
            resolve(list);
          },
          (t, err) => {
            console.warn('getEventsForDateRange error:', err);
            resolve([]);
          }
        );
      });
    });
  },

  getLastSyncTime: async () => {
    try {
      const val = await AsyncStorage.getItem(KEY_LAST_SYNC_TIME);
      return val ? parseInt(val, 10) : null;
    } catch (e) {
      return null;
    }
  },
};
