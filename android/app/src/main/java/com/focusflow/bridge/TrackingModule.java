package com.focusflow.bridge;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;
import com.focusflow.tracking.UsageCollector;

import android.content.Intent;
import android.provider.Settings;

import java.util.Calendar;
import java.util.Map;

public class TrackingModule extends ReactContextBaseJavaModule {

    private UsageCollector usageCollector;

    public TrackingModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.usageCollector = new UsageCollector(reactContext);
    }

    @Override
    public String getName() {
        return "NativeTracking";
    }

    @ReactMethod
    public void hasUsageAccess(Promise promise) {
        try {
            boolean hasAccess = usageCollector.hasUsageAccess();
            promise.resolve(hasAccess);
        } catch (Exception e) {
            promise.reject("ERR_USAGE_ACCESS", e);
        }
    }

    @ReactMethod
    public void openUsageSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
        } catch (Exception e) {
            // ignore
        }
    }

    @ReactMethod
    public void getDailyForegroundUsage(Promise promise) {
        try {
            Calendar c = Calendar.getInstance();
            c.set(Calendar.HOUR_OF_DAY, 0);
            c.set(Calendar.MINUTE, 0);
            c.set(Calendar.SECOND, 0);
            c.set(Calendar.MILLISECOND, 0);
            long startOfDay = c.getTimeInMillis();
            long endOfDay = startOfDay + 86400000L;

            Map<String, Long> usage = usageCollector.getForegroundUsageRange(startOfDay, endOfDay);

            WritableMap map = new WritableNativeMap();
            for (Map.Entry<String, Long> entry : usage.entrySet()) {
                map.putDouble(entry.getKey(), entry.getValue());
            }

            promise.resolve(map);
        } catch (Exception e) {
            promise.reject("ERR_GET_USAGE", e);
        }
    }

    @ReactMethod
    public void getUsageRange(double startMs, double endMs, Promise promise) {
        try {
            Map<String, Long> usage = usageCollector.getForegroundUsageRange((long) startMs, (long) endMs);
            WritableMap map = new WritableNativeMap();
            for (Map.Entry<String, Long> entry : usage.entrySet()) {
                map.putDouble(entry.getKey(), entry.getValue());
            }
            promise.resolve(map);
        } catch (Exception e) {
            promise.reject("ERR_GET_USAGE_RANGE", e);
        }
    }

    @ReactMethod
    public void getHourlyUsageToday(Promise promise) {
        try {
            Calendar c = Calendar.getInstance();
            c.set(Calendar.HOUR_OF_DAY, 0);
            c.set(Calendar.MINUTE, 0);
            c.set(Calendar.SECOND, 0);
            c.set(Calendar.MILLISECOND, 0);
            long startOfDay = c.getTimeInMillis();
            long endOfDay = startOfDay + 86400000L;

            long[] hourly = usageCollector.getHourlyUsageToday(startOfDay, endOfDay);
            WritableArray array = Arguments.createArray();
            for (long h : hourly) {
                array.pushDouble((double) h);
            }
            promise.resolve(array);
        } catch (Exception e) {
            promise.reject("ERR_GET_HOURLY", e);
        }
    }

    @ReactMethod
    public void getUnlockCountRange(double startMs, double endMs, Promise promise) {
        try {
            int count = usageCollector.getUnlockCountRange((long) startMs, (long) endMs);
            promise.resolve(count);
        } catch (Exception e) {
            promise.reject("ERR_GET_UNLOCKS", e);
        }
    }
}
