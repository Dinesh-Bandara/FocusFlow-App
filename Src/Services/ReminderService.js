import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import SQLite from 'react-native-sqlite-storage';

const { ReminderModule } = NativeModules;
const db = SQLite.openDatabase({ name: 'focusflow.db', location: 'default' });

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
                    offset_min INTEGER DEFAULT 0
                );
            `, [], () => {
                dbInitialized = true;
                resolve();
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
                        buttonNegative: 'Deny'
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

export const ReminderService = {

    syncEvents: async (apiEvents) => {
        await ensureDbInit();
        return new Promise((resolve) => {
            db.transaction(tx => {
                tx.executeSql('SELECT id, start_time, end_time, reminder_mode, offset_min FROM calendar_events', [], (tx, results) => {
                    const localEvents = {};
                    for (let i = 0; i < results.rows.length; i++) {
                        const row = results.rows.item(i);
                        localEvents[row.id] = row;
                    }

                    apiEvents.forEach(apiEvent => {
                        const startMs = new Date(apiEvent.start?.dateTime || apiEvent.start?.date || Date.now()).getTime();
                        const endMs = new Date(apiEvent.end?.dateTime || apiEvent.end?.date || Date.now() + 3600000).getTime();
                        const id = apiEvent.id;
                        const title = apiEvent.summary || 'Scheduled Event';

                        const current = localEvents[id];

                        if (current) {
                            const mode = current.reminder_mode;
                            const offset = current.offset_min;

                            if (current.start_time !== startMs && mode > 0) {
                                ReminderService.setReminder(id, title, startMs, mode, offset);
                            }

                            tx.executeSql(
                                'UPDATE calendar_events SET start_time=?, end_time=?, title=? WHERE id=?',
                                [startMs, endMs, title, id]
                            );
                            delete localEvents[id];
                        } else {
                            tx.executeSql(
                                'INSERT OR IGNORE INTO calendar_events (id, title, start_time, end_time, reminder_mode, offset_min) VALUES (?, ?, ?, ?, ?, ?)',
                                [id, title, startMs, endMs, 0, 0]
                            );
                        }
                    });

                    Object.keys(localEvents).forEach(deletedId => {
                        const deleted = localEvents[deletedId];
                        if (deleted && deleted.reminder_mode > 0 && ReminderModule?.cancelAlarm) {
                            ReminderModule.cancelAlarm(deletedId);
                        }
                        tx.executeSql('DELETE FROM calendar_events WHERE id=?', [deletedId]);
                    });

                    resolve();
                }, (t, err) => {
                    console.warn('syncEvents error:', err);
                    resolve();
                });
            });
        });
    },

    setReminder: async (eventId, title, startMs, mode, offsetMin = 5) => {
        await ensureDbInit();

        if (mode > 0) {
            await requestNotificationPermission();
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
                // If triggerTime is in the past (e.g. testing or event starting within 5m),
                // trigger in 5 seconds so the user is alerted immediately!
                if (triggerTime <= nowMs) {
                    triggerTime = nowMs + 5000;
                }

                if (ReminderModule?.scheduleAlarm) {
                    await ReminderModule.scheduleAlarm(eventId, title || 'Focus Session', triggerTime, mode);
                }
            }

            return new Promise((resolve, reject) => {
                db.transaction(tx => {
                    tx.executeSql(
                        'INSERT INTO calendar_events (id, title, start_time, end_time, reminder_mode, offset_min) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET reminder_mode=excluded.reminder_mode, offset_min=excluded.offset_min',
                        [eventId, title || 'Focus Session', startMs, startMs + 3600000, mode, offsetMin],
                        () => resolve({ triggerTime, mode }),
                        (t, err) => {
                            // Fallback if ON CONFLICT syntax not supported in older SQLite
                            tx.executeSql(
                                'UPDATE calendar_events SET reminder_mode=?, offset_min=? WHERE id=?',
                                [mode, offsetMin, eventId],
                                () => resolve({ triggerTime, mode }),
                                (t2, err2) => reject(err2)
                            );
                        }
                    );
                });
            });
        } catch (error) {
            console.error("Failed to set reminder natively:", error);
            throw error;
        }
    },

    testReminder: async (mode = 2) => {
        await requestNotificationPermission();
        if (ReminderModule?.testAlarm) {
            return await ReminderModule.testAlarm(mode);
        } else {
            throw new Error("ReminderModule is not loaded on this build.");
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
    }
};
