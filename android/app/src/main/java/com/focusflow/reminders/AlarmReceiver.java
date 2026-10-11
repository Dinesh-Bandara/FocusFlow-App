package com.focusflow.reminders;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.focusflow.MainActivity;

public class AlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "AlarmReceiver";
    public static final String CHANNEL_ID_ALARM = "focus_flow_alarms";
    public static final String CHANNEL_ID_NOTIF = "focus_flow_notifications";

    @Override
    public void onReceive(Context context, Intent intent) {
        String eventId = intent.getStringExtra("EVENT_ID");
        String eventTitle = intent.getStringExtra("EVENT_TITLE");
        int mode = intent.getIntExtra("REMINDER_MODE", 1); // 1 = notification, 2 = alarm

        Log.i(TAG, "Alarm triggered for event: " + eventTitle + " with mode " + mode);

        createNotificationChannels(context);

        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        // Intent to open the app directly to the Focus timer
        Intent appIntent = new Intent(context, MainActivity.class);
        appIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        appIntent.putExtra("START_FOCUS_FROM_ALARM", true);
        appIntent.putExtra("EVENT_ID", eventId);
        
        PendingIntent contentIntent = PendingIntent.getActivity(
                context, 
                eventId.hashCode(), 
                appIntent, 
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String channelId = (mode == 2) ? CHANNEL_ID_ALARM : CHANNEL_ID_NOTIF;
        
        int iconRes = (context.getApplicationInfo().icon != 0) ? context.getApplicationInfo().icon : android.R.drawable.ic_lock_idle_alarm;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(iconRes)
                .setContentTitle(eventTitle != null ? eventTitle : "Scheduled Focus Session")
                .setContentText((mode == 2) ? "⏰ Alarm: Your focus session is starting now!" : "🔔 Reminder: Your focus session is coming up.")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setContentIntent(contentIntent)
                .setAutoCancel(true)
                .setVibrate(new long[]{0, 500, 250, 500, 250, 500})
                .addAction(android.R.drawable.ic_media_play, "Start Focus", contentIntent);

        // Required to ensure the notification pops up heads-up instantly
        builder.setDefaults(Notification.DEFAULT_VIBRATE);

        if (mode == 2) {
            // Sound is handled by the Notification Channel configuration on API 26+
            Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmSound == null) {
                alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            // On older APIs (< 26), set sound directly
            builder.setSound(alarmSound);
            builder.setFullScreenIntent(contentIntent, true);
        }

        if (notificationManager != null) {
            notificationManager.notify(eventId.hashCode(), builder.build());
        }
    }

    public static void createNotificationChannels(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager == null) return;

            // Notification only channel
            if (manager.getNotificationChannel(CHANNEL_ID_NOTIF) == null) {
                NotificationChannel channel1 = new NotificationChannel(
                        CHANNEL_ID_NOTIF,
                        "Event Notifications",
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel1.setDescription("Standard reminders for scheduled events");
                manager.createNotificationChannel(channel1);
            }

            // Alarm channel (loud sound)
            if (manager.getNotificationChannel(CHANNEL_ID_ALARM) == null) {
                NotificationChannel channel2 = new NotificationChannel(
                        CHANNEL_ID_ALARM,
                        "Event Alarms",
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel2.setDescription("Loud ringing alarms for scheduled events");
                
                Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .build();
                
                channel2.setSound(alarmSound, audioAttributes);
                // Allow bypassing DND if user enables it in settings
                channel2.setBypassDnd(true); 
                manager.createNotificationChannel(channel2);
            }
        }
    }
}
