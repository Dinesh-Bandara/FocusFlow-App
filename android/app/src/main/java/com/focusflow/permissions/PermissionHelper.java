package com.focusflow.permissions;

import android.app.AppOpsManager;
import android.content.Context;
import android.os.Process;
import android.provider.Settings;
import android.text.TextUtils;

import androidx.core.app.NotificationManagerCompat;

import java.util.Set;

public class PermissionHelper {

    public static boolean hasUsageAccess(Context context) {
        try {
            AppOpsManager appOps = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
            if (appOps == null) return false;
            int mode = appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    context.getPackageName()
            );
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) {
            return false;
        }
    }

    public static boolean hasNotificationAccess(Context context) {
        try {
            Set<String> packageNames = NotificationManagerCompat.getEnabledListenerPackages(context);
            if (packageNames.contains(context.getPackageName())) {
                return true;
            }
        } catch (Exception ignored) {}

        try {
            String flat = Settings.Secure.getString(
                    context.getContentResolver(),
                    "enabled_notification_listeners"
            );
            if (!TextUtils.isEmpty(flat)) {
                String[] names = flat.split(":");
                for (String name : names) {
                    if (name.contains(context.getPackageName())) {
                        return true;
                    }
                }
            }
        } catch (Exception ignored) {}

        return false;
    }
}
