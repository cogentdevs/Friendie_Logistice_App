# Phase 3: Guest Profile and protected entry points

## A. Existing architecture

Phase 2 is implemented and reused. The existing Zustand auth store has restoring, guest and authenticated states. Keychain and validated user hydration establish real sessions. The in-memory auth flow store, runtime-validated pending actions and one coordinator manage login-on-demand and return navigation. No second guard or auth store was introduced.

The existing Root Native Stack has one NavigationContainer, AppDrawer and AuthStack. Drawer hosts MainTabs and account/info destinations. MainTabs retains HomeStack, ListingsStack, PostListingStack, MessagesStack and ProfileStack with the unchanged CustomTabBar. Existing SendParcel and CarryParcel routes share PostListingScreen with route-specific type selection.

## B. Files created

- src/features/profile/screens/GuestProfileScreen.tsx
- docs/PHASE_3_GUEST_ACCESS_REPORT.md

## C. Files modified

- src/navigation/RootNavigator.tsx
- src/navigation/BottomTabNavigator.tsx
- src/navigation/DrawerNavigator.tsx
- src/navigation/ProfileNavigator.tsx
- src/navigation/PostNavigator.tsx
- src/navigation/MessagesNavigator.tsx
- src/navigation/components/AccountAccessBoundary.tsx
- src/navigation/components/CustomDrawerContent.tsx
- src/features/home/screens/HomeScreen.tsx
- src/features/auth/types/pendingAction.types.ts
- src/features/auth/services/authActionResolver.ts
- src/features/auth/services/authFlowCoordinator.ts
- src/features/auth/store/authFlowStore.ts
- src/features/auth/services/sessionLogout.ts
- src/features/dashboard/screens/ProfileDashboardScreen.tsx
- src/features/listings/screens/ListingDetailsScreen.tsx
- src/features/post-listing/screens/PostListingScreen.tsx
- __tests__/App.test.tsx
- __tests__/Home.test.tsx
- __tests__/PostListing.test.tsx
- __tests__/sessionLogout.test.ts

Unrelated existing work was preserved. No backend, dependencies, navigation container, tab bar design, authenticated Profile design or contact-unlocking UI was replaced.

## D. Post Listing

Post tabPress calls preventDefault and the existing requireAuth(POST_LISTING), avoiding competing default/custom navigation. Guests open one Login while the previous public tab remains selected; cancellation clears intent and restores that origin. Authenticated users resolve immediately. Restoring sessions wait through the existing coordinator.

The Post navigator's existing route boundary now requires a real authenticated user, including direct routes, stale history and deep links. Guests receive a safe Sign In/Browse Home gate without mounting forms. Gate Sign In resumes the exact requested form. Checking state shows an activity indicator. This gate intentionally does not auto-redirect repeatedly when Login is cancelled. Continue checks the live auth state again before navigating to review. No publication is performed.

## E. Send and Carry

Home Send Parcel, Carry Parcel and Post Your Ad use POST_LISTING with listingType send/carry. The resolver targets the existing SendParcel or CarryParcel route rather than an unrelated generic destination. Existing route-based form initialization keeps the type. Login/Register transitions preserve the same pending action. The generic Post tab targets PostListing. No form is submitted on authentication success.

## F. Messages

Messages tabPress prevents default navigation and invokes OPEN_MESSAGES. Home Messages uses the same guard. The navigator boundary never mounts conversations/chat for guests, checking state or UI preview. Existing conversation/Chat routes and API services are retained. Listing Details Message also guards the conversation ID; its typed returnTo preserves Listing Details Back context after authentication.

The current authenticated conversations screen remains its existing honest unavailable/connection placeholder where live conversation-list integration is absent. No messages or API responses were fabricated.

## G. Guest Profile

Profile tab remains public and explicitly selects its public Profile root for guests, even after a stale private nested destination. Its existing stack selects GuestProfileScreen for guests, a checking indicator while restoring, and existing ProfileScreen for members. The new screen has a burgundy gradient, neutral avatar icon, welcome text, Sign In/Create Account buttons and compact benefit cards using theme tokens. No fake name, statistics, verification, private profile fields or guest Logout appears.

Both CTAs use OPEN_PROFILE in the existing pending-action system. Create Account selects the existing Register entry in AuthStack; no duplicate auth screen is added. Real authentication returns to Profile. A valid pending action cannot be overwritten. Registration without a valid session does not complete the action; existing unverified registration/verification integration remains unavailable.

## H. Authenticated Profile

The existing authenticated ProfileScreen and its seven approved menu rows remain unchanged: Dashboard, Edit Profile, My Listing, Messages, Reviews, Change Password, Logout. Dashboard/Edit Profile are individually bounded within ProfileStack. Drawer account destinations are similarly bounded. OPEN_ACCOUNT extends the existing typed model/resolver for real account destinations; no placeholder routes were invented. Drawer and Home account shortcuts now use this guard. Public legal, About, Contact and Home navigation remain public.

## I. Logout

Existing logout revocation, Keychain removal, query cancellation/cache clearing, bookmark cleanup and sensitive draft/search/location cleanup are retained. The change replaces the old forced Login request with cleared preview/auth-entry flags. Root's existing account-loss epoch removes private navigation and opens Guest Home. Onboarding completion and unrelated UI preferences remain intact. Android Back cannot recover a private screen from the discarded tree.

Remote revocation failure still permits secure local logout under existing policy. If Keychain removal fails, logout rejects and keeps the authenticated session/navigation; no false sign-out success is shown. Guests no longer see a Drawer Logout action.

## J. Security

UI preview is no longer accepted by private navigation boundaries. Login, registration and authorization are not fabricated. Checking state never renders old private account content. Session loss or account replacement clears private query memory, bookmark identity, chat drafts, listing drafts and private history before the replacement tree is painted. Per-account stored bookmarks remain scoped; public preferences are not erased by this memory cleanup. Protected destination boundaries remain effective even if an entry-point handler is bypassed.

Phone privacy is unchanged from Phase 2: listing/chat phone eligibility remains fail-closed because accepted-request AND authorized-participant proof has not been verified. No contact unlocking or request-status UI was implemented. Laravel authorization and all API endpoint definitions are unchanged.

## K. Validation

- npm run typecheck: PASS.
- npm run lint: PASS, no errors or warnings.
- npm test -- --runInBand --silent --testTimeout=30000: PASS, 53 suites / 348 tests, 98.109 seconds. This final run was executed after the earlier native build completed.
- App router integration includes 45 tests covering guest/returning startup, public browsing, Post/Messages interception and cancellation, Send/Carry through Register, Profile Sign In/Register return, direct account routes, account switch/cache clearing, expiry, stale Profile recovery and logout-to-Home.
- Existing Profile tests assert the exact seven menu rows. Existing phone privacy, secure logout failure, authentication validation and API error tests also pass.
- Final Android ARM64 release: PASS, .\gradlew.bat app:assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain (android directory). BUILD SUCCESSFUL in 5m 45s; 711 tasks, 21 executed / 690 up-to-date. An earlier intermediate build also passed.
- apksigner verify --verbose: PASS, APK Signature Scheme v2. Existing signing configuration is unchanged; Play Store signing readiness was not established.
- Final Metro source-map verification: GuestProfileScreen, guest Profile tab recovery, and account-loss private-memory cleanup are all included in the delivered bundle.
- APK: android/app/build/outputs/apk/release/friendie-phase3-guest.apk; 40006338 bytes. Also available as app-release.apk.
- SHA-256: 4883ca81f39aad7ed7d3e5a14630461a31a036c9a6513cbcc80f1902cd29ac87
- Early test expectations were updated for intentional logout-to-Home and preview restrictions. A test helper was corrected to select the visible listing card and private-route gate rather than hidden/inaccessible screen controls. Parallel build/test load caused timeouts; the final isolated run above passed.
- Live credentials, registration/verification and physical-device gestures are not claimed tested. Existing registration, authenticated conversations-list and other unavailable API contracts were not fabricated.

## L. Phase 4 readiness

Existing src/features/listings/screens/ListingDetailsScreen.tsx contains Request Now, call/message controls and listing metadata. src/features/listings/services/listingDetailsService.ts contains requestStatus and fail-closed permittedPhone. src/features/messages/services/chatService.ts contains fail-closed chatPhone. Phase 4 can adapt these existing components only after verifying accepted-request state, authorized participant identity and permitted contact contracts. REQUEST_LISTING and VIEW_CONTACT pending actions continue to resume review UI without automatic request submission or phone exposure.
