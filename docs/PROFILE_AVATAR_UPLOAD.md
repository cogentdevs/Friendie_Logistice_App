# Profile avatar selection, upload and synchronization

## Verified causes

The previous `profilePhotoService.validateAvatar` rejected WebP and any asset
without a positive known file size before `setPhoto` ran. The installed
`react-native-image-picker` 8.3.0 declares fileSize optional, and Android's native
implementation uses `ParcelFileDescriptor.getStatSize()` (unknown sizes can be
negative). These are reproducible ways a viewable selected image never reached
preview state. Ordinary JPEG/PNG with known size already previewed correctly.

EditProfileScreen also retained a failed URI after another selection of that
same URI, so the placeholder remained instead of retrying the image. Selection
now clears that failure marker. The actual reported phone asset/decoder trace
was not available, so its individual failure cause is not claimed as observed.

Saved photos could not propagate because the previous save adapter explicitly
rejected every selected photo. No multipart upload existed. Text-only
`PUT /customer/profile` does not accept images. A successful text save did not
prove that a photo had been uploaded.

## Verified contract and scope

The separate dependency was reported before implementation. Existing Laravel
`CustomerController::uploadAvatar`, `Services/Api/CustomerAvatarService` and the
saved API documentation verify:

- `POST /customer/profile/avatar`, current real Bearer token.
- Multipart file field **`avatar`**, no other fields required.
- JPEG/PNG/WebP, maximum **2 MiB**, dimensions 1–2048 in each direction.
- A MIME-compatible `jpg/jpeg/png/webp` filename extension is required. The
  server creates its own unique filename, not the original client filename.
- HTTP 200: `success: true`, message `Avatar updated successfully.`,
  `data.image_url` containing the server-generated absolute public URL.
- The backend decodes, scales down to 512×512 and writes a newly randomized JPEG
  filename for each upload. No client cache-busting timestamps are necessary.

This fix implements that existing upload endpoint only. The separate avatar
DELETE endpoint remains unimplemented and removal drafts still report that
limitation. No Laravel source, schema or business rules were changed.

## Frontend behavior

- Existing picker/native Image, dimensions, ring and layout are reused. Selected
  file/content URIs are retained exactly; no stripping prefixes or invented paths.
- WebP is supported. Unknown size metadata remains unknown and does not block a
  local preview; Laravel remains authoritative for file validation. Known oversized
  files are rejected locally. Picker max dimensions are 2048×2048. MIME type must
  be supported; cancellation preserves the current selection.
- The picker retains filename/dimension metadata. Upload filenames are sanitized
  and checked against MIME type, with a safe deterministic filename fallback.
- RN FormData holds one `{uri, name, type}` file descriptor under `avatar`.
  Existing Axios JSON defaults are overridden for this request only. The native
  Axios/XHR path supplies the multipart boundary; none is manually constructed.
- Save validates first and prevents duplicate operations. Photo-only Save uploads
  then calls the existing Get Profile service for a complete authoritative record.
  Combined Save uploads first, then uses the complete text-update response, avoiding
  another GET. Upload precedes email changes because email changes revoke tokens.
- Successful Save updates the existing `['profile', ownerId]` cache. ProfileScreen
  and Drawer already observe this data; no new store or image cache was introduced.
  Unsaved local URIs never enter that shared cache.
- Upload failure preserves the selected preview and edits for retry. If upload
  succeeds but a subsequent PUT/GET fails, feedback explicitly reports partial
  persistence and only the confirmed backend avatar URL may update the cache.
- Session object/token guards and cancellation discard late responses after
  logout, account/token replacement or leaving the editor. Guest/Demo uploads are
  rejected before network access. Existing logout clears private query data.
- All feedback uses the existing react-native-toast-message host. Existing real
  discard/source-choice dialogs remain. Photo help copy now reflects actual
  formats/limits; fonts, colors, spacing and avatar styles remain unchanged.

## URLs and limitations

The frontend uses the actual backend image URL and does not infer a media domain
from the API URL. Laravel's trusted media configuration must be reachable from
the device. A missing, relative or malformed upload URL is not treated as a fully
confirmed photo save. No backend configuration or production network security was
changed. Broken local image loading shows a Toast and the existing placeholder.

Actual backend persistence, image bytes rendering on the user's phone, media-host
reachability and app-restart verification require a real authenticated test session.
These were not claimed as executed. No phone app was installed or operated.

## Files

- `src/features/profile/services/profilePhotoService.ts`
- `src/features/profile/services/profileAvatarService.ts` (new)
- `src/features/profile/services/profileEditService.ts`
- `src/features/profile/screens/EditProfileScreen.tsx`
- `src/services/api/endpoints.ts`
- `__tests__/profileAvatar.test.ts` (new)
- `__tests__/EditProfile.test.tsx`
- `__tests__/profileEdit.test.ts`
- `__tests__/profileUpdateApi.test.ts`
- `docs/PROFILE_AVATAR_UPLOAD.md` (new)
- `docs/UPDATE_PROFILE_API_INTEGRATION.md`

## Executed verification

- 14 integration/regression suites: **187 tests passed**, including text profile
  updates, Profile/Drawer, Register/Login/Logout/Forgot/Change Password and local
  session cleanup. Tests cover selected preview, cancellation, failed-URI retry,
  failed-upload preview preservation and backend-only cache URLs on retry.
- Final upload-specific run: **16 tests passed**, including real RN FormData
  serialization, correct field/URI/name/MIME/Bearer, photo-only GET, combined PUT,
  email-revocation ordering, 401/403/413/422/500, malformed response, stale account
  response and partial-save feedback. The test bootstraps RN's actual FormData
  polyfill before Axios rather than Node's incompatible FormData implementation.
- `npm run typecheck`: passed.
- Scoped ESLint: passed without warnings.
- Android arm64 `app:assembleDebug`: **BUILD SUCCESSFUL in 5m40s**.
- EditProfileScreen StyleSheet equals Git HEAD; no avatar size/layout changes.
- Live invalid-token POST to the avatar endpoint returned **HTTP 401**. This
  verifies endpoint authentication only, not an authenticated multipart upload.
- No authenticated live image upload, rendered-device image, physical-device
  media reachability or app restart was executed; no phone app was installed.
