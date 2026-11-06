# Screen 31 - Logout Confirmation

## Files and presentation
- Added canonical `src/features/auth/components/LogoutConfirmationModal.tsx`: translucent dim overlay, centered white rounded card, soft pink LogOut icon circle, navy Log Out? title and requested supporting text. Cancel is white/navy with a grey border; Log Out is solid burgundy/white.
- Added centralized `modalOverlay` theme token derived from brand navy with transparency. Small-screen/safe-area scrolling and wrapping buttons support text scaling. No new dependency or navigation route.
- Old profile-component path now re-exports the same component for compatibility; no duplicate modal implementation remains.
- Profile, Settings and CustomDrawerContent use the auth modal. Drawer no longer uses a native Alert confirmation. Profile keeps the modal visible during the actual operation so loading remains accurate; all callers guard duplicate confirmation.
- Android Back/accessibility escape calls Cancel before submission. During submission buttons/dismissal are disabled; Cancel never changes authentication or calls the logout service. Visible labels are Cancel and Log Out; existing accessible action labels are preserved for consumers.

## Logout/security behavior
The existing logoutSession/authService pipeline remains the source of truth: cancel queries, attempt the existing verification-gated Laravel logout endpoint, remove Keychain credentials, clear authentication, reset user caches/drafts/search/location/bookmarks and pending notification targets, then request Sign In through the existing RootNavigator state transition.

No logout endpoint was invented. POST /auth/logout is attempted only behind the existing API base/auth verification configuration. Failed/offline remote revocation does not stop local secure credential removal or cache cleanup. The app does not claim that remote revocation succeeded when it failed.

Two supporting hardening changes: query cancellation failure no longer aborts secure cleanup; a real authenticated session still attempts verified remote revocation if a stale development-preview flag is present. The global in-flight logout promise deduplicates requests across entry points.

Native Keychain deletion failure remains an explicit failure/retry state, not a false successful logout. The app cannot promise removal if the OS storage operation fails. Existing local storage cleanup failures are reported through cacheCleared feedback; no claim of guaranteed erasure under storage failure is made. On normal/local-confirmed logout no private caches or stale authenticated navigation remain. Onboarding completion is preserved.

## Modified supporting files
ProfileScreen, SettingsScreen, CustomDrawerContent, compatibility LogoutConfirmationModal export, authService, sessionLogout and theme palette. Added LogoutConfirmation tests, strengthened sessionLogout security tests and updated App's real-router Drawer confirmation/Sign In/cache-reset assertions.

## Validation
Executed results added below after completion. iOS and physical layout checks are not claimed without execution.

Executed validation:
- TypeScript, full ESLint and whitespace diff check passed.
- Six focused suites passed (53 tests): App, Profile, Settings, ChangePassword, sessionLogout and auth. Drawer and Profile confirmations return to Login, remove AppDrawer from root history and clear private query data. Session tests cover offline server failure, query cancellation failure, real-session precedence over stale preview flags, shared in-flight requests and genuine native-storage failure reporting.
- The new modal suite initially used incorrect renderer assumptions about SafeArea style merging and composite button state. Those test-only assertions were corrected; its rerun passed both tests for copy, cancellation/Android Back, delegation and busy guards. All 55 distinct focused cases passed across these runs; a final combined seven-suite/full-repository rerun is not claimed.
- Android arm64-v8a debug build/install passed on Infinix X655C: 407 tasks (17 executed), 1m 7s. Existing Gradle deprecation warnings remain.
- Foreground-guarded device check returned not_foreground. Physical modal layout/touch validation remains unverified. iOS build was not run on Windows.
