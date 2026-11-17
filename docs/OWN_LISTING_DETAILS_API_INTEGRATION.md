# Private My Listing Details — read integration

## Verified contract

Sources: `docs/API_REFERENCE.md`, sibling Laravel `routes/api.php` and
`app/Http/Controllers/Api/V1/CustomerListingController.php` (read only).

- `GET /api/v1/customer/listings/{id}`; positive integer listing ID.
- Existing centralized Axios base URL already includes `/api/v1`.
- Real Bearer token; eligible customer middleware. No body or query parameters.
- HTTP 200: `{success: true, message: "Your listing retrieved successfully.", data: listing}`.
- Controller scopes `created_by` to the authenticated customer. Missing/non-owned IDs
  return 404. Response header: `Cache-Control: no-store, private`.
- Authentication/eligibility can return 401/403. Shared error normalization handles
  422/429/server/network/timeout errors without fabricating data.

The listing DTO is the **same serializer as My Listings**, reused through
`ownListingApiSchema`: `id`, nullable category/country/city IDs, `ad_type`, nullable
`title`, `description`, `from_area`, `to_area`, `currency`, `departure_on`, `reached_on`,
`created_at`, `updated_at`, nullable `weight`, `weight_price`, `image_url`, numeric
`status`, boolean `is_featured`, integer `show_contact_info`.
No country/city/category names, owner identity/contact details, chat authorization or
request authorization are returned. Frontend owner ID comes from the captured real
session; it is not claimed as a response field.

## Source selection and mapping

Existing My Listings cards already navigate to ListingDetails with `listingId` and
`returnTo: 'MyListings'`. The shared details hook uses that existing route context
to select the authenticated owner read. Public Home/Listings/Search routes continue
using their existing source, gates and fixtures. Explicit local demo preview retains
its existing local details path and does not call the private API.

- `Carring` → `carry`; `Send` → `send`.
- Status 0 → `pending`; 1 → existing presentation `active` (Published); 2 → `expired`.
  Original numeric status is retained. Pending is never Completed.
- Title, area labels, departure date, weight in kg, price/currency and image URL
  bind to the existing details UI. Missing area labels use "Location unavailable";
  missing weight/date/price use existing unavailable/not-provided presentations.
- Backend image URL is used directly, including permitted HTTP development URLs.
  Real private details never substitute the demo destination photograph or demo copy.
- Entire verified DTO stays in `backend`, including description, arrival date,
  reference IDs and timestamps. The unchanged existing layout does **not** contain
  dedicated description, arrival-date or status display rows; no new rows were added.
  Country/city names cannot be displayed from this response alone.
- No traveller/profile/rating/contact information is invented. Contact protection,
  existing owner Manage Listing navigation and request ownership checks remain.

## Session/cache/error safety

- Reuses centralized Axios, existing Keychain storage and existing auth store.
- Captures the actual Bearer token and checks auth identity, abort signal and token
  before accepting the response. A mismatched response ID or invalid shape fails.
- Guest/demo sessions cannot call the private service. Private query keys are
  `['ownListingDetails', currentUserId, listingId]`; demo/guest keys are separate.
- Existing logout/account-change cleanup cancels and clears the QueryClient cache;
  no duplicate store, persistence, auth lifecycle or API client was introduced.
- Existing skeleton, error, unavailable and Back UI are reused. Initial loading
  emits no success/error toast. Explicit retry uses one in-flight operation and the
  existing `react-native-toast-message` error presentation; unmounted/stale/cancelled
  operations cannot notify. Existing shared retry policy applies to network/server
  failures only. 404 remains the existing Listing unavailable state.

## Scope and remaining verification

No Laravel/database changes, mutations, status transitions, public Listings API,
reference APIs, authentication API changes or screen style changes.

Automated tests use the actual centralized Axios instance with a controlled adapter,
not a live server token. See validation results reported with this task. Real
authenticated backend ownership/404 behavior and physical-device navigation/image
rendering still require a reachable backend and a real account; no live success or
device visual verification is claimed.

Next Profile dependency: inventory remaining private module actions before selecting
another API. Listing edit/image mutations require a separate authorized task; they
are not implemented by this read integration.

## Files and executed validation

Created:
- `src/features/listings/services/ownListingDetailsService.ts`
- `__tests__/ownListingDetails.test.ts`
- This report.

Modified:
- `src/features/listings/hooks/useListingDetails.ts` — source/key/session selection.
- `src/features/listings/screens/ListingDetailsScreen.tsx` — private source context,
  actual image, missing price and guarded explicit retry feedback; styles unchanged.
- `src/features/listings/services/listingDetailsService.ts` — helper argument types
  accept the private presentation model; public validators and reads unchanged.
- `__tests__/ListingDetails.test.tsx` — private route/image/key assertions and cleanup.

Executed November 17, 2026:
- `npm run typecheck`: passed.
- ESLint on all six changed/new TypeScript files: passed.
- Final regression run: **26 suites, 356 tests passed** (40.903 seconds), including
  My Listings, Dashboard, Reviews, auth/profile, avatar, Drawer and public details.
  Jest printed its delayed-exit/open-handles warning after the test summary.
- An earlier concurrent run timed out in a screen test and cascaded into renderer
  failures. Isolated screen rerun passed all 15 tests; the final regression run
  above passed with a 60-second per-test limit.
- Android `app:assembleDebug -PreactNativeArchitectures=arm64-v8a`: **BUILD SUCCESSFUL**,
  5m35s, 407 tasks (30 executed). Native hard-link copy fallback/deprecation warnings
  were nonfatal. No device install or UI test was performed.
- Details screen StyleSheet matched its pre-task version; `git diff --check` passed.
- No successful live authenticated request was executed; no credentials supplied for
  this read-only endpoint verification. Automated transport tests use an Axios adapter.

Logs: `.validation/own-detail-verified.log`, `own-detail-types.log`,
`own-detail-lint.log`, `own-detail-test-lint.log`, `own-detail-android.log`.
