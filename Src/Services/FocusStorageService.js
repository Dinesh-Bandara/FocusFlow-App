import SQLite from 'react-native-sqlite-storage';

const db = SQLite.openDatabase({ name: 'focusflow.db', location: 'default' });

let isDbInitialized = false;
const savedSessionIds = new Set();

export const ensureFocusDbInit = () => {
    if (isDbInitialized) return Promise.resolve();

    return new Promise((resolve) => {
        db.transaction((tx) => {
            // 1. Ensure focus_sessions table exists
            tx.executeSql(
                `CREATE TABLE IF NOT EXISTS focus_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          start_time INTEGER NOT NULL,
          duration_ms INTEGER NOT NULL,
          status TEXT NOT NULL,
          session_title TEXT,
          task_completed INTEGER DEFAULT 0
        );`,
                [],
                () => {
                    // Attempt adding columns if upgrading an older version 2 DB
                    tx.executeSql(
                        'ALTER TABLE focus_sessions ADD COLUMN session_title TEXT;',
                        [],
                        () => { },
                        () => { } // ignore error if column already exists
                    );
                    tx.executeSql(
                        'ALTER TABLE focus_sessions ADD COLUMN task_completed INTEGER DEFAULT 0;',
                        [],
                        () => { },
                        () => { } // ignore error if column already exists
                    );
                    isDbInitialized = true;
                    resolve();
                },
                (t, err) => {
                    console.warn('FocusStorageService init warning:', err);
                    isDbInitialized = true;
                    resolve();
                }
            );
        });
    });
};

export const FocusStorageService = {
    // Save completed or ended focus session exactly once
    saveFocusSession: async ({
        sessionId,
        startTime,
        durationMs,
        status = 'completed',
        sessionTitle = 'Focus Session',
        taskCompleted = 0,
    }) => {
        await ensureFocusDbInit();

        // Idempotency guard: prevent duplicate saving
        const dedupeKey = sessionId || `${startTime}_${durationMs}_${sessionTitle}`;
        if (savedSessionIds.has(dedupeKey)) {
            console.log('Session already saved, skipping duplicate save:', dedupeKey);
            return { duplicate: true };
        }
        savedSessionIds.add(dedupeKey);

        return new Promise((resolve, reject) => {
            db.transaction((tx) => {
                tx.executeSql(
                    `INSERT INTO focus_sessions (start_time, duration_ms, status, session_title, task_completed)
           VALUES (?, ?, ?, ?, ?);`,
                    [
                        Math.round(startTime),
                        Math.round(durationMs),
                        status,
                        sessionTitle,
                        taskCompleted ? 1 : 0,
                    ],
                    (tx, results) => {
                        resolve({
                            success: true,
                            insertId: results.insertId,
                            dedupeKey,
                        });
                    },
                    (tx, err) => {
                        console.error('Error inserting focus session:', err);
                        savedSessionIds.delete(dedupeKey); // allow retry on actual DB failure
                        reject(err);
                    }
                );
            });
        });
    },

    // Query sessions in a timestamp range
    getFocusSessionsRange: async (startMs, endMs) => {
        await ensureFocusDbInit();

        return new Promise((resolve) => {
            db.transaction((tx) => {
                tx.executeSql(
                    `SELECT id, start_time, duration_ms, status, session_title, task_completed
           FROM focus_sessions
           WHERE start_time >= ? AND start_time <= ?
           ORDER BY start_time ASC;`,
                    [startMs, endMs],
                    (tx, results) => {
                        const rows = [];
                        for (let i = 0; i < results.rows.length; i++) {
                            rows.push(results.rows.item(i));
                        }
                        resolve(rows);
                    },
                    (tx, err) => {
                        console.warn('Error querying focus sessions range:', err);
                        resolve([]);
                    }
                );
            });
        });
    },

    // Summary for Today (or given day)
    getTodayFocusSummary: async (goalMinutes = 240) => {
        await ensureFocusDbInit();

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const endOfDay = startOfDay + 86400000;

        return new Promise((resolve) => {
            db.transaction((tx) => {
                tx.executeSql(
                    `SELECT id, start_time, duration_ms, status, task_completed
           FROM focus_sessions
           WHERE start_time >= ? AND start_time < ?;`,
                    [startOfDay, endOfDay],
                    (tx, results) => {
                        let totalDurationMs = 0;
                        let completedSessions = 0;
                        let totalSessions = results.rows.length;

                        for (let i = 0; i < results.rows.length; i++) {
                            const row = results.rows.item(i);
                            totalDurationMs += row.duration_ms || 0;
                            if (row.task_completed === 1 || row.status === 'completed') {
                                completedSessions += 1;
                            }
                        }

                        const totalFocusMinutes = Math.round(totalDurationMs / 60000);
                        const percentOfGoal = goalMinutes > 0
                            ? Math.min(100, Math.round((totalFocusMinutes / goalMinutes) * 100))
                            : 0;

                        resolve({
                            totalFocusMinutes,
                            totalDurationMs,
                            completedSessions,
                            totalSessions,
                            percentOfGoal,
                            goalMinutes,
                        });
                    },
                    (tx, err) => {
                        console.warn('Error querying today focus summary:', err);
                        resolve({
                            totalFocusMinutes: 0,
                            totalDurationMs: 0,
                            completedSessions: 0,
                            totalSessions: 0,
                            percentOfGoal: 0,
                            goalMinutes,
                        });
                    }
                );
            });
        });
    },

    // Weekly focus report aggregation
    getWeeklyFocusSummary: async (startOfWeekMs, endOfWeekMs, priorWeekStartMs, priorWeekEndMs) => {
        await ensureFocusDbInit();

        return new Promise((resolve) => {
            db.transaction((tx) => {
                tx.executeSql(
                    `SELECT id, start_time, duration_ms, status, task_completed
           FROM focus_sessions
           WHERE start_time >= ? AND start_time <= ?;`,
                    [startOfWeekMs, endOfWeekMs],
                    (tx, results) => {
                        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                        const dailyMinutes = [0, 0, 0, 0, 0, 0, 0];
                        let totalDurationMs = 0;
                        let completedCount = 0;
                        const totalCount = results.rows.length;

                        for (let i = 0; i < results.rows.length; i++) {
                            const row = results.rows.item(i);
                            totalDurationMs += row.duration_ms || 0;
                            if (row.task_completed === 1 || row.status === 'completed') {
                                completedCount += 1;
                            }

                            // Determine day index relative to startOfWeek (Monday = 0)
                            const sessionDate = new Date(row.start_time);
                            const dayOfWeek = (sessionDate.getDay() + 6) % 7; // Convert Sun=0..Sat=6 to Mon=0..Sun=6
                            if (dayOfWeek >= 0 && dayOfWeek < 7) {
                                dailyMinutes[dayOfWeek] += Math.round((row.duration_ms || 0) / 60000);
                            }
                        }

                        const totalFocusMinutes = Math.round(totalDurationMs / 60000);
                        const completionRate = totalCount > 0
                            ? Math.round((completedCount / totalCount) * 100)
                            : 0;

                        const chartData = dayNames.map((label, idx) => ({
                            label,
                            minutes: dailyMinutes[idx],
                            hours: parseFloat((dailyMinutes[idx] / 60).toFixed(1)),
                        }));

                        // Query prior week for comparison trend
                        if (priorWeekStartMs && priorWeekEndMs) {
                            tx.executeSql(
                                `SELECT SUM(duration_ms) as prior_total
                 FROM focus_sessions
                 WHERE start_time >= ? AND start_time <= ?;`,
                                [priorWeekStartMs, priorWeekEndMs],
                                (tx2, priorResults) => {
                                    const priorMs = priorResults.rows.item(0)?.prior_total || 0;
                                    const priorMin = Math.round(priorMs / 60000);
                                    const diffMinutes = totalFocusMinutes - priorMin;
                                    const diffHours = (diffMinutes / 60).toFixed(1);

                                    let trendBadge = '';
                                    if (priorMin === 0 && totalFocusMinutes > 0) {
                                        trendBadge = `+${(totalFocusMinutes / 60).toFixed(1)}h this week`;
                                    } else if (diffMinutes > 0) {
                                        trendBadge = `+${diffHours}h vs last week`;
                                    } else if (diffMinutes < 0) {
                                        trendBadge = `${diffHours}h vs last week`;
                                    } else {
                                        trendBadge = 'Consistent with last week';
                                    }

                                    resolve({
                                        totalFocusMinutes,
                                        totalHours: parseFloat((totalFocusMinutes / 60).toFixed(1)),
                                        completedCount,
                                        totalCount,
                                        completionRate,
                                        chartData,
                                        trendBadge,
                                        hasSessions: totalCount > 0,
                                    });
                                },
                                () => {
                                    resolve({
                                        totalFocusMinutes,
                                        totalHours: parseFloat((totalFocusMinutes / 60).toFixed(1)),
                                        completedCount,
                                        totalCount,
                                        completionRate,
                                        chartData,
                                        trendBadge: totalFocusMinutes > 0 ? `${(totalFocusMinutes / 60).toFixed(1)}h logged` : 'No sessions yet',
                                        hasSessions: totalCount > 0,
                                    });
                                }
                            );
                        } else {
                            resolve({
                                totalFocusMinutes,
                                totalHours: parseFloat((totalFocusMinutes / 60).toFixed(1)),
                                completedCount,
                                totalCount,
                                completionRate,
                                chartData,
                                trendBadge: totalFocusMinutes > 0 ? `${(totalFocusMinutes / 60).toFixed(1)}h logged` : 'No sessions yet',
                                hasSessions: totalCount > 0,
                            });
                        }
                    },
                    (tx, err) => {
                        console.warn('Error querying weekly focus summary:', err);
                        resolve({
                            totalFocusMinutes: 0,
                            totalHours: 0,
                            completedCount: 0,
                            totalCount: 0,
                            completionRate: 0,
                            chartData: [],
                            trendBadge: 'No data',
                            hasSessions: false,
                        });
                    }
                );
            });
        });
    },

    // Get the very next upcoming calendar event
    getNextUpcomingEvent: async () => {
        await ensureFocusDbInit();
        const now = Date.now();

        return new Promise((resolve) => {
            db.transaction((tx) => {
                tx.executeSql(
                    `SELECT id, title, start_time, end_time, reminder_mode, offset_min
           FROM calendar_events
           WHERE end_time > ?
           ORDER BY start_time ASC
           LIMIT 1;`,
                    [now],
                    (tx, results) => {
                        if (results.rows.length > 0) {
                            const row = results.rows.item(0);
                            resolve({
                                id: row.id,
                                title: row.title,
                                startTime: row.start_time,
                                endTime: row.end_time,
                                reminderMode: row.reminder_mode,
                                offsetMin: row.offset_min,
                            });
                        } else {
                            resolve(null);
                        }
                    },
                    (tx, err) => {
                        console.warn('Error querying next event:', err);
                        resolve(null);
                    }
                );
            });
        });
    },
};
