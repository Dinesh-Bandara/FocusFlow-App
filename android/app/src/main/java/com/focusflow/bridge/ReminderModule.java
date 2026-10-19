package com.focusflow.bridge;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.focusflow.reminders.AlarmReceiver;

public class ReminderModule extends ReactContextBaseJavaModule {
    private static final String TAG = "ReminderModule";

    public ReminderModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return "ReminderModule";
    }

    @ReactMethod
    public void scheduleAlarm(String eventId, String title, double triggerTimeMs, int mode, double startTimeMs, double endTimeMs, Promise promise) {
        try {
            Context context = getReactApplicationContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            boolean canExact = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                canExact = alarmManager.canScheduleExactAlarms();
            }

            Intent intent = new Intent(context, AlarmReceiver.class);
            intent.putExtra("EVENT_ID", eventId);
            intent.putExtra("EVENT_TITLE", title);
            intent.putExtra("REMINDER_MODE", mode);
            intent.putExtra("START_TIME", (long) startTimeMs);
            intent.putExtra("END_TIME", (long) endTimeMs);

            int requestCode = Math.abs(eventId.hashCode());

            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context,
                    requestCode,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            // Schedule alarm: Use exact if permitted, otherwise graceful fallback to inexact while idle
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (canExact) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, (long) triggerTimeMs, pendingIntent);
                    Log.i(TAG, "Scheduled exact alarm for event " + eventId + " at " + (long) triggerTimeMs);
                } else {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, (long) triggerTimeMs, pendingIntent);
                    Log.i(TAG, "Fallback: Scheduled inexact alarm for event " + eventId + " at " + (long) triggerTimeMs);
                }
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, (long) triggerTimeMs, pendingIntent);
            }

            promise.resolve(true);

        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule alarm", e);
            promise.reject("ALARM_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void testAlarm(int mode, Promise promise) {
        try {
            Context context = getReactApplicationContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            long now = System.currentTimeMillis();
            long triggerTimeMs = now + 5000L; // 5 seconds from now
            String testId = "test_reminder_" + now;
            String title = (mode == 2) ? "⏰ Test Focus Alarm" : "🔔 Test Focus Reminder";

            Intent intent = new Intent(context, AlarmReceiver.class);
            intent.putExtra("EVENT_ID", testId);
            intent.putExtra("EVENT_TITLE", title);
            intent.putExtra("REMINDER_MODE", mode);
            intent.putExtra("START_TIME", now);
            intent.putExtra("END_TIME", now + 25 * 60 * 1000L); // 25 min test window

            int requestCode = Math.abs(testId.hashCode());

            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context,
                    requestCode,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                boolean canExact = true;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    canExact = alarmManager.canScheduleExactAlarms();
                }
                if (canExact) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTimeMs, pendingIntent);
                } else {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTimeMs, pendingIntent);
                }
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTimeMs, pendingIntent);
            }

            Log.i(TAG, "Scheduled test alarm firing in 5s");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule test alarm", e);
            promise.reject("TEST_ALARM_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void canScheduleExact(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                promise.resolve(alarmManager.canScheduleExactAlarms());
            } else {
                promise.resolve(true);
            }
        } catch (Exception e) {
            promise.reject("PERMISSION_CHECK_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void cancelAlarm(String eventId, Promise promise) {
        try {
            Context context = getReactApplicationContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            Intent intent = new Intent(context, AlarmReceiver.class);
            int requestCode = Math.abs(eventId.hashCode());

            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context,
                    requestCode,
                    intent,
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
            );

            if (pendingIntent != null && alarmManager != null) {
                alarmManager.cancel(pendingIntent);
                pendingIntent.cancel();
                Log.i(TAG, "Cancelled alarm for event " + eventId);
            }
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to cancel alarm", e);
            promise.reject("CANCEL_ERROR", e.getMessage());
        }
    }
}
