import { NativeModules } from 'react-native';
import { FocusStorageService } from './FocusStorageService';
import { TargetStorageService } from './TargetStorageService';

const { NativeTracking } = NativeModules;

// In-memory cache for app names and icon URIs to minimize bridge traffic
const metadataCache = new Map();

export const UsageDataService = {
  /**
   * Calendar boundary for 'Today': local midnight (00:00:00.000) to now.
   */
  getTodayRange: () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const endOfDay = startOfDay + 86400000;
    const nowMs = now.getTime();
    return {
      period: 'Today',
      startMs: startOfDay,
      endMs: endOfDay,
      queryEndMs: nowMs,
      daysCount: 1,
      label: 'Today',
    };
  },

  /**
   * Calendar boundary for 'Week': Monday (00:00:00.000) to Sunday end of day,
   * with queries capped at current time if viewing the active week.
   */
  getWeekRange: (weekOffset = 0) => {
    const now = new Date();
    if (weekOffset !== 0) {
      now.setDate(now.getDate() + weekOffset * 7);
    }
    const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0, 0);
    const sunday = new Date(monday.getTime() + 7 * 86400000 - 1);
    const nowMs = Date.now();
    const isCurrentWeek = weekOffset === 0;

    const monDate = monday.getDate();
    const sunDate = sunday.getDate();
    const monthName = sunday.toLocaleDateString('en-US', { month: 'short' });

    return {
      period: 'Week',
      startMs: monday.getTime(),
      endMs: sunday.getTime(),
      queryEndMs: isCurrentWeek ? nowMs : sunday.getTime(),
      daysCount: 7,
      label: 'Week',
      displayStr: `${monDate} – ${sunDate} ${monthName}`,
      isCurrentWeek,
    };
  },

  /**
   * Rolling 7-day range (today + past 6 days from local midnight to now).
   * Ensures that regardless of which day of the week it is, 'Week' aggregates a full 7 days
   * of user data, providing distinct, meaningful weekly insights rather than duplicating today.
   */
  getRollingWeekRange: () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const startOf7Days = startOfToday - 6 * 86400000;
    const nowMs = now.getTime();

    const startDate = new Date(startOf7Days);
    const startDay = startDate.getDate();
    const endDay = now.getDate();
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = now.toLocaleDateString('en-US', { month: 'short' });
    const displayStr = startMonth === endMonth
      ? `${startDay} – ${endDay} ${endMonth}`
      : `${startDay} ${startMonth} – ${endDay} ${endMonth}`;

    return {
      period: 'Week',
      startMs: startOf7Days,
      endMs: startOfToday + 86400000,
      queryEndMs: nowMs,
      daysCount: 7,
      label: 'Week',
      displayStr,
      isCurrentWeek: true,
    };
  },

  /**
   * Get range for period name ('Today' | 'Week').
   * Uses rolling 7-day window for 'Week' so weekly view always presents full 7-day aggregates.
   */
  getDateRange: (period = 'Today') => {
    if (period === 'Week') {
      return UsageDataService.getRollingWeekRange();
    }
    return UsageDataService.getTodayRange();
  },

  /**
   * Resolves display names and cached PNG icon URIs for given package names.
   * Batches unresolved packages and caches results in memory.
   */
  resolveAppsMetadata: async (packageNames = []) => {
    if (!packageNames || packageNames.length === 0) return {};

    const missing = [];
    const result = {};

    for (const pkg of packageNames) {
      if (metadataCache.has(pkg)) {
        result[pkg] = metadataCache.get(pkg);
      } else {
        missing.push(pkg);
      }
    }

    if (missing.length > 0 && NativeTracking?.getAppsMetadata) {
      try {
        const fetched = await NativeTracking.getAppsMetadata(missing);
        if (fetched) {
          for (const [pkg, meta] of Object.entries(fetched)) {
            metadataCache.set(pkg, meta);
            result[pkg] = meta;
          }
        }
      } catch (err) {
        console.warn('Failed to resolve apps metadata:', err);
      }
    }

    // Neutral fallback for any packages that could not be resolved
    for (const pkg of packageNames) {
      if (!result[pkg]) {
        const fallback = {
          packageName: pkg,
          appName: pkg.split('.').pop() || pkg,
          iconUri: null,
        };
        result[pkg] = fallback;
      }
    }

    return result;
  },

  /**
   * Fetches unified dashboard metrics for the given period ('Today' | 'Week').
   * Used by Dashboard, Usage, and Reports screens to ensure consistent calculations.
   */
  fetchMetrics: async (period = 'Today') => {
    const range = UsageDataService.getDateRange(period);

    let hasUsageAccess = false;
    let hasNotificationAccess = false;
    let notificationInfo = { hasPermission: false, isConnected: false, trackingStartTime: 0 };
    let usageStats = {};
    let unlocksCount = 0;
    let notificationsCount = 0;

    // 1. Native tracking permissions and metrics
    if (NativeTracking) {
      try {
        hasUsageAccess = await NativeTracking.hasUsageAccess();
      } catch (e) {
        console.warn('Error checking usage access:', e);
      }

      try {
        if (NativeTracking.getNotificationTrackingInfo) {
          notificationInfo = await NativeTracking.getNotificationTrackingInfo();
          hasNotificationAccess = !!notificationInfo.hasPermission;
        } else if (NativeTracking.hasNotificationAccess) {
          hasNotificationAccess = await NativeTracking.hasNotificationAccess();
        }
      } catch (e) {
        console.warn('Error checking notification access:', e);
      }

      if (hasUsageAccess) {
        try {
          if (NativeTracking.getUsageRange) {
            usageStats = (await NativeTracking.getUsageRange(range.startMs, range.queryEndMs)) || {};
          } else {
            usageStats = (await NativeTracking.getDailyForegroundUsage()) || {};
          }
        } catch (e) {
          console.warn('Error querying usage stats:', e);
        }

        try {
          if (NativeTracking.getUnlockCountRange) {
            unlocksCount = (await NativeTracking.getUnlockCountRange(range.startMs, range.queryEndMs)) || 0;
          }
        } catch (e) {
          console.warn('Error querying unlocks count:', e);
        }
      }

      if ((hasNotificationAccess || hasUsageAccess) && NativeTracking.getNotificationCountRange) {
        try {
          notificationsCount = (await NativeTracking.getNotificationCountRange(range.startMs, range.queryEndMs)) || 0;
        } catch (e) {
          console.warn('Error querying notification count:', e);
        }
      }
    }

    // 2. Screen time aggregation and top apps breakdown
    const entries = Object.entries(usageStats || {})
      .map(([pkg, ms]) => ({
        packageName: pkg,
        durationMs: Number(ms),
      }))
      .filter((app) => app.durationMs > 10000); // Ignore negligible noise under 10 seconds

    const totalScreenTimeMs = entries.reduce((acc, curr) => acc + curr.durationMs, 0);
    const screenTimeHours = Math.floor(totalScreenTimeMs / 3600000);
    const screenTimeMinutes = Math.floor((totalScreenTimeMs % 3600000) / 60000);

    const sortedApps = entries.sort((a, b) => b.durationMs - a.durationMs);
    const topAppsList = sortedApps.slice(0, 5);

    // Resolve app metadata (real app names and cached PNG icon URIs)
    const packageNames = topAppsList.map((a) => a.packageName);
    const metadata = await UsageDataService.resolveAppsMetadata(packageNames);

    const topApps = topAppsList.map((app) => {
      const meta = metadata[app.packageName] || {};
      const minutesUsed = Math.max(1, Math.round(app.durationMs / 60000));
      // Denominator: Total screen time of the period (so each bar shows app's share of total usage)
      const shareOfTotalPercent = totalScreenTimeMs > 0
        ? Math.min(100, Math.round((app.durationMs / totalScreenTimeMs) * 100))
        : 0;

      return {
        packageName: app.packageName,
        appName: meta.appName || app.packageName.split('.').pop() || app.packageName,
        iconUri: meta.iconUri || null,
        durationMs: app.durationMs,
        minutesUsed,
        shareOfTotalPercent,
      };
    });

    // 3. Focus Goal persistence
    let dailyGoalMin = 240;
    try {
      const savedGoal = await TargetStorageService.getFocusGoal();
      if (savedGoal) dailyGoalMin = savedGoal;
    } catch (e) {
      console.warn('Error loading focus goal:', e);
    }
    const effectiveGoalMin = period === 'Week' ? dailyGoalMin * 7 : dailyGoalMin;

    // 4. Focus Sessions from SQLite for date range
    let focusedMinutes = 0;
    let completedSessionsCount = 0;
    try {
      const sessions = await FocusStorageService.getFocusSessionsRange(range.startMs, range.endMs);
      let totalDurationMs = 0;
      let completedCount = 0;
      sessions.forEach((s) => {
        totalDurationMs += s.duration_ms || 0;
        if (s.task_completed === 1 || s.status === 'completed') {
          completedCount += 1;
        }
      });
      focusedMinutes = Math.round(totalDurationMs / 60000);
      completedSessionsCount = completedCount;
    } catch (e) {
      console.warn('Error loading focus sessions:', e);
    }

    const progressPercent = effectiveGoalMin > 0
      ? Math.min(100, Math.round((focusedMinutes / effectiveGoalMin) * 100))
      : 0;

    // 5. Up next event from SQLite
    let nextUpcomingEvent = null;
    try {
      nextUpcomingEvent = await FocusStorageService.getNextUpcomingEvent();
    } catch (e) {
      console.warn('Error querying next upcoming event:', e);
    }

    return {
      period,
      range,
      hasUsageAccess,
      hasNotificationAccess,
      notificationInfo,
      totalScreenTimeMs,
      screenTimeHours,
      screenTimeMinutes,
      unlocksCount,
      notificationsCount,
      topApps,
      allApps: sortedApps,
      dailyGoalMin,
      effectiveGoalMin,
      focusedMinutes,
      completedSessionsCount,
      progressPercent,
      nextUpcomingEvent,
    };
  },
};
