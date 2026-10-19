package com.focusflow.reminders;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import androidx.core.app.NotificationManagerCompat;

import com.focusflow.MainActivity;
import com.focusflow.bridge.SplashModule;

public class NotificationActionReceiver extends BroadcastReceiver {
    private static final String TAG = "NotificationActionReceiver";

    public static final String ACTION_CONTINUE = "com.focusflow.ACTION_CONTINUE";
    public static final String ACTION_REJECT = "com.focusflow.ACTION_REJECT";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String eventId = intent.getStringExtra("EVENT_ID");
        String eventTitle = intent.getStringExtra("EVENT_TITLE");
        long startTime = intent.getLongExtra("START_TIME", 0L);
        long endTime = intent.getLongExtra("END_TIME", 0L);
        int notificationId = intent.getIntExtra("NOTIFICATION_ID", eventId != null ? eventId.hashCode() : 1001);

        Log.i(TAG, "Received notification action: " + action + " for event: " + eventId);

        // Always stop alarm ringing
        AlarmSoundPlayer.stop();

        // Dismiss the notification
        try {
            NotificationManagerCompat.from(context).cancel(notificationId);
        } catch (Exception e) {
            Log.e(TAG, "Error cancelling notification", e);
        }

        if (ACTION_CONTINUE.equals(action)) {
            Log.i(TAG, "Action Continue selected for event " + eventId + ". Launching Focus screen...");

            Intent launchIntent = new Intent(context, MainActivity.class);
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            launchIntent.putExtra("START_FOCUS_FROM_ALARM", true);
            launchIntent.putExtra("EVENT_ID", eventId);
            launchIntent.putExtra("EVENT_TITLE", eventTitle);
            launchIntent.putExtra("START_TIME", startTime);
            launchIntent.putExtra("END_TIME", endTime);

            // Pass through SplashModule for already running React Native instance
            SplashModule.onNewIntent(launchIntent);

            context.startActivity(launchIntent);
        } else if (ACTION_REJECT.equals(action)) {
            Log.i(TAG, "Action Reject selected for event " + eventId + ". Reminder dismissed.");
            // Reject records that reminder was declined; does not open Focus or alter Google Calendar.
        }
    }
}
