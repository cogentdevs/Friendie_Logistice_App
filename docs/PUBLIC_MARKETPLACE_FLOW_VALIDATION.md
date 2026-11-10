# Public marketplace flow validation

The requested source corrections were already present in the working tree when this follow-up began. They were preserved rather than replaced. No new application source or navigation changes were necessary during this verification pass.

## Existing implementation verified

- src/constants/appConfig.ts and src/features/listings/development/staticMarketplace.ts: public fixtures are controlled by __DEV__ and staticMarketplaceEnabled, independently of authentication and previewActive. Production runtimes exclude these fixtures even if preview flags are set.
- src/features/home/services/homeService.ts: three existing categories, seven destinations (four existing local photos), and three latest ads from the existing eight-listing catalogue.
- src/features/home/hooks/useHomeData.ts: public collection query keys use static availability, not user identity or demo login.
- src/features/listings/development/demoListings.ts: shared catalogue with pagination and public filters. Categories/countries without matching records return empty results; no listings are invented.
- src/features/listings/services/listingsService.ts and listingDetailsService.ts: public static listing reads and ID-based details do not require login or HTTP.
- src/navigation/BottomTabNavigator.tsx, existing account route boundaries and authFlowCoordinator.ts: protected actions retain the existing authentication guard, cancellation, pending intent and one-time resumption.
- src/features/listings/screens/ListingDetailsScreen.tsx: request resumption opens explicit review, never automatic submission. Save resumption returns to the same listing with an instruction to tap the heart. Phone authorization remains unavailable and fails closed.
- src/features/home/components/HomeSections.tsx: 146dp card width, 100dp image/fallback area, 48dp label area, 150dp total including borders. Both images and placeholders share these dimensions; cover resizing and horizontal scrolling are preserved.

## Files changed in this follow-up

- __tests__/staticMarketplace.test.ts: eight additional public-search regression cases, checking filters, truthful empty results, matching detail IDs, unchanged guest state, no preview authentication, no HTTP and hidden phone data.
- docs/PUBLIC_MARKETPLACE_FLOW_VALIDATION.md: this report.

Existing application changes from earlier tasks remain intact. No theme, image, backend, dependency, authentication or Home layout changes were made in this pass.

## Executed checks

- npm run typecheck: PASS.
- npx eslint __tests__/staticMarketplace.test.ts src/features/home/components/HomeSections.tsx: PASS.
- npx jest __tests__/staticMarketplace.test.ts --runInBand --silent: 10/10 PASS.
- npx jest --runInBand --silent: 54 suites, 380 tests PASS (239.654 seconds), including actual navigator integration tests for public browsing, protected Post/Messages/request actions, login cancellation, authenticated return, account changes and logout.
- Android ARM64 debug: .\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain: BUILD SUCCESSFUL in 4m 5s; 406 tasks (16 executed, 390 up-to-date). Initial sandbox attempt could not access the Gradle cache; the permitted rerun succeeded. Log: .validation/marketplace-flow-android.log. Output: android/app/build/outputs/apk/debug/app-debug.apk. This debug APK requires Metro.

## Limits

These are automated component/service/navigation tests, not a new full physical-device walkthrough. No genuine backend login, registration, request submission, message delivery or accepted-request contact authorization can be verified without integrated contracts. Save is device-local; request resumption requires explicit review and submission remains honestly unavailable. Only four destinations have existing photos; the other existing destinations retain their icon fallback. Release/production builds intentionally do not expose development fixtures.
