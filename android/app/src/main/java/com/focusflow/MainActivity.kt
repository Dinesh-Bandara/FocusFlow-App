package com.focusflow

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "FocusFlow"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
          override fun getLaunchOptions(): android.os.Bundle? {
              val initialProperties = android.os.Bundle()
              val intent = intent
              if (intent != null) {
                  if (intent.hasExtra("START_FOCUS_FROM_ALARM")) {
                      initialProperties.putBoolean("startupStartFocus", intent.getBooleanExtra("START_FOCUS_FROM_ALARM", false))
                  }
                  if (intent.hasExtra("EVENT_ID")) {
                      initialProperties.putString("startupEventId", intent.getStringExtra("EVENT_ID"))
                  }
              }
              return initialProperties
          }
      }
}
