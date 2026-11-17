# Messages Inbox — authenticated list read

## Inventory before integration

- `MessagesScreens.tsx` exports `ConversationsScreen`, used by the existing Messages
  bottom-tab navigator. Real users saw a placeholder; only local demo preview had cards.
- Demo cards contain a generic MessageCircle avatar, participant name, preview and
  ChevronRight. There was no remote list service, pagination, search/filter control,
  timestamp slot, avatar image, unread badge, pull-to-refresh or inbox-specific skeleton.
- Existing shared `LoadingIndicator` and `ErrorState` supply loading/error/retry UI.
- Existing route is `Chat {conversationId: string}`. Guest protection already exists
  through `withAccountAccess` and the existing Messages authentication action.
- `chatService.ts`/`useChat.ts` contain separate gated proposed detail/message/send
  flows and local demo chat. They are not an inbox implementation and were unchanged.

## Verified Laravel contract

Sources read: saved `docs/API_REFERENCE.md`, sibling backend `routes/api.php`,
`CustomerChatController::index/metadata/rooms` and `PublicData::paginationRules/page`.
No backend files were modified.

- **GET `/api/v1/customer/conversations`** (central base URL includes `/api/v1`).
- Real Bearer token; `ReadOnlyCustomerSanctum`, `auth:sanctum`, eligible-customer middleware.
- Only optional queries: `page` 1–100000, `per_page` 1–50 (default 20). No body/search query.
- HTTP 200:

```json
{
  "success": true,
  "message": "Conversations retrieved successfully.",
  "data": {
    "items": [{
      "id": 71,
      "listing": {"id": 501, "title": "Parcel capacity"},
      "other_participant": {"id": 9, "display_name": "Other customer"},
      "created_at": "2026-11-16 09:00:00",
      "last_message": "Is capacity available?",
      "last_message_at": "2026-11-17 10:00:00",
      "unread_count": 2
    }],
    "pagination": {"current_page": 1, "per_page": 20, "total": 1, "last_page": 1}
  }
}
```

Example values above are test/documentation examples only. Listing title, participant
display name, created_at, last_message and last_message_at may be null. Identifiers
are positive integers; unread_count is a nonnegative integer. No avatar, verification,
phone or email is provided. There is no fabricated presence/read authorization.

Backend scopes rooms to the viewer as initiator or owner, requires two different
participants, joins the listing and participant records, and requires room owner to
match listing creator. Sorting is last matching message ID descending, then room ID
descending; the app preserves that order rather than sorting timestamps itself.
Preview is up to 200 characters. Unread counts matching incoming messages whose
read_by is null. GET does not mark anything as read. Empty inbox has items=[] and
the normal pagination envelope. Header is `Cache-Control: no-store, private`.

## Implementation and field mapping

- `inboxService.getInboxPage` uses the existing Axios client, endpoint registry,
  Keychain token, captured Bearer header and shared error interceptor. A typed Zod
  parser validates the actual envelope and preserves backend identifiers/order/nulls.
  Unexpected private fields are stripped, not exposed through the list model.
- `id` becomes `String(id)` only at the existing Chat navigation boundary. It is
  never derived from a listing or participant ID.
- other_participant.display_name → existing name text; null/blank → "Name unavailable".
- last_message → existing preview text; null → "No message preview available."
- unread_count → name text suffix for nonzero values plus accessibility description.
  No new badge, icon or style was added. Existing generic avatar stays unchanged.
- Listing reference and timestamps remain typed/cache data. The existing card has
  no listing-title/time slots, so new fields/rows were not added. No date is invented.
- Real branch reuses the existing screen/card styles; demo branch and its shortcuts
  remain unchanged. Guest fallback and route-level guard remain unchanged.

## Pagination, lifecycle and refresh

- `useInbox` owns one account-scoped infinite query `['messages.inbox', userId]`.
- Focus-enabled, 30-second stale policy, no polling or automatic failure retry loop.
- Existing ScrollView forwards an optional onScroll callback through ScreenContainer
  (no styles changed). Near-bottom scrolling requests the next documented page.
- Separate serialized explicit retry/refresh/load-more operations prevent duplicate
  requests; overlap across pages is filtered by stable room ID, preserving first order.
- Empty pages/final pages stop; pagination failures retain cards and block automatic
  repeated attempts. The existing shared Retry action retries the failed next page.
- Existing focus lifecycle refreshes stale data. Hook refresh refetches loaded pages;
  no new pull-to-refresh control or pagination button was introduced.

## Authentication, cache and errors

- Only real authenticated sessions enable private queries or pass service guards.
  Demo preview never sends a fake token; existing local demo UI is retained.
- Snapshot auth identity, current Keychain token and abort signal are checked before
  accepting results. Token/account changes, logout and cancellation reject late data.
- Account-keyed child/query prevents another account's cards appearing. Existing
  logout/root session cleanup cancels and clears private QueryClient data. No new
  persistent message cache, token store, auth store or cleanup architecture exists.
- Shared 401 policy handles expired tokens. Transient failures do not discard a valid
  session. Invalid envelope/IDs/counts/pagination fail without fabricated results.
- Safe copy handles 401/403/404/429/500/network/timeout/unknown failures. Initial
  failure uses existing inline ErrorState; failed explicit retry/scroll pagination uses
  only the existing global `react-native-toast-message` configuration, once per flight.
  No automatic success Toast, Alert, Snackbar, logs of messages or token logs added.

## Dashboard consistency

Dashboard remains authoritative from `/customer/dashboard` data.unread_messages.
Inbox queries neither sum unread into that value nor invalidate its query. The
`messages.inbox` key deliberately avoids legacy `messages`/`conversation` invalidation.
Tests mount both hooks and verify inbox refresh leaves Dashboard count/request count
unchanged.

Dashboard counts across its whole query; inbox unread_count is per room on one page.
Backend Dashboard query also has different joins/valid-room restrictions than the inbox.
A page sum is therefore not an authoritative replacement even without pagination.
No live discrepancy was observed/tested and no backend semantics were changed.

## Files

Created:
- `src/features/messages/types/inbox.types.ts`
- `src/features/messages/services/inboxService.ts`
- `src/features/messages/hooks/useInbox.ts`
- `test/fixtures/inbox.ts`
- `__tests__/inboxService.test.ts`
- `__tests__/Inbox.test.tsx`
- This report.

Modified:
- `src/services/api/endpoints.ts` — verified collection endpoint only.
- `src/features/messages/screens/MessagesScreens.tsx` — real authenticated list branch.
- `src/components/layout/ScreenContainer.tsx` — optional onScroll forwarding only.

Pre-existing dirty files from the previous private listing-details task were preserved.

## Remaining dependency and scope

Next Messages dependency is verified real conversation metadata and message-history
read integration. Those services still have their existing false verification gates;
a real room card navigates with the correct ID, but real chat contents are not made
functional by this inbox-only task. Sending/creation/mark-read/deletion are untouched.

No successful live authenticated request or physical-device visual verification is
claimed. A reachable configured backend and an authenticated real account are required.
Automated API tests use the existing Axios client with a controlled test adapter.
No backend, database, website/admin, navigation structure, authentication contracts,
Toast design or unrelated integration changes.

## Executed verification — November 17, 2026

- Focused Inbox/API run: **2 suites, 40 tests passed** (13.897 seconds).
- Final regression: **34 suites, 441 tests passed** (32.441 seconds), exit code 0.
  Includes existing Chat/demo, auth flow/Register/Login/Logout/Forgot Password,
  Dashboard, Reviews, Profile/avatar/Drawer, My Listings/private details, Categories
  and static marketplace tests. These are automated regression results, not live
  endpoint checks. Jest emitted a delayed-exit/open-handles warning before exiting.
- TypeScript `npm run typecheck`: passed.
- Scoped ESLint on all nine created/modified TypeScript files: passed.
- Android `app:assembleDebug -PreactNativeArchitectures=arm64-v8a`: **BUILD SUCCESSFUL**,
  2m54s, 407 tasks (16 executed, 391 up-to-date). Existing Gradle deprecation warnings
  were nonfatal. No phone install or device interaction was performed.
- Messages screen and ScreenContainer StyleSheet blocks matched their pre-task
  versions; scoped `git diff --check` passed.
- An earlier regression run had one test-only failure: an unobserved seeded summary
  was removed by test gcTime=0. Its test cache policy was fixed. The mounted Dashboard
  integration assertion and all final tests above passed; production cache behavior
  was not altered to address the test.

Logs: `.validation/inbox-focused-final.log`, `inbox-verified.log`,
`inbox-types-final.log`, `inbox-lint-final.log`, `inbox-android.log`.
