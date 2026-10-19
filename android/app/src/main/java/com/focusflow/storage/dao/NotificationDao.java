package com.focusflow.storage.dao;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.util.Log;

import com.focusflow.storage.DatabaseExecutor;
import com.focusflow.storage.DatabaseHelper;
import com.focusflow.storage.DatabaseSchema;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public class NotificationDao {
    private static final String TAG = "NotificationDao";

    public static void recordNotification(Context context, String packageName, long timestampMs) {
        DatabaseExecutor.getInstance().execute(() -> {
            try {
                DatabaseHelper helper = DatabaseHelper.getInstance(context);
                SQLiteDatabase db = helper.getWritableDatabase();

                // 1. Insert into notification_records with exact timestamp
                ContentValues recordValues = new ContentValues();
                recordValues.put(DatabaseSchema.NotificationRecords.COL_TIMESTAMP_MS, timestampMs);
                recordValues.put(DatabaseSchema.NotificationRecords.COL_PACKAGE_NAME, packageName);
                db.insert(DatabaseSchema.NotificationRecords.TABLE_NAME, null, recordValues);

                // 2. Also update aggregate daily count in notification_counts
                SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
                String dateStr = sdf.format(new Date(timestampMs));

                db.execSQL(
                    "INSERT INTO " + DatabaseSchema.NotificationCounts.TABLE_NAME +
                    " (" + DatabaseSchema.NotificationCounts.COL_DATE + ", " +
                    DatabaseSchema.NotificationCounts.COL_APP_NAME + ", " +
                    DatabaseSchema.NotificationCounts.COL_COUNT + ") VALUES (?, ?, 1) " +
                    "ON CONFLICT(" + DatabaseSchema.NotificationCounts.COL_DATE + ", " +
                    DatabaseSchema.NotificationCounts.COL_APP_NAME + ") DO UPDATE SET " +
                    DatabaseSchema.NotificationCounts.COL_COUNT + " = " +
                    DatabaseSchema.NotificationCounts.COL_COUNT + " + 1;",
                    new Object[]{dateStr, packageName}
                );
            } catch (Exception e) {
                Log.e(TAG, "Error recording notification in SQLite", e);
            }
        });
    }

    public static int getNotificationCountRange(Context context, long startMs, long endMs) {
        int count = 0;
        Cursor cursor = null;
        try {
            DatabaseHelper helper = DatabaseHelper.getInstance(context);
            SQLiteDatabase db = helper.getReadableDatabase();

            String query = "SELECT COUNT(*) FROM " + DatabaseSchema.NotificationRecords.TABLE_NAME +
                    " WHERE " + DatabaseSchema.NotificationRecords.COL_TIMESTAMP_MS + " >= ? AND " +
                    DatabaseSchema.NotificationRecords.COL_TIMESTAMP_MS + " <= ?";

            cursor = db.rawQuery(query, new String[]{String.valueOf(startMs), String.valueOf(endMs)});
            if (cursor != null && cursor.moveToFirst()) {
                count = cursor.getInt(0);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error querying notification count range", e);
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
        return count;
    }

    public static Map<String, Integer> getPerAppCountsRange(Context context, long startMs, long endMs) {
        Map<String, Integer> map = new HashMap<>();
        Cursor cursor = null;
        try {
            DatabaseHelper helper = DatabaseHelper.getInstance(context);
            SQLiteDatabase db = helper.getReadableDatabase();

            String query = "SELECT " + DatabaseSchema.NotificationRecords.COL_PACKAGE_NAME + ", COUNT(*) FROM " +
                    DatabaseSchema.NotificationRecords.TABLE_NAME +
                    " WHERE " + DatabaseSchema.NotificationRecords.COL_TIMESTAMP_MS + " >= ? AND " +
                    DatabaseSchema.NotificationRecords.COL_TIMESTAMP_MS + " <= ? " +
                    "GROUP BY " + DatabaseSchema.NotificationRecords.COL_PACKAGE_NAME;

            cursor = db.rawQuery(query, new String[]{String.valueOf(startMs), String.valueOf(endMs)});
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    String pkg = cursor.getString(0);
                    int count = cursor.getInt(1);
                    map.put(pkg, count);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error querying per-app notification counts", e);
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
        return map;
    }
}
