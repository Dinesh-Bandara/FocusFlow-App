package com.focusflow.reminders;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.Build;
import android.util.Log;

import com.focusflow.storage.DatabaseHelper;
import com.focusflow.storage.DatabaseSchema;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "FocusFlowBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) || 
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())) {
            
            Log.i(TAG, "Device booted or app updated. Restoring calendar alarms...");
            restoreAlarms(context);
        }
    }

    private void restoreAlarms(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (!alarmManager.canScheduleExactAlarms()) {
                Log.w(TAG, "Cannot schedule exact alarms. Permission missing upon boot.");
                return;
            }
        }

        try {
            DatabaseHelper dbHelper = DatabaseHelper.getInstance(context);
            SQLiteDatabase db = dbHelper.getReadableDatabase();

            long currentTimeOffset = System.currentTimeMillis();

            // Fetch events that are in the future and have reminder mode > 0
            String query = "SELECT " + DatabaseSchema.CalendarEvents.COL_ID + ", " +
                    DatabaseSchema.CalendarEvents.COL_TITLE + ", " +
                    DatabaseSchema.CalendarEvents.COL_START_TIME + ", " +
                    DatabaseSchema.CalendarEvents.COL_REMINDER_MODE + ", " +
                    DatabaseSchema.CalendarEvents.COL_OFFSET_MIN +
                    " FROM " + DatabaseSchema.CalendarEvents.TABLE_NAME +
                    " WHERE " + DatabaseSchema.CalendarEvents.COL_END_TIME + " > ? " +
                    " AND " + DatabaseSchema.CalendarEvents.COL_REMINDER_MODE + " > 0";
            
            Cursor cursor = db.rawQuery(query, new String[]{String.valueOf(currentTimeOffset)});

            if (cursor.moveToFirst()) {
                do {
                    String eventId = cursor.getString(0);
                    String title = cursor.getString(1);
                    long startTime = cursor.getLong(2);
                    int mode = cursor.getInt(3);
                    int offsetMin = cursor.getInt(4);

                    long triggerTime = startTime - (offsetMin * 60 * 1000L);
                    
                    // Only schedule if the trigger time is in the future, or give a 2 min grace period
                    if (triggerTime > (currentTimeOffset - (2 * 60 * 1000L))) {
                        Intent alarmIntent = new Intent(context, AlarmReceiver.class);
                        alarmIntent.putExtra("EVENT_ID", eventId);
                        alarmIntent.putExtra("EVENT_TITLE", title);
                        alarmIntent.putExtra("REMINDER_MODE", mode);

                        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                                context,
                                eventId.hashCode(),
                                alarmIntent,
                                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                        );
                        
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent);
                        } else {
                            alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent);
                        }
                        Log.i(TAG, "Restored alarm for event: " + eventId);
                    }
                } while (cursor.moveToNext());
            }
            cursor.close();
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to restore alarms from database", e);
        }
    }
}
