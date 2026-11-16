# Change Password API

Verified against `docs/API_REFERENCE.md`, Laravel `routes/api.php`, and
`CustomerController::changePassword`. No backend files were changed.

- `POST /customer/change-password` on the existing `/api/v1` Axios base URL.
- Real Bearer token from existing Keychain storage; no demo/guest requests.
- JSON: `current_password`, `password`, `password_confirmation`.
- Current password required, maximum 255 characters. New password required,
  Laravel default minimum 8 characters, confirmation, different from current,
  maximum 72 UTF-8 bytes. No additional complexity is imposed.
- Success: HTTP 200, `success: true`, message
  `Password changed successfully. Sign in again.`,
  `data.reauthentication_required: true`.
- Laravel revokes all mobile tokens and invalidates existing password-reset
  records. The frontend conditionally removes the captured local credentials,
  clears authentication and existing private cache, and returns through the
  existing Guest Home navigation lifecycle. No Logout API request is made.
- Existing centralized `showToast` handles success, errors and invalid form
  notifications. Field-specific Laravel 422 feedback remains inline.
- Password inputs reset on success/confirmed-change cleanup failure and blur.
  Failed network requests preserve input for retry. Mutation retry is disabled,
  mutation state is reset, and no passwords are persisted or logged.
- Owner-object/token guards prevent late responses from clearing another
  session. AbortSignal handles leaving the screen; a request already accepted
  by the server cannot be undone by cancellation.
- If Keychain removal fails after confirmed change, the existing secure-sign-out
  gate allows local cleanup retry without sending another password/Logout request.

Unrelated notification feedback using `Alert.alert` remains in:

- `src/navigation/components/CustomDrawerContent.tsx`: logout cleanup warning.
- `src/features/settings/screens/SettingsScreen.tsx`: logout cleanup warning.
- `src/features/profile/screens/ProfileScreen.tsx`: logout cleanup warning.
- `src/features/support/screens/ContactUsScreen.tsx`: request-in-progress notice.
- `src/features/profile/screens/EditProfileScreen.tsx`: operation-in-progress notice.
- `src/features/auth/services/authFlowCoordinator.ts`: invalid destination notice.

These are recorded for separately authorized cleanup; actual confirmation
dialogs are out of scope. New notification feedback must exclusively reuse
the existing centralized `showToast` system.

Live verification in this task used an invalid token and received HTTP 401.
No real account password was changed; positive response/session behavior is
covered by controlled frontend tests, not a live authenticated/device test.

Executed validation:

- Focused Change Password service/screen tests: 28 passed. Final screen rerun:
  11 passed after the stale-feedback guard adjustment.
- Register, Login, Logout, Forgot Password, Profile and Drawer regression suites
  passed. The first combined run exposed an incorrectly encoded emoji fixture;
  replacing it with Unicode escapes corrected the test, and focused reruns passed.
- `npm run typecheck`: passed.
- ESLint on changed TypeScript/test files: passed, no warnings.
- Android `app:assembleDebug -PreactNativeArchitectures=arm64-v8a`: successful,
  4m39s. Debug APK requires the existing Metro development setup.
- ChangePasswordScreen's StyleSheet block equals the Git HEAD version.
- Physical-device success Toast/navigation and live authenticated password
  mutation were not executed. No device app was installed or operated.
