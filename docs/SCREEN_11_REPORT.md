# Screen 11 - Premium Chat Conversation

Implemented src/features/messages/screens/ChatScreen.tsx using the existing Messages native stack, shared theme, Lucide icons, safe areas and keyboard wrapper. No packages or second navigator/container were added. Existing debug Sign In UI preview remains enabled without a fake authenticated session.

UI:
- Native Back, participant avatar/neutral fallback, navy name, optional real presence, permitted call and More menu.
- Incoming light-grey/navy and outgoing burgundy/white rounded bubbles with distinct bottom corners, local timestamps, chronological sorting, day separators and server-confirmed status icons only.
- Pending messages say Sending; failed/unconfirmed messages have an explicit retry action. No outgoing message is labeled delivered/read before a server status supplies it.
- Inverted FlatList uses stable keys, deduplicates page IDs, preserves visible content when earlier pages load, and follows new messages only near the bottom. Latest messages action is available while reading older history.
- Paperclip, multiline rounded input and burgundy Send button remain keyboard safe. Attachments are explicitly disabled because no upload contract exists. Android already uses adjustResize; iOS uses the existing KeyboardAvoidingView with native header offset.
- Missing/deleted participants, empty/loading, network retry, unauthorized/missing conversations, unavailable send and failed-message states are explicit. No fake avatar, sample messages, online indicator or delivery status is seeded.

Lifecycle and architecture:
- chatService validates conversation/message IDs and DTOs, actual account authorization, cross-conversation responses and acknowledged sender/client IDs. AbortSignal is passed for reads. The existing Sanctum API client handles transport/token errors.
- TanStack Query owns conversation metadata and cursor-paginated messages. Account/conversation keys isolate responses. Zustand keeps unsent drafts and optimistic outbox entries in memory per account/conversation, across screen navigation; logout/account change clears them. Nothing stores message bodies in AsyncStorage or logs them. Drafts/outbox do not survive app termination.
- Synchronous draft consumption prevents repeated Send taps. A shared in-flight map prevents concurrent retries. Failed retries retain their original clientId and Idempotency-Key. Successful acknowledgements update server cache and remove the local row; polling echoes reconcile by clientId, including uncertain network outcomes. No local success is fabricated.
- Send requires both CHAT_API_VERIFIED and CHAT_IDEMPOTENCY_VERIFIED plus server canSend/active participant, successful loading and a real authenticated account. A verified server must enforce the key atomically, return the original result for retries, and echo clientId. Merely supplying a header is not assumed to guarantee idempotency.
- No real-time transport exists in the repository. The documented fallback polls metadata/messages every 15 seconds only while the chat is focused and the app is active; errors stop polling until retry. There is no background polling, socket claim or invented presence. Presence is shown only from recent server-observed data (under 45 seconds); no read-receipt endpoint is simulated.
- More exposes Refresh and Close. Reporting/blocking are not connected and are not presented as working actions. Calls require server permission and a safe number, then user confirmation before opening the dialer.

Navigation:
- Listing Details passes the actual conversation ID and a typed return destination. Chat header and Android hardware Back restore that same listing in its originating Home/Listings stack and reset the Messages stack to Conversations.
- Direct chat/deep-link entry falls back to Conversations. The existing tab bar hides on Chat and returns in its parent flow.
- The Messages inbox remains an existing placeholder. Its old hardcoded preview-conversation button was removed; a future real inbox must pass its actual selected ID to the registered Chat route. No inbox/creation endpoint was invented.

Integration limits:
- API_BASE_URL is empty; CHAT_API_VERIFIED=false and CHAT_IDEMPOTENCY_VERIFIED=false remain off. No unverified chat calls are transmitted.
- Proposed contracts awaiting Laravel verification: GET /conversations/:id, GET /conversations/:id/messages?before=cursor returning nextCursor, and POST /conversations/:id/messages with body/clientId plus Idempotency-Key. Verify authorization, ordering, cursor semantics, server-enforced idempotency, status/presence DTOs and participant contact permissions before enabling. Text is capped at 4000 characters.
- Upload, conversation creation, real inbox and real-time transport are not available. Attachment selection/delivery and live messaging were not claimed. The app shows unavailable/auth states until these integrations exist; test-only fixtures are isolated from production/UI preview.

Changed files:
- Added src/features/messages/screens/ChatScreen.tsx
- Added src/features/messages/components/MessageBubble.tsx
- Added src/features/messages/hooks/useChat.ts
- Added src/features/messages/services/chatService.ts
- Added src/features/messages/store/chatDraftStore.ts
- Updated src/features/messages/screens/MessagesScreens.tsx (retained inbox placeholder, removed fake preview ID/Chat placeholder)
- Updated MessagesNavigator, navigationTypes, CustomTabBar and ListingDetailsScreen return navigation
- Updated configure-env.cjs, generated public configuration, .env.example and Jest icon mocks
- Added Chat.test.tsx, ChatScreen.test.tsx, chatService.test.ts; updated App.test.tsx and ListingDetails.test.tsx
- Added this report and README link

Validation (2026-11-05):
- TypeScript passed; ESLint passed with no warnings.
- Full Jest: 20 suites, 124 tests passed. Includes pending/ack transitions, repeated tap, retry same key, draft preservation/logout clearing, deleted participant, sorting/deduplication, DTO/authorization gates, opaque cursors, composer/bubble presentation, no fabricated status/presence, unauthorized state, and real Listing Details -> Chat -> Android Back origin restoration.
- Android BUILD SUCCESSFUL in 1m 19s; 407 tasks (17 executed). Installed and launched on connected Infinix X655C, Android 10, arm64.
- Physical chat/keyboard smoke testing was not completed: phone foreground changed during guarded checks. No unrelated app UI or real message contents were inspected. Real backend send/realtime validation is pending verified services and actual authorized conversations. iOS build/keyboard testing not run on Windows.
- Existing upstream Gradle deprecation warnings remain. Device custom fonts may differ from reference typography.
