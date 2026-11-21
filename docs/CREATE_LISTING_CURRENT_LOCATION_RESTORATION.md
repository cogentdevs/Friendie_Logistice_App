# Task 31 � Create Listing current location restoration

## Inspection and minimal restoration plan (before implementation)
Task 14 replaced RouteLocationPicker with ListingLocationPicker for verified backend IDs, omitting the GPS action. Existing GPS uses react-native-geolocation-service, react-native-permissions, and FriendieGeocoder Android native reverse lookup (locality/subLocality/countryCode). Foreground permissions already exist; no background permission is needed. Existing detectCurrentLocation calls currentPosition, which requests permission and may show a system enable-location dialog. Automatic Create entry must use a non-prompting path instead. Home/Search defaults must remain unchanged.

Plan: optional non-prompting GPS options, a minimal native read-only location-services availability check, exact/unique matching against complete real country/country-scoped city reads (actual short_name retained), one Create-specific lifecycle controller and the existing themed GPS action in the From picker. No guessed aliases or IDs. Partial matches allow manual city choice. Generation/session/focus/manual-change guards ignore stale completions. Settings open only by explicit action. Preserve payload, destination, searchable selectors, keyboard handling, image flow, and draft state. Backend read-only.

Implementation and executed verification are recorded below.

## Implementation and files

- `src/features/post-listing/services/listingGpsService.ts` (new): Create-specific service availability/settings adapter and conservative Laravel reference matching. Concurrent Create detections share one pending native fix; coordinates are not retained after completion or stored in the draft.
- `src/features/post-listing/hooks/useListingGps.ts` (new): automatic/explicit detection lifecycle, generation/abort/session guards, loading, settings recovery and Toast feedback.
- `src/features/post-listing/components/ListingLocationPicker.tsx`: optional GPS action/loading and explicit App/Location Settings actions for Create From; existing searchable Country/City/Area, Apply/Cancel remain. Manual controls stay usable during detection and invalidate pending results.
- `src/features/post-listing/screens/PostListingScreen.tsx`: Create-only integration; automatic full match fills origin, partial match presents country for manual city selection. Explicit picker detection waits for Apply. Cancel discards local GPS replacement. Destination and Edit flow are untouched.
- `src/features/post-listing/services/listingReferencesService.ts`: retain actual returned short_name as optional option metadata for matching; selected value and API request contracts unchanged.
- `src/features/location/services/locationService.ts`: read-only foreground permission check; optional non-prompting currentPosition settings. Default Home/Search behavior unchanged.
- `src/features/location/services/currentLocationService.ts`: forward optional provider settings; existing no-argument behavior preserved.
- `android/app/src/main/java/com/friendie_logistics_app/FriendieGeocoderModule.kt`: minimal read-only `isLocationEnabled` method using existing Android LocationManager (API28+ property, older provider fallback). Reverse geocoder unchanged.
- `__tests__/listingGpsService.test.ts` (new), `__tests__/useListingGps.test.tsx` (new), `__tests__/PostListing.test.tsx` (new cases, previous changes preserved).
- This report.

No manifest changes, background permissions, new native packages or dependencies. Existing ACCESS_FINE_LOCATION and ACCESS_COARSE_LOCATION reused.

## Permission and disabled-services flow

Create entry checks existing permission only. Missing permission causes no request, GPS fix, or repeated prompt. The visible Use Current Location action explicitly requests foreground permission. Denial shows the existing Toast style and leaves manual selection available. A blocked result exposes Open App Settings. Disabled services expose Open Location Settings, using Android's LOCATION_SOURCE_SETTINGS intent only after a user press. The app never silently enables GPS.

AppState return after an explicitly opened Settings page resumes detection once, without requesting permission again if still denied. Manual edits/cancel/navigation clear that intent. Ordinary background/foreground does not trigger a repeated location request. Busy guards prevent double taps. Requests are foreground one-shot reads; no watchPosition or background tracking.

## Automatic detection and lifecycle

On a genuine focused Create entry, automatic detection runs once when origin is empty, foreground permission is already granted and native services are enabled. Automatic provider mode requests no permission and suppresses the provider's system-enable dialog. Existing origin drafts prevent automatic detection. Normal rerenders and Strict Mode effect replay do not duplicate it. A real leave/reopen resets the entry attempt, while selected origin drafts remain preserved. This reopening behavior was corrected after physical testing revealed the initially retained entry-attempt flag.

Generation and AbortController invalidate reverse/reference completions after manual Country/City/Area edits, picker cancellation, navigation away, background, logout, account switching or unmount. The native one-shot callback cannot be physically canceled by this library; its result is ignored and concurrent Create callers share the pending fix. No coordinates/addresses/tokens are logged. Precise coordinates are never written into form state, API IDs or persistent storage.

## Geocoding and real IDs

Reuses detectCurrentLocation -> react-native-geolocation-service -> existing Android FriendieGeocoder. Native countryCode, countryName, locality and subLocality are used, with existing finite coordinate validation and geocoder timeout behavior.

Reference endpoints were verified read-only in Task 30: complete public `{success,message,data:{items}}` lists, country `id/name/short_name`, city `id/name/short_name/country_id`. Currency and categories unchanged. Matching uses normalized, trimmed, case-insensitive exact server names or short names. ISO country code is preferred only when it uniquely matches server short_name. Otherwise a unique exact name/abbreviation is required. No unverified UAE/KSA alias table, fuzzy first-result choice or invented ID.

Cities are fetched for the verified matched country; parser rejects another country's city. A unique exact city name/short name is required. Country-only match leaves City unselected and shows an informational Toast. Country unmatched/ambiguous leaves existing values unchanged. Ambiguous city permits manual selection. Optional area is copied only for a complete city match, within the existing 100m accuracy policy and the backend's 255-character area constraint; incompatible area is omitted, not truncated or guessed.

Complete selections remain `source:api` with real registered Country/City IDs and matching relationship. Partial matches cannot satisfy form validation until a City is manually selected. Only From is filled; To is independent. Existing Y-m-d dates, Description, price/weight zero, contact privacy 0, creation guards, image sequence/retry and navigation remain unchanged. No listing POST was executed during testing.

## Physical Android verification

User explicitly authorized connected-phone testing. Built debug APK installed with `adb install -r` (no app data clearing). Infinix Android 10/API29 device, existing Metro, no API host changes.

Observed:
- Initially device location enabled (mode 3), both app foreground location permissions ungranted. Opening Create did not display an automatic permission prompt.
- From picker displayed Use Current Location and original manual selectors/Apply/Cancel.
- Explicit request displayed Android permission UI. Deny retained manual Country and GPS actions, without an automatic loop.
- A subsequent explicit request was allowed through Android's foreground permission action. Real GPS/reverse geocoding/public Laravel reference matching populated Country and City; Apply became enabled.
- Already-granted permission on empty Create entry autofilled origin; destination remained unselected.
- Android Location Settings switch was temporarily disabled through system UI. Explicit GPS action exposed Open Location Settings. That app action opened Settings; switching location back on and returning resumed detection, cleared recovery action and restored an enabled Apply.
- Country selector search worked with keyboard visible; choosing another real country cleared City and disabled Apply. Cancel dismissed without applying that local replacement.
- No precise coordinates or detected addresses were printed or captured in diagnostic screenshots. The only screenshot retained is the empty, pre-permission form. Temporary UI hierarchy files were removed.
- Device location restored to original enabled mode 3. Both foreground permissions restored to original ungranted state; verified permission flags matched baseline. An attempted optional permission-flag cleanup command was unsupported on this Android version, but revocation already restored the observed flags.

Permanently blocked permissions, native provider timeout/error, account switching/logout during a fix, and the entire slow-navigation race matrix were verified with mocks, not claimed as physical tests. Physical visual equivalence across all devices/font sizes is NOT VERIFIED. No emulator was used. Live authenticated listing creation/image upload: NOT VERIFIED and deliberately not performed. Public countries GET succeeded (252 records); successful device ID matching used public backend reads.

## Verification results

Executed focused, static and full-suite results are recorded below.

Android command: `cd android; .\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain`: exit 0, BUILD SUCCESSFUL in 3m 32s; 407 tasks (20 executed, 387 up-to-date). Existing Gradle/AGP and Kotlin deprecation/parameter-name warnings; no compile errors. Native availability reader compiled and was used by the installed device build.

During test development, Android-specific tests initially used Jest's iOS default and Toast.show lacked a spy; these mock issues were corrected. A typed partial permission-response mock was corrected. No assertions removed or weakened. Initial no-void ESLint warnings were corrected in new code/tests.

## Scope and limitations

Backend/database/website/admin, endpoints and listing payload unchanged. No Home/Search components, shared selector design, global theme/navigation, reviews, messaging or image workflows changed by Task 31. Shared GPS defaults remain intact and have regression coverage. Existing unrelated dirty/untracked files, including Tasks 28�30, are preserved.

GPS success still depends on device/provider signal, Android geocoder availability and matching backend reference records. Unsupported names/aliases require manual selection. Permission and GPS services are user-controlled. No universal physical-device, iOS, background-location or exactly-once provider guarantees are claimed.

### Focused and static results

Final focused command:
`node node_modules/jest/bin/jest.js --runInBand --silent __tests__/listingGpsService.test.ts __tests__/useListingGps.test.tsx __tests__/PostListing.test.tsx __tests__/ListingSelectorSearch.test.tsx __tests__/LocationAutofill.test.tsx __tests__/CreateListing.test.tsx __tests__/createListingApi.test.ts __tests__/ListingImageFlow.test.tsx __tests__/FilterRoutePickers.test.tsx __tests__/KeyboardLayout.test.tsx __tests__/keyboardVisibility.test.ts`

Result: 11 suites passed, 211 tests passed, 0 failures, 0 snapshots, 56.976 seconds, exit 0. Includes 38 Task 31 cases (15 matching/provider cases, 21 lifecycle cases, 2 Create UI/autofill cases). Earlier final-without-last-boundary run: 209 passed; reopening/area compatibility cases bring final focused total to 211.

`node node_modules/typescript/bin/tsc --noEmit`: exit 0.

Scoped ESLint command:
`node node_modules/eslint/bin/eslint.js src/features/post-listing/hooks/useListingGps.ts src/features/post-listing/services/listingGpsService.ts src/features/post-listing/services/listingReferencesService.ts src/features/post-listing/components/ListingLocationPicker.tsx src/features/post-listing/screens/PostListingScreen.tsx src/features/location/services/locationService.ts src/features/location/services/currentLocationService.ts __tests__/listingGpsService.test.ts __tests__/useListingGps.test.tsx __tests__/PostListing.test.tsx`
Result: exit 0, no diagnostics in final run.

`git diff --check` for affected tracked files: exit 0, Windows LF/CRLF notices only.

Full suite command: `node node_modules/jest/bin/jest.js --runInBand --silent`. Entire output is retained in ignored `.validation/task31/full-jest.log`. Run separately after builds, device interaction and static checks. Final totals: **107 passed suites, 2 existing skipped suites, 109 total; 1588 passed tests, 0 failed, 2 existing skipped tests, 1590 total; 0 snapshots; 219.731 seconds; exit 0**. Task 30 baseline was 1550 passing tests; 38 new Task 31 cases explain the increase. No tests removed or newly skipped.
