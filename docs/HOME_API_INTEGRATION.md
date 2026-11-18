# Home API integration

## Inspection and verified contract

Task: Home API integration, 18 November 2026. The screen-wise audit was checked against HomeScreen, HomeSections, LatestAdsSection, useHomeData, homeService, category/public-listing services, navigation, static-marketplace gates, authentication cleanup and existing tests. Before this change, categories used their separate service, while Latest Ads and Popular Locations depended on gated static fixtures or unavailable states. Home search already navigated to Results; category selection used the existing category filter; listing cards navigated to ListingDetails.

Laravel was inspected read-only in the sibling backend: routes/api.php, HomeController, PublicData and PublicListingQuery. No backend files were changed.

- Public `GET /api/v1/home`; no request body or query parameters.
- HTTP 200: `{ success: true, message: string, data: { categories: [], featured_listings: [], latest_listings: [] } }`.
- All three collections are present and may be empty. No pagination.
- Categories: active records, ordered by name then ID, limit 12. Fields: integer `id`, nullable `name`, nullable absolute HTTP(S) `image_url`.
- Latest listings: public query, descending listing ID, limit 8. The backend requires published/active listing, active category, and departure date today or later.
- Featured listings: public query plus featured flag and departure strictly after today, descending ID, limit 8.
- Listing fields reuse the existing public DTO: `id`, `ad_type` (`Carring`/`Send`), nullable `title`, `short_description`, `image_url`, category identity/name, origin/destination country/city identities/names, nullable weight/price/currency/dates, `is_featured`, `created_at`, and public owner identity/display name/image. No private phone/contact fields or listing status are supplied.
- Image URLs come from the existing backend media resolver. The frontend neither invents URLs nor appends cache-busting timestamps.

**Backend limitation:** Home returns no popular locations, location popularity/ranking/counts, or separate countries/cities collection. Live Popular Locations therefore uses the existing unavailable feedback with truthful copy and no ineffective Retry. No unrelated reference API is substituted for popularity. Featured data is parsed but no new section is added.

## Implementation and files

Created:

- `src/features/home/services/homeApiService.ts`: typed, validated response using existing category/public-listing schemas and normalized public listing model. Uses the existing Axios instance and endpoint registry, explicit `Authorization: false`, AbortSignal, exact HTTP 200 validation, no parameters/body. Invalid responses become ApiError rather than successful fixtures.
- `src/services/api/publicHomeCache.ts`: exact public aggregate query-key predicate; no duplicate store.
- `test/fixtures/home.ts`: shared contract fixture with dummy public identities.
- `__tests__/homeApi.test.ts` and `__tests__/HomeLiveApi.test.tsx`: focused service, cache and existing-screen coverage.
- This report.

Modified:

- `src/services/api/endpoints.ts`: `/home` registration.
- `src/features/home/services/categoriesService.ts`: export the existing category schema for reuse; standalone categories contract unchanged.
- `src/features/listings/services/publicListingsService.ts`: export/rename the existing public-listing normalizer; mapping and service contracts unchanged.
- `src/features/home/hooks/useHomeData.ts`: one aggregate live query feeds Categories and Latest Ads; shared refresh/retry; existing demo branch retained.
- `src/features/auth/services/sessionLogout.ts`: retain only the exact public Home query during cleanup; still remove private/other queries and clear mutation cache, drafts and existing account state.
- `src/features/post-listing/hooks/useUpdateListing.ts` and `src/features/listings/hooks/useRemoveListingImage.ts`: include public Home in existing authoritative public-data invalidation. Existing create/upload prefix invalidation already reaches this key.
- `__tests__/Home.test.tsx`: update the fixtures-disabled case to the live aggregate contract and truthful unavailable location feedback.

The working tree already contained earlier listing/avatar work. Those changes were preserved; this list describes the Home task only. Starting branch: main; HEAD: `25b3ed5592780aad3b9662feab581c2ae2fdf19f`. Initial status is recorded in `.validation/home-api/status-before.txt`.

## Data binding, guest behavior and navigation

Backend order and real IDs are preserved. Category IDs are converted to the existing string model; nullable names remain unavailable/empty rather than fabricated entities. Listings use the existing public normalizer, including zero numeric values and nullable fields. Existing Latest Ads renders its first three records; View All and public ListingDetails remain unchanged. The details service still fetches authoritative details and establishes protected-action provenance; a Home card is not treated as proof of ownership.

Guest and authenticated live sessions use the same public query. No secure-token lookup or login gate is needed for Home. Public HTTP errors do not invalidate an authenticated session. Guest pull-to-refresh does not explicitly refetch the private profile. Existing protected posting/messaging/review actions remain guarded.

Search text and category IDs follow existing Results routes without new Home query parameters or Search/Filters expansion. Full Search/Filters completion remains a separate task.

Existing development/static marketplace gates are preserved. When that gate enables static marketplace mode, Home retains its previous demo services and listing-detail compatibility. Normal live mode uses the aggregate API and never falls back to fixtures on failure. Native static-testing mode and live data have separate keys/projections. Plain debug's pre-existing real-category/fixture-listing compatibility limitation remains unchanged; no guessed fixture-to-backend ID mapping was introduced.

## Lifecycle, errors, cache and notifications

The aggregate query uses the existing focus lifecycle, 60-second stale policy, cancellation signal and disabled automatic retries. Categories and Latest Ads share `['home', 'latest', 'api']`; explicit concurrent retries/refreshes share one promise with `cancelRefetch: false`. No fetch occurs on each render. Query cancellation protects late results; explicit retry Toasts also check mounted/focused state and mode generation.

Loading, empty and error presentation reuse existing components. Automatic load failures do not emit Toasts. Explicit retry/refresh failure emits one safe error Toast through the existing react-native-toast-message root/configuration; no server exception text, success Toast, duplicate notification library or styling change. A failed refresh retains valid data internally, though existing error UI hides cards rather than falsely treating cached records as fresh success.

Public Home contains no customer summary; existing useProfile state stays separate. Logout/account cleanup retains only the exact public Home key (not lookalike/extended keys), while private query data and mutations are cleared. Public listing mutations invalidate this aggregate through existing invalidation mechanisms. No private record is copied into it.

## Verification

Logs and structured results: `.validation/home-api/`.

- Initial focused run: `node node_modules/jest/bin/jest.js --runInBand` with homeApi, Home, homeService, categoriesApi and sessionLogout suites: **5 suites, 67 passed, exit 0**, 42.156 seconds.
- UI/cache focused run: HomeLiveApi, homeApi, Home, staticMarketplace, logoutApi and sessionLogout: **6 suites, 83 passed, exit 0**, 25.162 seconds. This run exposed a test-client GC timer warning; the new test client was corrected to use existing test convention `gcTime: 0`, without altering production cache policy.
- Regression: `node node_modules/jest/bin/jest.js --runInBand --detectOpenHandles` with selected Home/public details/create/update/image-delete/category/static/auth/logout suites, `--json --outputFile=.validation/home-api/regression.json`: **16 suites, 321 passed, 0 failed/skipped, exit 0**, 45.13 seconds; no lingering-handle warning. Exact executed suite names are in regression.json; unmatched requested publicListingsApi/PublicListings/listingReferences filenames were not counted as executed suites.
- New tests verify exact public request, no body/params/token access, response validation, IDs/order/zero/null values, private-extra stripping, empty responses, HTTP/network/timeout errors without automatic retry, aborts, public cache retention/private cleanup, existing card rendering/navigation/search, shared retry/refresh, guest behavior, mode separation and late-feedback suppression.
- TypeScript: `node node_modules/typescript/bin/tsc --noEmit`: **exit 0**. An initial refresh-promise array inference error was corrected with a typed `Promise<unknown>[]`; the successful rerun is recorded in typecheck.log/exit.txt.
- Scoped ESLint: `node node_modules/eslint/bin/eslint.js` over the 13 changed/new source/test files: **exit 0**, no output; eslint.log/exit.txt.
- Full Jest: `node node_modules/jest/bin/jest.js --runInBand --json --outputFile=.validation/home-api/full.json`: **95 suites passed, 2 existing suites skipped; 1,386 tests passed, 0 failed, 2 existing tests skipped; exit 0; 195.647 seconds**. No tests were deleted or newly skipped. The current pre-Home baseline was 1,356 passing tests; the 30 new Home tests explain the increase (the prompt's 1,305 was historical). Full output retains existing React `act(...)` warnings in App tests; warnings were not suppressed.
- Android arm64 debug build: from `android`, `.\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain`: **BUILD SUCCESSFUL, exit 0, 4m 11s; 407 tasks, 30 executed and 377 up-to-date**. Log: android-arm64.log/exit.txt. Existing Gradle deprecation warnings and cross-drive hard-link fallback-to-copy warnings remain; no build configuration changes were made.

HomeScreen, HomeSections and LatestAdsSection were compared with pre-task snapshots and are byte-for-byte unchanged (`ui-preservation.json`). No JSX/styles/navigation files were changed for this task. This proves source preservation, not rendered visual equivalence.

## Live verification and limitations

A fresh guest request through curl to the configured API base plus `/home` returned **HTTP 200, curl exit 0**. The real envelope matched: one category, zero featured listings, zero latest listings. Evidence: live-home.log, live-home-response.json and live-home.exit.txt. No customer credentials or mutation were used.

**LIVE HOME API: VERIFIED for the public GET response only.** Live nonempty listing rendering/detail navigation could not be verified with the returned empty listing collections. Unit integration tests cover those bindings using verified-contract fixtures.

**LIVE AUTHENTICATED API: NOT VERIFIED.**

**PHYSICAL DEVICE: NOT VERIFIED.**

**VISUAL EQUIVALENCE: NOT VERIFIED.** No screenshots/device rendering comparison was performed.

Remaining dependencies: backend popularity data for Popular Locations; separately scoped Search/Filters completion. No invented workaround, new UI, unrelated endpoint or backend change was added.

## Scope confirmation

No Laravel, website, admin, database, schema, migration, status/business-rule, environment/host, dependency, navigation or Home UI styling changes. Existing centralized Axios, Toast, public-listing/category models and query architecture were reused.
