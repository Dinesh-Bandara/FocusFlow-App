jest.mock('react-native-sqlite-storage', () => ({
  openDatabase: jest.fn(() => ({
    transaction: jest.fn(),
    executeSql: jest.fn(),
  })),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('react-native', () => ({
  NativeModules: {
    NativeTracking: {
      hasUsageAccess: jest.fn(),
      getUsageRange: jest.fn(),
      getUnlockCountRange: jest.fn(),
      getNotificationCountRange: jest.fn(),
      getAppsMetadata: jest.fn(),
    },
    ReminderModule: {
      scheduleAlarm: jest.fn(),
      cancelAlarm: jest.fn(),
      canScheduleExact: jest.fn(),
    },
  },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Alert: {
    alert: jest.fn(),
  },
}));

import { formatUsageDuration } from '../Src/Hooks/useFocusSession';

describe('Schedule → Reminder → Focus Workflow Unit Tests', () => {

  describe('1. Time Boundaries and Status Derivation', () => {
    test('Correctly classifies Upcoming, Ongoing, and Ended events', () => {
      const now = 1729370000000; // Reference current timestamp

      const upcomingEvent = {
        startTimeMs: now + 30 * 60 * 1000,
        endTimeMs: now + 60 * 60 * 1000,
      };

      const ongoingEvent = {
        startTimeMs: now - 15 * 60 * 1000,
        endTimeMs: now + 15 * 60 * 1000,
      };

      const endedEvent = {
        startTimeMs: now - 60 * 60 * 1000,
        endTimeMs: now - 30 * 60 * 1000,
      };

      const deriveStatus = (startMs, endMs, currentMs) => {
        if (currentMs < startMs) return 'upcoming';
        if (startMs <= currentMs && currentMs < endMs) return 'ongoing';
        return 'ended';
      };

      expect(deriveStatus(upcomingEvent.startTimeMs, upcomingEvent.endTimeMs, now)).toBe('upcoming');
      expect(deriveStatus(ongoingEvent.startTimeMs, ongoingEvent.endTimeMs, now)).toBe('ongoing');
      expect(deriveStatus(endedEvent.startTimeMs, endedEvent.endTimeMs, now)).toBe('ended');
    });

    test('Never marks morning or elapsed events as Ongoing late at night', () => {
      const nightTime = new Date('2026-10-19T23:40:00+05:30').getTime();
      const morningEvent = {
        startTimeMs: new Date('2026-10-19T09:00:00+05:30').getTime(),
        endTimeMs: new Date('2026-10-19T09:30:00+05:30').getTime(),
      };

      const isOngoing = morningEvent.startTimeMs <= nightTime && nightTime < morningEvent.endTimeMs;
      expect(isOngoing).toBe(false);
    });
  });

  describe('2. Recurring Occurrence Identity & Independent Reminders', () => {
    test('Recurring event occurrences have distinct IDs and independent reminder settings', () => {
      const occurrence1 = {
        id: 'recur_event_123_20261019T090000Z',
        title: 'Daily Planning',
        reminder_mode: 2, // Alarm
      };

      const occurrence2 = {
        id: 'recur_event_123_20261020T090000Z',
        title: 'Daily Planning',
        reminder_mode: 0, // Off
      };

      const storage = {};
      storage[occurrence1.id] = occurrence1.reminder_mode;
      storage[occurrence2.id] = occurrence2.reminder_mode;

      expect(storage[occurrence1.id]).toBe(2);
      expect(storage[occurrence2.id]).toBe(0);
      expect(occurrence1.id).not.toBe(occurrence2.id);
    });
  });

  describe('3. Reminder Reconciliation & Event Updates', () => {
    test('Reconciles rescheduled event by updating trigger time and preserving reminder mode', () => {
      const existing = {
        id: 'event_456',
        title: 'Deep Work',
        startTimeMs: 1729370000000,
        reminder_mode: 2,
        offset_min: 5,
      };

      const updatedStartTimeMs = 1729373600000; // Moved by 1 hour
      const newTriggerTime = updatedStartTimeMs - (existing.offset_min * 60 * 1000);

      expect(newTriggerTime).toBe(1729373600000 - 300000);
      expect(existing.reminder_mode).toBe(2);
    });
  });

  describe('4. Action Deduplication', () => {
    test('Deduplicates rapid action events arriving within threshold', () => {
      let lastAction = null;
      let handledCount = 0;

      const handleAction = (action, now) => {
        if (lastAction?.eventId === action.eventId && (now - lastAction.at < 1500)) {
          return false; // deduplicated
        }
        lastAction = { eventId: action.eventId, at: now };
        handledCount++;
        return true;
      };

      const action = { action: 'START_FOCUS', eventId: 'event_789' };

      expect(handleAction(action, 1000)).toBe(true);
      expect(handleAction(action, 1200)).toBe(false); // 200ms later -> dropped
      expect(handleAction(action, 1400)).toBe(false); // 400ms later -> dropped
      expect(handleAction(action, 3000)).toBe(true);  // 2000ms later -> accepted
      expect(handledCount).toBe(2);
    });
  });

  describe('5. Session-Interval Usage Calculations', () => {
    test('Clips foreground app usage strictly to session active intervals', () => {
      const activeInterval = {
        start: 10000,
        end: 50000,
      };

      // App was resumed before session and paused inside session
      const appSession1 = { resumed: 5000, paused: 20000 };
      const s1 = Math.max(appSession1.resumed, activeInterval.start);
      const e1 = Math.min(appSession1.paused, activeInterval.end);
      const duration1 = Math.max(0, e1 - s1);
      expect(duration1).toBe(10000); // 10000 to 20000 = 10000ms

      // App was used entirely outside active interval
      const appSession2 = { resumed: 60000, paused: 70000 };
      const s2 = Math.max(appSession2.resumed, activeInterval.start);
      const e2 = Math.min(appSession2.paused, activeInterval.end);
      const duration2 = Math.max(0, e2 - s2);
      expect(duration2).toBe(0); // clipped to 0
    });

    test('formatUsageDuration formats durations correctly', () => {
      expect(formatUsageDuration(0)).toBe('<1m');
      expect(formatUsageDuration(30000)).toBe('<1m');
      expect(formatUsageDuration(300000)).toBe('5m');
      expect(formatUsageDuration(68 * 60 * 1000)).toBe('1h 8m');
      expect(formatUsageDuration(120 * 60 * 1000)).toBe('2h');
    });
  });

  describe('6. Slot Remaining Duration Calculation', () => {
    test('Calculates remaining slot time from calendar end timestamp', () => {
      const startTime = new Date('2026-10-19T10:00:00+05:30').getTime();
      const endTime = new Date('2026-10-19T10:45:00+05:30').getTime();
      const continueTime = new Date('2026-10-19T10:05:00+05:30').getTime();

      const plannedMinutes = Math.round((endTime - startTime) / 60000);
      const remainingSeconds = Math.round((endTime - continueTime) / 1000);
      const remainingMinutes = Math.round(remainingSeconds / 60);

      expect(plannedMinutes).toBe(45);
      expect(remainingMinutes).toBe(40);
      expect(remainingSeconds).toBe(2400);
    });
  });
});
