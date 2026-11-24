# Search and advanced filters: targeted corrections

## Control inventory and actual query contract

| Existing control | State | Laravel query / behavior |
| --- | --- | --- |
| Home keyword / retained Search keyword | query | trimmed search, maximum 100 characters |
| Home Category selector | category | category_id, actual API numeric identity |
| Carry / Send | type | ad_type = Carring / Send |
| Home Weight | weightKg | weight, optional exact integer, 0 remains valid |
| From / To route | from / to | verified available numeric country/city IDs; GPS text cannot substitute IDs |
| Advanced From Country / City | routeReferences.from | from_country_id / from_city_id; country-only allowed |
| Advanced To Country / City | routeReferences.to | to_country_id / to_city_id; country-only allowed |
| Location-directory destination | destinationCountry | to_country_id |
| Home date / Search exact date | dates or legacy date | departure_on; exact date only |
| Search date range | dates.start/end | multi-day ranges unsupported; rejected, never silently reduced to one day |
| Worldwide | location.mode | no geographic query restriction |
| GPS/manual radius / radius target | location selection + radiusTarget | unsupported by current public API; Apply reports unavailable rather than inventing radius filtering |
| Verified-only / Available-now | verifiedOnly / availableNow | unsupported public query flags; Apply rejects them |
| Currency selector | not present in inspected Search/Filters | no currency filter in current Laravel listing query contract |
| Sort selector | not present in inspected Search/Filters | backend supports sort, but no new control/query feature was invented |
| Results filter chips | current Search or Browse scope | remove corresponding state; query-key change starts page 1 |
| Advanced Reset / Back | local advanced draft | Reset prepares worldwide/cleared route/flags; Apply commits; Back without Apply preserves existing applied filters. Existing keyword/category/basic form values are retained by design |

`GET /api/v1/listings` supports search, category_id, from/to country/city IDs, ad_type, weight, departure_on, sort, page and per_page (maximum 50). Existing centralized Axios uses public Authorization:false and forwards cancellation. Public data has no client-side fabricated filtering or fixture fallback. Source inspection of Laravel ListingController and PublicListingQuery was read-only; published status1, departure >= server today, active category and existing joins remain authoritative.

## Defects and minimal changes

1. Real Search incorrectly required both route locations even though Laravel permits keyword-only/no-route/partial-route queries. Search now lets publicSearchParams validate optional real-mode filters; demo validation is preserved. Invalid/unsupported queries still fail before network.
2. Results only built a removable route chip from legacy from/to, leaving advanced routeReferences active without a visible removal action. The existing route chip now displays country/city reference labels and clears all directional representations together, including a destination-country alias. No new filter screen/layout/style.
3. Date chip removal cleared dates but left legacy date, which could reintroduce departure_on. Existing date chip now handles either representation and clears both. Search submission and the handoff to advanced Filters also clear the legacy date alias when using the current date control.

Country-dependent city clearing, selectable searchable API references, Clear controls, applied-draft separation, independent Browse scope, query-key pagination reset, requestEpoch guards and cancellation are existing behavior retained and covered by regression. Unsupported controls remain limitations; they are not claimed to have gained Laravel support.

## Files and verification

Source: `src/features/search/screens/SearchScreen.tsx`, `src/features/listings/screens/ListingsScreen.tsx`.
Focused tests: `__tests__/Search.test.tsx`, `__tests__/Listings.test.tsx`.
This report. Prior unrelated working-tree edits are preserved. No backend/database/API contract, theme, navigation structure, dependency or shared keyboard/selector changes.

Initial focused run: 95 passed / 3 failed across 7 suites (84.997s, exit 1). New test setups initially used the wrong Search/Browse scope and changed applied state after mounting rather than modeling a new Search entry. Fixtures were corrected without weakening the assertions. A following run had 90 passed / 8 failed (108.082s, exit 1), starting with 5-second timeout failures and subsequent renderer errors.

Isolated command `node node_modules/jest/bin/jest.js --runInBand --silent __tests__/Search.test.tsx __tests__/Listings.test.tsx`: **2 suites / 17 tests passed**, 43.675s, exit 0. Existing FilterRoutePickers, HomeLiveApi, Filters, searchFiltersContract and filterLocation suites passed in both focused runs. No test was skipped, removed or given an increased timeout. Isolated success does not establish a precise cause of earlier timing failures.

Full command `node node_modules/jest/bin/jest.js --runInBand --silent`: **exit 1**, 106 suites passed, 1 failed, 2 existing skipped (109 total); **1,621 passed, 7 failed, 2 existing skipped tests** (1,630 total), 287.352s. Three new focused cases explain the inventory increase from 1,627. Failures all occurred in Listings.test.tsx, beginning with the new route-chip case exceeding 5 seconds, followed by renderer/missing-control/mock-call errors in existing cases:

- advanced route chip removes all directional identities and resets to first-page query
- real count, verified card, details, deduplicated pagination and filter removal
- failed request exposes retry, no invented count, then empty state
- guest save is blocked; authenticated bookmarks persist locally and toggle
- a late previous-filter response cannot replace current results
- a failed device bookmark write does not claim a saved listing
- default public tab ignores Home filters and saved radius, paginates all eight, and preserves Home state

These cases passed in the isolated Search/Listings run above. Full-suite health is **not green**; the exact cause of the full-run timing/cleanup sensitivity remains unresolved. No assertion weakening, newly skipped tests or artificial timeouts were used.

`node node_modules/typescript/bin/tsc --noEmit`: exit 0, no diagnostics. Scoped ESLint on the two changed screens and their two test files: exit 0, no diagnostics.

Android command in `android`: `.\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain` — **BUILD SUCCESSFUL**, exit 0, 2m47s, 407 tasks (30 executed, 377 up-to-date). Existing Gradle deprecation warnings remain.

Logs `.validation/search-filters-fix/`: `typescript.log`, `eslint.log`, `android-build.log`, `focused.log`, `focused-final.log`, `search-listings-isolated.log`, `full-jest.log`. Automated requests are mocked. LIVE API / PHYSICAL DEVICE: NOT VERIFIED. Full-suite timing/cleanup failures remain a limitation; no live runtime correctness or pixel-equivalence claim is made from these tests alone.
