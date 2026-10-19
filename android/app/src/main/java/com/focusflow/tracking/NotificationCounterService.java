package com.focusflow.tracking;

import android.app.Notification;
import android.content.Context;
import android.content.SharedPreferences;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import com.focusflow.storage.dao.NotificationDao;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

public class NotificationCounterService extends NotificationListenerService {

    private static final String TAG = "FocusFlowNotif";
    public static final String PREFS_NAME = "focusflow_tracking_prefs";
    public static final String KEY_TRACKING_START_TIME = "notification_tracking_start_time";
    public static final String KEY_LISTENER_CONNECTED = "notification_listener_connected";

    // Track keys of currently active notifications to avoid double-counting updates
    private static final Set<String> activeNotificationKeys = Collections.synchronizedSet(new HashSet<>());
    private static volatile boolean isConnected = false;

    public static boolean isServiceConnected() {
        return isConnected;
    }

    public static long getTrackingStartTime(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getLong(KEY_TRACKING_START_TIME, 0L);
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        isConnected = true;
        Log.i(TAG, "Notification listener service connected");

        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        if (!prefs.contains(KEY_TRACKING_START_TIME)) {
            prefs.edit().putLong(KEY_TRACKING_START_TIME, System.currentTimeMillis()).apply();
        }
        prefs.edit().putBoolean(KEY_LISTENER_CONNECTED, true).apply();

        // Populate activeNotificationKeys with existing notifications so they aren't counted on startup
        try {
            StatusBarNotification[] active = getActiveNotifications();
            if (active != null) {
                for (StatusBarNotification sbn : active) {
                    if (sbn != null && sbn.getKey() != null) {
                        activeNotificationKeys.add(sbn.getKey());
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not seed active notifications on connect", e);
        }
    }

    @Override
    public void onListenerDisconnected() {
        super.onListenerDisconnected();
        isConnected = false;
        Log.i(TAG, "Notification listener service disconnected");
        try {
            SharedPreferences prefs = getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putBoolean(KEY_LISTENER_CONNECTED, false).apply();
        } catch (Exception ignored) {}
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        // 1. Exclude ongoing / foreground service notifications (media playback, downloads, system status)
        if (!sbn.isClearable() || sbn.isOngoing()) {
            return;
        }

        // 2. Exclude group summaries (only count actual user notifications)
        Notification notification = sbn.getNotification();
        if (notification != null && (notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0) {
            return;
        }

        // 3. Exclude internal system packages that generate automated system telemetry/alerts
        String packageName = sbn.getPackageName();
        if (packageName == null || packageName.equals("android") || packageName.equals("com.android.systemui")) {
            return;
        }

        // 4. Deduplicate: if this notification key is already active, this is an update, not a new notification
        String key = sbn.getKey();
        if (key != null) {
            if (activeNotificationKeys.contains(key)) {
                // Already counted, this is a content/progress update
                return;
            }
            activeNotificationKeys.add(key);
        }

        // 5. Record metadata only (package name and timestamp). Message content is never read or stored.
        long postTime = sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis();
        NotificationDao.recordNotification(getApplicationContext(), packageName, postTime);
        Log.d(TAG, "Counted distraction notification from " + packageName + " at " + postTime);
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        if (sbn != null && sbn.getKey() != null) {
            activeNotificationKeys.remove(sbn.getKey());
        }
    }
}
