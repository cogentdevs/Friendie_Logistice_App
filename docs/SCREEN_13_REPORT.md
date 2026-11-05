# Screen 13 - My Listings

Implemented src/features/listings/screens/MyListingsScreen.tsx in the existing drawer route. No new packages, navigation container, duplicate header or Laravel mutations were introduced. Active UI preview remains enabled with working demo IDs.

UI and navigation:
- Centered navy My Listings native header and Back to Home, white safe-area layout, rounded Active/Completed/Expired segmented tabs with burgundy gradient selection and actual optional counts.
- Memoized white bordered cards display bold origin/arrow/destination, pale-pink Send/Carry type, authoritative status badge, travel date and capacity/parcel weight with explicit units. Active uses centralized soft-green/dark-green tokens. No dates are used to infer status.
- FlatList supports pull-to-refresh, deduplicated paginated rows, stable IDs, loading skeletons, empty states and network/unavailable retry. Existing rows remain visible after ordinary refresh failure; authorization failures hide rows/counts.
- Selected tab is kept per account/preview namespace in Zustand across details navigation. Account changes clear selections. Reads are keyed by account/status and pass AbortSignal.
- Card taps open the existing ListingDetails route with the actual ID and a typed MyListings return destination. Header and Android Back return to My Listings with the same selected status, instead of landing on an unrelated tab. My Listings' own Back goes to Home and avoids a drawer/details history loop.
- Access: Home's preview My Listings action, Messages -> Preview My Listings, or the existing My Listings drawer entry. No user has to supply IDs to preview the screen.

Demo data:
- Active preview contains three Active routes (Karachi-Dubai, Lahore-Riyadh, Islamabad-London), one Completed Send listing and one Expired Carry listing. Statuses are explicit fixture values; counts reflect the fixtures.
- IDs 930001-930005 resolve to matching demo details, including the newly supported completed detail status. Sample ownership remains distinct from a real authenticated user and is labeled UI demo. No API requests or authenticated session are fabricated.

Backend/security limits:
- MY_LISTINGS_API_VERIFIED=false independently gates the proposed authenticated GET /user/listings?status=...&page=... contract. API_BASE_URL remains empty. Verify/map the Laravel DTO, pagination, total/counts and owner scoping before enabling.
- Live reads require real authentication. The request does not accept an arbitrary client-supplied owner ID; the endpoint must scope records from the Sanctum account. Responses with another owner's record, mismatched status or an account change during the read are rejected, rather than merely hiding controls.
- Backend authorization remains mandatory for any future edit/close/delete/renew routes. No verified mutation endpoints/permissions were supplied, so these actions are not exposed and no success is simulated. No destructive action was added, so no artificial delete confirmation is presented.
- This implementation is read-only management/status browsing plus details navigation until the actual mutation contracts exist. Offline failures have retry states; no fabricated offline dataset is used outside explicit preview.

Changed files:
- Replaced features/listings/screens/MyListingsScreen.tsx placeholder
- Added features/listings/components/MyListingCard.tsx
- Added features/listings/services/myListingsService.ts and hooks/useMyListings.ts
- Added features/listings/store/myListingsStore.ts
- Added features/listings/development/demoMyListings.ts; updated shared demo detail resolution
- Updated listingDetailsService (completed state), ListingDetailsScreen (typed return/back), navigationTypes and DrawerNavigator
- Updated HomeScreen and MessagesScreens with preview access links
- Updated theme/palette.json with centralized success badge shades
- Updated API endpoint constants, configure-env, generated configuration and .env.example with the independent read-contract gate
- Added MyListings.test.tsx and myListingsService.test.ts; updated App.test.tsx and ListingDetails.test.tsx
- Added this report and README link

Validation (2026-11-05):
- TypeScript passed; ESLint passed without warnings.
- Focused tests: 3 suites / 15 tests passed for My Listings service, UI and shared details. Covers status counts/filtering, tab restore, pagination deduplication, refresh/retry/empty, unauthenticated/unverified gates, foreign-owner rejection, account switching and authoritative status.
- Real-router App test additionally verifies Home -> My Listings -> Completed/Expired -> Details -> Android Back restoring Expired.
- Android BUILD SUCCESSFUL in 1m 31s; 407 tasks (17 executed), installed/launched on connected Infinix X655C Android 10 arm64.
- Physical visual smoke check was unavailable because Friendie was not foreground; no unrelated UI was inspected. Device custom fonts can differ from the reference. iOS build not run on Windows.
- Final full suite totals recorded below after completion. Existing upstream Gradle deprecation warnings remain.

Final full Jest run: 25 suites / 152 tests passed (104.618s). Final TypeScript validation passed.
