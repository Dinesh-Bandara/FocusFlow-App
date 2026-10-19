package com.focusflow.reminders;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

public class AlarmSoundPlayer {
    private static final String TAG = "AlarmSoundPlayer";
    private static final long MAX_RING_DURATION_MS = 60000L; // 60 seconds max ringing

    private static Ringtone sRingtone = null;
    private static final Handler sHandler = new Handler(Looper.getMainLooper());
    private static final Runnable sStopRunnable = AlarmSoundPlayer::stop;

    public static synchronized void play(Context context) {
        stop(); // Stop any currently playing ringtone

        try {
            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }

            sRingtone = RingtoneManager.getRingtone(context.getApplicationContext(), alarmUri);
            if (sRingtone != null) {
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                sRingtone.setAudioAttributes(audioAttributes);
                sRingtone.play();
                Log.i(TAG, "Alarm sound started playing");

                // Auto-stop after 60 seconds
                sHandler.postDelayed(sStopRunnable, MAX_RING_DURATION_MS);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error playing alarm sound", e);
        }
    }

    public static synchronized void stop() {
        sHandler.removeCallbacks(sStopRunnable);
        if (sRingtone != null) {
            try {
                if (sRingtone.isPlaying()) {
                    sRingtone.stop();
                    Log.i(TAG, "Alarm sound stopped");
                }
            } catch (Exception e) {
                Log.e(TAG, "Error stopping alarm sound", e);
            } finally {
                sRingtone = null;
            }
        }
    }

    public static synchronized boolean isPlaying() {
        return sRingtone != null && sRingtone.isPlaying();
    }
}
