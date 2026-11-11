package com.friendie_logistics_app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.uimanager.ViewManager

class AppMetadataModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "FriendieAppMetadata"
  override fun getConstants(): Map<String, Any> {
    val version = reactApplicationContext.packageManager
      .getPackageInfo(reactApplicationContext.packageName, 0).versionName
    return buildMap {
      if (!version.isNullOrBlank()) put("version", version)
      put("staticTesting", BuildConfig.STATIC_TESTING)
    }
  }
}

class AppMetadataPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(AppMetadataModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
