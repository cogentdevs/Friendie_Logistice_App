# My Reviews: Received and Given tabs

## Verified contracts and scope

Received: GET `/api/v1/customer/reviews/received`.
Given: GET `/api/v1/customer/reviews/given`.
Both require a real Bearer token; no body or caller-supplied user ID. Supported
queries: page 1..100000, per_page 1..50 (default 20). Descending review ID order.
Verified read-only against saved API_REFERENCE.md, routes/api.php,
CustomerReviewController::received/given/collection/data, PublicData and ApiResponse.
Both routes explicitly use the same controller serializer; shared DTO reuse is
verified, not inferred from similar endpoint names.

HTTP 200: `{success:true,message:string,data:{items:Review[],pagination:{current_page,
per_page,total,last_page}}}`. Review fields:
- id: positive integer.
- listing: {id, title:string|null}.
- reviewer: {id, display_name:string|null}.
- reviewed_customer: {id, display_name:string|null}.
- rating: integer 0..5.
- review, date_time, created_at, updated_at: string|null.
No avatar, status, verification or public-listing-access field is returned.
Received scopes review.to_user_id; Given scopes review.from_user_id. Account
eligibility/token middleware is unchanged. Backend feed joins listings/reviewers
and permits historical records; no invented frontend visibility filter is used.
Errors include existing 401/403/404/422/429/5xx and network/timeout normalization.

## Actual existing UI and reuse

Existing MyReviewsScreen has two tabs labelled **Visitors Reviews** and **Your
Reviews**, ReviewCard author/recipient avatar placeholder/name, 0..5 rating stars,
comment, ISO date or existing unavailable label, related listing text, Received
rating/total summary, FlatList infinite scroll, pull-to-refresh, skeleton/empty/
retry/footer states and existing Back destinations. No new UI, filter, tab,
pagination control, icon or navigation route was added.

The Received service is not duplicated: getReceivedVisitorReviews retains its
public signature and calls one shared private transport/session/parser helper.
getGivenReviews in that same existing service selects only the verified Given
endpoint and checks reviewer.id instead of reviewed_customer.id. Dashboard hook,
preview cache, rendering and counter logic are unchanged.

Existing reviewsService.received/authored adapt the verified DTO into existing
Review/ReviewsPage models:
- id -> id; reviewer.id -> fromUserId; reviewed_customer.id -> toUserId.
- rating unchanged, including 0; review -> comment unchanged/null.
- date_time -> existing ISO-date presentation; missing/unrecognized date uses
  existing Date unavailable state. No invented date or created_at substitution.
- Received person = reviewer; Given person = reviewed_customer (not author again).
- Actual display_name preserved/null; existing Name unavailable fallback remains.
- No avatarUrl/status invented. Existing avatar placeholder remains.
- listing ID/title preserved. canOpen remains false because a private historical
  review does not establish current public listing authorization. Existing listing
  callback/navigation is not changed and no Listings API was integrated.
- pagination.total -> page.total; nextPage derives only from current/last_page.
- Existing visibilityConfirmed internal marker means authorized feed validation,
  not a fabricated backend status or permission for another feature.

## Summary and counter consistency

My Reviews Received total uses authoritative pagination.total from its first page,
never loaded-row count. No extra summary/Dashboard request. Backend provides no
average rating; existing Rating unavailable state remains. No average is computed
from an incomplete page. Demo keeps existing local empty summary behavior.

Dashboard reviews_received stays from its existing Dashboard summary API; neither
My Reviews list nor pagination changes that counter. Dashboard preview remains its
own three-comment first-page query with independent key ending in 'dashboard'.

## Pagination/lifecycle and feedback

Existing independent keys ['reviews.received','user:<id>'] and
['reviews.authored','user:<id>'] isolate tabs, users and Dashboard preview. Existing
30-second freshness, focus/active-tab fetching and infinite scroll are preserved.
Guest queries are disabled; direct services additionally reject unauthorized
sessions. Demo returns existing local empty feeds without private HTTP/tokens.

Shared transport validates page limits, response page/size, unique IDs within a
page and owner. Existing page validator rejects nonadvancing cursors; UI dedups
IDs across pages. Existing last-page detection and separate loading-more/error
footer remain. Concurrent explicit operations share a promise, preventing duplicate
requests/Toasts. Refresh uses the active feed; real Received summary reuses that
query rather than refetching a second resource.

Only explicit retry/refresh/load-more failures emit existing Toast.show(error),
with safe normalized messages. Initial loading is inline/silent; no success spam.
No new Toast system, Alert, ToastAndroid or Snackbar. Existing session snapshot,
secure token recheck, AbortSignal and conditional 401/missing-token cleanup remain.
Late account/logout/token/abort responses cannot populate another user's data;
existing logout cache cancellation/clear is unchanged. Temporary errors preserve
session/cached rows and existing refresh-error feedback.

## Exact files

Modified:
- src/services/api/endpoints.ts: Given route entry only.
- src/features/reviews/services/visitorReviewsService.ts: shared verified transport,
  Received wrapper retained; Given wrapper and appropriate ownership check.
- src/features/reviews/services/reviewsService.ts: typed UI adapter and safe errors.
- src/features/reviews/types/reviews.types.ts: rating 0 allowed; optional page total.
- src/features/reviews/hooks/useReviews.ts: guest gate, guarded single-flight explicit
  fetch/retry and Toast feedback; same existing queries/cache architecture.
- src/features/reviews/screens/MyReviewsScreen.tsx: real Received summary reads feed
  metadata; demo summary preserved. No style or navigation changes.
- __tests__/Reviews.test.tsx, __tests__/reviewsService.test.ts,
  __tests__/dashboardService.test.ts: integration/regression updates for verified
  adapters instead of obsolete unconnected-route assertions.

Created:
- __tests__/myReviewsApi.test.ts.
- docs/MY_REVIEWS_API_INTEGRATION.md.

No Dashboard screen/component/hook, Dashboard counters/service DTO, profile/auth
API, global Axios config, Toast config, backend or database changes.

## Verification and limitations

Production Axios adapter tests verify both private endpoints, headers, queries,
owner mapping, rating 0, nullable fields, actual comment/date mapping, empty/invalid
responses, errors and account/logout/token/abort races. My Reviews UI tests verify
tabs, independent pagination, dedup, refresh, rating-zero stars, total/unknown
average, retry Toasts and account/logout safety. Dashboard received-feed tests
continue checking its independent preview/pagination/counter behavior.

No successful authenticated live request or physical-device test is claimed.
No real token was supplied, no device credentials were extracted and no Login or
other API was called to obtain one. Live reachability attempt/results are recorded
below. Test response fixtures never become application fallback data.

Next incomplete Profile feature: My Listings API/list/detail integration, separately
authorized. Review submission/edit/delete remain out of scope. My Reviews aggregate
average rating and actual avatar images cannot be supplied by these verified feed
contracts; an authoritative backend contract would be needed for those fields.

Executed verification (2026-11-16):
- Final My Reviews + Received/Dashboard + Auth/Profile/avatar/Drawer/logout regression
  run: 18 suites, 249 tests passed (`.validation/myreviews-regressions-final.log`).
- npm run typecheck: passed (`.validation/myreviews-types-final.log`).
- Scoped ESLint: passed (`.validation/myreviews-lint.log`).
- gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain:
  BUILD SUCCESSFUL in 1m39s (`.validation/myreviews-android.log`).
- My Reviews StyleSheet compared against HEAD: unchanged. Tab bar, ReviewCard,
  rating stars, icons, summary styling and navigation callbacks untouched.
- Configured local Given endpoint reachability request timed out after 10 seconds.
  No successful authenticated live request and no physical-device verification.
- No backend/database, Submit/Edit/Delete Review API or unrelated API/UI changes.
