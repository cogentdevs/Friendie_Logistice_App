# Edit / Update Profile API

Contract verified from `docs/API_REFERENCE.md`, Laravel `routes/api.php`,
`CustomerController::updateProfile/profileData`, and `CustomerEmailChangeService`.
No backend or database files were modified.

## Request and response

`PUT /customer/profile`, relative to the existing `/api/v1` Axios base URL.
JSON with the current real Bearer token. No multipart body.

Supported partial fields: `name`, `email`, `phone`, `country_id`. At least one
supported field is required. Omitted fields remain unchanged; included fields
must be nonempty/non-null. Name/email/phone have maximum 255 characters. Email
must be valid and unique; phone must be unique; country must be an active existing
ID. Country IDs reuse the existing configured registration/reference snapshot.
No extra country API was integrated. Existing international-phone form validation
is retained; untouched missing contact fields may be omitted in a partial update.

HTTP 200:

```json
{
  "success": true,
  "message": "Profile updated successfully.",
  "data": {
    "profile": "same complete object returned by GET /customer/profile",
    "verification_required": false,
    "reauthentication_required": false
  }
}
```

On an actual email change, the message is
`Profile updated. Verify your new email and sign in again.`, both flags are true,
verification is reset, and all personal access tokens are revoked. The frontend
conditionally removes the captured credential, cancels pending auth actions and
uses the existing Guest Home/private-cache cleanup lifecycle. It does not call
the Logout API, auto-login, or fabricate email delivery confirmation.

Other successful text updates retain the session. The existing Login identity
and secure credentials are not overwritten by profile data.

## Form, cache and feedback

- Name/email/phone prefill from the existing owner-scoped Profile query. Country
  calling-code selection prefers real profile country code/ID and falls back to
  existing phone-prefix information. Unknown country remains unselected.
- GET and PUT share the same verified profile DTO normalization, including actual
  country metadata; no route coordinates or statistics are invented.
- The loaded form baseline stays stable while editing. Only changed supported
  text fields are sent. Photo uploads now use the separate avatar endpoint;
  unsupported photo removal drafts still block saving with a Toast.
- Complete successful profile data updates `['profile', ownerId]` after cancelling
  older GET requests. Existing ProfileScreen and Drawer observers react to this
  same cache without a second store or an additional required GET.
- `react-native-toast-message`'s `Toast.show()` handles success/error/validation/operation-in-progress
  feedback. Safe Laravel field errors remain inline. Existing discard/photo-source
  confirmation workflows are preserved; no notification library was added.
- Network failures preserve edits. Duplicate UI/service submissions are blocked;
  retry is disabled. AbortSignal plus owner-object/token checks reject stale
  responses after navigation, logout, account replacement or token replacement.
- Guest/Demo calls are rejected before network access; demo behavior is not
  replaced by fabricated backend updates.

## Image integration follow-up

Avatar upload (`POST /customer/profile/avatar`) and removal (`DELETE` same path)
are separate from this text endpoint. Upload was integrated in the subsequent
avatar fix; see `PROFILE_AVATAR_UPLOAD.md` for its verified multipart contract,
preview handling and cache synchronization. Avatar removal remains unimplemented.

## Verification limitations

Live invalid-token PUT returned HTTP 401. No real account credentials/token were
available for an authenticated live update, email verification delivery, or
restart/device UI test. Controlled Axios/service and screen tests verify request,
response, cache, session and error behavior. No device app was operated.

If secure credential removal fails after a confirmed email change, feedback
explicitly distinguishes the completed server update from failed local sign-out;
no server Logout success is claimed. A request already accepted by Laravel cannot
be undone by navigating away or aborting the client request.

## Changed files

- `src/features/profile/services/profileEditService.ts`
- `src/features/profile/services/profileService.ts` (shared DTO normalization and
  actual country metadata only; GET endpoint/response contract unchanged)
- `src/features/profile/schemas/editProfileSchema.ts`
- `src/features/profile/screens/EditProfileScreen.tsx`
- `src/features/auth/services/sessionLogout.ts` (owner/token-guarded local cleanup
  helper; existing Logout API workflow unchanged)
- `__tests__/profileUpdateApi.test.ts` (new)
- `__tests__/EditProfile.test.tsx`
- `__tests__/profileApi.test.ts`
- `__tests__/profileEdit.test.ts`
- `docs/UPDATE_PROFILE_API_INTEGRATION.md` (new)

## Executed checks

- Combined integration/regression run: 12 suites, 154 tests passed (Register,
  Login, Logout, Forgot Password, Get Profile, Change Password, Drawer, Edit).
- After adding nullable-contact, background-edit, email-return, duplicate and
  logout cases, final focused run: 3 suites, 36 tests passed. A shared test fixture
  mutation was corrected; the rerun used `--testTimeout=20000` after a slow initial
  renderer timeout while the concurrent Android build was running.
- `npm run typecheck`: passed.
- Scoped ESLint: passed without warnings.
- Additional existing `sessionLogout.test.ts` regression: 9 tests passed.
- `app:assembleDebug -PreactNativeArchitectures=arm64-v8a`: BUILD SUCCESSFUL in
  1m33s. No device installation or operation was performed.
- EditProfileScreen StyleSheet matches Git HEAD exactly. No theme, typography,
  spacing, navigation structure, Drawer layout or notification styling changed.
- Live PUT with an intentionally invalid Bearer token: HTTP 401. Authenticated
  live persistence, restart, email delivery and physical-device UI remain untested.
