# Login API integration

Scope: frontend Login and necessary secure session wiring only. No backend/database changes, new dependencies, or style changes.

## Verified contract
Source: docs/API_REFERENCE.md plus read-only inspection of routes/api.php and AuthController::login/profile.
POST /auth/login using the existing base URL ending /api/v1. Payload contains only normalized email and untouched password (no device_name).
HTTP 200: success:true, data.token (nonempty), data.token_type:'Bearer', data.user:{id,name,email}. Login permits only active, verified, exclusively customer-role accounts. Verification status/avatar are not inferred from missing response fields.
422: field errors; 401: generic invalid credentials/account restrictions; 403: permission restriction; 429: rate limit; network and 5xx use safe UI errors. Login rate limits are 20/IP/900 seconds and 5/email/900 seconds.

## Configuration
LOGIN_API_ENABLED=true in .env, generated using npm run configure:env. It is independent of AUTH_API_VERIFIED so enabling Login does not enable guessed Profile or Logout endpoints. Existing Register and Login share apiClient/base URL/timeout/JSON headers. Login and Register explicitly opt out of Authorization and Keychain token reads. Existing protected requests still attach the real stored Bearer token and clear an invalid current session on 401.

## Session
The login response is strictly checked before writing Keychain. The same existing Keychain service stores the real token as password and JSON-mapped user as username. No plaintext password, tokens in navigation, or token logs. Abort/duplicate-flight checks remain. Auth state changes only after secure storage succeeds.
Startup restores this previously server-established token/user pair locally. This is NOT fresh server validation and cannot detect revocation until a future protected request receives 401. Token-only legacy records do not establish a session via this path. /auth/me integration is deliberately deferred. Local Logout removes the same Keychain record and existing logoutSession clears private caches/history; no remote token revocation is claimed.

## Demo and navigation
Existing demo credentials route to existing UI preview only when debug or explicit native STATIC_TESTING permits it. Other emails now reach real Login instead of being rejected by the demo form. Demo email is never sent by authService to Laravel. Normal production cannot enable preview with the old environment-only testing flag.
Existing requireAuth/coordinator resolves Post, Messages, Profile and listing resume actions after auth commits. No request or listing is automatically submitted; contact authorization is unchanged. Register success still returns to Login with the pending action intact.

## Files created
- __tests__/loginApi.test.ts
- docs/LOGIN_API_INTEGRATION.md

## Files modified for Login
- scripts/configure-env.cjs
- .env.example and ignored .env
- src/app/config/environment.generated.json (generated)
- src/features/auth/schemas/sessionSchema.ts
- src/features/auth/services/authService.ts
- src/services/storage/secureStorage.ts
- src/features/auth/screens/LoginScreen.tsx (behavior/comment only; style block unchanged)
- src/constants/appConfig.ts (production demo isolation)
- __tests__/Login.test.tsx
- __tests__/authFlow.test.ts (cancellation assertion now checks setSession)

## Live verification and blocker
Actual configured Laravel HTTP requests: empty payload ->422 with email/password errors; unknown synthetic account ->401 Invalid credentials. No token or PII logged.
Read-only Schema::hasTable('personal_access_tokens') returned false. No schema changes were made. A successful live token-issuing Login cannot be verified on this database until its owner approves/deploys the missing Sanctum table and supplies an eligible verified customer's credentials. Automated Axios adapter tests check the documented successful contract; they are not proof of live login success. No isolated backend environment or valid live account credentials were supplied, so no claim of successful real authenticated login is made.

Validation logs are in ignored .validation/login-tests.log, login-typecheck.log, login-eslint.log and login-android.log. No device UI interaction or installation was performed.

Executed: five Jest suites passed, 68/68 tests (Login UI, authFlow, loginApi, Register UI, registrationApi); TypeScript passed. Login StyleSheet block compared byte-normalized against HEAD: unchanged. Live 422/401 and missing-table checks above were executed separately, not simulated. Backend token issuance and device end-to-end login remain blocked/unverified.

ESLint passed for modified Login/session/config/tests files. Additional App navigation regression selection passed 5/5 (48 unrelated tests skipped): returning guest public browsing, repeated protected actions with Register/Forgot/Cancel, authenticated Post resume, same-listing request review resume, and Profile/local logout. These are automated navigation tests, not live-token/device tests.
Android command: `android/gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain` -> BUILD SUCCESSFUL in 7m 5s (407 tasks). APK: android/app/build/outputs/apk/debug/app-debug.apk. This is a debug/Metro build, not a newly assembled standalone STATIC_TESTING APK. The first sandboxed attempt could not access the external Gradle lock; the approved retry completed successfully.
