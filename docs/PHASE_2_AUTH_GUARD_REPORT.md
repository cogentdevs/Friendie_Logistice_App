# Phase 2: Authentication guard and smart return

## A. Architecture

The existing Zustand auth store remains the only session authority: restoring (checking), guest, authenticated. Keychain stores the Sanctum credential. Login only publishes authenticated state after secure storage and validated user hydration. Restoration retains credentials on temporary network failure; the existing bootstrap still opens public Home. No backend files or contracts were changed.

The existing single Root Native Stack hosts AppDrawer and AuthStack. Drawer contains the existing five tabs and nested stacks. AuthStack contains the existing Login, Register, ForgotPassword and ResetPassword. A stable main navigation group now preserves public navigation during guest-to-member transitions; explicit logout/account replacement discards private history.

## B. Files created

- src/features/auth/types/pendingAction.types.ts
- src/features/auth/store/authFlowStore.ts
- src/features/auth/services/authActionResolver.ts
- src/features/auth/services/authFlowCoordinator.ts
- src/features/auth/hooks/useRequireAuth.ts
- __tests__/authFlow.test.ts
- docs/PHASE_2_AUTH_GUARD_REPORT.md

## C. Files modified for Phase 2

- src/navigation/RootNavigator.tsx
- src/navigation/AuthNavigator.tsx
- src/navigation/navigationTypes.ts
- src/features/auth/screens/LoginScreen.tsx
- src/features/auth/hooks/useAuth.ts
- src/features/auth/services/authService.ts
- src/features/auth/services/sessionLogout.ts
- src/store/developmentStore.ts
- src/features/home/components/LatestAdsSection.tsx (Save event only; no Home redesign)
- src/features/listings/screens/ListingsScreen.tsx
- src/features/listings/screens/ListingDetailsScreen.tsx
- src/features/listings/services/listingDetailsService.ts
- src/features/messages/services/chatService.ts (phone privacy only)
- __tests__/App.test.tsx
- __tests__/Home.test.tsx
- __tests__/Listings.test.tsx
- __tests__/ListingDetails.test.tsx
- __tests__/Login.test.tsx
- __tests__/guestListingDetails.test.ts
- __tests__/listingDetailsService.test.ts
- __tests__/loginService.test.ts

Existing unrelated dirty files were preserved. No dependency installation, theme redesign, NavigationContainer duplication, tab duplication or Laravel modification.

## D. Guard API

Use useRequireAuth() in React or import requireAuth() in an event handler. Example: requireAuth({ type: 'POST_LISTING', params: { listingType: 'carry' } }). Its boolean return means the action was accepted for coordination, NOT that permission has been granted; callers must not execute protected operations based on that return value.

Runtime Zod validation checks discriminated action parameters, positive numeric listing IDs and the existing conversation-ID format. Authenticated users resolve directly. Guests get one Login flow. Restoring sessions wait for state resolution. Navigation readiness is handled by Root lifecycle callbacks, with no arbitrary timer. A single active flow prevents rapid taps from replacing the first intent.

## E. Pending action and resolver

One typed action and monotonic flow ID live only in memory. Supported destinations: POST_LISTING, OPEN_MESSAGES (optionally Chat), OPEN_PROFILE, SAVE_LISTING, REQUEST_LISTING, VIEW_CONTACT. The originating Home/Listings stack is retained for listing actions.

The resolver opens existing routes. Save/request/contact actions return to the relevant Listing Details UI with a one-time continuation explanation. Saving requires another explicit heart tap and remains local-device storage. Requests are never submitted automatically. Contact is never dialed or exposed automatically. Pending state clears on consumption, overall authentication cancellation, explicit logout and unsafe account change. No credentials or private contact data are stored in it.

## F. Login, registration and reset

Login retains its form, validation, errors and styling. The central coordinator alone handles post-auth navigation. Login requests carry AbortSignal, concurrent service login is rejected, and cancellation/unmount prevents late responses from establishing a session. Logout aborts and settles an unfinished login before clearing credentials.

Register/ForgotPassword transitions leave the outer AuthStack mounted and retain the pending action. Registration failure and reset-password success do not authenticate or consume it. Existing registration has no verified session/verification contract; it continues to show its honest unavailable state. A future verified registration flow that establishes the existing validated session will be coordinated by the same auth-state listener. No verification screen or fake success was invented.

The explicitly enabled old UI-testing credential gate remains available for direct UI preview. A guarded pending flow always uses real authentication, even with preview enabled. Preview never consumes pending actions or proves membership. Real authenticated sessions take precedence over development fixtures.

## G. Navigation

Guest protected action -> AuthStack over the public origin -> validated session -> dismiss AuthStack and resolve original destination. Root state removal preserves the origin route key and nested state. Cancel or Android/root Back removes the auth flow and clears intent. Back within Register/Forgot returns within AuthStack without clearing intent. Direct actual Login without a pending action returns Home. Existing native detail back behavior is retained.

## H. Contact security

Login alone cannot unlock a mobile number. The current listing/chat contact flags do not establish accepted-request status AND authorized participation through a verified backend contract. Phone/call-permission fields are stripped from real listing/conversation responses, and both dialer eligibility functions fail closed. This intentionally leaves calling unavailable until the backend authorization contract is verified. No final contact UI or backend authorization changes were implemented.

## I. Validation

- npm run typecheck: PASS.
- npm run lint: PASS, no warnings.
- npm test -- --runInBand --silent: 53 suites / 333 tests PASS.
- Additional updated Login suite: 8 tests PASS, including the newly added guarded-flow preview-bypass regression (one test added after the full run).
- Focused real-router integration: 6 suites / 67 tests PASS before the final additional coverage.
- Guard coverage includes checking -> guest/member, readiness, invalid IDs, duplicates, cancellation, failed login retention, logout clearing and phone privacy.
- App router coverage includes Register/Forgot intent retention, Cancel/Back origin restoration, and successful-session return to the original Post flow without a residual Login route.
- Backend login/registration/device end-to-end success is not claimed: contracts are gated and no live credential/provider was supplied.
- Android release build: PASS: .\gradlew.bat app:assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain (android directory), BUILD SUCCESSFUL in 6m 13s; 711 tasks, 21 executed / 690 up-to-date.
- Final scoped-unmount navigation regression: App + authFlow, 2 suites / 44 tests PASS after the final navigation edit.
- apksigner verify --verbose: PASS (APK Signature Scheme v2). Existing signing configuration was preserved; this does not establish Play Store/release-key readiness.
- APK contains assets/index.android.bundle and arm64-v8a native app modules. Metro source-map content confirms the final flow-scoped AuthNavigator cleanup is bundled.
- APK: android/app/build/outputs/apk/release/friendie-phase2-auth-guard.apk (39,999,002 bytes), also app-release.apk.
- Physical-device installation, native gestures, real credentials and live registration/verification were not tested in this phase.

## J. Phase 3 readiness and remaining dependencies

The reusable resolver already supports Post, Messages/Chat and Profile. Phase 3 should connect the Post, Messages and Profile tab-press entry points in src/navigation/components/CustomTabBar.tsx (or existing tab listeners), corresponding drawer shortcuts, and the Sign In entry in src/navigation/components/AccountAccessBoundary.tsx to the guard. Home Send/Carry/promotional CTAs currently enter the existing Post boundary; migrate those entry points consistently in Phase 3. No full tab protection or Guest Profile redesign was added here.

Existing API paths remain unchanged and configuration-gated: /auth/login, /user, /auth/logout, plus the existing listing and chat services. The endpoints module itself marks these contracts as proposed; Phase 2 does not newly verify them. Registration/session/verification semantics, request creation, server bookmarks and accepted-request participant/contact authorization remain backend dependencies. No new endpoint URL was invented.

APK SHA-256: 6baa6f430bef4e56b2cbdfa7ce07c31d9e19202207a9044a444fce5294c90f0d
