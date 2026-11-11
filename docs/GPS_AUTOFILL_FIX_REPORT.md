# GPS crash and automatic location fill

## Crash cause and native fix

Device crash logs previously showed IncompatibleClassChangeError at FusedLocationProvider.java:97: FusedLocationProviderClient was expected to be a class but was an interface. The GPS module requested Google Play Services Location 18.0.0 while Maps selected 21.3.0 in the app runtime. The modules now share 21.3.0 through the existing Android root ext properties playServicesLocationVersion and googlePlayServicesLocationVersion. No npm dependencies or unrelated native versions changed.

The GPS module debugCompileClasspath resolves to 21.3.0. javap confirms its getLastLocation call now uses invokeinterface, matching the packaged interface. No exception suppression or GPS removal was used.

## Address flow

Existing react-native-geolocation-service 5.3.1 still acquires permission and the actual device point. currentLocationService.detectCurrentLocation is shared by route forms and radius filters. It records capture time before address resolution, validates the point, and calls placesService.reverseGeocode.

placesService.reverseGeocode now uses the small Android FriendieGeocoder native module. Android Geocoder uses its asynchronous listener on API 33+; older Android versions run the blocking API on a worker thread. A 12-second native timeout settles once and safely ignores late callbacks. The module checks Geocoder.isPresent and returns only country name, ISO country code, locality and sub-locality when supplied. It never substitutes district/street names as a made-up city, returns a company/private address, or logs precise coordinates. It needs no application backend, paid key or added package. Android's system provider can require connectivity and does not guarantee results: https://developer.android.com/reference/android/location/Geocoder

## Form binding and fallback

RouteLocationPicker fills Country, Country code, City and optional Area automatically. Latitude/longitude are retained as typed internal coordinates; the old raw coordinate inputs have been removed from this shared form. Users review/select their detected location and can still edit the address. Existing forms use free-text structured locations, not a predefined country/city directory; existing IDs are retained only when the original identity still matches. No country or city IDs are invented.

A geocoder failure/partial result preserves the device point and shows a message. Users complete the missing address fields manually without calculating coordinates. Editing a fully resolved address changes to manual selection and discards the old point so another city cannot silently retain the previous GPS center. Closing the picker ignores late results. Duplicate GPS taps are prevented while an acquisition is pending.

Home Search now enables the shared GPS option. Search and Post Listing already use the same picker; Send/Carry reuse Post Listing. Each picker commits only its selected From or Destination field.

Filters use the same detection service and show resolved GPS metadata. GPS radius remains centered on the actual device coordinates; city/area labels never replace that point. Existing accuracy/staleness checks, explicit worldwide state and independent origin/destination matching remain. An explicit switch to manual mode can retain a newly captured point for manual address completion, while preserving any existing manual selection. Picking a route location alone does not activate radius filtering.

## Files modified

- android/build.gradle
- android/app/src/main/java/com/friendie_logistics_app/MainApplication.kt
- src/features/home/components/HomeSearchCard.tsx
- src/features/location/components/RouteLocationPicker.tsx
- src/features/location/hooks/useCurrentLocation.ts
- src/features/location/services/filterLocationService.ts
- src/features/location/services/placesService.ts
- src/features/location/types/location.ts
- src/features/search/screens/FiltersScreen.tsx
- src/features/search/store/filterDraftStore.ts

## Files created

- android/app/src/main/java/com/friendie_logistics_app/FriendieGeocoderModule.kt
- src/features/location/services/currentLocationService.ts
- __tests__/LocationAutofill.test.tsx
- docs/GPS_AUTOFILL_FIX_REPORT.md

## Validation

- Initial Android ARM64 debug build: Gradle BUILD SUCCESSFUL in 5m 25s; 406 tasks, 37 executed, 369 up-to-date. The command wrapper returned 1 after compiler warnings on stderr; an explicit-exit-code final check is recorded separately below.
- APK inspection: native FriendieGeocoderModule is present in APK dex.
- adb install -r: Success on device 054783303M030918. App launch: Success; no app data cleared.
- GPS dependency inspection: module compiles against play-services-location:21.3.0.
- Existing Home/Search/Post/Filters suites: 5 suites, 51 tests PASS.
- New auto-fill suite: 16 tests PASS, including native address adapter, partial/failing lookup, permission grant/denial, blocked/disabled/timed-out GPS, manual edits, Guest/Demo modes, no backend calls, route isolation, exact radius coordinates and ignoring late results.
- Full regression: 55 suites, 396 tests PASS (161.421 seconds).
- Final targeted location checks after capture-time/duplicate-flight changes: 3 suites, 36 tests PASS.
- Final TypeScript: PASS.
- Targeted ESLint: PASS.
- Final Android ARM64 debug build: BUILD SUCCESSFUL in 58s; 406 tasks (16 executed, 390 up-to-date); explicit GRADLE_EXIT_CODE=0. Log: .validation/gps-autofill-final-android.log. Output: android/app/build/outputs/apk/debug/app-debug.apk (debug APK requires Metro).

## Physical-device verification after unlock

On the installed updated APK, the real shared location picker displayed the success notice "Location detected" and populated Country, ISO country code, City and Area. No latitude/longitude input fields were present. Android reported fine and coarse location permissions granted. The original application process (PID 11836) remained alive and its crash buffer contained no fatal exception. Only boolean checks were saved; real coordinates and address text were not recorded in the QA artifacts.

Evidence: .validation/gps-autofill-device-smoke.json (all seven checks true). This confirms a successful real-device GPS/address flow, including the native geocoder, without the previous FusedLocationProviderClient crash in this run.

A follow-up repeat tap was inconclusive because the screen changed from the picker to Home while QA was running. The subsequent false field/success checks describe the absence of the picker, not a confirmed GPS failure. The repeat artifact is marked accordingly. Manual edit behavior, denied/blocked permissions, route-endpoint isolation and exact radius values remain automated-test results; they were not all repeated physically. The API 33+ native listener branch still needs a suitable device/emulator walkthrough.

## Preserved boundaries

No Laravel or application API integration, authentication/Guest Mode/demo login/static fixture/contact privacy/navigation/theme changes. iOS has no new native geocoder in this Android-focused implementation: coordinates are retained and manual address fallback is used there.
