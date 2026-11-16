# Profile Dashboard: inventory and first API integration

## Actual UI inventory before this task

| Screen/item | Existing source | Hardcoded? | Backend/dependency | Status and action |
|---|---|---|---|---|
| Profile name, avatar, verification | Existing Get Profile query/cache; Login identity fallback | Real data; demo has explicit local identity | GET /customer/profile, Bearer | Already integrated; untouched |
| Profile Listings / Reviews / Rating header strip | profile.statistics | Real Profile DTO has no statistics; shows em dash. Demo explicitly uses sample statistics | Dashboard has listing/review counts, but no average rating | Separate header-stat binding/contract decision; untouched |
| Profile seven menu actions | Existing navigation callbacks | Labels/routes are presentation, not API data | Dashboard, Edit Profile, My Listing, Messages, Reviews, Change Password, Logout | Preserved |
| Dashboard title / My Dashboard intro | Existing static presentation copy | Static copy only | None | No API necessary |
| Active Listing card | dashboardService.activeListings -> getMyListings(active, page 1) -> authoritative meta count, otherwise unknown | Demo uses sample own listings; real adapter gated/unverified | Dedicated Dashboard endpoint has listings.published | First integration now uses dedicated summary |
| Total Reviews card | useReviewsSummary -> reviewsService.summary | Real totals unavailable; explicit demo empty state | Dedicated Dashboard endpoint has reviews_received | Same first summary request supplies actual received-review count |
| New Messages card | dashboardService.newMessages | Always unavailable; no fabricated count | Dedicated Dashboard endpoint has unread_messages | Same first summary request supplies unread message count |
| Visitor Review preview / View All | Existing useVisitorReviews -> received feed; up to three records | Real feed unconnected; demo empty-state preview | GET /customer/reviews/received exists | Not implemented in this task; existing behavior preserved |
| Active Listing tap | Existing MyListings active-tab selection | Navigation only | Future own-listings integration | Unchanged |
| Total Reviews / Visitor Review taps | Existing MyReviews visitors tab | Navigation only | Future received/given review feeds | Unchanged |
| New Messages tap | Existing Conversations route | Navigation only | Future conversations integration | Unchanged |
| Back, Retry counts, Retry Visitor Review, pull-to-refresh | Existing controls | Not data | Existing hooks | Styles/navigation preserved; count retry now refetches one summary |

No Request summary, earnings, wallet, activity chart, or additional Dashboard user
summary exists in the inspected UI. No new cards or fields were added.

## Verified single API selected

GET `/api/v1/customer/dashboard` (centralized endpoint `/customer/dashboard`).
Bearer token required, no body or query parameters. Current active, verified,
customer-role account is enforced by existing backend middleware. Read-only
verification: routes/api.php, API V1 CustomerController::dashboard, ApiResponse.
Saved docs/API_REFERENCE.md already lists this endpoint.

HTTP 200:
```json
{
  "success": true,
  "message": "Dashboard retrieved successfully.",
  "data": {
    "listings": {"total": 0, "published": 0, "pending": 0, "expired": 0},
    "unread_messages": 0,
    "reviews_received": 0
  }
}
```

Zeros above document the shape, not values inserted by the frontend. All counters
must be nonnegative integers. Missing/malformed data is rejected, never filled
with zero. Backend counts own ads (created_by); published means isActive=1,
pending=0, expired=2. Unread counts incoming unread messages in authorized rooms;
it is a message count, not a conversation count. reviews_received counts reviews
targeted to the authenticated account. The backend returns no rating, requests,
earnings, profile identity, or review text here. Response is private/no-store.
Shared Axios normalization handles 401/403/404/429/5xx, network and timeout.

A partially implemented dashboardService.summary, DTO/schema and endpoint were
already present in the working tree but unused by the UI. They were reused and
completed, not replaced with a duplicate service.

## Changes and mapping

- `src/features/dashboard/services/dashboardService.ts`: existing captured real
  token/session summary service, conditional missing-token cleanup guard, safe
  notification error messages. Existing demo/legacy helpers remain untouched.
- `src/features/dashboard/types/dashboard.types.ts`: verified existing summary
  schema/type reused and formatted; no guessed additional fields.
- `src/features/dashboard/hooks/useProfileDashboard.ts`: one private summary query
  shared by all three real counters: published -> Active Listing,
  reviews_received -> Total Reviews, unread_messages -> New Messages. Existing
  demo queries remain isolated; real counters do not invoke Listings/Reviews
  APIs. Existing Visitor Review hook remains unconnected to a new backend API.
- `src/features/dashboard/screens/ProfileDashboardScreen.tsx`: existing count
  Retry button invokes the shared retry once. All styles, card props, labels,
  navigation actions and header unchanged.
- `__tests__/dashboardApi.test.ts`: new request/DTO/session/error adapter tests.
- `__tests__/ProfileDashboard.test.tsx`: updated single-request binding, loading,
  retry Toast, guest/demo and account-switch/cache tests.

No new store, Axios client, library, API, persistent cache or authentication flow.
The existing endpoints.dashboard entry was reused without changing its path.

## Lifecycle, safety, feedback

Private React Query key: ['profileDashboard', 'user:<id>', 'summary']; 30-second
freshness; focus enabled; automatic retry disabled. No unconditional focus
invalidation/duplicate requests. Existing query invalidations target this summary
for real users. Guest/demo summary query disabled. The service additionally rejects
non-real sessions before reading a token or calling Axios.

Request snapshots current auth user object and secure token, passes AbortSignal,
and checks auth object/token/abort after awaits. Late responses after logout,
account switch, same-account re-login or token replacement cannot return success.
Existing logout/account-transition private cache cleanup cancels queries and clears
Dashboard data; new account has a distinct query key. No auth/token persistence
changes and no auth state restoration from Dashboard responses.

Existing skeletons, em-dash unavailable counts, inline error panel, sign-in action,
zero/empty behavior and retry/pull-to-refresh remain. A failed explicit count retry
uses existing react-native-toast-message Toast.show(error); automatic loads do not
emit success/error Toast spam. Concurrent retries share one promise. Unmounted or
changed-session callers do not emit late notifications. Existing global Toast
appearance remains unchanged. No Alert/ToastAndroid/Snackbar introduced.

## Remaining Profile completion checklist

1. Dashboard counters: now integrated through the one verified endpoint.
2. Dashboard Visitor Review feed: next recommended integration is authenticated
   GET /customer/reviews/received, using existing reviews owner/cache conventions.
3. MyReviews received/given feeds: separate subsequent integration; summary endpoint
   does not provide comments, authors, pagination or average rating.
4. My Listing list/detail/mutations: separate existing customer-listing endpoints;
   dashboard count integration does not implement them.
5. Messages conversations/read/send: separate work, not required for unread count.
6. Profile header statistics: real Profile currently has no statistics. Reuse
   verified summary counts only in a separately authorized binding; rating needs a
   verified authoritative source. Never calculate from a partial review page.
7. Existing Profile identity, text editing, password change, image upload, Drawer
   synchronization and auth APIs remain integrated. Separate avatar removal is not
   added. No unrelated notification cleanup in this task.

## Verification limits

No real authenticated token was supplied to this task. Live read-only request to
configured http://127.0.0.1:8000/api/v1/customer/dashboard timed out (15 seconds).
Therefore live valid-token data, physical-device rendering and actual persisted
session/device tests cannot be claimed verified. No Login or other endpoint was
called to obtain a token, and no backend/database/server configuration was changed.
Adapter tests exercise the production Axios client/service with explicit test DTOs;
these test fixtures are not application fallbacks or fabricated live responses.

Executed validation (2026-11-16):
- Dashboard service/UI/legacy-demo tests: 3 suites, 33 tests passed
  (`.validation/dashboard-tests.log`).
- Register/Login/Logout/Forgot Password/Profile/Change Password/Update Profile/
  avatar/Drawer/session-logout regressions: 10 suites, 151 tests passed
  (`.validation/dashboard-regressions.log`). These are adapter/UI tests, not new
  live credential changes, registration writes or backend mutations.
- `npm run typecheck`: passed (`.validation/dashboard-types-final.log`).
- Scoped ESLint on modified Dashboard source/tests: passed
  (`.validation/dashboard-lint.log`).
- `gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain`:
  BUILD SUCCESSFUL in 3m2s (`.validation/dashboard-android.log`).
- Dashboard StyleSheet compared to HEAD: identical. Card/icon/header/component
  styles untouched. The only Dashboard screen handler change is one shared count
  retry instead of three independently refetched counters.
- Live read-only request: configured server timed out; authenticated success and
  device rendering not verified. No backend, database, website or unrelated UI
  modifications performed.
