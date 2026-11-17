# Send Message — existing conversation only

## Verified contract and previous state

Sources: saved API reference, existing sibling Laravel `routes/api.php` and
`CustomerChatController::send/messageRules/insertMessage/messageData/room/lockCustomer`.
Backend files were inspected read-only. Real Send was deliberately disabled by the
previous read-only task; only development demo chat had a local optimistic outbox.
The existing composer already called the existing useChat.send operation.

- **POST `/api/v1/customer/conversations/{id}/messages`**.
- Existing positive integer room ID; real Bearer token; JSON body **only**:

```json
{"message":"Message text"}
```

- Public/client message ID, idempotency key, attachment and recipient fields are not
  part of this contract and are not sent.
- Required string, maximum **10000 Unicode characters**, maximum **65535 UTF-8 bytes**;
  empty/whitespace-only and NUL-containing strings are rejected. Frontend validates
  without truncating or trimming the submitted payload. Laravel's returned normalized
  text is authoritative; either original text or its trimmed equivalent is accepted.
- HTTP **201**:

```json
{
  "success": true,
  "message": "Message sent successfully.",
  "data": {
    "id": 99,
    "conversation_id": 42,
    "sender": {"id": 8, "display_name": "Customer"},
    "message": "Message text",
    "created_at": "2026-11-17 10:00:00",
    "message_on": "17 Nov 2026",
    "is_read": false
  }
}
```

These are documentation/test example values, not app records. The DTO uses the same
message serializer as history. The returned message ID, room ID, sender ID, content,
timestamp and read proof are validated. Existing UTC normalization is reused. No
client-generated real message ID/timestamp/delivery status is added.

Backend only permits authorized participants of an eligible existing room. It
rechecks the active/verified customer and current token inside the transaction.
Missing/inaccessible rooms return 404; role/account restrictions 403; expired token
401; validation 422; throttling 429. Chat throttle is 60/minute per account/IP. Shared
error normalization also handles 400, 500, network/timeout and unexpected responses.

There is **no verified Send idempotency contract**. Repeating this POST can insert
another record. Conversation-creation deduplication is unrelated and is not used.

## Implementation and composer behavior

- Extends existing chatService/useChat, centralized Axios, endpoint prefix, Keychain,
  auth state, error interceptor and existing draft store. No parallel API/store/library.
- getConversation's canSend is now frontend eligibility to attempt Send after authorized
  room/history loading; the POST remains the backend authorization authority. This
  is not a new backend permission/acceptance/contact field.
- Real Send validates the untouched draft, serializes one operation per account/room,
  disables the existing button while busy and retains the draft until confirmation.
  No optimistic real bubble or real local-outbox entry is created.
- A complete verified 201 record is inserted into the correct existing history cache.
  Only actual server IDs are deduplicated. Earlier page parameters are preserved.
  In-flight history reads are cancelled before POST and before cache insertion to
  avoid an older response overwriting the confirmed record.
- Draft clears only after confirmation, and only if it still equals the submitted
  text. A different draft typed while the request is pending is preserved.
- Existing bubbles, numeric backend-ID ordering, sender alignment, UTC/local time,
  scroll behavior, keyboard handling and route structure are unchanged.
- The real input no longer silently truncates at the old 4000-character demo limit;
  explicit backend-compatible validation handles oversized real drafts. Demo keeps
  its original 4000-character local behavior.
- Sending/error text uses existing UI slots, button styling and accessibility busy
  state. No spinner/component/screen/layout/style was added.

## Duplicate protection, ambiguity and limitations

- One in-flight promise per account/room blocks double taps, stale callbacks and a
  second mounted composer. No automatic POST retry or idempotency header is used.
- The existing account/room draft record temporarily tracks unresolved body + last
  known authoritative message ID. It is private, in-memory only, not a second store.
- Explicit 400/401/403/404/422/429 rejections preserve drafts while the same session
  remains active; manual correction/retry is possible. Existing 401 session-expiration
  cleanup can clear private drafts on sign-out, as before. Access rejection blocks
  Send until the existing refresh revalidates.
- Network/timeout, server errors or malformed acknowledgements are conservative
  **unknown delivery** outcomes. The draft remains, no fake sent bubble is inserted,
  a warning Toast appears and an existing history GET is safely revalidated once.
- Matching later authoritative history (same authenticated sender/body, ID after the
  pre-send baseline) can reconcile the unresolved draft, without repeating POST.
  No success Toast is fabricated. New mounts with an unresolved send refetch history
  even if the normal cache is still fresh.
- If history does not establish a matching record, Send stays held for that room in
  the current session. An explicit history refresh remains available. No unsafe force-
  resend control or new UI was added. This can conservatively block a message that
  never reached the server; the backend has no receipt/idempotency facility to prove
  non-delivery. Exact-once delivery across process/session restarts or other devices
  cannot be guaranteed. A matching text record is history evidence, not a cryptographic
  request correlation token. No stronger guarantee is claimed.
- Request failure never clears a newer edit; known rejection never adds a success
  bubble. Request cancellation/navigation does not falsely claim server non-delivery.

## Cache, Inbox, Dashboard and session safety

- Real history remains scoped by account and room. Auth-object, token, mount and
  lifecycle-generation checks prevent late acknowledgements from entering another
  room/account or clearing another draft after navigation/logout/account switching.
- Existing logout/root cleanup clears private cache, drafts and unresolved sends.
  No token, message body, request payload or private contact data is logged.
- On confirmed Send, existing Inbox cache is marked stale with refetchType:none.
  Its current preview/order/unread values are not patched or invented. Existing
  focus refresh obtains authoritative server previews when the Inbox opens again.
- Dashboard unread counter/query is not changed or invalidated. History read keys
  remain separate from its legacy invalidation triggers. No Mark as Read is called.
- Guests cannot POST. Demo sessions continue local demoSend behavior and never
  obtain/send fake backend tokens. Phone/contact authorization remains fail-closed.

## Errors and notifications

Only existing react-native-toast-message is used. Validation uses warning feedback;
definitive failures use error; explicit 403 uses rejected; ambiguous delivery uses
warning. Existing inline error text is retained. 422 message-field feedback is reused;
server exceptions/stacks are not displayed. One operation owns one notification;
automatic history reconciliation does not emit another Toast. No automatic success
Toast, Alert notification, Snackbar, duplicate library or Toast styling change.

## Exact files for this task

Created:
- `__tests__/sendMessageApi.test.ts`
- `__tests__/ChatSend.test.tsx`
- This report.

Modified:
- `src/features/messages/services/chatService.ts`
- `src/features/messages/hooks/useChat.ts`
- `src/features/messages/screens/ChatScreen.tsx`
- `src/features/messages/store/chatDraftStore.ts`
- `src/features/messages/types/chatRead.types.ts`
- `__tests__/chatService.test.ts`
- `__tests__/ChatReadScreen.test.tsx`

Existing dirty files from previous tasks were preserved. No backend, database,
website/admin, dependency, navigation structure, contact rules, Inbox API, Dashboard
API, auth/Profile API, listing/search/category code or unrelated UI was modified.

## Live verification and next dependency

Live authenticated Send/delivery/history/device verification: **NOT VERIFIED**.
No valid live test credentials/token were supplied for this task. Automated tests
use a controlled Axios adapter or service fixtures; they are not live deliveries.
Android build success alone does not constitute device rendering verification.

Next separately authorized Messages dependency: **Mark as Read**. Conversation
creation, attachments, editing/deletion and backend idempotency remain separate
features. None are implemented by this task.

## Executed verification — November 17, 2026

- Focused Messages/Send run: **7 suites / 98 tests passed**, exit **0**, 36.275 seconds.
  Covers actual Axios POST contract, payload/header/ID validation, Unicode length,
  no truncation, server-only acknowledgement, real Send button, double-tap lock,
  draft edits/failures, uncertain outcomes/no POST retry, history reconciliation,
  pagination/deduplication, logout/account/room switching, demo isolation, Inbox
  invalidation and mounted Dashboard unread non-invalidation.
- Final regression run: **37 suites / 527 tests passed**, exit **0**, 85.103 seconds.
  Includes Messages/Inbox/history/demo, Register/Login/Logout/Forgot Password, Profile
  editing/password/avatar/Drawer, Dashboard/Reviews, My Listings/private details,
  Categories/static marketplace and auth-flow regression suites. This final run
  includes the additional pagination/Dashboard and malformed-422 safety assertions.
  Jest printed a delayed-exit/open-handles warning before exiting successfully.
- TypeScript `npm run typecheck`: **passed**, exit **0**.
- Scoped ESLint on all nine changed/new TS files: **passed**, exit **0**.
- Android `app:assembleDebug -PreactNativeArchitectures=arm64-v8a`: **BUILD SUCCESSFUL**,
  exit **0**, 1m20s, 407 tasks (16 executed, 391 up-to-date). Existing Gradle deprecation
  warnings were nonfatal. No device install, visual test or live delivery was executed.
- ChatScreen StyleSheet matches baseline; scoped `git diff --check` passed.
- An earlier new account/room-switch assertion expected an array although test
  gcTime=0 had correctly removed the old cache. The assertion was fixed to accept
  the cleared cache; final runs above passed. No production behavior was changed
  to accommodate that test.

Logs: `.validation/chat-send-focused-final.log`, `chat-send-delivery-verified.log`,
`chat-send-types-delivery.log`, `chat-send-lint-delivery.log`, `chat-send-android.log`.
