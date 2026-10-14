package com.focusflow.bridge;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.focusflow.StartupSplashView;

import java.util.concurrent.atomic.AtomicBoolean;

public class SplashModule extends ReactContextBaseJavaModule {
    private static final String TAG = "SplashModule";
    private static final AtomicBoolean sContentReady = new AtomicBoolean(false);
    private static volatile WritableMap sPendingAction = null;
    private static ReactApplicationContext sReactContext = null;

    public SplashModule(ReactApplicationContext reactContext) {
        super(reactContext);
        sReactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return "SplashModule";
    }

    public static boolean isContentReady() {
        return sContentReady.get();
    }

    public static void setContentReady(boolean ready) {
        sContentReady.set(ready);
    }

    public static void resetContentReady() {
        sContentReady.set(false);
    }

    public static void processIntent(@Nullable Intent intent) {
        if (intent == null) return;
        boolean isFocus = intent.getBooleanExtra("START_FOCUS_FROM_ALARM", false);
        String eventId = intent.getStringExtra("EVENT_ID");
        Log.i(TAG, "processIntent: isFocus=" + isFocus + ", eventId=" + eventId);
        if (isFocus) {
            WritableMap map = Arguments.createMap();
            map.putString("action", "START_FOCUS");
            map.putString("eventId", eventId != null ? eventId : "");
            sPendingAction = map;
        }
    }

    public static void onNewIntent(@Nullable Intent intent) {
        if (intent == null) return;
        boolean isFocus = intent.getBooleanExtra("START_FOCUS_FROM_ALARM", false);
        String eventId = intent.getStringExtra("EVENT_ID");
        Log.i(TAG, "onNewIntent: isFocus=" + isFocus + ", eventId=" + eventId);
        if (isFocus) {
            WritableMap map = Arguments.createMap();
            map.putString("action", "START_FOCUS");
            map.putString("eventId", eventId != null ? eventId : "");
            sPendingAction = map;

            // If react context is active, emit event to JS immediately
            if (sReactContext != null && sReactContext.hasActiveReactInstance()) {
                try {
                    sReactContext
                            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                            .emit("onFocusAlarmAction", map);
                    Log.i(TAG, "Emitted onFocusAlarmAction to JS");
                } catch (Exception e) {
                    Log.e(TAG, "Failed to emit onFocusAlarmAction", e);
                }
            }
        }
    }

    @ReactMethod
    public void hide(Promise promise) {
        sContentReady.set(true);
        Activity activity = getCurrentActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> StartupSplashView.hide(activity));
        }
        if (promise != null) {
            promise.resolve(true);
        }
    }

    @ReactMethod
    public void getPendingAction(Promise promise) {
        if (sPendingAction != null) {
            WritableMap action = sPendingAction;
            sPendingAction = null; // Consume action
            promise.resolve(action);
        } else {
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void clearPendingAction(Promise promise) {
        sPendingAction = null;
        if (promise != null) {
            promise.resolve(true);
        }
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Keep for NativeEventEmitter compatibility
    }

    @ReactMethod
    public void removeListeners(double count) {
        // Keep for NativeEventEmitter compatibility
    }
}
