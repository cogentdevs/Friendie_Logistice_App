# Screen 07 ? Search Listings

Implemented src/features/search/screens/SearchScreen.tsx with the existing centered native-stack Search Listings header/back button, white safe-area content, two-option gradient segment, structured From/To cards, floating full-value swap, date-range row, gradient Search action and persisted recent-search cards. Search temporarily hides the existing tab bar; Home restores that same bar. No second navigator/container or tab bar was added. Direct Search entry uses Home as the header/hardware Back fallback. Empty history starts empty rather than reproducing fabricated reference searches.

A shared RouteLocationPicker modal now serves both endpoints because the repository had native location services but no selection UI. It collects country name/code, city, optional area and optional exact coordinates, retaining existing IDs only where identities still match. Changing a parent location clears dependent area/coordinates and stale place identifiers. Native GPS is explicitly user-triggered through the existing locationService and supplies coordinates only; country/city/area remain user-confirmed. No unverified reverse geocoding is called. The swap exchanges entire objects, including IDs, area, source and coordinates. Local identity includes country/area/IDs and point information rather than treating a city label as globally unique.

SearchDatePicker is an accessible native-component calendar modal supporting start/end range selection, reversed selections, single days, Any date and cancellation. No date-picker package was installed. Local calendar dates are serialized as YYYY-MM-DD without UTC conversion. Search rejects past dates, missing endpoints and identical structured locations. Segment changes preserve other draft values. Home query/country handoff is retained and external filters are reapplied on focus. Keyboard is dismissed before picker/search interactions.

Recent searches use a separate versioned AsyncStorage key, friendie.recent-searches, with a maximum of 10 deduplicated valid submissions. Durable queued writes publish state only after storage succeeds; malformed records are rejected and valid records are bounded on restore. Storage failures remain visible/retryable and do not overwrite unread history. Tapping history restores type, both full location objects, date range and optional query/category. Clear requires confirmation and persists removal. History stores valid search attempts, including attempts made while the backend is unavailable; it never claims server success.

Server state remains in React Query. A valid search invokes the existing listings service using a captured structured route and GPS/manual radius selection. Request serialization and radius validation live in the service, not this screen; no distance calculations were added to presentation. Verified responses produce actual result/empty states in this screen and rows link to the existing ListingDetails destination. Network/server failures are visible and retryable; controls disable during both history writes and network requests.

Backend dependency: listings routes, request keys and paginated DTO are still proposed and API_BASE_URL is empty. LISTINGS_API_VERIFIED defaults false; no unverified request is transmitted. Enable only after confirming the actual Laravel listing contract, including nested From/To IDs/coordinates, date range and radius parameters, and adapting the existing serializer/DTO as needed. The Places proxy contract is also unverified, so the selector uses explicit manual entry/native GPS rather than pretending to offer live city autocomplete. Live search results are not claimed.

Reference differences: no real saved searches are seeded; routes/dates start unset unless restored or selected. The new reusable selector uses structured manual entry because a verified country/city/area catalog was not supplied. Existing system typography is retained; custom device fonts can differ. The reference's decorative route examples are not treated as user history. Existing listing-detail and other unrelated screens remain unchanged. No new packages or Laravel changes.

Changed files:
- src/features/search/screens/SearchScreen.tsx (new)
- src/features/search/screens/SearchScreens.tsx (Search placeholder removed; Filters retained)
- src/features/search/components/SearchDatePicker.tsx (new)
- src/features/search/types/search.ts (new)
- src/features/search/store/searchStore.ts
- src/features/search/store/recentSearchStore.ts (new)
- src/features/location/components/RouteLocationPicker.tsx (new)
- src/features/listings/services/listingsService.ts
- src/navigation/HomeNavigator.tsx
- src/navigation/components/CustomTabBar.tsx
- scripts/configure-env.cjs, generated public environment configuration and .env.example
- jest.setup.js
- test/fixtures/search.ts (new, test-only)
- __tests__/Search.test.tsx, searchHistory.test.ts and searchRequest.test.ts (new)
- __tests__/App.test.tsx (direct-entry Back and tab restoration test)
- docs/SCREEN_07_REPORT.md

Validation: Android arm64 debug build/install passed on Infinix X655C / Android 10 in 1m 27s (407 tasks: 17 executed, 390 up-to-date). Final TypeScript and full ESLint passed with no warnings. Jest passed all 11 suites / 67 tests, covering full-value swapping, segment preservation, required routes, date ranges/reversed selection/Any date, stale place-ID removal after manual edits, error/empty results, bounded/deduplicated history, durable restoration, malformed history, storage failures/retry, clear confirmation, structured GPS/manual radius serialization and verified-endpoint gating. A real-router test verifies direct-entry hardware Back restores Home and its tab bar. Initial tests required a native geolocation mock when its UI was first imported; the mock was added only to Jest setup, with no production behavior changed. Package-guarded device inspection and screenshot confirmed centered header, segments, both cards, floating swap, date row/button and empty history without a tab bar. The shared location modal opened; a calendar day was selected and applied visibly, and hardware Back returned to Home. Full physical manual-entry, GPS permission and backend-search flows are not claimed; these require further device/backend validation. Temporary debug navigation preview was restored to false, and no authenticated session/credential was created. Package-scoped ReactNativeJS/AndroidRuntime errors were empty; git diff --check passed. iOS and additional physical viewport sizes remain unverified.
