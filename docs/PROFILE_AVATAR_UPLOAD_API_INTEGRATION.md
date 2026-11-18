# Task 18 — Profile Avatar Upload API

## Outcome and inspection

Task18 reuses the already integrated avatar endpoint and existing Edit Profile camera/library picker, local preview, and Save Changes action. No new screen, dialog, button, dependency, Axios instance, authentication store or profile cache was necessary. The working tree contained Task15–17 changes before this task; these were preserved (baseline status and HEAD under `.validation/task18`).

Inspected ProfileScreen, EditProfileScreen, AppAvatar, profilePhotoService, profileAvatarService, profileEditService, profileService/useProfile, CustomDrawerContent, ProfileDashboard, secure auth/session cleanup, Axios/interceptors/endpoints, image-picker8.3.0/RN Image implementations, existing tests, and previous Profile/Edit Profile/Dashboard/Listing Image Upload/Delete reports. Read-only Laravel inspection covered routes/api.php, CustomerController, CustomerAvatarService, PublicData, ApiResponse and eligibility middleware.

The historical missing-preview bug had already been corrected: valid picker assets reached photo state, local URI had priority, same-URI reselection cleared the failed-image marker, and Save used the separate avatar upload endpoint. There was no evidence to claim that all selections currently failed, and the original phone asset/decoder trace was unavailable. The current baseline's three avatar/editor suites passed37tests.

Concrete remaining gaps addressed here:

- Direct upload callers had no shared in-flight lock. Screen protection alone did not cover concurrent calls/remounts.
- Network/timeout/malformed response outcomes could be retried even though Laravel might already have replaced the image.
- A confirmed upload followed by a failed profile GET/PUT could upload the same selected photo again on Save retry.
- Picker callbacks could update an editor after leaving it or switching accounts.
- Picker dimensions alone did not establish that RN could decode the selected content URI; delayed errors from a previous image could produce irrelevant feedback.

## Verified Laravel contract

**POST /api/v1/customer/profile/avatar**, relative endpoint `/customer/profile/avatar` on the existing environment-aware Axios base. Sanctum Bearer and EligibleMobileCustomer; active, verified customer/current token checked again under transaction lock. No query parameters. Multipart contains exactly one actual file under **avatar**. No `image`, Base64 JSON or unrelated profile fields.

Validation independently verified for avatars:

- Required file and decodable image.
- MIME: image/jpeg, image/png, image/webp.
- Extensions: jpg/jpeg/png/webp. GIF, HEIC and SVG are unsupported.
- Maximum2048KiB = **2,097,152 bytes**, inclusive.
- Width and height **1–2048 pixels**, inclusive.
- Shared avatar operation rate limit10/account and IP/hour;429 includes Retry-After.

Success **HTTP200**:

```json
{"success":true,"message":"Avatar updated successfully.","data":{"image_url":"<authoritative absolute public URL, or null if media resolution is unavailable>"}}
```

No complete customer, new token, image version, upload identity or idempotency key is returned. The frontend requires a usable HTTP(S) URL before treating the displayed image as confirmed. Null/relative/malformed URLs remain unconfirmed; none is constructed from the API host.

Replacement is supported. GD/Intervention decodes, scales down within512×512, writes JPEG quality85 with unique `api_user_{id}_{random32hex}.jpg`, and replaces users.image. Old saved images are **not** unlinked; failure cleanup removes only a newly written file from the failed transaction. No retention behavior was changed. Backend errors use existing success:false/message/errors handling; field errors422, authorization401/403, rate limit429 and unexpected server failures are handled by existing normalization. Other HTTP error handling is defensive, not a claim each status is emitted by this controller.

## Implementation and existing interaction

Existing Upload New Photo/camera action opens the existing source-choice workflow only on user action. Gallery cancellation preserves the selection. Existing interactive source-choice/discard confirmations remain; no notification Alert was added. Notifications use the existing Toast.show host and styling.

`chooseProfilePhoto` validates MIME, known size/dimensions and local file/content URI, then decodes with RN Image.getSize to verify accessibility and actual dimensions. The exact content:// or file:// URI is retained. Unknown provider file size remains unknown, never fabricated; Laravel performs authoritative byte/MIME validation. A safe MIME-compatible multipart filename fallback remains in use. No new picker, file-copy, image cache or resizing library was added.

The selected local image still immediately takes priority in the same100×100 circular avatar inside its112×112 ring. No shared cache receives this local URI. Re-selection resets image failure state; stale image error callbacks cannot affect a newer preview. Duplicate errors for the same source notify once. An unreadable selected preview cannot be submitted.

Upload still occurs only on existing **Save Changes**, never on mount, focus, picker completion or Login. Photo-only Save uploads then reads the complete existing GET/customer/profile. Combined changes upload first (an email change may revoke tokens), then send only changed text fields through the unchanged PUT/customer/profile contract. Confirmed photo persistence is not rolled back or falsely reported as lost when the remaining text/profile refresh fails.

## Mutation and recovery safety

The existing avatar service now owns a small current-session mutation ledger: selected asset, pending/unknown/confirmed state, confirmed URL where available, a pre-upload server URL snapshot from the existing profile baseline, and an authoritative reconciliation observation. It is not an independent profile/image cache. It resets synchronously when auth status/user-object changes.

The lock is acquired before awaiting secure storage. Concurrent callers cannot POST twice. Successful same-selection recovery reuses the confirmed URL, so retry after a subsequent GET/PUT failure performs only the remaining read/text operation. The editor clears confirmed recovery after the complete save.

Definite HTTP400/401/403/404/409/413/415/422/429 rejection releases the attempt for an explicit retry. Network loss, timeout, HTTP500, invalid success shape and cancellation after dispatch retain an unknown hold. No automatic POST retry occurs. A read-only GET/customer/profile is attempted while the captured session is still active; the returned URL is compared with the pre-upload snapshot (unchanged/changed/unavailable). The server profile may refresh displayed data, but a changed URL could belong to another device's replacement and cannot prove which bytes this request saved. An inconclusive result keeps upload blocked. The selected preview and hold survive editor remount. The existing inline photo error area and warning Toast explain the hold; no new control was added.

Recovery is intentionally in memory, cleared on Logout/account replacement and process termination. It is not a durable idempotency guarantee. The backend lacks an upload-operation identifier/checksum or conditional version; unresolved ambiguous outcomes cannot be safely attributed automatically. No recovery action silently repeats the upload.

Captured auth-user object, secure-token checks, AbortSignal, focus/mount generation and latest-image guards reject stale work. No old account's completion updates another account's cache or navigation. No passwords, tokens, image payloads or full profile responses are logged. Guests/demo cannot upload; preview remains local. Existing Login gate, session restoration and secure storage are unchanged.

## Synchronization and URL handling

The existing owner-scoped `['profile', id]` query remains authoritative. Before publishing a successful/observed profile or confirmed partial photo URL, older profile reads are canceled and session guards are checked again. Existing ProfileScreen and CustomDrawerContent observe this cache. Local unsaved URIs are never published. Login identity and secure credentials are not replaced.

ProfileDashboard has no avatar consumer and its statistics do not change; no Dashboard request or auth/me request was added. Complete GET/customer/profile data is sufficient. New randomized server URLs naturally invalidate image sources; no timestamp/random query or media host is fabricated.

## UI and scope preservation

Source inventory comparison against the pre-task EditProfileScreen snapshot confirms identical JSX element hierarchy, displayed JSX copy, style bindings and StyleSheet bytes. Existing avatar/ring dimensions and shape remain unchanged. Functional disabled/error guards change only with actual operation state. ProfileScreen, Drawer, Dashboard, navigation and all listing UI/service files were not edited by Task18.

**SCREENSHOT VISUAL EQUIVALENCE: NOT VERIFIED.** Source/unit evidence is not a device rendering comparison.

Existing unrelated notification violations found during inspection (for example Drawer sign-out cleanup Alert feedback) are left for a separately authorized cleanup task. No new Alert/ToastAndroid/Snackbar/notification library was introduced; the existing global react-native-toast-message design is untouched.

**No avatar DELETE is called or implemented.** Existing local Remove Photo drafts remain unsupported on Save and cannot remove a server avatar (Task19 dependency).

## Files changed by Task18

Production:

- src/features/profile/services/profileAvatarService.ts — shared mutation lock/recovery and read-only reconciliation.
- src/features/profile/services/profilePhotoService.ts — RN accessibility/dimension decoding.
- src/features/profile/services/profileEditService.ts — safe uncertain-outcome copy through existing error formatter.
- src/features/profile/screens/EditProfileScreen.tsx — lifecycle/preview/recovery guards and existing cache/Toast integration, no layout/style changes.

Tests:

- __tests__/profileAvatarSafety.test.ts — new40tests.
- __tests__/EditProfile.test.tsx — eight additional lifecycle/recovery/duplicate tests, native decoder fixture; existing retry case now uses a definite422 rejection, separately covered network ambiguity cannot be retried.
- __tests__/profileAvatar.test.ts — reset auth between fixtures to isolate mutation recovery.
- __tests__/profileEdit.test.ts — explicit native decoder fixture for picker tests.

Documentation: docs/PROFILE_AVATAR_UPLOAD_API_INTEGRATION.md (this report). Diagnostic snapshots/logs/JSON under ignored .validation/task18. No existing assertion was removed, skipped or weakened; existing two unrelated skips remain.

## Executed verification

- Pre-change baseline: node node_modules/jest/bin/jest.js --runInBand __tests__/profileAvatar.test.ts __tests__/EditProfile.test.tsx __tests__/profileEdit.test.ts --json --outputFile=.validation/task18/baseline.json — **3suites/37PASS**, exit0,20.190s.
- Focused safety: profileAvatarSafety.test.ts — **40PASS**, exit0,8.024s.
- Focused/regression command: node node_modules/jest/bin/jest.js --runInBand --detectOpenHandles [21files listed in .validation/task18/regression.log] --json --outputFile=.validation/task18/regression.json — **21suites/401PASS**, exit0,31.824s. Includes all four avatar/editor suites, profileUpdateApi/profileApi/ProfileApiScreen/Profile/DrawerProfile/ProfileDashboard, loginApi/loginService/authFlow/logoutApi/sessionLogout and listingImageUploadApi/ListingImageFlow/listingImageDeleteApi/ListingImageDelete/updateListingApi/UpdateListing. No open-handle finding.
- Full suite: PENDING.
- TypeScript: node node_modules/typescript/bin/tsc --noEmit — exit0. An initial new useState initializer type error was corrected; final output is clean.
- Scoped ESLint: node node_modules/eslint/bin/eslint.js [the four production and four test files above] — exit0, no warnings.
- Android arm64: PENDING.
- git diff --check: PENDING.
- UI inventory: .validation/task18/ui-integrity.json; stylesByteEquivalent=true, jsxHierarchyStylesAndTextEquivalent=true.

An intermediate full run recorded92passed suites,1failed suite and2existing skipped suites;1,351passed tests,1failed test and2skips, exit1,185.681s. The existing App.test.tsx case "Home dashboard uses the real first name and routes every action through existing navigators" exceeded its5,000ms limit. No App/navigation test code or timeout was altered. This run preceded the final three snapshot-comparison tests; final verification is recorded separately. Logs: .validation/task18/full.log/full.json/full.exit.txt.

An intermediate focused run exposed a test rejecting a picker promise in the same React act batch as unmount, before unmount committed. The test now commits unmount before delivering the late result; the final lifecycle regression passes. No timeout, snapshot or skip was changed to hide a failure.

## Live verification and blockers

Fresh public connectivity probe used the configured environment URL and curl --connect-timeout5 --max-time10 /categories. Result **curl exit28 / HTTP000 / timed out after10seconds**, no response body. No protected request or customer mutation was attempted. Valid disposable customer credentials were not supplied. The previous Task17 HTTP200 connectivity is historical and does not establish current availability.

**LIVE AUTHENTICATED API: NOT VERIFIED.**

**PHYSICAL DEVICE: NOT VERIFIED.**

**SCREENSHOT VISUAL EQUIVALENCE: NOT VERIFIED.**

No APK was installed or operated. Actual gallery provider behavior, media host reachability, image bytes rendering, persistence after restart, and live replacement require a reachable server/test account/device. Unknown size metadata is delegated to Laravel. Ambiguous uploads remain held when attribution is impossible; no backend idempotency support was invented. Saved avatar deletion remains Task19.

## Scope confirmation

No Laravel/backend, database/schema/migration, website/admin, API contract, business-rule, navigation, Toast configuration, dependency or unrelated UI changes. Existing listing creation/upload/update/delete, reviews and messaging are preserved and included in regression/full-suite verification where stated. No new endpoint or avatar deletion was implemented.

## Reproducible command details

The focused/regression command uses these actual arguments (no test filter omissions within the selected21files):

```powershell
node node_modules/jest/bin/jest.js --runInBand --detectOpenHandles __tests__/profileAvatarSafety.test.ts __tests__/profileAvatar.test.ts __tests__/EditProfile.test.tsx __tests__/profileEdit.test.ts __tests__/profileUpdateApi.test.ts __tests__/profileApi.test.ts __tests__/ProfileApiScreen.test.tsx __tests__/Profile.test.tsx __tests__/DrawerProfile.test.tsx __tests__/ProfileDashboard.test.tsx __tests__/loginApi.test.ts __tests__/loginService.test.ts __tests__/authFlow.test.ts __tests__/logoutApi.test.ts __tests__/sessionLogout.test.ts __tests__/listingImageUploadApi.test.ts __tests__/ListingImageFlow.test.tsx __tests__/listingImageDeleteApi.test.ts __tests__/ListingImageDelete.test.tsx __tests__/updateListingApi.test.ts __tests__/UpdateListing.test.tsx --json --outputFile=.validation/task18/regression-complete.json
```

Scoped lint uses exactly:

```powershell
node node_modules/eslint/bin/eslint.js src/features/profile/services/profileAvatarService.ts src/features/profile/services/profilePhotoService.ts src/features/profile/services/profileEditService.ts src/features/profile/screens/EditProfileScreen.tsx __tests__/profileAvatarSafety.test.ts __tests__/profileAvatar.test.ts __tests__/profileEdit.test.ts __tests__/EditProfile.test.tsx
```
