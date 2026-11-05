# Screen 08 - Advanced Location & Listing Filters

Implemented `src/features/search/screens/FiltersScreen.tsx` in the existing Home native stack. It uses the shared white/navy/burgundy theme, centered native header with Back/Reset, GPS/manual radio cards, accessible 1-200 km slider, Country/City/Area selection, verified/available checkboxes and a fixed safe-area Apply action. Content scrolls on small devices. The existing tab bar hides on Search and Filters; no additional navigator or dependencies were introduced.

Location behavior:
- GPS is requested only by tapping My Current Location through the existing foreground-permission adapter. The radius center uses the returned device coordinates, never a named area's center. Fresh high-accuracy fixes are requested; fixes worse than 100 m and selections older than two minutes cannot be applied. Denied, blocked, disabled, timeout, unavailable and inaccurate states provide explicit fallbacks/settings actions.
- Manual selection uses structured country/city/optional area identity and coordinates or a verified provider's resolved point. Exact coordinate selection takes priority. GPS and manual selections remain separate; revision guards discard stale asynchronous responses after switching mode/resetting.
- Worldwide is an explicit state, without dummy coordinates or oversized radius. Reset clears location restrictions and other switches in the draft; Apply commits them.
- Draft choices survive navigating away/back. Applied location persists through the existing AsyncStorage location store; invalid restored selections fall back to Worldwide. Advanced switches are separate search state. Country/city edits invalidate dependent area/IDs/coordinates through the reused structured location picker.
- From/origin and To/destination are distinct radius targets. Listing serialization specifies straight-line distance and omits geographic identity constraints for GPS/exact pins. Coordinates are not logged or displayed in the main Filters screen.

Integrations and reference differences:
- No verified country/city/area catalog, Places proxy, reverse-geocoder, Maps credentials or Laravel filter/count contract was supplied. Dropdown-style fields therefore open structured manual entry, existing route-point choices, or an exact-coordinate picker; there is no interactive map or fabricated catalog. Unresolved named locations cannot be applied.
- `PLACES_API_VERIFIED=false` now gates Places requests in addition to its URL. `LISTINGS_API_VERIFIED=false` continues to prevent unverified listing calls. Verify/adapt the proposed radius_target, distance_metric, verified_only and available_now parameters before enabling the real backend. No mock result count is shown.
- Worldwide and radius-target controls are additional requirements beyond the screenshot. Real permission/error/loading states replace the reference's prefilled sample location. No GPS permission was automatically granted during device QA.
- Existing debug UI preview remains enabled: Sign In opens Home without creating an authenticated session.

Changed files:
- Added FiltersScreen, RadiusSlider, ExactPointPicker, filterDraftStore, useLocationFilters and filterLocationService.
- Updated location types/store/services and RouteLocationPicker; search types/store/screen; Home route reset; listing request serializer; HomeNavigator and CustomTabBar.
- Removed obsolete SearchScreens placeholder. Updated configure-env, generated public configuration, .env.example, README and Jest setup.
- Added Filters and filterLocation tests; updated App/Search/searchRequest tests.

Validation (2026-11-05):
- TypeScript: passed.
- ESLint: passed.
- Jest: 14 suites, 91 tests passed. Covers exact GPS geometry, stale responses, permission failures, accuracy/age, manual override, worldwide, radius bounds, serialized target/flags and real navigator Apply/Reset/back behavior.
- Android: BUILD SUCCESSFUL in 44 seconds, 407 tasks; APK installed and launched on connected Infinix X655C (Android 10, arm64).
- Physical device: Home to Search to Filters, manual selection and exact-point modal confirmed; no real GPS coordinates collected. Native GPS success still needs an outdoor device test with user-granted permission. iOS build not available on Windows.

Device visual note: the phone's custom system font changes typography from the supplied reference. Existing React Native development warning overlay can obscure the footer; it was not suppressed. The main content remains scrollable and the footer is fixed below it. Screenshot inspected locally at .validation/filters-check.png (ignored validation artifact).
