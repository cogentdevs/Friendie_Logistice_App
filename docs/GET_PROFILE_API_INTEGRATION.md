# Get Profile API integration

Scope: only authenticated Get Profile and minimum existing cache/UI wiring. No Update Profile, Avatar, Change Password, Delete Account, Dashboard or other API implementation. No backend/database modifications or dependency additions.

## Verified contract
Sources: saved docs/API_REFERENCE.md (GET /customer/profile), read-only routes/api.php, CustomerController::profile/profileData, ApiResponse::success, EligibleMobileCustomer and PublicData::image.
- GET /customer/profile using the existing API base URL ending /api/v1.
- Authorization: Bearer <current real token>. No user ID, query parameters or body.
- HTTP 200 envelope: success:true, message:'Profile retrieved successfully.', data is the own-profile object.
- Fields: id, name, email, phone, country_id, country:{id,name,short_name}|null, image_url|null, is_verified:boolean, email_verified_at|null. Nullable/optional metadata is handled without inventing values.
- The endpoint does NOT return listing count, review count, average rating or route coordinates. No Dashboard/Reviews request is added to fill those gaps.

## Mapping to existing UI/model
| Backend | Existing frontend field/behavior |
|---|---|
| id, name, email | Same typed fields; response ID must match the current authenticated owner |
| phone | Existing optional own-profile data; no new visible phone field/contact access is added |
| image_url | avatarUrl; null/missing uses the existing avatar fallback |
| is_verified | verified; badge is shown only for explicit true |
| country_id, country, email_verified_at | Validate response metadata; no new UI or fabricated route location is introduced |
| No statistics fields | Existing dash placeholders; no zeros/sample ratings for real users |

## Service and session safety
The existing profileService.getProfile replaces its proposed /user read with apiClient.get(endpoints.profile). It uses the existing Axios instance/base/timeout/headers and a captured current Keychain token. Missing/malformed local credentials cannot make a private request. Actual 401 follows the existing Axios expiry cleanup; no Logout API is called automatically. Network/timeout/403/404/429/5xx preserve a valid session and use safe messages. Invalid response shapes and another owner's response are rejected.
The request checks AbortSignal, captured auth-user reference and current secure token before returning. Logout, account replacement, and same-ID reauthentication cannot let an old response become current profile data. No token, personal details, password or full profile response is logged.
The existing TanStack Query cache is the authoritative displayed profile. Login's minimal identity and Keychain record stay unchanged: Get Profile is not Login and does not return/store a new token. This avoids a second persistent profile store and keeps ownership consistent without changing the auth-user reference during an in-flight Logout.

## Fetch/cache lifecycle
useProfile keeps existing per-owner keys ['profile',owner] and separate ['profile','demo'] scope, with 60-second freshness, focus gating, no automatic retry or polling, and shared-query deduplication. Guest/restoring states are disabled. Existing Retry refetches; a failed refresh retains valid cached identity rather than discarding it. Existing loading/error UI is reused.
Home's already-existing summary consumer uses the same hook/cache (no Home source or UI change), so an authenticated Home may populate the same cache before Profile opens. A fresh cached result avoids a duplicate Profile request. Existing Edit Profile can read the same supported data; its save/upload APIs remain unimplemented.
RootNavigator/logoutSession already cancel/clear private queries on Logout/account change and remove private navigation history. These mechanisms were reused unchanged. Guest Profile and Demo Profile remain separate; demo never reads/sends a backend token or calls real Profile, and stale preview flags cannot affect real sessions.

## Configuration
Existing PROFILE_API_VERIFIED was enabled in ignored local .env. Ran node scripts/configure-env.cjs to regenerate src/app/config/environment.generated.json. .env.example still defaults false and now names the correct endpoint. AUTH_API_VERIFIED and other endpoint flags remain unchanged; no /auth/me integration is added.

## Files created
- __tests__/profileApi.test.ts
- __tests__/ProfileApiScreen.test.tsx
- docs/GET_PROFILE_API_INTEGRATION.md

## Files modified in this task
- src/features/profile/services/profileService.ts
- src/features/profile/hooks/useProfile.ts
- src/features/profile/screens/ProfileScreen.tsx (retain cached data on refresh failure; no JSX/style/menu redesign)
- src/services/api/endpoints.ts (profile key only)
- .env.example (existing flag comment only)
- ignored .env (existing PROFILE_API_VERIFIED=true)
- src/app/config/environment.generated.json (generated)
- __tests__/profileService.test.ts (verified backend fixtures)
- __tests__/App.test.tsx (isolate synthetic navigation memberships from real transport; guest-with-API-enabled test)
Existing unrelated working-tree changes were preserved. Register/Login/Logout/Forgot services, marketplace fixtures, Home, Search, Messages, theme, privacy rules and navigation structure were not modified.

## Executed validation and live limitations
- API/Profile/auth regression batch: 7 suites, 98 tests passed. Includes actual Axios request mapping with adapter responses, nullable fields, 401/403/404/429/5xx/network/timeouts, malformed responses, guest/demo isolation, pending Logout and same-ID account replacement.
- UI batch: ProfileApiScreen/Profile/EditProfile, 3 suites, 22 passed. Covers real service-to-existing screen mapping, loading, no fetch loops, failed refresh/cache retention/Retry, per-owner cache, demo/guest and successful Logout cleanup. These overlap other batches and are not a unique sum.
- Actual configured Laravel GET /customer/profile with intentionally invalid Bearer -> HTTP 401, success:false, message:'Unauthenticated'. No real user's profile or token was extracted/logged for the probe.
- Live successful real-token Profile/device testing was not performed because a dedicated real test token/account was not supplied. Successful response/UI mapping is verified against read-only backend source and automated Axios adapter tests; it is not claimed as live-account success. No backend account/token was created or changed to bypass that limitation.
Logs: .validation/profile-api-tests.log, profile-api-ui.log, profile-api-navigation.log, profile-api-typecheck.log, profile-api-eslint.log and profile-api-android.log.

## Final results
- Navigation regression selection: 5 passed, 50 unrelated skipped. Includes guest Profile with API enabled (no private request), Guest Home/public marketplace, demo Login, authenticated protected-action resume, and Profile Logout -> Guest Home/private Back-history cleanup. Synthetic navigation memberships keep real transport disabled except the explicit guest-enabled test; real Profile transport is covered in profileApi/ProfileApiScreen.
- TypeScript: passed. ESLint on touched service/hook/screen/endpoint/tests: passed, no warnings.
- Profile StyleSheet block matched HEAD after newline normalization; menu JSX and assets unchanged. Source diff check passed (Windows newline warnings only).
- Android command: android/gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain -> BUILD SUCCESSFUL in 1m 22s, 407 tasks (17 executed, 390 up-to-date).
- Output: android/app/build/outputs/apk/debug/app-debug.apk. Debug/Metro build only; no phone install/UI interaction or new standalone STATIC_TESTING build was performed.
- Remaining validation limit: an authorized real token/account is needed to verify a positive live account Profile response and physical-device display. The live invalid-token 401 and documented/source-derived positive mapping were verified separately and are not conflated.
