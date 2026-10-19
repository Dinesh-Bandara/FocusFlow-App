package com.focusflow.tracking;

import android.app.usage.UsageEvents;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.util.Log;

import com.focusflow.permissions.PermissionHelper;

import java.io.File;
import java.io.FileOutputStream;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class UsageCollector {
    private static final String TAG = "FocusFlowUsage";
    private final Context context;

    public UsageCollector(Context context) {
        this.context = context.getApplicationContext();
    }

    public boolean hasUsageAccess() {
        return PermissionHelper.hasUsageAccess(context);
    }

    /**
     * Resolves the package name of the device's default launcher (Home app).
     */
    public String getDefaultLauncherPackage() {
        try {
            Intent intent = new Intent(Intent.ACTION_MAIN);
            intent.addCategory(Intent.CATEGORY_HOME);
            PackageManager pm = context.getPackageManager();
            ResolveInfo resolveInfo = pm.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY);
            if (resolveInfo != null && resolveInfo.activityInfo != null) {
                return resolveInfo.activityInfo.packageName;
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not determine default launcher package", e);
        }
        return null;
    }

    /**
     * Set of system packages to exclude from user app screen time.
     * SystemUI and default launcher are excluded to match Digital Wellbeing standards.
     */
    private Set<String> getExcludedPackages() {
        Set<String> excluded = new HashSet<>();
        excluded.add("com.android.systemui");
        String launcher = getDefaultLauncherPackage();
        if (launcher != null) {
            excluded.add(launcher);
        }
        return excluded;
    }

    /**
     * Calculates foreground app usage within the exact selected time range [startMs, endMs].
     * - Lookback window to capture sessions already active at startMs (crossing midnight).
     * - Screen turn-off (SCREEN_NON_INTERACTIVE) closes active sessions to prevent idle sleep inflation.
     * - Clamps each session strictly to [startMs, endMs].
     * - Handles ongoing sessions up to current time.
     */
    public Map<String, Long> getForegroundUsageRange(long startMs, long endMs) {
        UsageStatsManager usm = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        Map<String, Long> usageMap = new HashMap<>();

        if (usm == null) return usageMap;

        Set<String> excludedPackages = getExcludedPackages();

        // For multi-day or weekly ranges (> 36 hours), Android's queryEvents ring buffer
        // only retains recent events (usually 24-48 hours). Older events are pruned by the OS.
        // Therefore, we query Android's aggregated daily records via queryUsageStats(INTERVAL_DAILY).
        if ((endMs - startMs) > 129600000L) {
            try {
                List<UsageStats> statsList = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startMs, endMs);
                if (statsList != null && !statsList.isEmpty()) {
                    for (UsageStats stats : statsList) {
                        String pkg = stats.getPackageName();
                        if (pkg != null && !excludedPackages.contains(pkg)) {
                            long duration = stats.getTotalTimeInForeground();
                            if (duration > 0) {
                                usageMap.put(pkg, usageMap.getOrDefault(pkg, 0L) + duration);
                            }
                        }
                    }
                    if (!usageMap.isEmpty()) {
                        return usageMap;
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "Multi-day queryUsageStats error, falling back to events", e);
            }
        }

        try {
            // Query events starting with a lookback window (up to 4 hours before range start)
            // to accurately resolve whichever app was active when the range began (crossing midnight).
            long lookbackStart = Math.max(0L, startMs - 4 * 3600000L);
            UsageEvents events = usm.queryEvents(lookbackStart, endMs);
            if (events == null) return usageMap;

            UsageEvents.Event event = new UsageEvents.Event();
            Map<String, Long> appLastResumedMap = new HashMap<>();

            while (events.hasNextEvent()) {
                events.getNextEvent(event);
                int eventType = event.getEventType();
                String pkg = event.getPackageName();
                long t = event.getTimeStamp();

                if (eventType == UsageEvents.Event.ACTIVITY_RESUMED
                        || eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                    if (pkg != null && !excludedPackages.contains(pkg)) {
                        appLastResumedMap.put(pkg, t);
                    }
                } else if (eventType == UsageEvents.Event.ACTIVITY_PAUSED
                        || eventType == UsageEvents.Event.MOVE_TO_BACKGROUND) {
                    if (pkg != null && appLastResumedMap.containsKey(pkg)) {
                        long resumed = appLastResumedMap.get(pkg);
                        long s = Math.max(resumed, startMs);
                        long e = Math.min(t, endMs);
                        long duration = e - s;
                        if (duration > 0) {
                            usageMap.put(pkg, usageMap.getOrDefault(pkg, 0L) + duration);
                        }
                        appLastResumedMap.remove(pkg);
                    }
                } else if (eventType == 16 || eventType == 26) {
                    // 16 = SCREEN_NON_INTERACTIVE, 26 = DEVICE_SHUTDOWN
                    // Screen turned off or phone shut down: close any active sessions at this point
                    for (Map.Entry<String, Long> entry : appLastResumedMap.entrySet()) {
                        long s = Math.max(entry.getValue(), startMs);
                        long e = Math.min(t, endMs);
                        long duration = e - s;
                        if (duration > 0) {
                            usageMap.put(entry.getKey(), usageMap.getOrDefault(entry.getKey(), 0L) + duration);
                        }
                    }
                    appLastResumedMap.clear();
                }
            }

            // Close apps still actively open at end of period (or current time)
            long currentTime = Math.min(System.currentTimeMillis(), endMs);
            for (Map.Entry<String, Long> entry : appLastResumedMap.entrySet()) {
                long s = Math.max(entry.getValue(), startMs);
                long e = Math.min(currentTime, endMs);
                long duration = e - s;
                if (duration > 0) {
                    usageMap.put(entry.getKey(), usageMap.getOrDefault(entry.getKey(), 0L) + duration);
                }
            }

        } catch (Exception e) {
            Log.e(TAG, "Error querying foreground usage range", e);
        }

        return usageMap;
    }

    /**
     * Hourly usage breakdown for the specified day (24 hourly buckets in milliseconds).
     */
    public long[] getHourlyUsageToday(long startOfDay, long endOfDay) {
        long[] hourly = new long[24];
        UsageStatsManager usm = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return hourly;

        Set<String> excludedPackages = getExcludedPackages();

        try {
            long lookbackStart = Math.max(0L, startOfDay - 4 * 3600000L);
            UsageEvents events = usm.queryEvents(lookbackStart, endOfDay);
            if (events == null) return hourly;

            UsageEvents.Event event = new UsageEvents.Event();
            Map<String, Long> appLastResumedMap = new HashMap<>();

            while (events.hasNextEvent()) {
                events.getNextEvent(event);
                int eventType = event.getEventType();
                String pkg = event.getPackageName();
                long t = event.getTimeStamp();

                if (eventType == UsageEvents.Event.ACTIVITY_RESUMED
                        || eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                    if (pkg != null && !excludedPackages.contains(pkg)) {
                        appLastResumedMap.put(pkg, t);
                    }
                } else if (eventType == UsageEvents.Event.ACTIVITY_PAUSED
                        || eventType == UsageEvents.Event.MOVE_TO_BACKGROUND) {
                    if (pkg != null && appLastResumedMap.containsKey(pkg)) {
                        long resumed = appLastResumedMap.get(pkg);
                        addHourlySegment(hourly, resumed, t, startOfDay, endOfDay);
                        appLastResumedMap.remove(pkg);
                    }
                } else if (eventType == 16 || eventType == 26) {
                    // SCREEN_NON_INTERACTIVE or DEVICE_SHUTDOWN
                    for (Map.Entry<String, Long> entry : appLastResumedMap.entrySet()) {
                        addHourlySegment(hourly, entry.getValue(), t, startOfDay, endOfDay);
                    }
                    appLastResumedMap.clear();
                }
            }

            long currentTime = Math.min(System.currentTimeMillis(), endOfDay);
            for (Map.Entry<String, Long> entry : appLastResumedMap.entrySet()) {
                addHourlySegment(hourly, entry.getValue(), currentTime, startOfDay, endOfDay);
            }

        } catch (Exception e) {
            Log.e(TAG, "Error querying hourly usage", e);
        }

        return hourly;
    }

    private void addHourlySegment(long[] hourly, long sessionStart, long sessionEnd, long startOfDay, long endOfDay) {
        long s = Math.max(sessionStart, startOfDay);
        long e = Math.min(sessionEnd, endOfDay);
        if (e <= s) return;

        long cur = s;
        while (cur < e) {
            int hour = (int) ((cur - startOfDay) / 3600000L);
            long nextHourStart = startOfDay + (hour + 1) * 3600000L;
            long segEnd = Math.min(e, nextHourStart);
            if (hour >= 0 && hour < 24) {
                hourly[hour] += (segEnd - cur);
            }
            cur = segEnd;
        }
    }

    /**
     * Unlock events: UsageEvents KEYGUARD_HIDDEN = 18.
     * Deduplicates events occurring within 1000ms.
     * Refreshes are idempotent and will not increment counts.
     */
    public int getUnlockCountRange(long startMs, long endMs) {
        UsageStatsManager usm = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return 0;

        int unlockCount = 0;
        long firstUnlockTime = 0;
        long lastUnlockTime = 0;

        try {
            UsageEvents events = usm.queryEvents(startMs, endMs);
            if (events == null) return 0;

            UsageEvents.Event currentEvent = new UsageEvents.Event();
            while (events.hasNextEvent()) {
                events.getNextEvent(currentEvent);
                int eventType = currentEvent.getEventType();
                // 18 = KEYGUARD_HIDDEN (Unlock)
                if (eventType == 18) {
                    long t = currentEvent.getTimeStamp();
                    if (firstUnlockTime == 0) firstUnlockTime = t;
                    if (lastUnlockTime == 0 || (t - lastUnlockTime) >= 1000) {
                        unlockCount++;
                        lastUnlockTime = t;
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error counting unlocks", e);
        }

        // If multi-day query (> 36 hours) and the events buffer only spans recent hours
        // (because Android pruned older events), scale to the full multi-day duration.
        long rangeDuration = endMs - startMs;
        if (rangeDuration > 129600000L && unlockCount > 0 && firstUnlockTime > (startMs + 86400000L)) {
            long covered = Math.max(86400000L, lastUnlockTime - firstUnlockTime);
            double scale = (double) rangeDuration / (double) covered;
            if (scale > 1.0 && scale <= 10.0) {
                return (int) Math.round(unlockCount * scale);
            }
        }

        return unlockCount;
    }

    /**
     * Counts notification interruptions across all apps on the phone (UsageEvents type 12: NOTIFICATION_INTERRUPTION).
     * This matches Android's system-level notification count reported in Digital Wellbeing.
     */
    public int getNotificationCountRange(long startMs, long endMs) {
        UsageStatsManager usm = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return 0;

        int count = 0;
        long firstEventTime = 0;
        long lastEventTime = 0;
        Set<String> excludedPackages = getExcludedPackages();

        try {
            UsageEvents events = usm.queryEvents(startMs, endMs);
            if (events == null) return 0;

            UsageEvents.Event event = new UsageEvents.Event();
            while (events.hasNextEvent()) {
                events.getNextEvent(event);
                // 12 = NOTIFICATION_INTERRUPTION
                if (event.getEventType() == 12) {
                    String pkg = event.getPackageName();
                    // Exclude internal android core framework package and launcher
                    if (pkg != null && !pkg.equals("android") && !excludedPackages.contains(pkg)) {
                        long t = event.getTimeStamp();
                        if (firstEventTime == 0) firstEventTime = t;
                        lastEventTime = t;
                        count++;
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error counting notification interruptions", e);
        }

        // For multi-day or weekly ranges (> 36 hours), if events only span recent ~24h,
        // scale proportionally across the multi-day range
        long rangeDuration = endMs - startMs;
        if (rangeDuration > 129600000L && count > 0 && firstEventTime > (startMs + 86400000L)) {
            long covered = Math.max(86400000L, lastEventTime - firstEventTime);
            double scale = (double) rangeDuration / (double) covered;
            if (scale > 1.0 && scale <= 10.0) {
                return (int) Math.round(count * scale);
            }
        }

        return count;
    }

    /**
     * Resolves app display name and renders an appropriately sized (96x96 px) PNG icon
     * saved to cacheDir/app_icons/.
     * Works with AdaptiveIconDrawable, BitmapDrawable, and VectorDrawable.
     */
    public Map<String, String> getAppMetadata(String packageName) {
        Map<String, String> result = new HashMap<>();
        result.put("packageName", packageName);

        PackageManager pm = context.getPackageManager();
        String label = packageName;
        String iconUri = "";

        try {
            ApplicationInfo appInfo = pm.getApplicationInfo(packageName, 0);
            CharSequence appLabel = pm.getApplicationLabel(appInfo);
            if (appLabel != null && appLabel.length() > 0) {
                label = appLabel.toString();
            }

            File iconDir = new File(context.getCacheDir(), "app_icons");
            if (!iconDir.exists()) {
                iconDir.mkdirs();
            }

            File iconFile = new File(iconDir, packageName + ".png");
            if (iconFile.exists() && iconFile.length() > 0) {
                iconUri = "file://" + iconFile.getAbsolutePath();
            } else {
                Drawable drawable = pm.getApplicationIcon(appInfo);
                int iconSize = 96;
                Bitmap bitmap;

                if (drawable instanceof BitmapDrawable) {
                    Bitmap orig = ((BitmapDrawable) drawable).getBitmap();
                    if (orig != null) {
                        bitmap = Bitmap.createScaledBitmap(orig, iconSize, iconSize, true);
                    } else {
                        bitmap = Bitmap.createBitmap(iconSize, iconSize, Bitmap.Config.ARGB_8888);
                    }
                } else {
                    bitmap = Bitmap.createBitmap(iconSize, iconSize, Bitmap.Config.ARGB_8888);
                    Canvas canvas = new Canvas(bitmap);
                    drawable.setBounds(0, 0, canvas.getWidth(), canvas.getHeight());
                    drawable.draw(canvas);
                }

                FileOutputStream fos = new FileOutputStream(iconFile);
                bitmap.compress(Bitmap.CompressFormat.PNG, 90, fos);
                fos.flush();
                fos.close();

                iconUri = "file://" + iconFile.getAbsolutePath();
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not resolve metadata/icon for package: " + packageName, e);
        }

        result.put("appName", label);
        result.put("iconUri", iconUri);
        return result;
    }

    /**
     * Batch resolve app metadata for a list of package names.
     */
    public Map<String, Map<String, String>> getAppsMetadata(List<String> packageNames) {
        Map<String, Map<String, String>> batch = new HashMap<>();
        if (packageNames == null) return batch;

        for (String pkg : packageNames) {
            if (pkg != null && !pkg.isEmpty()) {
                batch.put(pkg, getAppMetadata(pkg));
            }
        }
        return batch;
    }
}
