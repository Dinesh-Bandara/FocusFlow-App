package com.focusflow

import android.content.Intent
import android.os.Bundle
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.focusflow.bridge.SplashModule

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    val splash = installSplashScreen()
    splash.setOnExitAnimationListener { it.remove() }
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
      SplashModule.onNewIntent(intent)
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
              }
              return initialProperties
          }
      }
}
