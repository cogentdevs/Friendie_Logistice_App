# UI preview: direct screen access and demo IDs

The user is building/testing UI and requires every implemented app screen to remain discoverable without real IDs/authentication/backend data. Preserve this preference for subsequent screens: use explicitly labeled development fixtures and demo IDs inside active UI preview; do not remove preview entry points while waiting for real services.

Changes:
- Added isUiPreviewActive in the existing development store as a shared __DEV__ + configured preview + active preview-session guard.
- Existing bottom tabs now stay visible throughout active UI preview, including Listings, Filters, Post and Chat. Tapping a preview tab opens its entry screen (Post form, Conversations inbox, Listings list, etc.), including when that tab was already focused. Normal authenticated/release navigation retains its previous visibility rules.
- Wrapped CustomTabBar in a React element in the existing BottomTabNavigator callback so it can subscribe to preview state correctly. No second tab bar/container was created.
- Messages now offers three labeled demo conversations and direct UI shortcuts to Post a Listing, Listing Details (900001), Search and Filters. The real inbox remains an unconnected placeholder outside preview.
- Added a memory-only demo chat adapter with stable sample conversation/message IDs, incoming/outgoing sample bubbles and local-only send/duplicate-key handling. It never calls Laravel, opens a phone number or claims delivered/read. The screen labels the conversation as a UI demo and says messages stay on the device. Demo polling is disabled. Threads clear when leaving preview.
- Demo chat actor identity is separate from the auth store; login status stays guest and no tokens/real authenticated session are fabricated. Demo caches/drafts use a separate namespace from actual account conversations.
- Demo listing details now include a stable demo conversation ID and their Message action opens the matching sample chat without a real-auth prompt. Actual contact/auth checks remain in effect outside preview.
- Existing Post form, back/draft confirmations and review navigation remain intact. UI preview tabs allow switching screens while preserving form drafts.

Changed files:
- src/store/developmentStore.ts
- src/navigation/BottomTabNavigator.tsx and components/CustomTabBar.tsx
- src/features/messages/development/demoChat.ts (new)
- src/features/messages/services/chatService.ts and hooks/useChat.ts
- src/features/messages/screens/MessagesScreens.tsx and ChatScreen.tsx
- src/features/messages/store/chatDraftStore.ts
- src/features/listings/development/demoListings.ts and screens/ListingDetailsScreen.tsx
- __tests__/chatDemo.test.ts (new), __tests__/App.test.tsx, __tests__/listingDemo.test.ts
- README and this report

Validation (2026-11-05):
- TypeScript and ESLint passed, no warnings.
- Full Jest: 23 suites, 143 tests passed. Covers preview tabs/shortcuts, actual navigation into Post/Filters/demo Chat, local message sending without authentication, demo listing-to-chat access, duplicate local retry/no API calls, and restoration of real authorization gates after leaving preview. Existing real-auth navigation tests still pass.
- Android build/install/launch passed in 1m 52s, 407 tasks (17 executed), connected Infinix X655C Android 10 arm64.
- Physical screen inspection was limited by foreground changes; do not claim a completed physical chat/keyboard smoke test. Automated real-router coverage verifies the preview flow. No unrelated app UI was inspected.

This supersedes earlier Screen 09-12 report statements about hidden preview tabs, missing demo chat IDs and an inaccessible preview inbox. Release/API integrations remain independently gated; no fake delivery, publication or payment flow was introduced.
