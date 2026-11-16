# Profile completion task 2: Dashboard Visitor Review feed

## Verified API contract

GET `/api/v1/customer/reviews/received` with real Bearer token. No body or user-ID
parameter. Supported queries only: `page` (1..100000), `per_page` (1..50; default 20).
Descending review ID order. Complete endpoint/DTO/pagination verified read-only in
Laravel routes/api.php, CustomerReviewController::received/collection/data,
PublicData::input/page/paginationRules and ApiResponse. Saved API_REFERENCE.md
already lists the candidate endpoint.

HTTP 200 envelope:
```ts
{
  success: true;
  message: string; // Received reviews retrieved successfully.
  data: {
    items: Array<{
      id: number;
      listing: { id: number; title: string | null };
      reviewer: { id: number; display_name: string | null };
      reviewed_customer: { id: number; display_name: string | null };
      rating: number; // integer 0..5, including 0
      review: string | null;
      date_time: string | null;
      created_at: string | null;
      updated_at: string | null;
    }>;
    pagination: { current_page: number; per_page: number; total: number; last_page: number };
  };
}
```

No reviewer avatar, moderation/status, or per-record visibility flag is returned.
No avatar URLs, names or flags are constructed. The private backend query scopes
review.to_user_id to the authenticated account, inner-joins the listing/reviewer,
and left-joins the recipient. It does not require the historical listing to be
currently public. The frontend trusts these authorized returned records rather
than inventing a public-listing status filter. Empty items remain empty. Existing
middleware handles invalid token/eligibility, shared errors handle 401/403/404/
422/429/5xx and network/timeout. Unknown query keys are rejected with 422.

## Actual existing UI

Dashboard VisitorReviewSection has a heading, View All action, divider, skeleton,
existing empty state, error/Retry control and up to three comment texts. It does
not render reviewer avatars, rating stars, author names or dates. Those richer
rows belong to the separate MyReviews ReviewCard, not the Dashboard section.
No new rows or cards were added. Reviewer identity, rating and date metadata are
validated and retained in the typed feed model without changing Dashboard UI.
Null/blank comments retain the existing explicit 'No written feedback.' state
label; no invented reviewer comment or name is substituted.

## Files and data wiring

Created:
- src/features/reviews/types/visitorReview.types.ts: exact nested DTO/schema and
  typed ReceivedReviewsPage; preserves rating 0 and nullable metadata. The old
  MyReviews website model assumes different flat fields and ratings 1..5, so it
  was not silently repurposed.
- src/features/reviews/services/visitorReviewsService.ts: getReceivedVisitorReviews
  uses existing apiClient/endpoints, secure credentials and session guards.
- src/features/reviews/hooks/useDashboardVisitorReviews.ts: existing React Query
  infrastructure, Dashboard-only received-feed subscription, pagination/retry.
- __tests__/visitorReviewsApi.test.ts and __tests__/DashboardVisitorReviews.test.tsx.
- docs/VISITOR_REVIEW_API_INTEGRATION.md.

Modified:
- src/services/api/endpoints.ts: receivedReviews `/customer/reviews/received`.
- src/features/dashboard/hooks/useProfileDashboard.ts: Dashboard feed hook and
  comment mapping (`review`, rather than the old internal `comment` property).
- __tests__/ProfileDashboard.test.tsx: actual preview mapping/counter consistency,
  loading/retry/Toast and existing navigation regression coverage.

VisitorReviewSection, ProfileDashboardScreen, all styles and navigation actions
were left untouched. Dashboard summary service, counters, DTO and query are
unchanged. MyReviews service/hooks/UI remain unconnected and unchanged; no given,
create-review or other endpoint integration was implemented.

## Pagination/cache/session lifecycle

Key: ['reviews.received', 'user:<id>', 'dashboard']; separate from the legacy
MyReviews page model so incompatible cache data is never mixed. Uses existing
QueryClient, not another store. 30-second freshness, focus-enabled, retry false.
First page only for the existing three-comment preview. Existing View All route
unchanged. Infinite-query fetchNextPage is wired to validated pagination and stops
at last_page; no new Load More UI was added. Repeated page pointers, mismatched
response page/page-size and duplicate IDs within a page are rejected/prevented.

Service checks real authenticated user before token/HTTP, snapshots auth user
object and secure token, forwards AbortSignal, rechecks object/token/abort after
awaits, and verifies every reviewed_customer.id matches current owner. Guest and
demo cannot call this real service. Demo keeps its existing local empty received
feed; no fake token reaches Laravel. Existing conditional credential cleanup and
Axios 401 policy are reused; transient failures preserve session.

Existing logout/account transitions cancel and clear private query cache. New
account has a different key. Late old-account/re-login/token-change/aborted
responses cannot restore reviews or populate another session. A single retry
promise prevents duplicate user retries/Toasts. After unmount/account change no
late error Toast is emitted.

## Counter consistency and feedback

Dashboard reviews_received remains sourced from GET /customer/dashboard, never
from page size, preview length or feed pagination.total. This integration does not
invalidate/refetch Dashboard counters when the received page loads or retries.
Existing pull-to-refresh retains its existing count refresh alongside feed refresh.

Counts can differ without a frontend bug: Dashboard counts all matching reviews
rows, while feed totals exclude rows missing an inner-joined listing/reviewer.
Pagination means displayed preview length is not the total. Requests can also
observe different moments. No counts or backend semantics were altered.

Automatic loading is silent except existing inline states. Failed explicit retry
uses existing react-native-toast-message Toast.show(error) with safe messages;
no automatic success Toast, new host, Alert, Snackbar or library. Existing global
white card/colored-left-bar presentation remains unchanged.

## Validation

Adapter tests run the production Axios client/service with explicit test fixtures;
these are not fake application responses or API fallbacks. They verify endpoint,
headers, queries, nested fields, rating 0, null metadata, empty/malformed responses,
page limits/mismatch, current recipient, guest/demo isolation, missing/expired
token, network/server errors and late logout/account/token/abort responses.

Hook/UI tests verify request reuse, pagination, first-three comment preview,
existing empty/loading/error UI, one retry Toast, no counter-refetch on feed retry,
no counter derived from page data, guest/demo, account switch/logout and unmount.
MyReviews regression tests verify it was not implicitly integrated.

Live authenticated verification and device rendering have not been performed:
no real authenticated token was supplied to this task. No Login API was called
and no credential/token was extracted from a device. Live request reachability
results and actual build/test results are recorded below after execution.

## Next incomplete Profile feature

MyReviews received/given tabs remain separate work. Next integrate those screens
with verified contracts, reusing the received DTO/service where appropriate but
adapting their richer existing rating/date/reviewer UI and cache model explicitly.
Reviewer avatar cannot be populated from this endpoint because it is not returned.
My Listings and Messages remain subsequent independent integrations.

Executed results (2026-11-16):
- Final targeted + Dashboard/MyReviews/auth/Profile/avatar/Drawer/logout regressions:
  16 suites, 220 tests passed (`.validation/visitor-regressions.log`).
- `npm run typecheck`: passed (`.validation/visitor-types-final.log`).
- Scoped ESLint on changed source/tests: passed (`.validation/visitor-lint.log`).
- Android arm64 debug `gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain`:
  BUILD SUCCESSFUL in 1m37s (`.validation/visitor-android.log`).
- Live unauthenticated request to configured local received endpoint timed out
  after 10 seconds. No successful authenticated live response was executed.
- No physical-device installation or visual check was performed.
- No backend/database, other API implementation, Dashboard counter, section style,
  navigation or global Toast configuration changes were made.
