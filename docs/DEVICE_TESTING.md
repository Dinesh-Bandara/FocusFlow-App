# Device Testing Guide

As FocusFlow relies heavily on Android system-level permissions and services, proper testing cannot be fully achieved on an iOS simulator or a basic Android emulator without Google Play Services. Real device testing is strongly recommended.

## 1. Preparing the Device
- Enable Developer Options on your Android device (Tap "Build number" 7 times in Settings > About Phone).
- Enable USB Debugging in Developer Options.
- Connect your device via USB (or wireless debugging in Android 11+).

## 2. Building and Installing the APK
From the project root:
```bash
npm start
```
In a new terminal:
```bash
npm run android
```
The React Native CLI will compile the custom Java modules (`UsageCollector`, `NotificationCounterService`) and install them on the device.

## 3. Testing UsageStatsManager
1. Open FocusFlow and tap **Grant Usage Access** on the Dashboard/Permissions screen.
2. You will be redirected to the Android Settings. Toggle it on for FocusFlow.
3. Return to the app. The Dashboard should now display your total foreground screen time for the day and the most used apps in the **Usage** tab.
4. Try spending a minute dynamically opening another app (e.g., YouTube), then checking FocusFlow again (pull to refresh).

## 4. Testing Notification Counting
1. Ensure the `BIND_NOTIFICATION_LISTENER_SERVICE` permission is granted.
2. Send yourself a notification (e.g., an SMS message from another phone).
3. The internal service `NotificationCounterService.java` will count it.
4. (UI integration for this counter is a WIP, but logcat will show: `Counted new notification for ...`)

## 5. Testing the Focus Timer
1. Go to the **Focus** tab.
2. Start a 25-minute timer.
3. Lock your phone or switch to another app.
4. Return to the app. The timer should continue running accurately.

## 6. Testing Google Calendar
Currently blocked by the missing web client ID. When provided:
1. Tap **Connect Calendar** in the Schedule tab.
2. Select your Google Account.
3. Observe fetched events in the list.
