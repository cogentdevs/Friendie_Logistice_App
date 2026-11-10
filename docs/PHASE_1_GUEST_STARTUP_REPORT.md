# Phase 1: Splash, onboarding and public guest Home

## A. Existing architecture and forced redirects

The existing React Native Community CLI/TypeScript app uses AppBootstrap, one Root Native Stack/NavigationContainer, Main Drawer and five existing Bottom Tabs. Home/Listings/Post/Messages/Profile retain their existing nested stacks and custom tab component. No navigator or package was replaced.

Authentication lives in the existing authStore (restoring/guest/authenticated); tokens use react-native-keychain via secureStorage. Onboarding and notification preferences use AsyncStorage under friendie.preferences, envelope version 0. Location preferences use the existing separate persisted location store.

The old root omitted AppDrawer unless authenticated or explicitly previewing, and selected AuthStack after onboarding. The shared onboarding Skip reset directly to Login without persisting completion. Bootstrap also skipped session restoration whenever UI preview was configured. Those were the compulsory-login startup paths.

## B. Phase 1 files

Modified:
- src/app/AppBootstrap.tsx
- src/store/uiStore.ts
- src/features/auth/services/authService.ts (restoration/cancellation only; login/register/logout behavior retained)
- src/navigation/RootNavigator.tsx
- src/features/onboarding/hooks/useOnboardingNavigation.ts
- src/features/onboarding/screens/GlobalReachIntroScreen.tsx
- src/features/onboarding/components/OnboardingLayout.tsx
- src/navigation/PostNavigator.tsx
- src/navigation/MessagesNavigator.tsx
- src/navigation/ProfileNavigator.tsx
- src/navigation/DrawerNavigator.tsx
- src/navigation/components/CustomDrawerContent.tsx (guest identity fallback only)
- src/features/listings/services/listingDetailsService.ts
- __tests__/App.test.tsx
- __tests__/auth.test.ts
- README.md (report index)

Created:
- src/features/onboarding/hooks/useCompleteOnboarding.ts
- src/navigation/components/AccountAccessBoundary.tsx
- __tests__/Startup.test.tsx
- __tests__/guestListingDetails.test.ts
- docs/PHASE_1_GUEST_STARTUP_REPORT.md

Earlier APK/demo-login work was already present in the dirty working tree and is preserved. Phase 1 does not change auth forms, demo credentials, package.json, dependencies, Home/search UI, search business logic, brand tokens, linking configuration or Laravel files.

## C. Startup state and session restoration

StartupStatus is derived in the existing bootstrap context: initializing, onboardingRequired or ready. It is separate from authStore; no duplicate auth store or fake persisted authenticated flag exists.

| Situation | Destination |
| --- | --- |
| First install / missing or malformed onboarding preference | Existing Welcome and onboarding |
| Get Started on final introduction | Persist completion, replace intro history with Home |
| Skip on an introduction | Persist completion, replace intro history with Home |
| Returning guest with completed/skipped onboarding | Home |
| Existing authenticated session restored | Home with real user state |
| Confirmed unauthorized session | Guest flow, with Home if onboarded |
| Temporary restore/network failure on cold start | Public guest flow; Keychain token retained for later restoration |

All three startup operations run in parallel and use the existing 15-second request budget as a deadline, not a mandatory splash delay. Native preference/session operations cannot trap Splash indefinitely. Restoration always runs, including when the existing explicit UI-testing configuration is enabled. A transient failure keeps an already confirmed in-memory session; a cold start does not invent an authenticated user when validation is unavailable. Existing API headers and 401 handling are retained.

Cancellation prevents late preference/profile responses from changing startup/session state after timeout or retry. Preferences read errors expose Retry and Continue without saved preferences; continuation does not mark onboarding persisted. Background/foreground events do not restart the bootstrap effect or replay onboarding. Once this app instance has reached MainApp after a confirmed session/completed onboarding, startup stays ready if the session later expires; this does not manufacture a persisted onboarding flag.

## D. Onboarding persistence

The existing friendie.preferences key and version-0 shape are reused. Shared completion logic calls the existing serialized preference writer and publishes onboardingComplete only after AsyncStorage.setItem succeeds. Authentication and secure credentials are independent and unchanged by completion.

Both Skip and final Get Started share loading/error/duplicate-submission handling. A write failure stays on the current introduction and supports retry. Existing images, design, Next and Android previous-slide behavior are preserved. Final Get Started is still the existing final-slide action; Welcome Get Started still opens the first introduction.

## E. Navigation

AppDrawer is registered for guests as well as members. Root navigation groups change keys when onboarding completes, so Home has no obsolete Login/Splash/onboarding back history. Login/Register/Forgot/Reset routes remain in the existing AuthStack and can be explicitly opened. Public Home, Listings, Search, Filters, category/location/latest-ad sections and existing informational routes are reachable without signing in.

Only one NavigationContainer remains in RootNavigator. The existing drawer, five tabs and nested screens remain in place. The existing tab bar's screen-specific hide/show behavior is preserved. Existing deep-link mappings are unchanged; public links can use the MainApp routes. Private links encounter the privacy boundary rather than mounting account data. Onboarding-only links still depend on onboarding routes being available.

## F. Guest security and backend limits

Removing the root auth wall required a small rendering privacy boundary on the existing private navigators and account drawer routes. For a normal guest, it does not mount Post, Messages, Profile, private listing management, saved/reviews/notifications/tracking/settings/change-password screens. It displays an explicit Sign In / Browse Home prompt, with no automatic login redirect. Authenticated screens and existing opt-in labeled UI-demo access retain their prior behavior. This is a Phase 1 compatibility/privacy boundary, not the future protected-action/pending-action system.

Public listing-details parsing removes contact metadata (including phone/conversation identifiers) and private request status before entering a guest cache. An in-flight member response is rejected if the session owner changes. Existing authenticated contact-permission behavior is retained; no accepted-request/contact-unlocking workflow is implemented. Backend authorization must still enforce which contacts and listings its public endpoints return.

No backend endpoint was invented and no Laravel file was changed. Existing public listing/detail API verification flags and endpoint contracts remain required. Home category/destination/latest/count services have no verified live contracts and continue to show their existing honest unavailable/error states outside explicit development preview. An API that requires authentication remains unavailable to guests; no security bypass or automatic production mock data was added. This phase makes public navigation available, not unsupported backend functionality.

## G. Executed validation

Executed checks:
- npm run typecheck: passed.
- npm run lint: passed.
- Expanded regression run: 11 suites, 95 tests passed (App, Startup, preferences, auth, ListingDetails, guestListingDetails, Home, Search, Filters, Listings and sessionLogout).
- Final edge-case rechecks: Startup 8/8 passed; targeted App startup/Skip/navigation 7/7 passed; final guest/returning-member/public Contact Us recheck 3/3 passed. These overlap the expanded tests and are not additional unique-test totals.
- Full Android command: android/gradlew.bat app:assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain. Initial run passed; final run including the last public-route adjustment passed in 5m 56s (711 tasks, 21 executed).
- Final APK signature verification passed (v2). APK includes ARM64 appmodules and bundled JS/assets. Source-map inspection confirms the final entered-app startup state and unwrapped public Contact Us route are included.
- git diff --check passed; Windows line-ending warnings only.

Testing artifact: android/app/build/outputs/apk/release/friendie-phase1-guest.apk. This is an ARM64 verification build using the existing debug signing key and existing explicit UI-testing configuration; production signing/verified services remain separate requirements. Other ABIs and iOS were not built in this phase. No device installation or physical gesture/layout certification is claimed.

Local ignored build logs: .validation/phase1-android.log and .validation/phase1-final-android.log.

Native gestures, physical-device rendering, actual backend public visibility and real network/session contracts require environment/service validation; unit tests do not certify these. Existing development preview remains explicitly labeled and does not create a real session.

## H. Phase 2 readiness (not implemented)

Existing entry points include Listing Details request/contact handlers, listing save actions, Home Send/Carry actions, Post/Messages/Profile navigators and private drawer screens. AuthStack.Login params remain unchanged. Future phases can connect these to a typed pending action and resume after real authentication. No pending-action store, action-resume logic, new guest account menu, contact unlocking or Phase 2-5 workflow was added.

Contact Us remains public through its original drawer route as well as the root public/legal adapter; its existing prefill already excludes unauthenticated user data.

Existing logout still confirms, clears secure credentials/private caches and requests Login. Changing logout to guest Home is deliberately deferred, as specified. The future business rule restricting phone visibility to authenticated authorized participants after acceptance still needs verified backend enforcement and the later accepted-request workflow.
