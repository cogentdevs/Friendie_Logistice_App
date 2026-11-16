# Register API integration

Date: 2026-11-14. Scope: existing Register screen and the existing Laravel Register endpoint only.

## Verified contract and existing architecture

The mobile app already used React Hook Form/Zod, TanStack Query mutations, a central Axios instance and an environment generator. The registration service was an intentionally disconnected boundary. Its form already supplied name, email, country calling-code selection, phone, password, confirmation and local legal consent; the existing UI, styling and navigation were reused.

The neighboring backend was inspected read-only: `routes/api.php`, `app/Http/Controllers/Api/V1/AuthController.php`, `app/Support/ApiResponse.php`, `app/Exceptions/ApiExceptionRenderer.php`, the country resource mapper and existing authentication tests. No backend source, tables, schema, migrations or business rules were changed. A synthetic unverified customer was submitted through the authorized public registration API during live testing; there were no direct SQL writes.

- Method/path: **POST /api/v1/auth/register**.
- Required JSON keys: `name`, `email`, `phone`, `country_id`, `password`, `password_confirmation`.
- No CAPTCHA. Unknown fields are rejected by the backend; local `acceptedTerms` and UI country-code strings are not sent.
- Country ID must belong to an active backend country.
- Name/email/phone backend maximum: 255 characters. Password uses Laravel's default minimum of eight characters and rejects more than 72 UTF-8 bytes. Confirmation must match. Existing supported phone validation is retained.
- Exact accepted response: HTTP **201**, `{"success":true,"message":"If registration is available for these details, a verification email will be sent. Please check your inbox and spam folder.","data":{}}`.
- Existing email OR phone intentionally receives the SAME neutral 201 response. It is incorrect to invent an email-already-registered error for this backend.
- No token, authenticated session or user DTO is returned. Browser email verification is required before a subsequent real login.
- Validation response: HTTP 422, `success:false`, `message:"Validation failed"`, and `errors` with arrays of messages keyed by backend field name. Register is limited to five attempts per IP per hour.

## Axios, payload and errors

`apiClient` retains its existing timeout and JSON headers. Registration opts out of bearer authentication with Axios's `Authorization:false` header setting. The request interceptor honors that opt-out and skips Keychain access; existing protected requests retain their previous behavior. A public registration 401 cannot clear another authenticated session.

Field mapping:

| Existing form field | Request field |
| --- | --- |
| fullName | name (trimmed) |
| email | email (trimmed/lowercase) |
| phone + country calling code | phone (international format) |
| country ISO code | country_id from verified environment mapping |
| password | password (not trimmed) |
| confirmPassword | password_confirmation |
| acceptedTerms | local validation only; no backend consent mechanism is claimed |

The service returns only `{ message, requiresEmailVerification:true }` after validating the exact 201 envelope and empty data object. Unexpected response bodies, false success values and unexpected token/session data are rejected. There is no token storage or authentication-state change.

Laravel error fields map back to the existing input error slots: name to fullName, country_id to country (shown under the phone/calling-code field), and password_confirmation to confirmPassword. Actual field messages are preserved. Malformed/unknown error fields are discarded. Network/timeout, 400/401/403/409, 429 and server failures produce safe retryable feedback without exposing raw server traces. The form retains its existing submit lock and loading/disabled button.

On accepted registration, passwords/form values are cleared and the native confirmation alert shows the backend's neutral verification message. Its existing Login destination is opened by the "Back to Sign In" action. A pending protected action is preserved, and remains pending until real authentication or the separate existing testing preview flow. No new screen or navigator was added.

## Central configuration

Edit `.env`, then run `node scripts/configure-env.cjs`; do not edit generated JSON manually.

```dotenv
API_BASE_URL=http://127.0.0.1:8000/api/v1
REGISTRATION_API_ENABLED=true
REGISTRATION_COUNTRY_IDS={"PK":179,"AE":2,"SA":194,"GB":233,"US":235}
```

The IDs above were read from active `/countries` records on the current local server: Pakistan 179, UAE 2, Saudi Arabia 194, UK 233, US 235. They are not universal defaults. Re-verify and configure this mapping when changing server/database. Missing mappings stop submission with inline feedback; no numeric ID is guessed. The existing five-country selector was not redesigned and the app does not integrate/call the Countries API in this phase. The reference endpoint was read during setup to verify the mapping only.

`REGISTRATION_API_ENABLED` is independent of `AUTH_API_VERIFIED`; the latter remains false. Marketplace/demo flags and credentials are unchanged.

Connection options:

- USB device with the displayed loopback URL: `adb reverse tcp:8000 tcp:8000` is REQUIRED. Phone 127.0.0.1 refers to the computer only through this explicit ADB tunnel.
- The original server was reachable on IPv4 loopback. A separate instance of the unchanged Laravel application was started on IPv6 loopback for ADB's localhost forwarding: from the backend directory, `php artisan serve '--host=[::1]' --port=8000 --no-reload`. The original instance was not stopped. These are development server processes, not backend source changes.
- Device-path verification: a temporary host-to-device forward to the device's reverse tunnel returned HTTP 200 and the real Laravel health JSON. The temporary forward was removed; reverse port 8000 is retained for registration testing.
- Direct LAN port 8000 was refused; a temporary LAN server on port 8001 was reachable from the computer but timed out from the phone and was stopped. LAN use still requires a reachable server binding/network policy; no firewall rules were changed.
- Emulator: configure `http://10.0.2.2:8000/api/v1` with the existing IPv4 host server.
- Production: configure an approved reachable HTTPS base URL and that environment's verified country IDs.

For debug and STATIC_TESTING only, Gradle generates an Android network-security resource allowing HTTP for exact development hosts (localhost, 127.0.0.1, 10.0.2.2 and a configured HTTP API host). Its default is deny-cleartext. Normal release has no manifest reference to this resource and retains production network policy. No unrestricted production cleartext flag was added.

## Files

Modified:

- `.env` (ignored local registration settings only)
- `.env.example`
- `scripts/configure-env.cjs`
- `src/app/config/environment.generated.json` (generator output)
- `src/constants/appConfig.ts` (typed registration country mapping)
- `src/services/api/endpoints.ts` (register path only)
- `src/services/api/interceptors.ts` (public authentication opt-out)
- `src/features/auth/services/registrationService.ts`
- `src/features/auth/schemas/registerSchema.ts`
- `src/features/auth/screens/RegisterScreen.tsx`
- `android/app/build.gradle` (scoped generated development network resource)
- `__tests__/registration.test.ts`
- `__tests__/Register.test.tsx`

Created:

- `android/app/src/debug/AndroidManifest.xml`
- `android/app/src/staticTesting/AndroidManifest.xml`
- `__tests__/registrationApi.test.ts`
- `__tests__/registration.live.test.ts`
- `docs/REGISTER_API_INTEGRATION.md`

The pre-existing untracked `docs/API_REFERENCE.md` was preserved.

## Verification and limits

Executed results:

- Real Laravel registration test: 1/1 PASS (`.validation/register-live-tests.log`), covering actual 201 acceptance, neutral duplicate response, actual 422 errors and no token/session creation.
- Existing Axios/auth and registration service regression: 58/58 PASS across five suites (`.validation/register-regression.log`).
- Register screen: 11/11 PASS (`.validation/register-screen-tests.log`), including duplicate-submit prevention, field errors, neutral success, password clearing and pending-action preservation.
- Guest/public marketplace and existing demo navigation: 6/6 selected scenarios PASS (`.validation/register-guest-navigation.log`; 47 unrelated scenarios skipped). This selected navigator run used `--testTimeout=30000` on the slow build machine.
- TypeScript: PASS (`.validation/register-typecheck-final.log`).
- Targeted ESLint: PASS (`.validation/register-eslint-final.log`).
- Android: `app:assembleDebug app:processStaticTestingMainManifest app:processReleaseMainManifest -PreactNativeArchitectures=arm64-v8a --console=plain` PASS, BUILD SUCCESSFUL in 13m 9s, 447 tasks (48 executed, 399 up-to-date), `.validation/register-android.log`.
- Device-network route: HTTP 200 through a temporary host forward to the connected phone's ADB reverse tunnel. No app installation, screen interaction or physical form submission was performed.
- An initial Register suite run hit its default 5-second setup timeout; its separate final run passed. An initial Gradle configuration rejected a Provider passed as a SourceSet directory; it was corrected to a resolved file. Initial live-test transport selection used React Native's browser Axios build; the opt-in Node test was corrected to use the installed Axios Node HTTP adapter. These initial failures are not represented as successful runs.

Actual commands and results are recorded in `.validation/register-*.log`. The opt-in live test executes the real service through the central Axios client using Axios's Node HTTP adapter for the test runner; the app keeps its React Native adapter. It checks real 422 validation, one accepted registration, the neutral duplicate response and absence of token/session creation. It never calls Login or any protected API.

To deliberately rerun this write test against the configured local server:

```powershell
$env:FRIENDIE_RUN_REGISTER_LIVE='true'
npx jest __tests__/registration.live.test.ts --runInBand
Remove-Item Env:FRIENDIE_RUN_REGISTER_LIVE
```

The live test creates a new synthetic unverified customer via the API, and is skipped in ordinary regression runs. Be mindful of the backend's five-attempts-per-hour rate limit. No private credentials, generated passwords or request bodies are logged.

Register styles were compared against Git HEAD and are identical. Colors, typography, spacing, icons, images and button styles were not changed. Guest Home, static marketplace content, public navigation and demo Login destinations are covered by the existing navigator regression tests. No Login, Forgot Password, Profile, listings, search, chat or contact APIs were integrated. No phone app was installed/opened for UI testing, preserving the earlier APK-only preference.

Backend acceptance does not prove email delivery. Browser verification/mail configuration remains owned by the backend. The known missing `personal_access_tokens` table still blocks original-database real login; no migration or login testing was performed here.

## Registration console diagnostics

Debug and explicit STATIC_TESTING builds emit metadata-only `console.info` events prefixed with `[Register]`. Inspect these in React Native DevTools' Console after reloading the updated debug app. Regular production builds do not emit these diagnostics.

- `FORM_VALIDATION_FAILED`: form field names that failed local validation; no request was sent.
- `BLOCKED`: registration API configuration or selected-country ID mapping is missing; no request was sent.
- `REQUEST_STARTED`: request ID, POST method and `/auth/register` path.
- `API_ACCEPTED`: request ID, HTTP 201 and `requiresEmailVerification:true`, after validating the complete expected response.
- `REQUEST_FAILED`: request ID, normalized error kind/status and invalid field names.
- `RESPONSE_INVALID`: HTTP response did not match the verified registration contract.

No names, email/phone values, passwords, request/response bodies, token values or raw error objects are logged. API_ACCEPTED means the backend accepted the attempt; duplicate existing accounts deliberately receive the same neutral response, so it is not proof that a new account row was created or an email delivered. Browser email verification or an authorized backend account check confirms that separately.

Diagnostics follow-up files: `src/features/auth/services/registrationDiagnostics.ts` (new), registration service/screen, and the registration API/screen tests. TypeScript, targeted ESLint and 30 registration service/screen tests passed; tests cover metadata privacy and production suppression. No new live account was submitted for this diagnostics-only update.
