# Task 27 — Latest Ads and Listings empty-data analysis

Investigation date: 2026-11-19. Strict read-only investigation; the only new deliverable is this report. Existing dirty files were preserved. Branch: main; inspected HEAD: 9fc4317432d0b8e7c08f287f9922851b337e3151.

## Executive summary and classification

**B — Existing records are excluded by backend visibility rules.** The inspected MySQL database `friendie_logistics` contains **15 listings**, all **Expired (isActive=2)**. All departure dates are in the past: 2024-10-26 through 2025-01-25. Laravel's current UTC date is **2026-11-19**. There are **zero Published listings** and **zero publicly eligible listings**. Both live public endpoints successfully return empty collections. This explains the observed empty results without requiring a frontend mapping defect.

This is not an empty database (A). No evidence establishes a wrong environment (C), backend query malfunction (D), or mapping/rendering defect (E/F) as the cause of these responses. Device connectivity (G) remains independently unverified. The running HTTP process's working directory/database could not be independently inspected because Windows process inspection was denied; HTTP results agree with the inspected backend/database but that agreement alone does not prove process identity.

## Actual public HTTP evidence

Executed from the app workspace using the current generated API base URL, no authentication, no body, no query parameters:

`curl.exe --silent --show-error --connect-timeout 3 --max-time 8 -w '\nHTTP %{http_code}\n' <configured-base>/<route>`

All three returned HTTP 200 without curl errors:

- `/api/v1/home`: `success:true`, message `Home retrieved successfully.`, `data.categories` contains category ID 1, `data.featured_listings:[]`, `data.latest_listings:[]`.
- `/api/v1/listings`: `success:true`, message `Listings retrieved successfully.`, `data.items:[]`, `data.pagination:{current_page:1,per_page:20,total:0,last_page:1}`.
- `/api/v1/categories`: `success:true`, message `Categories retrieved successfully.`, `data.items` contains `{id:1,name:"Food Items",image_url:"http://127.0.0.1:8000/backend/img/category/category-04.jpg"}`.

No listing IDs, listing statuses or listing image URLs were returned because no listing records were returned. No arbitrary listing-details ID was probed. Home has no pagination; backend Latest limit is 8, and the existing frontend carousel presents its first 3. Those limits cannot turn a nonempty eligible set into an empty first page.

## Read-only database evidence

Bootstrapped the existing Laravel application through PHP stdin (`vendor/autoload.php`, `bootstrap/app.php`, Console Kernel bootstrap), then used configuration reads and DB Query Builder **SELECT/count/group/min/max only**. No routes rendering Blade views were invoked, no database tests/migrations/seeds, and no writes were issued.

Connection: mysql; database: `friendie_logistics`; Laravel timezone UTC; `now()->toDateString()` = 2026-11-19. Credentials and customer identities were not printed.

| Measurement | Count |
|---|---:|
| Total post_ads | 15 |
| Pending (0) | 0 |
| Published (1) | 0 |
| Expired (2) | 15 |
| Carring | 10 |
| Send | 5 |
| Past departure dates | 15 |
| Null departure dates | 0 |
| Published AND current/future departure | 0 |
| Complete PublicListingQuery eligible set | 0 |
| Missing owner/category/from-country/to-country/from-city/to-city | 0 each |
| Joined inactive categories | 0 |

Record IDs inspected: 2 through 16 inclusive. No titles, descriptions, names, contact details or customer IDs are included here.

Independent exclusion counts overlap: **15 fail publication status**, **15 fail departure date**, **0 fail category activity**, **0 fail any required join**. These must not be added to claim 30 excluded records. Sequentially, publication excludes all 15, leaving 0 for subsequent date/category/join conditions.

The read-only queries were equivalent to:

```sql
SELECT COUNT(*) FROM post_ads;
SELECT isActive, COUNT(*) FROM post_ads GROUP BY isActive;
SELECT ad_type, COUNT(*) FROM post_ads GROUP BY ad_type;
SELECT COUNT(*) FROM post_ads WHERE isActive=1;
SELECT COUNT(*) FROM post_ads WHERE departure_on < '2026-11-19';
SELECT MIN(departure_on),MAX(departure_on) FROM post_ads;
```

Additional left-join missing-reference counts and the actual public Query Builder count confirmed the relation/visibility conclusions above.

## Public visibility and website comparison

Backend paths are relative to `G:/friendie_logistics_project/friendie_logistics_backend/`.

- `app/Queries/Api/PublicListingQuery.php:13-22`: inner joins require existing owner, category, both countries and both cities. Public visibility requires `ads.isActive=1`, `ads.departure_on >= today`, and `category.isActive=1`.
- No additional owner active/verified condition, ad-type restriction, explicit deleted/hidden flag, or country/city activity filter exists in this public builder. Do not infer undocumented exclusion rules.
- `app/Http/Controllers/Api/V1/ListingController.php:16-33`: optional filters only when supplied; default sort latest (ID descending), page 1, per_page 20, max 50. Our live requests supplied none. Public detail uses the same eligibility query (lines 36-43).
- `app/Http/Controllers/Api/V1/HomeController.php:20-23`: Latest uses that same builder, ID descending, limit 8. Only Featured adds `isFeatured=1` and departure strictly after today. Featured restrictions do not apply to Latest.
- `app/Http/Controllers/PostAdsController.php:70-80,110-117`: existing admin pending/publish workflow, publication sets isActive=1.
- `app/Providers/AppServiceProvider.php:28-38`: existing **Blade view composer** updates past-departure ads to Expired. It was inspected, not invoked by this investigation. This is a possible existing expiry mechanism; historical provenance of each status was not established. The JSON public query deliberately does not invoke it.
- `app/Http/Controllers/FrontController.php:51-64`: the legacy website Home query explicitly includes status 1 **or status 2** and its departure restriction is commented out. Therefore website ads can appear while the mobile public API correctly returns none under its stricter current rules. This is a business-policy difference, not evidence that the mobile should bypass API rules. `routes/web.php:94-95` and `routes/api.php:60-66` route to controllers in this same application, using its default DB connection; a separate deployed website's database was not verified.

## Frontend response path

- `src/services/api/apiClient.ts:5` uses `appConfig.apiBaseUrl`.
- `src/features/home/services/homeApiService.ts:14-20,33-52`: requires HTTP 200 and valid success envelope, maps `data.latest_listings` through `normalizePublicListing`, preserves backend IDs/images. Invalid structure produces an error rather than fabricated empty success.
- `src/features/home/hooks/useHomeData.ts`: focused real-API Home query uses publicHomeKey, AbortSignal, 60-second stale time; returned `latest.data` is `home.data?.latest`. Static branch is inactive in the actual runtime.
- `src/features/home/screens/HomeScreen.tsx:175-182` passes that query to LatestAdsSection and navigates with the returned listing ID.
- `src/features/home/components/LatestAdsSection.tsx:71-99`: existing feedback then FlatList uses `(query.data ?? []).slice(0,3)` and stringified backend-ID keys. No additional eligibility filter. Existing loading/error/empty handling is in `HomeSections.tsx:72-102`.
- `src/features/listings/services/publicListingsService.ts:165-187`: public GET with Authorization suppressed, AbortSignal, strict page envelope/current-page validation; maps `data.items` and preserves `data.pagination`.
- `src/features/listings/hooks/useListings.ts`: query key contains filters/location, passes cancellation signal, 30-second stale time and bounded next-page detection. Old search results use separate cache keys rather than replacing newer search data.
- `src/features/listings/screens/ListingsScreen.tsx:74-86,233-235,290-313`: flattens pages, removes duplicate IDs only, renders existing cards and loading/error/empty states.
- `src/features/listings/store/browseFiltersStore.ts`: default public tab filters `{}` and worldwide location. No silent GPS/Home filters. Explicit filters can further restrict; unsupported filters surface validation errors.
- `src/features/listings/development/staticMarketplace.ts:3-4`: runtime selector returns false. Jest's explicitly mocked fixture mode is test-only. No live fallback to fixtures.

Source inspection finds no field extraction, hidden filter or state reset explaining these server-empty results. This does not constitute physical-device visual verification or proof of every runtime race condition.

## Effective API environment and images

`src/app/config/environment.generated.json:2` currently specifies `http://127.0.0.1:8000/api/v1`; `src/constants/appConfig.ts` spreads that environment for the centralized client. No debug/release-specific JS host replacement was found. Both use this configuration when built from the current generated file; an already installed APK may contain an older bundle and was not inspected.

The host machine successfully reaches port 8000 and API v1. On an emulator or physical device, 127.0.0.1 means that device's own loopback unless a suitable existing transport such as adb reverse is configured. Device reachability/reverse configuration and release HTTP/network-security behavior were not executed or verified. No URL, environment, manifest or transport changes were made. `scripts/configure-env.cjs:28` generates the URL from existing environment configuration; it was read, not run.

`app/Support/Api/PublicData.php:43-84` validates image filenames, file existence, public-directory containment and trusted media base (`api.public_base_url`, fallback `app.url`). The observed category image URL is host-loopback. Listing image correctness cannot be live-tested with an empty listing set; device loading of loopback image URLs remains NOT VERIFIED. Images cannot explain zero records in the HTTP collections.

Windows `Get-CimInstance Win32_Process` was denied by local permissions; no escalation/change was attempted. Running server process/database identity is therefore not independently confirmed beyond matching source/config/query/response evidence.

## Creation and publication lifecycle

`CustomerListingController.php:120-135` creates listings with `isActive=0`, returning HTTP 201 and `Listing created and pending approval.` Private My Listings query (lines 26-28,92-108) scopes by current account, optionally filters status, and does not require future departure/public publication. Thus new Pending records are available through the private read contract but not automatically included in an Active/Published tab. Actual authenticated requests were not performed.

Public visibility requires the existing approval/publication workflow, a current/future departure, active category and intact references. Merely uploading an image does not publish an ad. Publishing one of these old ads without a legitimate date/business update would still fail the public date rule. No listing was created, approved, edited or revived here.

## Expected versus actual

| Layer | Expected | Actual | Evidence | Status |
|---|---|---|---|---|
| Database | Existing records counted | 15 | Read-only SQL | PASS |
| Visibility | Only eligible ads returned | 0 eligible; all expired and past | PublicListingQuery + SQL | PASS |
| GET /home | Latest matches eligible set | empty latest/featured | HTTP 200 | PASS |
| GET /listings | Eligible paginated records | empty items, total 0 | HTTP 200 | PASS |
| Home mapping | Extract latest_listings | Correct source mapping | homeApiService | PASS (source) |
| Listings mapping | Extract items/pagination | Correct source mapping | publicListingsService | PASS (source) |
| Rendering | Cards when records exist | Mock-backed regression checked; live set empty | Jest / source | See verification below |
| Device | Reach configured host and render | Not executed | No device observation | NOT VERIFIED |

## Minimum safe recommendations

No UI or frontend/API mapping change is justified to correct this particular empty dataset. No backend query change is needed to satisfy its current visibility policy. Through a separately authorized normal business workflow, genuine current listings must be created and approved/published with valid departure dates and references. Do not seed fixtures, mass-approve expired listings, bypass expiry, or change dates solely to make cards appear.

If the product intentionally wants expired ads in public browsing like the legacy website, that requires a separate explicit business-policy decision and authorized backend contract change; it is not an automatic bug fix. Separately verify the installed Android build's effective host, transport, image reachability and visual rendering on a device. Preserve truthful empty states meanwhile.

## Current-task verification

Actual current-task executions (no snapshots updated, no test changes):

| Check | Command/result | Exit |
|---|---|---:|
| Complete Jest suite | `node node_modules/jest/bin/jest.js --runInBand --silent` — 102 passed suites, 2 skipped suites, 104 total; 1,506 passed tests, 0 failed, 2 skipped, 1,508 total; 0 snapshots; 196.949 seconds | 0 |
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit` | 0 |
| Scoped ESLint (no fix) | Command below, no diagnostics | 0 |

```powershell
node node_modules/eslint/bin/eslint.js src/features/home/services/homeApiService.ts src/features/home/hooks/useHomeData.ts src/features/home/screens/HomeScreen.tsx src/features/home/components/LatestAdsSection.tsx src/features/listings/services/publicListingsService.ts src/features/listings/hooks/useListings.ts src/features/listings/screens/ListingsScreen.tsx
```

The complete run included passing `homeApi.test.ts`, `homeService.test.ts`, `HomeLiveApi.test.tsx`, `Home.test.tsx`, `allBuildsLiveApi.test.ts`, `Listings.test.tsx`, `ListingDetails.test.tsx`, `listingDetailsService.test.ts`, `guestListingDetails.test.ts`, `createListingApi.test.ts`, and `CreateListing.test.tsx`, plus existing authentication, messaging, profile and other regressions. These are mock-backed automated tests, not live populated-database or physical-device verification. They were executed as part of the full run, not claimed as separate targeted executions.

Historical Task 26 numbers are not substituted for this execution, even though totals match. No build was requested by Task 27 and none was run; no backend feature tests or live mutations were executed. Final git status shows the same pre-existing modified/untracked paths plus only this newly created report; no other task edits were made.

## Scope and gaps

Only this diagnostic Markdown report is created. No React Native, tests, UI, navigation, API configuration, Laravel, website, admin, database, statuses, migrations or fixtures were changed. Existing uncommitted work remains intact. Live authenticated API: NOT VERIFIED. Physical device and visual equivalence: NOT VERIFIED. Exact historical expiry event and identity of any separately deployed website remain unverified.

