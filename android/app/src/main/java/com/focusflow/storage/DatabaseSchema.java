package com.focusflow.storage;

public class DatabaseSchema {

    public static final String DATABASE_NAME = "focusflow.db";
    public static final int DATABASE_VERSION = 4; // Upgraded for notification_records table

    public static final class UsageRecords {
        public static final String TABLE_NAME = "usage_records";
        public static final String COL_ID = "id";
        public static final String COL_DATE = "date"; // YYYY-MM-DD
        public static final String COL_APP_NAME = "app_name";
        public static final String COL_DURATION_MS = "duration_ms";

        public static final String CREATE_TABLE = "CREATE TABLE " + TABLE_NAME + " (" +
                COL_ID + " INTEGER PRIMARY KEY AUTOINCREMENT, " +
                COL_DATE + " TEXT NOT NULL, " +
                COL_APP_NAME + " TEXT NOT NULL, " +
                COL_DURATION_MS + " INTEGER NOT NULL DEFAULT 0, " +
                "UNIQUE(" + COL_DATE + ", " + COL_APP_NAME + "));";
    }

    public static final class NotificationRecords {
        public static final String TABLE_NAME = "notification_records";
        public static final String COL_ID = "id";
        public static final String COL_TIMESTAMP_MS = "timestamp_ms";
        public static final String COL_PACKAGE_NAME = "package_name";

        public static final String CREATE_TABLE = "CREATE TABLE IF NOT EXISTS " + TABLE_NAME + " (" +
                COL_ID + " INTEGER PRIMARY KEY AUTOINCREMENT, " +
                COL_TIMESTAMP_MS + " INTEGER NOT NULL, " +
                COL_PACKAGE_NAME + " TEXT NOT NULL);";

        public static final String CREATE_INDEX = "CREATE INDEX IF NOT EXISTS idx_notification_timestamp ON " +
                TABLE_NAME + " (" + COL_TIMESTAMP_MS + ");";
    }

    public static final class NotificationCounts {
        public static final String TABLE_NAME = "notification_counts";
        public static final String COL_ID = "id";
        public static final String COL_DATE = "date";
        public static final String COL_APP_NAME = "app_name";
        public static final String COL_COUNT = "count";

        public static final String CREATE_TABLE = "CREATE TABLE " + TABLE_NAME + " (" +
                COL_ID + " INTEGER PRIMARY KEY AUTOINCREMENT, " +
                COL_DATE + " TEXT NOT NULL, " +
                COL_APP_NAME + " TEXT NOT NULL, " +
                COL_COUNT + " INTEGER NOT NULL DEFAULT 0, " +
                "UNIQUE(" + COL_DATE + ", " + COL_APP_NAME + "));";
    }

    public static final class UnlockRecords {
        public static final String TABLE_NAME = "unlock_records";
        public static final String COL_ID = "id";
        public static final String COL_DATE = "date";
        public static final String COL_COUNT = "count";

        public static final String CREATE_TABLE = "CREATE TABLE " + TABLE_NAME + " (" +
                COL_ID + " INTEGER PRIMARY KEY AUTOINCREMENT, " +
                COL_DATE + " TEXT NOT NULL UNIQUE, " +
                COL_COUNT + " INTEGER NOT NULL DEFAULT 0);";
    }

    public static final class FocusSessions {
        public static final String TABLE_NAME = "focus_sessions";
        public static final String COL_ID = "id";
        public static final String COL_START_TIME = "start_time"; // Unix epoch MS
        public static final String COL_DURATION_MS = "duration_ms";
        public static final String COL_STATUS = "status"; // completed, interrupted, cancelled
        public static final String COL_SESSION_TITLE = "session_title";
        public static final String COL_TASK_COMPLETED = "task_completed"; // 1 for Yes, 0 for No

        public static final String CREATE_TABLE = "CREATE TABLE " + TABLE_NAME + " (" +
                COL_ID + " INTEGER PRIMARY KEY AUTOINCREMENT, " +
                COL_START_TIME + " INTEGER NOT NULL, " +
                COL_DURATION_MS + " INTEGER NOT NULL, " +
                COL_STATUS + " TEXT NOT NULL, " +
                COL_SESSION_TITLE + " TEXT, " +
                COL_TASK_COMPLETED + " INTEGER NOT NULL DEFAULT 0);";
    }

    public static final class CalendarEvents {
        public static final String TABLE_NAME = "calendar_events";
        public static final String COL_ID = "id"; // Google Event ID
        public static final String COL_TITLE = "title";
        public static final String COL_START_TIME = "start_time"; // Unix Epoch MS
        public static final String COL_END_TIME = "end_time"; // Unix Epoch MS
        public static final String COL_REMINDER_MODE = "reminder_mode"; // 0: Off, 1: Notification, 2: Alarm
        public static final String COL_OFFSET_MIN = "offset_min";

        public static final String CREATE_TABLE = "CREATE TABLE " + TABLE_NAME + " (" +
                COL_ID + " TEXT PRIMARY KEY, " +
                COL_TITLE + " TEXT NOT NULL, " +
                COL_START_TIME + " INTEGER NOT NULL, " +
                COL_END_TIME + " INTEGER NOT NULL, " +
                COL_REMINDER_MODE + " INTEGER NOT NULL DEFAULT 0, " +
                COL_OFFSET_MIN + " INTEGER NOT NULL DEFAULT 0);";
    }
}
