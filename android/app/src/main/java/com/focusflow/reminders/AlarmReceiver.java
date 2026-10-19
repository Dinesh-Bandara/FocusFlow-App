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
import androidx.core.app.NotificationManagerCompat;

import com.focusflow.MainActivity;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class AlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "AlarmReceiver";
    public static final String CHANNEL_ID_ALARM = "focus_flow_alarms";
    public static final String CHANNEL_ID_NOTIF = "focus_flow_notifications";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        String eventId = intent.getStringExtra("EVENT_ID");
        if (eventId == null) eventId = "event_" + System.currentTimeMillis();

        String eventTitle = intent.getStringExtra("EVENT_TITLE");
        if (eventTitle == null || eventTitle.isEmpty()) {
            eventTitle = "Scheduled Focus Session";
        }

        int mode = intent.getIntExtra("REMINDER_MODE", 1); // 1 = notification, 2 = alarm
        long startTime = intent.getLongExtra("START_TIME", 0L);
        long endTime = intent.getLongExtra("END_TIME", 0L);

        int notificationId = Math.abs(eventId.hashCode());

        Log.i(TAG, "Reminder triggered for event: " + eventTitle + " (" + eventId + ") mode=" + mode);

        createNotificationChannels(context);

        // Build human-readable time range (e.g. "09:00 – 09:30")
        String timeRange = "";
        if (startTime > 0 && endTime > 0) {
            SimpleDateFormat sdf = new SimpleDateFormat("HH:mm", Locale.getDefault());
            timeRange = sdf.format(new Date(startTime)) + " – " + sdf.format(new Date(endTime));
        }

        // 1. Play ringing alarm if mode is 2 (Alarm)
        if (mode == 2) {
            AlarmSoundPlayer.play(context);
        }

        // 2. Action: Continue -> Opens MainActivity with Focus screen parameters
        Intent continueIntent = new Intent(context, MainActivity.class);
        continueIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        continueIntent.setAction(NotificationActionReceiver.ACTION_CONTINUE);
        continueIntent.putExtra("START_FOCUS_FROM_ALARM", true);
        continueIntent.putExtra("EVENT_ID", eventId);
        continueIntent.putExtra("EVENT_TITLE", eventTitle);
        continueIntent.putExtra("START_TIME", startTime);
        continueIntent.putExtra("END_TIME", endTime);
        continueIntent.putExtra("NOTIFICATION_ID", notificationId);

        PendingIntent continuePendingIntent = PendingIntent.getActivity(
                context,
                notificationId * 31 + 1,
                continueIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // 3. Action: Reject -> Stops sound and dismisses notification without opening Focus
        Intent rejectIntent = new Intent(context, NotificationActionReceiver.class);
        rejectIntent.setAction(NotificationActionReceiver.ACTION_REJECT);
        rejectIntent.putExtra("EVENT_ID", eventId);
        rejectIntent.putExtra("NOTIFICATION_ID", notificationId);

        PendingIntent rejectPendingIntent = PendingIntent.getBroadcast(
                context,
                notificationId * 31 + 2,
                rejectIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String channelId = (mode == 2) ? CHANNEL_ID_ALARM : CHANNEL_ID_NOTIF;
        int iconRes = (context.getApplicationInfo().icon != 0) ? context.getApplicationInfo().icon : android.R.drawable.ic_lock_idle_alarm;

        String contentText = (!timeRange.isEmpty()) ? timeRange : ((mode == 2) ? "Alarm: Session starting now!" : "Reminder: Session starting soon.");

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(iconRes)
                .setContentTitle(eventTitle)
                .setContentText(contentText)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setContentIntent(continuePendingIntent)
                .setDeleteIntent(rejectPendingIntent) // swiping notification away stops ringing
                .setAutoCancel(true)
                .setVibrate(new long[]{0, 500, 250, 500, 250, 500})
                .addAction(android.R.drawable.ic_media_play, "Continue", continuePendingIntent)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Reject", rejectPendingIntent);

        if (mode == 2) {
            Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmSound == null) {
                alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            builder.setSound(alarmSound);
            builder.setFullScreenIntent(continuePendingIntent, true);
        }

        try {
            NotificationManagerCompat.from(context).notify(notificationId, builder.build());
            Log.i(TAG, "Notification posted with ID: " + notificationId);
        } catch (SecurityException se) {
            Log.e(TAG, "Notification permission missing to post reminder", se);
        } catch (Exception e) {
            Log.e(TAG, "Failed to post notification", e);
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
                channel2.setBypassDnd(true);
                manager.createNotificationChannel(channel2);
            }
        }
    }
}
