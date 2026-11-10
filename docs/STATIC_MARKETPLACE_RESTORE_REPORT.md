# Static marketplace restoration

## A. Root-cause fix
Public fixtures were gated by authentication-preview state. The public catalogue now uses isStaticMarketplaceEnabled(), independent of auth status, user, token, previewActive and demo credentials. The legacy public isListingDemoMode() helper delegates to that setting; public list/details hooks no longer require previewActive. Home query keys distinguish static content from disabled content without using user identity. Private unread/profile data remains separately scoped.

Home's existing preview-only identity and My Listings preview link still use the separate login-preview helper. Enabling catalogue fixtures does not create a demo user, activate preview, store a token or authenticate anyone.

## B. Exact files changed in this focused fix
Application:
- src/constants/appConfig.ts
- src/features/listings/development/staticMarketplace.ts (new)
- src/features/listings/development/demoListings.ts
- src/features/listings/hooks/useListings.ts
- src/features/listings/hooks/useListingDetails.ts
- src/features/home/services/homeService.ts
- src/features/home/hooks/useHomeData.ts
- src/features/home/screens/HomeScreen.tsx
- src/features/home/components/HomeSections.tsx
- src/features/home/types/home.types.ts

Tests:
- __tests__/staticMarketplace.test.ts (new)
- __tests__/Home.test.tsx
- __tests__/homeService.test.ts
- __tests__/listingDemo.test.ts
- __tests__/listingDetailsService.test.ts
- __tests__/guestListingDetails.test.ts
- __tests__/searchRequest.test.ts
- __tests__/App.test.tsx

Report:
- docs/STATIC_MARKETPLACE_RESTORE_REPORT.md (new)

Existing unrelated working-tree changes were preserved. No Git reset/revert, package installation, backend change, API integration, native configuration change or new navigation route was performed for this fix. Existing API-contract tests explicitly disable static fixtures so they continue testing the intended non-fixture serializer/privacy paths.

## C. Availability and restored content
appConfig.staticMarketplaceEnabled defaults to __DEV__. isStaticMarketplaceEnabled() requires both __DEV__ and that independent flag. No environment/credential file change is required.

Restored through existing components/services:
- Categories: Food Items, Personal Items, Documents.
- Destinations: existing Saudi Arabia, UAE, Philippines, Bahrain, Pakistan and India remain; the existing destination directory adds United Kingdom. Existing UAE, Saudi Arabia, Pakistan and United Kingdom photo assets are reused. Other destinations keep the existing icon fallback. No images were created or edited.
- Latest Ads: first three entries from the same eight existing demo listings; IDs/prices/route data remain unchanged. Listings and public Details can resolve those same IDs without a login or preview activation.

## D. Guest and member parity
Service tests compare the complete categories/destinations/latest results for a guest and an authenticated test member with previewActive false and UI preview disabled. Both receive identical public fixtures. Home component tests render cards for both states. Logout/router coverage confirms the Guest Home still shows categories/latest ads after private caches are cleared. Fixture reads do not mutate authentication state or make HTTP requests.

## E. Authentication and contact privacy
Existing requireAuth, pending actions, Login/Register, token storage and route boundaries are untouched by this fix. Post, Send/Carry posting, Messages, Request Now and private account actions remain protected. Actual router coverage confirms guest category/location navigation and public Listing Details, then Login for Request Now, Post and Messages; cancellation returns to the original public context.

No demo credentials are displayed in Home or used to unlock fixture visibility. The existing development login remains separate. No private phone was added. Tests inspect all eight public demo details and confirm phone is absent and permittedPhone remains undefined. Accepted-request/contact authorization is not fabricated; the existing backend-dependent contact lock remains intact.

## F. Home design and error states
Home layout, section/card components, fonts, colors, spacing, shadows, radii and assets are preserved. Mechanical comparison against the committed baseline confirms HomeScreen and HomeSections style blocks are identical. Git diff shows no changes to theme, destination assets, HomeEssentials or HomeSearchCard. LatestAdsSection and its ListingCard reuse are retained without a source edit in this fix.

Only required state/identity wiring and error feedback changed:
- Disabled fixture service throws StaticMarketplaceDisabledError; Home displays 'Static marketplace content is disabled in this build.' without a connection claim or Retry button.
- Valid empty arrays retain the existing empty-state text.
- Actual loading failures retain Retry with neutral 'Unable to load ... Please try again.' wording.
- Existing loading skeletons remain unchanged.

## G. Development versus production
Development/debug: public fixtures enabled by default for guests and members, independently of demo login. The independent flag can disable them for API-contract/integration work.
Production/release: __DEV__ is false, so fixture availability is false even if the flag is forced true or the existing release UI-preview flag is enabled. Production therefore does not accidentally render this development catalogue. Future verified API integration can replace the data services without changing auth flows.

## H. Executed validation
- npm run typecheck: PASS, exit 0 (.validation/static-marketplace-final-typecheck.log).
- npm run lint: PASS, exit 0, no reported warnings/errors (.validation/static-marketplace-final-lint.log).
- npm test -- --runInBand --silent --testTimeout=30000: PASS, 54 suites / 372 tests, 144.246 seconds (.validation/static-marketplace-final-tests.log).
- Focused actual-router run: PASS, 4 selected tests across 2 suites (47 intentionally filtered cases); includes public fixture navigation, guarded actions, authenticated Home and logout card restoration (.validation/static-marketplace-router.log).
- The initial focused run exposed one outdated expected 'unavailable' message; updated to the required disabled-build semantics. The final full suite passes all cases.
- Android ARM64 debug: .\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain: BUILD SUCCESSFUL in 31m 15s; 406 tasks, 335 executed / 71 up-to-date (.validation/phase5-final-android-debug.log). The already-running native build completed during this fix; no Android/native dependencies were changed.
- apksigner verify --verbose: PASS, APK Signature Scheme v2, existing debug signer.
- APK: android/app/build/outputs/apk/debug/app-debug.apk; 78,665,239 bytes.
- SHA-256: 14C84B7118B01478012882CCB0DAFBF9FB06B49E5AF4752AF4A6D92286E210FA.
- adb install -r: Success; existing app data was preserved.
- Device smoke: current debug app with current Metro bundle exposed restored destination and Latest Ads/listing controls in the foreground hierarchy. Further screenshot capture was skipped when Friendie was no longer foreground. No complete manual device matrix or live authenticated backend test is claimed.

## I. Remaining issues / limits
No failing automated check remains for this fix. Backend integration is intentionally absent. Protected account/request/message operations still require actual authentication and verified backend capabilities; static fixture availability never bypasses those requirements. Authorized contact disclosure remains unavailable, not simulated.

The debug APK requires this workspace's Metro server (npm start); it is not a standalone release bundle. Release fixtures are intentionally disabled. Full manual device coverage of all destinations, both auth states and large-font/offline cases remains separate from the executed automated coverage.
