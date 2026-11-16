# My Listings read/list integration

## Scope and actual UI

Existing MyListingsScreen has Active / Completed / Expired tabs, selected-tab
counts, route/type/status/date/weight cards, existing detail navigation, infinite
scroll, pull-to-refresh, skeleton, empty state and retry/footer. No search or
Send/Carry filter controls exist on this screen; no new controls were added.
MyListingCard does not currently display title, description, price or image, so
those backend fields are preserved in the model without adding UI.

Before this task, demo sessions used demoMyListings; real reads were gated by
myListingsApiVerified and a proposed `/user/listings`/`data`+`meta` contract. The
verified API differs in route, DTO, enum and pagination. No real-to-demo fallback
was added. Existing demo data and status presentation remain unchanged.

## Verified API

GET `/api/v1/customer/listings`, real Bearer token, no body. Read-only contract
verification: saved API_REFERENCE.md, routes/api.php, CustomerListingController
index/serialize/query, PublicData::input/page/paginationRules. Endpoint registry
now uses `/customer/listings` relative to the existing /api/v1 base URL.

Supported query keys:
- page: 1..100000; per_page: 1..50 (default 20).
- status: 0 (Pending), 1 (Published), 2 (Expired).
- ad_type: exact backend `Carring` or `Send`.
- search: title search, 1..100 characters.
- sort: latest (default, ID descending), oldest (ID ascending), departure.
No separate Send/Carry read endpoints exist. No user ID/owner parameter is sent;
Laravel scopes created_by to the authenticated current user.

HTTP 200:
```ts
{
 success: true; message: string; // Your listings retrieved successfully.
 data: {
  items: Array<{
   id: number; category_id: number|null;
   ad_type: 'Carring'|'Send'; title: string|null; description: string|null;
   from_country_id: number|null; from_city_id: number|null; from_area: string|null;
   to_country_id: number|null; to_city_id: number|null; to_area: string|null;
   weight: number|null; weight_price: number|null; currency: string|null;
   departure_on: string|null; reached_on: string|null;
   status: 0|1|2; is_featured: boolean; show_contact_info: number;
   image_url: string|null; created_at: string|null; updated_at: string|null;
  }>;
  pagination: {current_page:number;per_page:number;total:number;last_page:number};
 }
}
```

Image URL is absolute HTTP(S) or null. Price is weight_price (per Kg on the existing
website), not a computed total/budget; weight is Kg. No owner identity joins,
phone/contact details, category/country/city names or per-status counts are returned.
The private no-store response is not a public listing authorization decision.
Unknown types/statuses/malformed records are rejected rather than misclassified.
Existing 401/403/404/422/429/5xx/network/timeout normalization is reused.

## Important compatibility limitation — not silently resolved

Active maps to backend Published (1); Expired maps to Expired (2).
**Completed has no backend equivalent. Pending (0) is NOT Completed.**
Real Completed selection therefore displays a clear unsupported-status error in
the existing error panel, and sends no HTTP request. Pending is supported/preserved
by the raw read service, but cannot be displayed in an appropriately labelled tab
without a separately approved UI/status-label change. No Pending/Completed
mislabeling, invented empty success, new tab or status transition was introduced.
This prevents claiming full tab/status parity is complete under the current rules.
Demo Completed fixtures remain local to the explicit existing preview behavior.

The API supplies location IDs/area text, not city/country names. Available from_area
and to_area populate existing route text. Missing areas use explicit 'Location
unavailable'; IDs remain preserved in typed backend data. No static catalogue IDs
or invented city names are mixed in, and no reference APIs were implemented.

## Files and model mapping

Created:
- src/features/listings/types/myListingsApi.types.ts: exact private DTO/filter schema.
- src/features/listings/services/myListingsApiService.ts: getOwnListingsPage, one
  authenticated read boundary, existing Axios client/session/token lifecycle.
- test/fixtures/myListings.ts: test-only verified-contract fixture.
- docs/MY_LISTINGS_API_INTEGRATION.md.
- __tests__/MyListingsDashboardConsistency.test.tsx: no extra Dashboard calls/count changes.

Modified:
- src/services/api/endpoints.ts: correct own-list collection path.
- src/features/listings/services/myListingsService.ts: existing demo branch retained;
  real Active/Expired read adapter; unsupported Completed class and safe messages.
- src/features/listings/hooks/useMyListings.ts: private cache/lifecycle, query reuse,
  guest gate and guarded one-flight explicit operation/error Toast.
- src/features/listings/screens/MyListingsScreen.tsx: existing error text uses safe,
  accurate feedback (including unsupported Completed); styles/navigation unchanged.
- __tests__/myListingsService.test.ts: replaced obsolete proposed-contract assertions
  with real DTO/header/type/status/session/error cases.
- __tests__/MyListings.test.tsx: real Axios adapter card rendering, retry/cache/status
  limitation and existing UI/pagination/navigation regressions.

Mapping:
- id preserved; ownerId is captured authenticated session scope (not a fabricated
  server response field; API itself does not return created_by).
- Carring -> carry; Send -> send. Unknown enum rejected.
- status numeric preserved under backend; presentation active/expired only as above.
- title/description, dates, IDs, price, currency, image, raw status/flags/timestamps
  preserved in typed backend record. No dates/status inferred from current time.
- category name remains null because no category name is returned.
- price/currency stay null when missing (no fake 0/USD).
- departureDate uses actual departure_on; missing date triggers existing formatter's
  Date unavailable state. Exact raw nullable value remains under backend.
- weight maps to existing capacityKg and Kg weight display only when provided.
- No phone disclosure is inferred from show_contact_info; no contact value is returned.

The old myListingsApiVerified switch is no longer used by the now-verified read
path; generated environment files were not edited. Auth/secure-token checks remain
mandatory. No mutation, private detail, reference, public-listing or other endpoint
was integrated. Existing detail callback/navigation is preserved; opening private
or unpublished details may still require the separately scoped own-detail feature.

## Caching, pagination, authentication and Toast

Existing React Query infrastructure: real key ['myListings.read','user:<id>',status]
separates the verified private DTO from the old proposed cache and prevents legacy
Dashboard invalidation-on-read from issuing duplicate summary requests. Demo keeps
its existing ['myListings','demo',status] cache. Selected-tab store remains unchanged.
30-second freshness, focus enabling, separate account/status pages, existing single
transient retry policy and infinite pagination are preserved. Existing view dedups
cross-page IDs; service rejects duplicates within a page, mismatched page/size/type/
status and invalid filters. Total is authoritative pagination.total, never page length.
Unrequested status counts are unknown rather than invented; no three extra count calls.

Guest direct API is rejected before token/HTTP; demo cannot call real raw API and
continues using only existing sample fixtures. Real sessions never use fixtures.
Captured auth-user reference, secure token recheck, AbortSignal, conditional
missing-token cleanup and existing Axios 401 policy protect logout/account/re-login/
token/abort races. Existing private logout cache cleanup cancels/clears this data.
Temporary network/server failures do not destroy session.

Explicit retry/refresh/load-more operations share one promise and use existing
react-native-toast-message Toast.show(error), safe messages and current global
styling. Automatic loads do not show success Toasts. Unmounted/changed-session
callers cannot emit late Toasts. No new notification system or Alert/Snackbar.

## Dashboard and remaining completion checklist

Dashboard Active Listing remains data.listings.published from its existing summary
API. Own-list totals/pages do not alter it. Dedicated combined-hook test verifies
list fetch/refetch produces exactly one Dashboard request and preserves its count.
Public Listings/static marketplace, Home, Categories, My Reviews and Visitor Review
code are untouched; regression tests cover the existing integrations.

1. Compatible own-list reads: implemented for Active/Expired.
2. Pending/Completed tab mismatch: requires product/UI-label approval; backend
   behavior must remain unchanged. No status-changing action is authorized here.
3. Human-readable city/country names: future reference API/cache integration or an
   independently verified expanded read contract; not invented from IDs here.
4. Private own-list details: separate next read integration, preserving route design;
   list-only scope does not implement GET /customer/listings/{id}.
5. Create/Edit/Delete/archive/publish/status/image mutations remain out of scope.
6. Next Profile read feature: own-list detail integration, after resolving the
   status-display limitation. No automatic listing/request submission or mutation.

Live authenticated data/device rendering cannot be claimed without an actual real
session request. No token was supplied or extracted and no Login API was called.
Executed validation and live reachability results follow below.

Executed validation (2026-11-16):
- Final own-list service/UI, Dashboard consistency, static marketplace, My Reviews,
  Visitor Review, Dashboard, Auth/Profile/avatar/Drawer/logout regressions:
  22 suites, 297 tests passed (`.validation/ownlist-verified.log`). Includes the
  adapter await-gap session race and real Axios-backed Carry/Send card rendering.
- npm run typecheck: passed (`.validation/ownlist-types-verified.log`).
- Scoped ESLint: passed (`.validation/ownlist-lint-verified.log`).
- Android arm64 debug gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain:
  BUILD SUCCESSFUL in 2m17s (`.validation/ownlist-android.log`).
- MyListingsScreen StyleSheet compared to HEAD: identical; card component, badges,
  fonts, icons, tab labels, selection store and navigation callbacks untouched.
- Configured local unauthenticated collection reachability request timed out after
  10 seconds. No successful authenticated live request and no device visual test.
- Pending/Completed mismatch remains a product/UI compatibility limitation, not
  hidden by fixture fallback, invented records or a fake successful empty page.
- No backend/database changes or mutation/detail/reference API integration.
