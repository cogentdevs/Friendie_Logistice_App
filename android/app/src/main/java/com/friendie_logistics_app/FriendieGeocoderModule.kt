package com.friendie_logistics_app

import android.location.Address
import android.location.Geocoder
import android.os.Build
import android.os.Handler
import android.os.Looper
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class FriendieGeocoderModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val worker = Executors.newSingleThreadExecutor()
  private val handler = Handler(Looper.getMainLooper())

  override fun getName() = "FriendieGeocoder"

  @ReactMethod
  fun reverse(latitude: Double, longitude: Double, promise: Promise) {
    if (!latitude.isFinite() || !longitude.isFinite() || latitude !in -90.0..90.0 || longitude !in -180.0..180.0) {
      promise.reject("INVALID_POINT", "The location point is invalid.")
      return
    }
    if (!Geocoder.isPresent()) {
      promise.reject("GEOCODER_UNAVAILABLE", "Address lookup is unavailable on this device.")
      return
    }
    val settled = AtomicBoolean(false)
    val timeout = Runnable {
      if (settled.compareAndSet(false, true)) promise.reject("GEOCODER_TIMEOUT", "Address lookup timed out.")
    }
    fun fail() {
      if (settled.compareAndSet(false, true)) {
        handler.removeCallbacks(timeout)
        // Do not include provider exceptions, coordinates or addresses in logs/errors.
        promise.reject("GEOCODER_UNAVAILABLE", "The address could not be resolved.")
      }
    }
    fun complete(addresses: List<Address>) {
      if (settled.compareAndSet(false, true)) {
        handler.removeCallbacks(timeout)
        val result = Arguments.createMap()
        addresses.firstOrNull()?.let { address ->
          fun put(key: String, value: String?) {
            value?.trim()?.takeIf { it.isNotEmpty() }?.let { result.putString(key, it) }
          }
          put("countryName", address.countryName)
          put("countryCode", address.countryCode?.uppercase(Locale.ROOT))
          put("city", address.locality)
          put("area", address.subLocality)
        }
        promise.resolve(result)
      }
    }
    handler.postDelayed(timeout, 12000)
    try {
      val geocoder = Geocoder(reactApplicationContext, Locale.getDefault())
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        geocoder.getFromLocation(latitude, longitude, 1, object : Geocoder.GeocodeListener {
          override fun onGeocode(addresses: MutableList<Address>) { complete(addresses) }
          override fun onError(errorMessage: String?) { fail() }
        })
      } else {
        worker.execute {
          try {
            @Suppress("DEPRECATION")
            val addresses = geocoder.getFromLocation(latitude, longitude, 1)
            complete(addresses ?: emptyList())
          } catch (_: Exception) { fail() }
        }
      }
    } catch (_: Exception) { fail() }
  }

  override fun invalidate() {
    worker.shutdownNow()
    super.invalidate()
  }
}

class FriendieGeocoderPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(FriendieGeocoderModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
