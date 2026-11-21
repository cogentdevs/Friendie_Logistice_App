# Task 26 — Real public API data in every build

Date: 2026-11-19.

## Root cause and original behavior

The bypass was `src/features/listings/development/staticMarketplace.ts::isStaticMarketplaceEnabled` (original lines 3–7): `(__DEV__ || appConfig.staticTestingBuild) && appConfig.staticMarketplaceEnabled`. appConfig's legacy flag is initialized from debug/native build metadata at src/constants/appConfig.ts:16. Authentication did not control that selection.

Execution paths inspected before changes:

| Area | Existing bypass / path | Corrected normal runtime |
| --- | --- | --- |
| Home categories / Latest Ads | useHomeData.ts:35 chooses static Home queries; homeService.latest returns getDemoListings; native static-testing categories use fixtures | Existing getHome → GET /api/v1/home; categories and latest_listings normalized from server |
| Categories selectors | categoriesService.categoriesDataSource consults native flag and central selector | API selector; existing public GET /categories where independently needed |
| Listings tab / Search Results | listingsService.getListings:102 → isListingDemoMode → central selector | Existing GET /api/v1/listings with existing filters/pagination |
| Public Listing Details | listingDetailsService.getListingDetails:46 → same selector → getDemoListing | Existing GET /api/v1/listings/{id} |
| Search and filters | existing validation/UI/query-key branches consult isListingDemoMode | Existing real-API validation/identity mapping in every build |
| Country/city selectors | existing ListingReferencePicker/getListingReferences APIs; filter controls hidden by demo branch | Existing real reference controls/services now active under the normal API branch |
| Card navigation | HomeScreen passes String(id), ListingsScreen passes String(id) to existing ListingDetails | Same routes and parameters, now populated from authoritative server records |

No __DEV__ logging or authentication/UI-preview behavior was removed. The data-selection defect was independent of sign-in; both guests and members had been affected.

## Minimum production changes

1. `src/features/listings/development/staticMarketplace.ts`: existing selector now returns false unconditionally. No runtime demo flag, environment override, host or secondary API client was introduced. Legacy build/config metadata can no longer enable public fixtures, including native STATIC_TESTING builds.
2. `src/features/listings/hooks/useListingDetails.ts`: preserve the existing **private** Demo My Listings preview via the existing getDemoMyListing provider, only for ownListing + actual UI-preview context. Otherwise removing the public gate would have leaked these private fixture IDs into public GET requests. Public listing details always use the existing real service; real authenticated owner details still use their existing private endpoint. No authentication rule, private API contract or new preview mode was added.

No screen/card/component/style/theme/navigation/auth/storage/backend/configuration changes were made for Task 26. Existing public API clients, response parsers, safe media URLs, retry/loading/empty states, query cancellation and filter mapping remain intact. A network error cannot activate a fixture fallback: public reads throw through existing errors and the central selector remains false. Empty arrays remain empty.

## Test-only fixture isolation

Fixture data files were preserved. `jest.setup.js` supplies an explicit Jest-only mock of the old catalogue selector for existing fixture-driven UI scenarios. This is never imported by an app build and adds no production NODE_ENV/test/runtime switch. Fixture expectations are clearly labeled as such in `__tests__/staticMarketplace.test.ts`; their substantive catalogue/privacy assertions remain.

**Production-path tests explicitly unmock that selector** in new `__tests__/allBuildsLiveApi.test.ts` and existing `__tests__/HomeLiveApi.test.tsx`. Home's obsolete test expecting native flags to switch to demo cards was replaced with API-only card, no-fixture and real-ID navigation assertions. Tests cover debug/release × native flag true/false × guest/member with the legacy fixture flag deliberately true, public auth opt-out, Home and Listings IDs/images, real details provenance, HTTP parameters/pagination, network errors, empty results, real card navigation and private-preview fixture-ID isolation.

Task 26 test/setup changes: jest.setup.js; __tests__/allBuildsLiveApi.test.ts (new); __tests__/HomeLiveApi.test.tsx; __tests__/staticMarketplace.test.ts. No tests were deleted or newly skipped. All pre-existing Task 22/23 source/test/report changes and Task 24 report were preserved.

## Backend visibility and cache inspection (read only)

PublicListingQuery::make scopes records to isActive=1 (Published), departure_on >= backend today, and active category, with required owner/location/category joins. Home latest uses that query ordered descending by listing ID, limit 8; featured additionally requires its featured flag and future departure. No client-side fake publication/order was added.

Creation remains HTTP 201 with Pending (0). My Listings/Dashboard invalidation after Create remains unchanged. An uploaded image's existing success path cancels/invalidates corresponding real public Listings/Details/Home keys. A pending newly created listing is not entitled to appear in public Latest Ads. The no-image Create path does not force a public Home refresh; that is consistent with pending records being excluded and was not broadened into an unrelated cache change. Backend approval/status transitions remain authoritative. No live record was created or changed.

Existing publicSearchParams rejects unsupported radius/verified/availability/multi-day and unsupported sort/currency UI payloads rather than pretending they work. Those existing limitations were not changed by this gate fix. Existing API default ordering, supported filters, per-page limits, real reference-ID registry, page tracking and stale-response guards remain unchanged.

Popular Locations is not supplied by GET /home. The existing live-mode unavailable presentation is retained; no fixture popularity data or new layout is substituted.

## Live read-only verification and environment

Using the unchanged configured base URL from src/app/config/environment.generated.json, curl made public GETs only:

- GET /home: HTTP 200, curl exit 0, success:true; 1 category, 0 latest listings.
- GET /listings: HTTP 200, curl exit 0, success:true; 0 public listing items.
- GET /categories: HTTP 200, curl exit 0, success:true.

Response bodies/errors and summary are saved under `.validation/all-builds-live/live-*`. No token/customer credentials were sent, and **no live POST/PUT/PATCH/DELETE occurred**. Because Listings returned no eligible record ID, live Listing Details/navigation with a real populated record was not verified; no example/fixture ID was substituted. Empty server data is not proof that the entire database has no listings.

Configured API host remains http://127.0.0.1:8000/api/v1. Host-machine connectivity is verified above; Android's loopback refers to the device/emulator itself unless an existing appropriate forwarding arrangement is present. No device mapping was verified or changed. Environment variables, manifests, network-security configuration, signing and build variants were left untouched. Release/AAB data selection is covered by source/tests, not by a newly executed release/AAB build.

**PHYSICAL DEVICE / ANDROID LIVE NETWORK / VISUAL VERIFICATION: NOT VERIFIED.**

## Executed verification

Diagnostic directory: `.validation/all-builds-live/`. Final results are recorded below after completion. Android arm64 debug build already completed successfully: exit 0, 2m 19s, 407 tasks (16 executed, 391 up-to-date). It used the existing Gradle cache with approved access; no build settings changed. Existing Gradle deprecation/hard-link fallback notices are retained in android.log.

Initial iterations: Jest rejected the first setup mock's direct __DEV__ reference; it was corrected to the global property in test-only code. Scoped lint then identified globalThis as an unregistered JavaScript lint global; the mock uses existing global instead, without disabling lint rules. First full iteration recorded 1,504 passes, 1 failure, 2 skips (exit 1, 194.546s): the obsolete Home static-card assertion was still present while its suite had been switched to the real selector. That assertion has been replaced with the required API-only expectation; subsequent focused tests passed. No production behavior was weakened to satisfy it.

Additional preserved diagnostic runs:

- Initial targeted Home/Listings/details/guest/Create/auth/filter selection: 10 suites, 9 passed/1 failed, 169 tests passed/15 failed, exit 1, 32.103s. Home's `route search validates, carries structured IDs/coordinates and weight, and never requests GPS` exceeded its existing 5-second budget; subsequent tests in that file cascaded with overlapping act/unmounted-renderer errors.
- Next full iteration: 101 suites passed/1 failed/2 skipped; 1,503 tests passed/3 failed/2 skipped; exit 1, 202.178s. Home passed, while three existing App tests exceeded 5 seconds: `Home dashboard uses the real first name and routes every action through existing navigators`; `static marketplace browsing stays public while request, Post and Messages still require login`; `public Listings filters are isolated from intentional Home search and radius preferences`.
- The fixture mock now captures its configuration module once, matching the prior provider pattern, rather than performing repeated require lookups on every selector call. No timeout, assertion, test skip or production navigation change was made. Timing variation/resource effects were observed; no CPU profile proves a sole cause.
- Final isolated navigation/Home/production-selector selection: **4 suites, 100 tests passed, 0 failed, exit 0, 65.509s**. This includes App, Home, HomeLiveApi and allBuildsLiveApi, with both live suites explicitly unmocking the production gate.
- Final focused live suites: **2 suites, 27 tests passed, 0 failed, exit 0, 42.374s**. This run overlapped the native build; no focused test failed.

Final verification commands (app root unless noted):

```powershell
node node_modules/jest/bin/jest.js --runInBand __tests__/App.test.tsx __tests__/Home.test.tsx __tests__/HomeLiveApi.test.tsx __tests__/allBuildsLiveApi.test.ts --json --outputFile=.validation/all-builds-live/navigation-final.json
node node_modules/jest/bin/jest.js --runInBand --json --outputFile=.validation/all-builds-live/full-verified.json
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/features/listings/development/staticMarketplace.ts src/features/listings/hooks/useListingDetails.ts jest.setup.js __tests__/allBuildsLiveApi.test.ts __tests__/HomeLiveApi.test.tsx __tests__/staticMarketplace.test.ts
# Working directory: android
.\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain
```

The final complete suite and final static-check results are recorded after execution below. The full run includes actual CreateListing UI/service, protected actions, Listing Details, Profile/avatar, authentication, Messages and Search regressions; initial narrower selections are not presented as a substitute for it.

### Final executed results

| Verification | Result | Exit |
| --- | --- | --- |
| Focused production Home/API suites | 2 suites, 27 passed, 0 failed; 42.374s | 0 |
| Isolated App/Home/navigation/production-selector regression | 4 suites, 100 passed, 0 failed; 65.509s | 0 |
| Complete final Jest (`full-verified.log/json`) | 102 suites passed, 0 failed, 2 skipped; **1,506 tests passed, 0 failed, 2 existing skips**, 1,508 total; 143.075s | 0 |
| Final TypeScript (`typecheck-verified.log`) | no errors | 0 |
| Final scoped ESLint (`eslint-verified.log`) | no errors/warnings | 0 |
| Android arm64 debug (`android.log`) | BUILD SUCCESSFUL, 2m 19s, 407 tasks (16 executed, 391 up-to-date) | 0 |
| git diff --check | clean; Windows newline notices only | 0 |

The 1,490 historical passing cases increased by 16 new production-selector cases; no tests were removed or newly skipped. Full verification ran after the fixture-mock lookup correction, separately from the native build. App passed in 45.102s; no navigation timeout remained in this final run. Existing act-warning console output was retained rather than suppressed.

Debug APK: android/app/build/outputs/apk/debug/app-debug.apk. No install, physical-device test, populated live listing navigation, release APK or AAB build was performed. Public read-only HTTP checks succeeded on the configured development host; these do not prove that an Android device can reach its own configured loopback address.

## Scope confirmation

Only the central public data gate and necessary private-preview ID safety binding changed in production. No UI/style/layout/component/route changes, no API request/response contract changes, no auth business-rule changes, no backend/website/admin/database/schema/migration/status changes, no new endpoints, no new runtime demo switch, no fixture fallback on API failure. Live populated-listing/device verification remains limited as stated above.
