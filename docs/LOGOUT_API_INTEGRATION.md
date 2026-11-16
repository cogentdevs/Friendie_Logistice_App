# Real Logout API integration

Scope: Logout API and existing session cleanup only. No backend/database changes, new dependencies, UI styles, or navigation structure changes.

## Contract and sources
Saved contract: docs/API_REFERENCE.md, Authentication table. Read-only verified backend routes/api.php, AuthController::logout, ApiResponse::success and EligibleMobileCustomer middleware.
- POST /auth/logout with existing base URL ending /api/v1.
- Authorization: Bearer <real current token>; no request body.
- HTTP 200: {success:true,message:'Logout successful.',data:{}}.
- Backend deletes only the current personal access token, not all devices' tokens.
- HTTP 401: supplied token is unusable/already invalid; local sign-out is appropriate, but no claim that this request revoked it.
- HTTP 403: account/ability restrictions; not proof of revocation.

## Implementation
logoutApiService.revoke uses the existing apiClient, timeout, base URL and normalized errors. It returns typed 'revoked' or 'already-invalid'; unexpected accepted envelopes fail closed. Network/timeouts, 403, 429, and 5xx preserve credentials and identity and display safe actionable messages through existing Profile/Settings error slots. No automatic retries, token/request-body logging, or success notification before confirmation.
The request carries a captured token explicitly. The interceptor now honors an explicit Authorization header instead of replacing it with a later Keychain token. Login/Register public Authorization:false remains respected. Only Logout handles its own 401 via validateStatus, delaying cleanup until the existing logout coordinator can finish; other endpoints retain existing expiry handling.

Existing authService.logout coalesces concurrent calls, aborts/waits for an unfinished Login, and blocks a new Login while logout is in flight. A revision guard prevents late restore/hydrate responses from restoring the old session. After 200/401, conditional serialized Keychain removal checks both token and owner before clearing the user. An account replacement while the request is pending is preserved. Keychain failure is reported honestly; server revocation may already have succeeded, so retry can receive 401 and retry local cleanup.
If no local token exists, only local cleanup is possible. Guest/demo preview never calls Laravel Logout, including a stale stored credential in guest mode. The existing logoutSession service clears pending auth actions, private drafts/bookmarks/query caches and preview state. RootNavigator's existing account-change epoch resets private history and returns to Guest Home; no new navigation container/routes were added.
Public search filters, recent searches, location preferences and onboarding completion are preserved. Static marketplace fixtures/assets and Login/Register payloads/styles are unchanged.

## Files created
- src/features/auth/services/logoutApiService.ts
- __tests__/logoutApi.test.ts
- docs/LOGOUT_API_INTEGRATION.md

## Files modified in this task
- src/features/auth/services/authService.ts (Logout and necessary in-flight session guards)
- src/features/auth/services/sessionLogout.ts (preserve public browsing preferences)
- src/services/api/interceptors.ts (respect captured explicit Authorization)
- src/services/storage/secureStorage.ts (conditional removal also supports an absent token)
- src/features/profile/screens/ProfileScreen.tsx (existing error slot only)
- src/features/settings/screens/SettingsScreen.tsx (existing error slot only)
- __tests__/loginApi.test.ts (replace superseded local-only real-session Logout assertion with guest-local assertion)
- __tests__/sessionLogout.test.ts (new failure policy, public preference preservation, test isolation)
- __tests__/Profile.test.tsx (actionable server error)
- __tests__/App.test.tsx (Logout API-to-Guest Home navigation test)
Existing unrelated dirty changes were preserved.

## Validation and limits
Live configured endpoint request with an intentionally invalid token returned HTTP 401, success:false, message:'Unauthenticated'. No real customer's token was extracted, logged, or revoked for that probe.
Successful revocation and local lifecycle/failure cases use Axios adapter tests; these are not proof of live successful revocation. No dedicated real test-account credentials were supplied, and no phone UI interaction/installation or backend account modification was performed. Live Login -> real-token Logout -> token rejection requires that authorized account/device test separately. No other backend API was integrated or called by Logout.
Logs: .validation/logout-services.log, logout-ui.log, logout-final-services.log, logout-navigation.log, logout-typecheck.log, logout-eslint.log, logout-android.log.

## Executed results
- `npx jest __tests__/logoutApi.test.ts __tests__/sessionLogout.test.ts __tests__/api.test.ts __tests__/loginApi.test.ts __tests__/registrationApi.test.ts --runInBand --silent --testTimeout=30000`: 5 suites, 63 tests passed.
- Existing LogoutConfirmation/Profile/Settings/Login/Register/authFlow UI regression batch: 6 suites, 47 tests passed.
- Follow-up after added coverage/test-isolation fixes: logoutApi + sessionLogout + Profile, 3 suites, 31 tests passed. This overlaps the preceding batches and must not be added as a unique-test total.
- Existing App navigation selection: 4 passed, 49 skipped (Guest Home marketplace, Profile Logout/back history, protected Post resume, same-listing request review resume).
- Added `real Logout API confirmation` App test: 1 passed, 53 skipped; confirms empty POST/Bearer -> Guest Home -> no private Back -> Post opens Login again, using a mocked API response rather than a live token.
- `npm run typecheck`: passed.
- ESLint on modified Logout/session/UI/test files: passed, no warnings in final run.
- Profile/Settings StyleSheet blocks compared against HEAD: exactly unchanged after newline normalization. Source diff check on touched tracked files passed (Windows newline warnings only).
- `android/gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain`: BUILD SUCCESSFUL in 6m, 407 tasks (30 executed, 377 up-to-date). Debug APK requires Metro; no new standalone STATIC_TESTING APK was requested or built.
- Live invalid-token Logout probe: HTTP 401, success:false, Unauthenticated. Live successful real-token revocation and physical-device Logout remain unverified for the reasons above.
