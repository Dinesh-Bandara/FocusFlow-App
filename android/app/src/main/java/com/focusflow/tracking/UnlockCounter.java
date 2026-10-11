package com.focusflow.tracking;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;

public class UnlockCounter {

    private Context context;
    private BroadcastReceiver unlockReceiver;

    public UnlockCounter(Context context) {
        this.context = context;
    }

    public void startListening() {
        if (unlockReceiver == null) {
            unlockReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    if (Intent.ACTION_USER_PRESENT.equals(intent.getAction())) {
                        recordUnlockEvent();
                    }
                }
            };
            IntentFilter filter = new IntentFilter(Intent.ACTION_USER_PRESENT);
            context.registerReceiver(unlockReceiver, filter);
        }
    }

    public void stopListening() {
        if (unlockReceiver != null) {
            context.unregisterReceiver(unlockReceiver);
            unlockReceiver = null;
        }
    }

    private void recordUnlockEvent() {
        // TODO: Save to SQLite database (UnlockDao)
    }
}
