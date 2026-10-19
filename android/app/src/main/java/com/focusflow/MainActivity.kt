package com.focusflow

import android.content.Intent
import android.os.Bundle
import androidx.core.app.NotificationManagerCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.focusflow.bridge.SplashModule
import com.focusflow.reminders.AlarmSoundPlayer

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    val splash = installSplashScreen()
    splash.setOnExitAnimationListener { it.remove() }
    handleAlarmIntent(intent)
    SplashModule.processIntent(intent)
    super.onCreate(savedInstanceState)
    // Native branding is drawn before React Native loads its JavaScript bundle.
    if (!SplashModule.isContentReady()) {
      StartupSplashView.show(this)
    }
  }

  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    setIntent(intent)
    if (intent != null) {
      handleAlarmIntent(intent)
      SplashModule.onNewIntent(intent)
    }
  }

  private fun handleAlarmIntent(intent: Intent?) {
    if (intent?.getBooleanExtra("START_FOCUS_FROM_ALARM", false) == true) {
      AlarmSoundPlayer.stop()
      val notifId = intent.getIntExtra("NOTIFICATION_ID", -1)
      if (notifId != -1) {
        try {
          NotificationManagerCompat.from(this).cancel(notifId)
        } catch (_: Exception) {}
      }
    }
  }

  override fun onDestroy() {
    super.onDestroy()
    SplashModule.resetContentReady()
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "FocusFlow"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
          override fun getLaunchOptions(): android.os.Bundle? {
              val initialProperties = android.os.Bundle()
              val currentIntent = intent
              if (currentIntent != null) {
                  if (currentIntent.hasExtra("START_FOCUS_FROM_ALARM")) {
                      initialProperties.putBoolean("startupStartFocus", currentIntent.getBooleanExtra("START_FOCUS_FROM_ALARM", false))
                  }
                  if (currentIntent.hasExtra("EVENT_ID")) {
                      initialProperties.putString("startupEventId", currentIntent.getStringExtra("EVENT_ID"))
                  }
                  if (currentIntent.hasExtra("EVENT_TITLE")) {
                      initialProperties.putString("startupEventTitle", currentIntent.getStringExtra("EVENT_TITLE"))
                  }
                  if (currentIntent.hasExtra("START_TIME")) {
                      initialProperties.putDouble("startupStartTime", currentIntent.getLongExtra("START_TIME", 0L).toDouble())
                  }
                  if (currentIntent.hasExtra("END_TIME")) {
                      initialProperties.putDouble("startupEndTime", currentIntent.getLongExtra("END_TIME", 0L).toDouble())
                  }
              }
              return initialProperties
          }
      }
}
