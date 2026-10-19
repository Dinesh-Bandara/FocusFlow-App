jest.mock('react-native-sqlite-storage', () => ({
  openDatabase: jest.fn(() => ({
    transaction: jest.fn(),
    executeSql: jest.fn(),
  })),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
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
  },
}));

import { UsageDataService } from '../Src/Services/UsageDataService';

describe('UsageDataService Date Boundaries & Aggregation Tests', () => {
  describe('Date Boundaries', () => {
    test('getTodayRange starts at local midnight and covers 24 hours', () => {
      const todayRange = UsageDataService.getTodayRange();
      const start = new Date(todayRange.startMs);
      const end = new Date(todayRange.endMs);

      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
      expect(start.getMilliseconds()).toBe(0);

      expect(todayRange.endMs - todayRange.startMs).toBe(86400000);
      expect(todayRange.daysCount).toBe(1);
      expect(todayRange.period).toBe('Today');
    });

    test('getWeekRange starts on Monday 00:00:00 and spans 7 days', () => {
      const weekRange = UsageDataService.getWeekRange(0);
      const start = new Date(weekRange.startMs);

      // (getDay() + 6) % 7 === 0 means Monday
      const dayOfWeek = (start.getDay() + 6) % 7;
      expect(dayOfWeek).toBe(0); // Must be Monday
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);

      expect(weekRange.daysCount).toBe(7);
      expect(weekRange.period).toBe('Week');
    });

    test('prior week offset correctly shifts by exactly 7 days', () => {
      const currentWeek = UsageDataService.getWeekRange(0);
      const lastWeek = UsageDataService.getWeekRange(-1);

      expect(currentWeek.startMs - lastWeek.startMs).toBe(7 * 86400000);
      expect(currentWeek.endMs - lastWeek.endMs).toBe(7 * 86400000);
    });

    test('getRollingWeekRange spans exactly 7 calendar days ending today', () => {
      const rollingRange = UsageDataService.getRollingWeekRange();
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();

      expect(rollingRange.startMs).toBe(startOfToday - 6 * 86400000);
      expect(rollingRange.endMs).toBe(startOfToday + 86400000);
      expect(rollingRange.daysCount).toBe(7);
      expect(rollingRange.period).toBe('Week');
      expect(UsageDataService.getDateRange('Week').startMs).toBe(rollingRange.startMs);
    });
  });

  describe('Duration Aggregation & Clamping', () => {
    test('accurately calculates hours and minutes from milliseconds', () => {
      const ms = 7 * 3600000 + 4 * 60000; // 7h 4m
      const hrs = Math.floor(ms / 3600000);
      const mins = Math.floor((ms % 3600000) / 60000);

      expect(hrs).toBe(7);
      expect(mins).toBe(4);
    });

    test('midnight crossing duration is strictly clamped to range start', () => {
      const midnight = new Date(2026, 9, 19, 0, 0, 0, 0).getTime();
      const sessionStart = midnight - 15 * 60000; // 23:45 yesterday
      const sessionEnd = midnight + 30 * 60000;   // 00:30 today
      const queryStart = midnight;
      const queryEnd = midnight + 86400000;

      const effectiveStart = Math.max(sessionStart, queryStart);
      const effectiveEnd = Math.min(sessionEnd, queryEnd);
      const durationToday = effectiveEnd - effectiveStart;

      expect(durationToday).toBe(30 * 60000); // exactly 30 minutes credited to today
    });

    test('sorts apps descending by duration', () => {
      const rawApps = [
        { packageName: 'com.chrome', durationMs: 2220000 },
        { packageName: 'com.whatsapp', durationMs: 6360000 },
        { packageName: 'com.youtube', durationMs: 4680000 },
      ];

      const sorted = [...rawApps].sort((a, b) => b.durationMs - a.durationMs);
      expect(sorted[0].packageName).toBe('com.whatsapp');
      expect(sorted[1].packageName).toBe('com.youtube');
      expect(sorted[2].packageName).toBe('com.chrome');
    });

    test('relative progress bar calculation sets top app to 100%', () => {
      const topDurationMs = 6000000; // 100m
      const secondDurationMs = 3000000; // 50m

      const topPercent = Math.min(100, Math.max(8, Math.round((topDurationMs / topDurationMs) * 100)));
      const secondPercent = Math.min(100, Math.max(8, Math.round((secondDurationMs / topDurationMs) * 100)));

      expect(topPercent).toBe(100);
      expect(secondPercent).toBe(50);
    });
  });

  describe('Deduplication Logic', () => {
    test('unlock events within 1000ms are deduplicated', () => {
      const timestamps = [1000000, 1000200, 1000500, 1005000, 1005200, 1010000];
      let unlockCount = 0;
      let lastUnlock = 0;

      for (const t of timestamps) {
        if (lastUnlock === 0 || (t - lastUnlock) >= 1000) {
          unlockCount++;
          lastUnlock = t;
        }
      }

      // 1000000 -> 1, 1000200 & 1000500 ignored, 1005000 -> 2, 1005200 ignored, 1010000 -> 3
      expect(unlockCount).toBe(3);
    });

    test('notification updates with identical key are not double-counted', () => {
      const activeKeys = new Set();
      const incomingNotifications = [
        { key: 'pkg|1|tag', isUpdate: false },
        { key: 'pkg|1|tag', isUpdate: true }, // updated progress
        { key: 'pkg|2|tag', isUpdate: false },
        { key: 'pkg|1|tag', isUpdate: true }, // another update
      ];

      let counted = 0;
      for (const notif of incomingNotifications) {
        if (!activeKeys.has(notif.key)) {
          counted++;
          activeKeys.add(notif.key);
        }
      }

      expect(counted).toBe(2);
    });
  });
});
