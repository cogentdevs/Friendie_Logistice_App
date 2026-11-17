# Mark incoming messages as read

## Verified Laravel contract

Verified read-only against `routes/api.php` and
`app/Http/Controllers/Api/V1/CustomerChatController.php` in the existing backend.
No backend or database files were changed.

- `POST /api/v1/customer/conversations/{id}/read`.
- Existing centralized base URL plus `/customer/conversations/{id}/read`.
- Real customer Bearer authentication; positive existing conversation ID.
- **No request body and no query parameters** (`axios.post(path, undefined, config)`).
- HTTP 200:

```json
{
  "success": true,
  "message": "Messages marked as read.",
  "data": { "conversation_id": 42, "marked_read": 3, "unread_count": 0 }
}
```

All three data properties are nonnegative integers except the positive conversation
ID. The returned conversation must match the requested conversation. No read
timestamp or per-message acknowledgement is returned.

The server transaction locks the customer and room, rechecks eligibility/token,
and marks **all** valid-pair incoming messages addressed to the current user whose
`read_by` is null. It then returns the actual remaining unread count. This includes
older, unloaded pages; this API cannot acknowledge only visible message IDs.
Outgoing messages and other conversations are unaffected. Repeating the operation
leaves already-read rows unchanged, but can mark newly arrived incoming rows.
The client does not automatically retry mutations.

Missing/inaccessible/non-owned rooms return 404. Invalid authentication returns
401; account restrictions 403; unsupported input 422; shared chat rate limiting
can return 429 (60 attempts/minute per account and IP). Existing Axios error
normalization handles these and server/network/timeout failures.

## Existing module inventory and trigger

Inbox uses account-scoped `messages.inbox` queries and backend `unread_count`.
Chat uses `chat.conversation.read` and `chat.history.read`, real conversation IDs,
inverted message bubbles, latest-page initialization, earlier-history pagination,
and the existing confirmed-send/draft architecture. Dashboard summary uses
`profileDashboard`, `user:<id>`, `summary`; `unread_messages` remains authoritative.

Chat's existing FlatList now reports actual visible message records. The latest
loaded record must be at least 50% visible for 200 ms. The screen must be focused,
app active, metadata/history successful, history not fetching, and a real session
present. An actual incoming unread record must exist in the loaded history.
Loading, failed requests, empty history, history with no unread evidence,
Inbox previews, guest/demo sessions and background screens do not trigger POST.
The hook subscribes reactively to the existing Inbox QueryCache without adding
a query observer or replacing its query function: an actual
positive backend `unread_count` for this conversation is also valid evidence
when older unread rows fall outside the latest history page. This adds no Inbox
HTTP call or duplicate cache. Already-read/outgoing-only latest pages do not
trigger POST when neither history nor the cached Inbox provides unread evidence.

This follows the backend's **conversation-level** read workflow when the user
reaches the latest loaded history; it does not claim every older bubble was seen.
No new polling, sockets, navigation routes, visual components or controls exist.
New messages are detected through existing history fetch/refresh lifecycles,
not through a new real-time transport.

## Duplicate, lifecycle and account protection

The hook keeps only in-memory operation coordination/evidence, not an unread
counter store. WeakMap keys are the existing auth user/session identity and room.
Concurrent consumers share one pending operation. Confirmed evidence uses actual
backend message IDs; the highest observed ID at success prevents refocus,
rerender and earlier-page loads from repeating an already-confirmed read. A newer
incoming unread ID allows another read. Failed attempts are suppressed for the
same query snapshot; a later authoritative history fetch can permit a fresh
attempt. There is no automatic POST retry loop.

Setup is deferred until committed presentation, avoiding Strict Mode's discarded
setup. Cleanup aborts outstanding work; account/logout changes remove operation
evidence. Auth identity, token and AbortSignal are checked by the service before
and after network work. Stale completions cannot update replacement-account
caches. Pending-operation waiters wake after completion without polling.

## Authoritative unread synchronization

After confirmed success, cancel older Inbox/Dashboard GET snapshots and invalidate
only the current account's Inbox and existing Dashboard summary. Active observers
refresh through their existing services; inactive screens remain stale until
their existing focus lifecycle. Infinite Inbox pages/page parameters remain under
the existing query implementation. No page sums, guessed zeroes, decrements or
manual Dashboard values are written. Other summary statistics remain sourced
from the same Dashboard response.

For a failed/ambiguous acknowledgement while still active, safe GET invalidation
reconciles server state without reporting success or retrying the POST. A timeout
cannot prove whether the mutation committed. Abandoned/stale completions are
ignored; a later normal refresh obtains authoritative state. Offline follow-up
GET failure preserves last known data.

## Send, privacy, notifications and UI

No Send request is issued by this feature. Composer draft, uncertain-delivery
hold, message cache/order, backend IDs/timestamps, bubbles and earlier pagination
are untouched. No fabricated read receipts are applied to outgoing bubbles.
Guest and local demo behavior remain isolated; no fake token is sent. Tokens and
message contents are not logged.

The existing root `react-native-toast-message` configuration is unchanged. This
automatic synchronization emits no success or repeated background-error Toasts.
Existing explicit Chat refresh failure feedback still uses the approved Toast
system. Existing actual dialer confirmation remains a confirmation dialog.

Chat StyleSheet matches the pre-existing committed StyleSheet. Inbox/Dashboard
styles, root Toast, navigation and unrelated APIs were not modified.

## Files in this task

Created:
- `src/features/messages/hooks/useMarkConversationRead.ts`
- `__tests__/markReadApi.test.ts`
- `__tests__/MarkConversationRead.test.tsx`
- This report.

Modified:
- `src/features/messages/types/chatRead.types.ts`: exact read acknowledgement schema.
- `src/features/messages/services/chatService.ts`: bodyless authenticated operation.
- `src/features/messages/hooks/useChat.ts`: lifecycle/data eligibility wiring.
- `src/features/messages/screens/ChatScreen.tsx`: existing list visibility callback.
- `__tests__/ChatReadScreen.test.tsx`: actual presentation-to-POST integration test.

## Verification

Tests use controlled Axios adapters and hook/screen rendering; they are not live
backend verification.

| Executed check | Actual result | Exit |
| --- | --- | --- |
| Final focused read API/hook/Chat/Send/Inbox | 5 suites, 77 tests passed | 0 |
| Final relevant Messages/Auth/Profile/Dashboard/Listings regression selection | 39 suites, 565 tests passed | 0 |
| Full available Jest run | 76 passed, 4 failed, 2 skipped suites (82 total); 885 passed, 16 failed, 2 skipped tests (903 total) | 1 |
| TypeScript (`npm run typecheck`) | Passed | 0 |
| Scoped ESLint (changed Messages sources and tests) | Passed | 0 |
| Android `app:assembleDebug -PreactNativeArchitectures=arm64-v8a` | BUILD SUCCESSFUL; final rebuild 2m 53s, 407 tasks | 0 |
| Chat stylesheet comparison and scoped diff whitespace check | Passed | 0 |

The full available run above preceded the final cached-Inbox-evidence edge-case
refinement. The final 39-suite selection, 5-suite focused check, TypeScript and
scoped lint were rerun after the final cache subscription/guard refinements.
An intermediate 39-suite run caught two malformed-cache marker failures; the
cache guard fixed these before the final green runs. Active Inbox and Dashboard
authoritative refresh are both explicitly tested.

Full-run failures, outside the changed feature:

- `App.test.tsx`: 10 broad navigation/fixture assertions. Most expect protected
  destinations after merely injecting a user object without a real stored
  session; actual route is Home. Another assumes no GET of any kind while the
  existing public Categories request runs. One static-fixture control lookup
  also fails. These tests were not rewritten to hide their failures.
- `loginService.test.ts`: 4 legacy contract/configuration expectations, including
  the older profile-hydration login flow. Login service/configuration were not
  changed in this task.
- `auth.test.ts`: 1 offline-restore expectation mocks `hydrate`, while the enabled
  existing Login session-restoration branch uses secure `getSession` and returns
  without calling `hydrate`. Authentication implementation was not changed.
- `developmentPreview.test.ts`: 1 explicit preview-configuration expectation.
  Build/preview configuration was not changed.

A diagnostic rerun with `useMarkConversationRead` mocked to a no-op reproduced
the two selected App failures (My Listings navigation and the blanket no-GET
Guest Profile assertion): 2 failed, 53 skipped, exit 1. Diagnostic setup/log live
only under ignored `.validation`; production files were not disabled or modified.

Do not interpret the full run as all green. The current read API/hook/screen,
Inbox, history, Send/uncertain delivery, Dashboard and current API-specific
auth/Profile regression suites passed in the full run. The earlier historical
37-suite selection was narrower than this full available run.

Logs: `.validation/mark-read-final-delivery.log`, `mark-read-delivery-verified.log`,
`mark-read-full.log`, `mark-read-types.log`, `mark-read-lint.log`,
`mark-read-android-final.log`, `mark-read-unrelated-baseline.log`.

**LIVE AUTHENTICATED API VERIFICATION: NOT VERIFIED**

**PHYSICAL DEVICE VERIFICATION: NOT VERIFIED**

No real test credentials/token were supplied for an unread conversation. Existing
local host configuration was preserved; Android reachability was not assumed.
No APK installation or device operation was performed. A debug build, when
successful, still needs the existing Metro development runtime.

Remaining dependency: creating/reusing a conversation from a listing is separate
from these existing-conversation operations. Attachments, push and real-time
transport remain outside this task.

Conservative trigger limitation: without loaded unread history or an actual
positive Inbox unread value, the feature does not infer unread older-page rows
from their absence. Existing history/Inbox refresh or earlier pagination can
establish that evidence. No claim of real-time unread detection or per-visible-
message acknowledgement is made.
