package com.focusflow.tracking;

import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.util.Log;

import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;

public class UsageCollector {
    private static final String TAG = "FocusFlowUsage";
    private Context context;

    public UsageCollector(Context context) {
        this.context = context;
    }

    public boolean hasUsageAccess() {
        UsageStatsManager usm = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null)
            return false;
        long time = System.currentTimeMillis();
        try {
            UsageEvents events = usm.queryEvents(time - 1000 * 60 * 10, time);
            return events != null && events.hasNextEvent();
        } catch (Exception e) {
            return false;
        }
    }

    // Foreground time calculation for any given timestamp range
    public Map<String, Long> getDailyForegroundUsage(long startOfDay, long endOfDay) {
        return getForegroundUsageRange(startOfDay, endOfDay);
    }

    public Map<String, Long> getForegroundUsageRange(long startMs, long endMs) {
        UsageStatsManager usm = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        Map<String, Long> usageMap = new HashMap<>();

        if (usm == null)
            return usageMap;

        try {
            UsageEvents events = usm.queryEvents(startMs, endMs);
            if (events == null) return usageMap;

            UsageEvents.Event currentEvent = new UsageEvents.Event();
            Map<String, Long> appLastResumedMap = new HashMap<>();

            while (events.hasNextEvent()) {
                events.getNextEvent(currentEvent);
                String packageName = currentEvent.getPackageName();
                if (packageName == null) continue;

                int eventType = currentEvent.getEventType();
                if (eventType == UsageEvents.Event.ACTIVITY_RESUMED
                        || eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                    appLastResumedMap.put(packageName, currentEvent.getTimeStamp());
                } else if (eventType == UsageEvents.Event.ACTIVITY_PAUSED
                        || eventType == UsageEvents.Event.MOVE_TO_BACKGROUND) {
                    if (appLastResumedMap.containsKey(packageName)) {
                        long lastResumed = appLastResumedMap.get(packageName);
                        long duration = currentEvent.getTimeStamp() - lastResumed;
                        if (duration > 0) {
                            usageMap.put(packageName, usageMap.getOrDefault(packageName, 0L) + duration);
                        }
                        appLastResumedMap.remove(packageName);
                    }
                }
            }

            // Handle apps still open at end of period
            long currentTime = Math.min(System.currentTimeMillis(), endMs);
            for (Map.Entry<String, Long> entry : appLastResumedMap.entrySet()) {
                long duration = currentTime - entry.getValue();
                if (duration > 0) {
                    usageMap.put(entry.getKey(), usageMap.getOrDefault(entry.getKey(), 0L) + duration);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error querying foreground usage range", e);
        }

        return usageMap;
    }

    // Hourly usage breakdown for the specified day (24 hourly buckets in milliseconds)
    public long[] getHourlyUsageToday(long startOfDay, long endOfDay) {
        long[] hourly = new long[24];
        UsageStatsManager usm = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return hourly;

        try {
            UsageEvents events = usm.queryEvents(startOfDay, endOfDay);
            if (events == null) return hourly;

            UsageEvents.Event currentEvent = new UsageEvents.Event();
            Map<String, Long> appLastResumedMap = new HashMap<>();

            while (events.hasNextEvent()) {
                events.getNextEvent(currentEvent);
                String packageName = currentEvent.getPackageName();
                if (packageName == null) continue;

                int eventType = currentEvent.getEventType();
                if (eventType == UsageEvents.Event.ACTIVITY_RESUMED
                        || eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                    appLastResumedMap.put(packageName, currentEvent.getTimeStamp());
                } else if (eventType == UsageEvents.Event.ACTIVITY_PAUSED
                        || eventType == UsageEvents.Event.MOVE_TO_BACKGROUND) {
                    if (appLastResumedMap.containsKey(packageName)) {
                        long lastResumed = appLastResumedMap.get(packageName);
                        long eventTime = currentEvent.getTimeStamp();
                        long duration = eventTime - lastResumed;

                        if (duration > 0) {
                            int hour = (int) ((lastResumed - startOfDay) / (3600000L));
                            if (hour >= 0 && hour < 24) {
                                hourly[hour] += duration;
                            }
                        }
                        appLastResumedMap.remove(packageName);
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error querying hourly usage", e);
        }

        return hourly;
    }

    // Unlocks in range (UsageEvents KEYGUARD_HIDDEN = 16 or SCREEN_INTERACTIVE = 15)
    public int getUnlockCountRange(long startMs, long endMs) {
        UsageStatsManager usm = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return 0;

        int unlockCount = 0;
        try {
            UsageEvents events = usm.queryEvents(startMs, endMs);
            if (events == null) return 0;

            UsageEvents.Event currentEvent = new UsageEvents.Event();
            while (events.hasNextEvent()) {
                events.getNextEvent(currentEvent);
                int eventType = currentEvent.getEventType();
                // 16 = KEYGUARD_HIDDEN (Unlock), 15 = SCREEN_INTERACTIVE
                if (eventType == 16) {
                    unlockCount++;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error counting unlocks", e);
        }

        return unlockCount;
    }
}
