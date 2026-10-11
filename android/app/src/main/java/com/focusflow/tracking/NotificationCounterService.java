package com.focusflow.tracking;

import android.app.Notification;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

public class NotificationCounterService extends NotificationListenerService {

    private static final String TAG = "FocusFlowNotif";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null)
            return;

        // Exclude ongoing / foreground service notifications and group summaries
        if (!sbn.isClearable() || sbn.isOngoing()) {
            return;
        }

        Notification notification = sbn.getNotification();
        if (notification != null && (notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0) {
            return;
        }

        String packageName = sbn.getPackageName();
        // TODO: Save to SQLite database (NotificationDao)
        Log.d(TAG, "Counted new notification for " + packageName);
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // We only care about posted notifications
    }
}
