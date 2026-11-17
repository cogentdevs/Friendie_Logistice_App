# Conversation metadata and history — read only

## Verified contracts

Sources: saved API reference plus the existing sibling Laravel `routes/api.php`,
`CustomerChatController::show/messages/room/metadata/messageData`, and `PublicData`.
The backend was inspected read-only. Its configured APP_TIMEZONE was verified as UTC.

### Conversation metadata

- **GET `/api/v1/customer/conversations/{id}`**.
- Real Bearer token, positive integer room ID, no query/body.
- HTTP 200 envelope:

```json
{
  "success": true,
  "message": "Conversation retrieved successfully.",
  "data": {
    "id": 42,
    "listing": {"id": 501, "title": "Parcel capacity"},
    "other_participant": {"id": 9, "display_name": "Customer"},
    "created_at": "2026-11-17 09:00:00"
  }
}
```

Listing title, participant display_name and created_at are nullable. No avatar,
presence, verified/deleted flag, phone, send authorization or attachments are returned.

### Message history

- **GET `/api/v1/customer/conversations/{id}/messages`**.
- Same real Bearer/room access. Optional `page` 1–100000 and `per_page` 1–50,
  default 20. No `before` cursor or other query fields.
- HTTP 200:

```json
{
  "success": true,
  "message": "Messages retrieved successfully.",
  "data": {
    "items": [{
      "id": 10,
      "conversation_id": 42,
      "sender": {"id": 8, "display_name": "Customer"},
      "message": "Message text",
      "created_at": "2026-11-17 10:00:00",
      "message_on": "17 Nov 2026",
      "is_read": false
    }],
    "pagination": {"current_page": 1, "per_page": 20, "total": 1, "last_page": 1}
  }
}
```

Examples are documentation/test values, not app records. Sender display_name,
created_at and message_on can be null. Message IDs and sender/conversation IDs are
positive integers; is_read is boolean. No attachment or recipient object is returned.
The room contains two authorized participants; backend query accepts only messages
between that pair. Messages are sorted **message ID ascending**, not timestamp order.
Empty history returns items=[] with pagination. `is_read` means read_by matches the
message recipient; GET does not change it.

### Access/errors

Eligible customer Bearer middleware protects both endpoints. Room lookup is scoped
to initiator/owner, requires two different participants and the current listing owner.
Missing, inaccessible and non-owned rooms return 404. Account restrictions can return
403; missing/expired token 401; invalid queries 422; shared rate/server/network/timeout
errors are handled. Both GET responses are `Cache-Control: no-store, private`.

## Existing UI/architecture inventory and integration

- Existing ChatScreen, participant header, generic avatar, inverted FlatList,
  MessageBubble, timestamp/day labels, earlier-history footer/retry, latest-message
  scroll action, keyboard-aware composer and Back behavior are reused.
- Existing chat service had a gated proposed `/conversations` contract with opaque
  cursors. Only local demo chat was usable. Verified reads now use the already
  registered `/customer/conversations` endpoint prefix, existing Axios/Keychain/error
  handling, and the existing service/hook architecture. No second API client/store.
- Existing Inbox/navigation and DTOs are unchanged. Chat receives its real room ID.
- New `chatRead.types.ts` validates the actual metadata/history envelopes. The Inbox
  metadata field schema is reused rather than inventing another participant DTO.

## Field binding, ordering and time

- Metadata `id` → existing string conversation ID; other_participant.id/display_name
  → header identity. Missing name uses "Name unavailable". Optional absent profile,
  presence/verification/deleted/contact fields stay absent. Phone remains fail-closed.
- Message id/conversation_id → existing string IDs, sender.id → senderId,
  message → full body. Read history does not apply the old 4000-character composer
  limit to server message bodies.
- Sender alignment uses senderId === authenticated owner ID, never array position.
  The hook additionally rejects senders outside the current room participant pair.
- is_read=true → existing read indicator; false does not invent delivered/sent proof.
- Verified UTC SQL created_at is normalized to ISO UTC, then existing UI formats
  device-local time/day. Explicit-offset timestamps retain their actual instant.
  Null time displays "Time unavailable" and has no invented day heading. Invalid
  non-null timestamp fails safely. message_on does not fabricate a precise time.
- Numeric server message IDs determine order, even if timestamps are equal/backdated.
  Existing inverted list reverses presentation data; bubble styles are unchanged.

## Pagination and lifecycle

Backend starts with oldest messages, while existing UI loads earlier messages at
the top. Initial history read requests page 1 to discover last_page. If last_page>1,
it fetches that last page before publishing initial history. These are distinct,
necessary reads; no temporary oldest-page flash occurs.

The existing internal nextCursor field now carries the previous numeric page number
for this real API adapter. Requests use only page/per_page=20. Subsequent earlier
loads request N-1 down to 1, preserve scroll positioning and filter overlapping IDs.
Repeated cursors/pages are blocked; malformed/out-of-order/duplicate same-page
responses fail. Empty/final pages stop. Offset pagination is not an atomic snapshot
when backend data changes; no invented cursor API or synchronization rule was added.

Focus/app-active guards, 30-second stale policy and serialized explicit refresh/earlier
loads prevent render/polling loops. Metadata is verified before history fetch. Existing
earlier-loading/retry UI remains. Refresh revalidates metadata then loaded history.
No new button, screen, pagination control or polling endpoint was added.

## Composer, notifications and privacy

- Real send capability is explicitly false, regardless of old verification flags.
  Direct real sendMessage calls reject before POST. The old unverified POST branch
  was removed so enabling read access cannot accidentally enable a mutation.
- Existing input/Send/attachment UI remains. Draft text can be edited but real Send
  stays disabled. Legacy local outbox entries are not inserted into real history.
- Explicit development demo retains its original local send/retry behavior and uses
  no backend token. Older optimistic-send tests now explicitly run as local demo.
- Initial load failures use existing inline states. Failed explicit refresh/earlier
  requests use only existing `react-native-toast-message`, once per operation. No
  success toast on automatic loading. Existing options icon now invokes existing
  refresh directly instead of notification popup feedback; no styles changed. Existing
  actual dialer confirmation remains, but private phone authorization stays unavailable.
- Captured auth identity, Bearer token and AbortSignal are checked after async reads.
  Wrong response room IDs, stale sessions and invalid pages cannot enter current cache.
- Real query keys are `['chat.conversation.read', userId, roomId]` and
  `['chat.history.read', userId, roomId]`; demo keys remain separate. These keys avoid
  legacy Dashboard unread invalidation. Inbox and Dashboard counters/previews are not
  recalculated, invalidated or marked read by history loading.
- Existing logout/session cleanup cancels and clears private QueryClient data and
  drafts. Account/conversation switching cannot show previous private history.
- No message bodies, access tokens or private profile/contact data are logged.

## Files for this task

Created:
- `src/features/messages/types/chatRead.types.ts`
- `__tests__/ChatReadScreen.test.tsx`
- This report.

Modified:
- `src/features/messages/services/chatService.ts`
- `src/features/messages/hooks/useChat.ts`
- `src/features/messages/screens/ChatScreen.tsx`
- `src/features/messages/components/MessageBubble.tsx`
- `__tests__/chatService.test.ts` (replaces obsolete proposed-contract tests)
- `__tests__/Chat.test.tsx` (isolates demo send tests explicitly)

Pre-existing Inbox/private listing changes in the workspace were preserved.
No Inbox, Dashboard, auth/profile, navigation structure, dependency, backend, website,
admin or database changes were made for this task. Chat/Bubble StyleSheet blocks
match their pre-task versions.

## Remaining verification and next dependency

No live authenticated API request or device visual test was executed. Automated
transport tests use the real centralized Axios instance with a controlled adapter.
Live acceptance requires a reachable configured backend, a real account and a room
containing messages. UTC normalization relies on the verified server UTC setting;
any future timezone change requires an explicit contract/configuration update.

Next dependency: separately authorize the verified Send Message API integration.
Conversation creation and Mark as Read are separate future mutations; none are
enabled or implemented here. Attachments have no verified read fields in this API.

## Executed verification — November 17, 2026

- Final regression: **35 suites / 480 tests passed**, exit code 0. Includes Chat
  transport/UI/demo tests, Inbox, Dashboard/unread consistency, auth flow/APIs,
  Profile/avatar/Drawer, Reviews, My Listings/private details, Categories and static
  marketplace tests. Jest emitted its delayed-exit/open-handles warning, then exited.
- Actual-transport UI tests cover alignment, empty/loading/retry states, UTC/null
  time, read-only composer, earlier-page requests, conversation switching, logout
  cleanup and Dashboard/Inbox non-invalidation.
- `npm run typecheck`: passed. Scoped ESLint on all eight changed/new TS files: passed.
- Android `app:assembleDebug -PreactNativeArchitectures=arm64-v8a`: **BUILD SUCCESSFUL**
  in 1m42s; 407 tasks (16 executed, 391 up-to-date). Existing Gradle deprecation
  warnings were nonfatal. Debug compilation does not constitute a device/runtime test.
- ChatScreen/MessageBubble StyleSheet comparison: unchanged. Scoped diff check passed.
- Initial test runs exposed obsolete proposed-cursor/send assumptions, a memoized
  component lookup and a stale test renderer reference. Tests were updated to the
  verified read contract and explicit local demo context; final results above passed.
- Live authenticated API/device verification: **not executed**; no live success claimed.

Validation logs: `.validation/chat-read-verified.log`, `chat-read-types-final.log`,
`chat-read-lint-final.log`, `chat-read-android.log`.
