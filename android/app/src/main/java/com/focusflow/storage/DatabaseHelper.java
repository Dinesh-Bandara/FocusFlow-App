package com.focusflow.storage;

import android.content.Context;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

public class DatabaseHelper extends SQLiteOpenHelper {

    private static DatabaseHelper instance;

    public static synchronized DatabaseHelper getInstance(Context context) {
        if (instance == null) {
            instance = new DatabaseHelper(context.getApplicationContext());
        }
        return instance;
    }

    private DatabaseHelper(Context context) {
        super(context, DatabaseSchema.DATABASE_NAME, null, DatabaseSchema.DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL(DatabaseSchema.UsageRecords.CREATE_TABLE);
        db.execSQL(DatabaseSchema.NotificationRecords.CREATE_TABLE);
        db.execSQL(DatabaseSchema.NotificationRecords.CREATE_INDEX);
        db.execSQL(DatabaseSchema.NotificationCounts.CREATE_TABLE);
        db.execSQL(DatabaseSchema.UnlockRecords.CREATE_TABLE);
        db.execSQL(DatabaseSchema.FocusSessions.CREATE_TABLE);
        db.execSQL(DatabaseSchema.CalendarEvents.CREATE_TABLE);
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        if (oldVersion < 2) {
            db.execSQL(DatabaseSchema.CalendarEvents.CREATE_TABLE);
        }
        if (oldVersion < 3) {
            try {
                db.execSQL("ALTER TABLE " + DatabaseSchema.FocusSessions.TABLE_NAME + " ADD COLUMN " + DatabaseSchema.FocusSessions.COL_SESSION_TITLE + " TEXT;");
            } catch (Exception ignored) {}
            try {
                db.execSQL("ALTER TABLE " + DatabaseSchema.FocusSessions.TABLE_NAME + " ADD COLUMN " + DatabaseSchema.FocusSessions.COL_TASK_COMPLETED + " INTEGER NOT NULL DEFAULT 0;");
            } catch (Exception ignored) {}
        }
        if (oldVersion < 4) {
            try {
                db.execSQL(DatabaseSchema.NotificationRecords.CREATE_TABLE);
                db.execSQL(DatabaseSchema.NotificationRecords.CREATE_INDEX);
            } catch (Exception ignored) {}
        }
    }
}
