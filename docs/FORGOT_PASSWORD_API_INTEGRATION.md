# Forgot Password API integration

Scope: only password-recovery initiation through the existing Forgot Password screen/service. No Reset Password, OTP, Change Password, Profile, or other API implementation. No backend/source/database/schema modifications, new dependencies, or UI redesign.

## Verified contract
Sources: saved docs/API_REFERENCE.md authentication table; read-only Laravel routes/api.php, AuthController::forgotPassword/RECOVERY/email/input, ApiResponse::success and WebPasswordResetService::requestLink.
- POST /auth/forgot-password with the existing centralized base URL ending /api/v1.
- Public JSON payload: {email:string}, trimmed/lowercased, max 255 characters. No CAPTCHA, password, token, device name or additional fields.
- HTTP 200: {success:true,message:'If an eligible account matches that email, a link will be sent. Please check your inbox and spam folder.',data:{}}.
- No OTP, reset token, reset URL, user object or authenticated session is returned.
- Backend uses an email link to the existing web recovery flow for eligible customer accounts. No mobile deep link or Reset Password screen is added.
- Unknown/ineligible email receives the same neutral 200 response; a 200 is acceptance, not proof of account existence or delivery. Backend delivery exceptions are handled neutrally, so SMTP/inbox delivery cannot be inferred from that response.
- Rate limits: 10 requests/IP/900 seconds, 5 requests/email/3600 seconds, 60-second per-email delivery cooldown. No frontend fake countdown/resend is added. Existing submit lock, mutation retry:false and loading state remain.

## Implementation and security
Existing passwordResetService.request replaces its unavailable placeholder with apiClient.post(endpoints.forgotPassword, {email}, {headers:{Authorization:false}}). It checks exact status/envelope/message/empty data before returning its existing internal {accepted:true} result. No second Axios client, auth store, environment flag or hardcoded host is introduced. The shared current API base/timeout/JSON headers are reused.
Public Authorization:false avoids Keychain access/token attachment and prevents a recovery 401 from clearing an unrelated authenticated session. No credentials/tokens/payload logging, password generation, token storage, automatic Login, or session mutation occurs.
Only known safe Laravel required/format/length email messages are retained verbatim. Other 422 account-related details are reduced to neutral email feedback. Network/timeouts and rate-limit/server failures use existing friendly messages; unknown 400/401/403/404 and unexpected responses never display raw server details or success.
The reserved demo@friendie.test address is explicitly rejected locally with a UI-testing-account explanation; it never initiates real or fake recovery. Demo Login credentials and preview session logic are unchanged. The pre-existing separately labeled development-only 'Preview confirmation (UI only)' control is preserved to keep the UI unchanged; it explicitly states no request/email occurred and does not run as part of Send Reset Link.

## Screen/navigation
Existing form, illustration, loading controls, neutral Check Your Email confirmation and Back to Sign In are reused unchanged. The only screen behavior change maps all safe validation-kind failures to the existing inline email error slot. No navigation routes, styles, buttons, typography, spacing, theme tokens or assets were changed. The pending protected action stays intact across recovery and return to Login; recovery itself never consumes it or authenticates.

## Files created
- __tests__/forgotPasswordApi.test.ts
- docs/FORGOT_PASSWORD_API_INTEGRATION.md

## Files modified in this task
- src/features/auth/services/passwordResetService.ts
- src/features/auth/schemas/forgotPasswordSchema.ts
- src/features/auth/screens/ForgotPasswordScreen.tsx
- src/services/api/endpoints.ts (forgotPassword key only)
- __tests__/passwordReset.test.ts
- __tests__/ForgotPassword.test.tsx
Unrelated existing working-tree changes were preserved. Register/Login/Logout services and their contracts, Guest Mode, public fixtures, location, messaging, and contact privacy are unchanged.

## Executed API verification
Two actual configured Laravel requests were sent, without any real user credentials or recovery secrets:
1. Empty payload -> HTTP 422, success:false, Validation failed, email field error.
2. Fresh synthetic unknown .test email -> HTTP 200, success:true, exact neutral message and empty data object.
No existing person's recovery was initiated and no email delivery/received reset link was verified. Password reset consumption is out of scope. Real accepted-account SMTP/inbox delivery remains a separate backend/email verification concern.

## Validation logs
- .validation/forgot-password-tests.log: six suites, 83 tests passed (Forgot API/schema/screen, Register/Login/Logout API regressions).
- .validation/forgot-password-ui-regression.log: four suites, 44 tests passed (additional Forgot validation/pending-action tests, Login, Register, sessionLogout). This overlaps prior suites; do not add as a unique total.
- .validation/forgot-password-navigation.log: selected existing App navigation regression results.
- .validation/forgot-password-typecheck.log, forgot-password-eslint.log, forgot-password-android.log.
The Forgot Password StyleSheet block matched HEAD after newline normalization; touched tracked source diff check passed (Windows newline warnings only). No phone UI installation/interaction was performed.

## Final results
- TypeScript (`npm run typecheck`): passed after final test changes.
- ESLint on all touched Forgot API/schema/screen/endpoint/tests: passed, no warnings.
- App navigation selection: 4/4 passed, 50 unrelated tests skipped. Covers Forgot Password/explicitly labeled preview -> Login, guest public marketplace, pending-action Register/Forgot/Cancel flow, and demo Login isolation.
- Android: `android/gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain` -> BUILD SUCCESSFUL in 3m 31s, 407 tasks (16 executed, 391 up-to-date).
- Output: android/app/build/outputs/apk/debug/app-debug.apk (debug/Metro build; no standalone STATIC_TESTING APK requested/built).
- No frontend implementation blockers remain. Physical-device form interaction and successful delivery into a real eligible customer's inbox were not performed/claimed; acceptance is intentionally neutral and cannot prove delivery.
