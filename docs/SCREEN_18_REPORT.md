# Screen 18 - Premium Edit Profile

## Access and visual implementation

Profile -> tap avatar/name -> Edit Profile. The existing Profile native stack is reused, with one custom safe-area header and the existing tab bar. Profile editing is now reachable for real sessions as well as isolated development preview.

The editor has a centered 100px avatar, soft pink outline, burgundy camera overlay, photo action, verified/unverified/unknown status, navy form labels, burgundy focus rings, existing calling-code selector, structured location rows and Save Changes CTA. It reuses shared inputs, button, avatar, keyboard and scroll components. Bio is omitted because support is not verified.

## Data and persistence

The existing useProfile/getProfile query populates name, email and any supplied phone/location. Optional domain phone/location fields were added to the guarded profile schema; their actual Laravel mapping still needs verification. No personal data or locations are invented. Existing explicitly labeled development fixtures remain isolated.

Form and photo drafts stay in component memory. A stable loaded baseline prevents background refetches overwriting edits. Unsaved navigation removal requests show Keep Editing/Discard; native back and stack-removing actions use React Navigation usePreventRemove. Mounted tab switches retain the draft. Missing phone/location are left empty rather than fabricated. Unknown calling codes retain the supplied international number; the shared selector can now show Code until a supported country is chosen.

React Hook Form + Zod validate name, normalized email, optional phone format and structured location. Country/City/Area rows reuse the existing manual RouteLocationPicker: it edits the complete location together, clears dependent selections/IDs and does not use GPS. This is a manual-entry flow, not a newly invented geographical directory. Existing verification is read-only, and changes to contact fields explain possible re-verification.

## Photos

react-native-image-picker was already installed. Camera and gallery selection are functional for development preview. Cancellation/permission-denied/unavailable-camera/invalid-image states preserve the original and any existing draft. The selected image is explicitly an unsaved local preview and Restore original photo removes it. No profile/query/auth data is changed during selection.

The local preview accepts JPEG/PNG with known nonzero size up to 5 MB; this is explicitly a development safeguard, NOT a claimed backend upload policy. Only local file/content URIs are accepted; no base64 or EXIF is requested. Native unexpected picker errors are replaced with generic messages. Permission-denied UI offers device Settings.

Production photo selection/upload remains unavailable until a real upload endpoint and format/size policy are confirmed. Android uses the installed picker's system photo picker/camera intent without broad storage permission or declaring CAMERA; the installed library documentation says no extra permission is required for these options. iOS camera/photo-library usage descriptions were added for the native picker. iOS runtime was not available on this Windows host.

## Save boundary and remaining backend work

There is no verified profile-update endpoint, field allowlist, avatar-upload endpoint or contact re-verification contract. profileEditService therefore validates the typed domain form and throws an honest unavailable error without making an HTTP request. No endpoint or successful save is fabricated, including in UI preview. The original profile/photo remains intact.

The screen is prepared to accept a validated authoritative profile result from a future verified adapter: matching current authenticated owner is required before updating the owner-keyed query cache and auth store, then returning to Profile. Foreign-owner/session-changed/demo results cannot overwrite a real session. Server verification status is used as returned, not locally promoted. Tests mock this boundary to verify the behavior; they are not evidence of a live backend integration.

Pending submissions disable controls and share an in-flight guard. No automatic retries; failures retain the draft for retry. Laravel-style name/email/phone conflicts render inline; network/rate-limit/server/unexpected failures have clear error states. Credentials, selected image paths and profile information are not logged or persisted as drafts. Query mutation state is reset after settlement with zero inactive cache retention.

Before production: confirm the update/upload routes and supported fields, map international phone and structured location to the actual backend names/IDs, validate upload content/limits server-side, and supply confirmed contact re-verification semantics. Backend ownership authorization remains required.

## Changed files

- src/features/profile/screens/EditProfileScreen.tsx
- src/features/profile/screens/ProfileScreens.tsx (compatibility export)
- src/features/profile/screens/ProfileScreen.tsx (enable edit entry)
- src/features/profile/schemas/editProfileSchema.ts
- src/features/profile/services/profileEditService.ts, profilePhotoService.ts, profileService.ts
- src/navigation/ProfileNavigator.tsx
- src/features/auth/components/CallingCodeSelector.tsx (missing-code state)
- ios/friendie_logistics_app/Info.plist (picker usage descriptions)
- jest.setup.js, __tests__/EditProfile.test.tsx, __tests__/profileEdit.test.ts
- README.md and this report

## Validation

Results recorded after final checks. No new packages installed.

- TypeScript: passed.
- ESLint: passed with no warnings.
- Full Jest run: 34 suites / 217 tests passed, including prefill, validation, native image validation/cancellation/permission errors, original-avatar preservation, structured location, discard confirmation, duplicate saves, conflicts, network failures, owner checks and confirmed-result cache updates.


- Android: npm run android passed in 58 seconds; debug APK installed on Infinix X655C and launch command completed. Existing Gradle deprecation warnings remain.
- Physical smoke check: guarded inspection returned hierarchy_unavailable_or_not_foreground, so actual-device visual review and camera/gallery interaction were not completed. No other app was inspected or controlled. iOS build/runtime is unverified on this Windows host.

