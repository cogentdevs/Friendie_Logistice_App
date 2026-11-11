# Priority 1: public static marketplace

## Root cause and corrective changes

1. Public fixtures were gated exclusively by __DEV__. A normal release runtime therefore disabled Home/categories/destinations/listings while no backend was configured. Authentication was not the correct availability switch.
2. Default Listings subscribed to the same Home search filters and persisted radius. A previous Home search could hide the tab's catalogue.
3. Home's keyword submit shared a schema requiring both route endpoints, preventing general keyword-only search.

Existing fixture arrays, listing IDs, images, Home components, theme and authentication guards are retained.

## Explicit build configuration

Android build type staticTesting inherits release, sets native BuildConfig.STATIC_TESTING=true, uses application ID com.friendie_logistics_app.static_testing, version 1.0-STATIC_TESTING and launcher name Friendie STATIC TESTING. DEBUG=false; JS and 33 local asset files are bundled. The cleartext manifest placeholder is explicitly false for this custom release build type. Existing test signing is reused; this is not a production publishing/signing setup.

The existing FriendieAppMetadata native module exposes the boolean to appConfig. Fixtures are available only for __DEV__ or this explicit native testing marker, and can still be disabled with staticMarketplaceEnabled. Normal release sets STATIC_TESTING=false. Demo login, previewActive, tokens and authentication status do not enable the public catalogue. No environment/credential changes or new packages are required.

## Build and install (PowerShell, Android ARM64)

From the project root:

~~~powershell
node scripts/configure-env.cjs
Push-Location android
.\gradlew.bat app:assembleDebug app:assembleStaticTesting -PreactNativeArchitectures=arm64-v8a --console=plain
Pop-Location
adb install -r android/app/build/outputs/apk/staticTesting/app-staticTesting.apk
adb shell am start -n com.friendie_logistics_app.static_testing/com.friendie_logistics_app.MainActivity
~~~

Open **Friendie STATIC TESTING**, not an older ordinary release install. This package installs alongside the normal app and has separate app data. The testing APK runs without Metro. The debug APK remains android/app/build/outputs/apk/debug/app-debug.apk and requires the project's Metro server plus adb reverse tcp:8081 tcp:8081. Remove the architecture property to build other configured ABIs when needed; the delivered APK is arm64-v8a.

Do not use the existing app-release.apk as a static-testing deliverable. Ordinary release intentionally excludes public fixtures, even when UI-preview flags are enabled.

## Search scopes and navigation

Home search and Home Results retain their existing state. From and Destination are optional for general marketplace search; each selected structured endpoint still constrains results. Same-route, weight and date validation remains. Keyword trimming, category/country matching and truthful empty results use the existing catalogue.

Listings tab uses browseFiltersStore, initially empty filters plus worldwide location. It never inherits Home filters or persisted GPS radius. Explicit tab filters remain available. BrowseFiltersScreen reuses the existing FiltersScreen, snapshots/restores Home search/radius state and commits only the tab's filter scope. Existing route names and details IDs remain unchanged; no second navigator or filter UI was created.

The existing eight records are paginated (four per page). The default static catalogue loads its remaining local pages proactively, so a short first page cannot prevent access to the last four records. Real API searches retain demand-driven pagination. Home Latest Ads retains the existing three-record selection. Documents/Food and non-UAE destinations have no matching fixture listings; empty results are intentional. Only four existing destinations have supplied photos; the remaining existing cards use their original icon fallback.

## Authentication and privacy

Home, categories, destinations, Listings, search, filters and public Details remain guest-accessible. Post/Send/Carry creation, Messages, Request, Save and private account routes retain requireAuth. Guest Profile retains Sign In / Create Account. No fake session is established. Contact authorization remains fail-closed. No changes to Demo Login, GPS services, location permissions, Laravel or application backend APIs were made in this priority task.

## Files changed in this task

- android/app/build.gradle
- android/app/src/main/java/com/friendie_logistics_app/AppMetadataModule.kt
- src/constants/appConfig.ts
- src/features/listings/development/staticMarketplace.ts
- src/features/listings/hooks/useListings.ts
- src/features/listings/screens/ListingsScreen.tsx
- src/features/home/types/homeSearchSchema.ts
- src/navigation/ListingsNavigator.tsx
- __tests__/App.test.tsx
- __tests__/Home.test.tsx
- __tests__/Listings.test.tsx
- __tests__/homeService.test.ts
- __tests__/staticMarketplace.test.ts

Created:

- src/features/listings/store/browseFiltersStore.ts
- src/features/listings/screens/BrowseFiltersScreen.tsx
- docs/STATIC_TESTING_MARKETPLACE.md

Pre-existing uncommitted GPS work was preserved and is not part of this change list. HomeSearchCard/HomeSections/LatestAds styling, location images and theme tokens were not changed in this task. Popular Location cards retain 146dp width and 150dp total height (100dp media + 48dp text + borders).

## Executed validation

- TypeScript: PASS (.validation/priority1-typecheck-final.log).
- Targeted ESLint: PASS (.validation/priority1-eslint-final.log).
- Final regression: 55 suites / 399 tests PASS, 274.977 seconds (.validation/priority1-full-tests-final.log).
- Automated tests cover debug availability, release-runtime STATIC_TESTING availability without HTTP/authentication, normal release exclusion, keyword/partial route validation, all eight paginated listings despite Home filters/radius, tab filter editing with Home restoration, public details/navigation, guarded actions and logout returning to visible public cards.
- Debug and staticTesting ARM64 builds: BUILD SUCCESSFUL in 11m 30s, 1077 tasks (82 executed, 995 up-to-date), explicit exit 0 (.validation/priority1-android-builds-final.log). Initial custom variant build failed on a missing usesCleartextTraffic placeholder; that was corrected before the successful build.
- Native generated config confirms STATIC_TESTING=true and DEBUG=false for the testing variant. APK badging confirms the distinct package, launcher label and version; application-debuggable is absent. The packaged sourcemap includes the final optional-route schema.
- Final-hook validation: TypeScript and targeted ESLint PASS (.validation/priority1-typecheck-delivery.log, priority1-eslint-delivery.log). A concurrent full run passed 54 suites/392 tests but seven App navigation cases exceeded their default time budget. A standalone App rerun passed 45/48, with three default-5-second timeouts; a focused retry passed the logout case, leaving Home action coverage and returning-guest traversal at the 5-second limit. These timeout failures are recorded, not presented as green default-command results. A diagnostic 30-second-budget navigation run is recorded separately.
- Final navigation diagnostic: `npx jest __tests__/App.test.tsx --runInBand --testTimeout=30000` PASS, all 48 tests, 95.728 seconds (.validation/priority1-navigation-30s.log). No source test timeout was changed. Combined with the other 54 passing suites, every test has passed on the final implementation; the default-budget full command itself remains recorded as timing out.
- Both APKs installed successfully on device 054783303M030918. The static-testing app was launched after removing the Metro adb reverse, confirming standalone operation.

Static APK: android/app/build/outputs/apk/staticTesting/app-staticTesting.apk
Final size: 40,023,258 bytes
Final SHA256: 02C9AD534735543CF8DA1C7B46E7381F4BFB9BCF245764579BA1FC1AD7A5245D

Final delivery rebuild: BUILD SUCCESSFUL in 12m 57s, 1077 tasks (37 executed, 1040 up-to-date), exit 0 (.validation/priority1-android-delivery.log). Both final APKs installed successfully. The final release source map includes the local-page loading effect and corrected hook dependencies. Metro bundling is limited to two workers to reduce build memory pressure.

## Actual APK evidence

Debug device checks: guest Home/header/search/cards, Categories, image destinations, Latest Ads, default Listings (8), public Details, Request to Login and cancellation, matching keyword-only Dubai (2 send records), and non-matching keyword empty results. Default tab stayed at 8 even when Home search showed an old 1km radius restriction.

STATIC_TESTING device checks: fresh onboarding to guest Home without Login; categories/images/latest cards visible; Documents and Saudi Arabia returned Listings (0) with the proper empty state; default Listings returned Listings (8) despite Home's country filter; public Details opened and Request triggered Login; keyword-only Dubai returned Listings (2) without From/To. Post/Messages auth and guest Profile were checked on-device. Verified-only filters returned seven records, and removing the chip restored eight. After the final rebuild, both debug and standalone STATIC_TESTING were scrolled to records 900007 and 900008. Public Ayesha Noor Details opened from the final release catalogue and Request Now opened Login; cancellation returned to browsing. The final release Home categories, image destinations and Latest Ads were rechecked and recaptured. Location cards measure 146 by 150dp on the tested device.

Screenshots (project .validation directory):

- priority1-debug-home.png
- priority1-debug-marketplace.png
- priority1-debug-latest.png
- priority1-debug-listings.png
- priority1-debug-details.png
- priority1-debug-keyword-results.png
- priority1-debug-empty-results.png
- priority1-static-testing-home.png
- priority1-static-testing-marketplace.png
- priority1-static-testing-latest.png
- priority1-static-testing-listings.png
- priority1-static-testing-details.png
- priority1-static-testing-category-empty.png
- priority1-static-testing-keyword-results.png
- priority1-static-testing-guest-profile.png
- priority1-static-testing-filtered-listings.png
- priority1-static-testing-listings-page2.png
- priority1-debug-listings-page2.png

## Limits

Real server login/logout, publication and requests cannot be tested in a static app with no integrated authentication/backend. Authenticated/guest equality and post-logout visibility are covered by automated session-transition tests; no fake device session was created. The two APK modes share the same unchanged guard implementation. Device notifications occasionally interrupted UI automation; interrupted checks were retried rather than marked as passes. No private notification contents are retained as deliverable evidence. Future production data integration remains outside scope.
