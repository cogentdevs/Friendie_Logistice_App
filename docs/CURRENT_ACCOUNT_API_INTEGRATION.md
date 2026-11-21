# Task 22 — Current Account API

Date: 2026-11-19.

## Existing architecture and verified contract

Before this task authService.hydrate used an unverified `/user` registry path, while the enabled Login startup branch accepted the Keychain cached identity without server validation. That is not an integrated `/auth/me` lifecycle. Login already returns authoritative user data; no extra blocking request was added after Login.

Backend inspected read-only in sibling friendie_logistics_backend: routes/api.php, AuthController::me/profile, EligibleMobileCustomer, ApiResponse, ApiExceptionRenderer.

- `GET /api/v1/auth/me`; existing centralized configured base URL plus `/auth/me`. No body or query parameters.
- Sanctum authentication and EligibleMobileCustomer require an actual personal access token with mobile:account ability, exactly customer user role, active and verified account.
- HTTP 200: `{success:true,message:"Account retrieved successfully.",data:{id:number,name:string,email:string}}`; `Cache-Control: no-store, private`.
- No avatar, verification boolean, Dashboard counters or full Profile DTO is returned. The middleware verifies eligibility; the frontend does not fabricate fields from it.
- Missing/invalid authentication: HTTP 401, `{success:false,message:"Unauthenticated"}`. Ineligible role/account/token ability: HTTP 403 Forbidden. Shared renderer normalizes other errors, including 429 Too many requests and 500 Server error. No additional endpoint-specific limiter was found in me().

## Implementation

Modified production files:

- src/services/api/endpoints.ts: correct existing me path to `/auth/me`.
- src/features/auth/schemas/sessionSchema.ts: verified response schema with success flag, message and required identity fields.
- src/features/auth/services/authService.ts: reuse hydrate/restore rather than adding a duplicate account service/store. Explicitly bind GET to the captured secure token; validate HTTP status/envelope/identity and current token before setting the existing authenticated user. The server ID must match the securely stored session's account ID.
- src/app/AppBootstrap.tsx: existing foreground lifecycle safely attempts pending verification, without new UI or navigation routes.

Tests: new __tests__/currentAccountApi.test.ts; updated __tests__/auth.test.ts and __tests__/loginApi.test.ts expectations for the now-authorized verified startup behavior. Existing assertions were replaced with meaningful authoritative-request assertions, not removed or skipped.

## Session/security behavior

No stored complete session: guest, no protected request. Stored real session: existing Splash bootstrap awaits server verification; cached user is not authenticated first. A successful response populates the existing auth store, retaining the token. Secure-session format/storage implementation is unchanged.

Definitive current-token 401 uses existing Axios invalidation and token-conditional removal; it cannot erase a replacement credential. Transient errors, 403/429/500 and malformed response retain credentials and leave account state guest/unverified. A pending in-memory verification flag permits one request on a later foreground event; no loop or automatic network retry is installed. App restart also uses the existing bootstrap verification. Bootstrap's bounded cancellation prevents late authentication and leaves the token eligible for later verification.

Concurrent restore calls share one flight. Signal, session revision, owner reference and final token comparison reject stale results. Login advances revision before starting; Logout advances revision and clears pending verification. Replacement-account, replacement-token, logout and conversation-independent private state cannot be overwritten by old verification. Existing RootNavigator account-change cleanup and sessionLogout cache/draft cleanup remain intact; no separate account cache was introduced.

Demo preview skips restoration/reverification and cannot become a real session through the pending path. Guest-first startup/onboarding and protected action gates remain unchanged. Existing public data, Profile and Dashboard APIs are not replaced by identity data. No token/message/password logging or persistence was added. Ordinary restoration shows no Toast; existing react-native-toast-message design is untouched.

## Verification

Diagnostic output: `.validation/current-account/`.

Initial focused adapter tests caught the legacy `/user` endpoint; registry corrected before final verification. Older tests asserting that startup never calls a server were updated for Task 22's explicitly required behavior.

Live credentials were not supplied or used. **LIVE AUTHENTICATED API: NOT VERIFIED. PHYSICAL DEVICE / VISUAL VERIFICATION: NOT VERIFIED.** No fake token was sent to a live server. Test-only dummy credentials are confined to mocks/adapters.

Task 19 context: source and its Part 2 report already contain the four authorized filter pickers and a later historical green suite. No Search/Filters or test timeouts were modified by Task 22. Any fresh navigation failures are reported with this task's actual runs rather than concealed by historical results.

### Final executed results

| Check | Result | Exit |
| --- | --- | --- |
| Focused Current Account/auth/Login/Logout/Startup | 5 suites, 63 passed, 0 failed; 3.867 seconds | 0 |
| Complete Jest, final isolated run | 99 suites passed, 2 suites skipped; 1,461 tests passed, 0 failed, 2 existing skips; 1,463 total; 162.407 seconds | 0 |
| TypeScript, after final source changes | no errors | 0 |
| Scoped ESLint, after final source changes | no errors/warnings | 0 |
| Android arm64 debug, cache-access retry | BUILD SUCCESSFUL in 5m 40s; 407 tasks, 30 executed, 377 up-to-date | 0 |
| git diff --check | clean (Windows newline notices only) | 0 |

18 new focused test cases cover the exact GET/header/body/query contract, authoritative identity, missing token, 401/403/429/500, network/timeout retention and later safe retry, malformed/mismatching identity, duplicate restoration, logout/account/token/cancellation races, Demo isolation and replacement of an aborted bootstrap flight. The full run includes existing Profile, Dashboard, Messages, public browsing, Search/Filters and protected-navigation regression. No tests were newly skipped, deleted or given increased timeouts. Full-suite inventory increased by those 18 cases from the previous 1,445-total inventory.

Exact final commands (from app root unless noted):

```powershell
node node_modules/jest/bin/jest.js --runInBand __tests__/currentAccountApi.test.ts __tests__/auth.test.ts __tests__/loginApi.test.ts __tests__/logoutApi.test.ts __tests__/Startup.test.tsx --json --outputFile=.validation/current-account/focused-final.json
node node_modules/jest/bin/jest.js --runInBand --json --outputFile=.validation/current-account/full-final.json
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/features/auth/services/authService.ts src/features/auth/schemas/sessionSchema.ts src/services/api/endpoints.ts src/app/AppBootstrap.tsx __tests__/currentAccountApi.test.ts __tests__/auth.test.ts __tests__/loginApi.test.ts
# Working directory: android
.\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain
```

Jest output/results: focused-final.log/json and full-final.log/json. Static output: typecheck-final.log and eslint-final.log. Build: android-retry.log. Debug APK: android/app/build/outputs/apk/debug/app-debug.apk. A debug native build does not establish on-device API connectivity or screenshot equivalence.

### Earlier failed executions (retained, not hidden)

- Initial focused iterations found obsolete startup test fixtures/expectations, an asynchronous cancellation fixture requiring an explicit captured token, and the legacy `/user` endpoint. These were corrected to the verified API behavior; final focused coverage passes.
- First full run (`full.log/json`), overlapping native/static and selected Jest work: exit 1, 97 suites passed, 2 failed, 2 skipped; 1,456 tests passed, 4 failed, 2 skipped; 350.582 seconds. All four errors were 5-second test timeouts:
  - App: `Home dashboard uses the real first name and routes every action through existing navigators`.
  - App: `authenticated Profile preserves seven menu actions; confirmed logout returns Guest Home`.
  - App: `returning guest opens public Home, public navigation works, and private screens remain unmounted`.
  - FilterRoutePickers: `guest selectors use the existing public reference services, real labels/IDs, shared countries and exact route query`.
- Selected regression (`regression.log/json`), overlapping that work: exit 1; 5 suites passed, 1 failed; 117 tests passed, 1 failed; 129.987 seconds. The first App test above exceeded 5 seconds. This run preceded the final additional aborted-bootstrap safety test.
- These timing failures did not reproduce in the final isolated full run: App passed in 57.734 seconds and FilterRoutePickers passed, without changing either suite or its timeouts. Resource contention is consistent with the observations, but no CPU profiling was performed to prove a sole root cause. Existing App console act-warning output is retained; it did not fail final tests.
- First Android attempt: exit 1 before compilation, sandbox denied access to the existing external Gradle wrapper zip lock. The same requested build with approved cache access succeeded. No Gradle/native configuration changes were made. Existing cross-drive hard-link fallback-to-copy and Gradle deprecation notices remain in logs.

No automated failures remain in the final run. Remaining limitations are live authenticated API and physical-device verification, not an unresolved Task 19 navigation failure.

## Scope

No Laravel, website/admin, database/schema/migration, API contract, dependency, secure storage implementation, UI layout/theme/style, navigation route, Search/Filters, Profile or Dashboard endpoint changes. Pre-existing Task 20/21 reports were preserved.
