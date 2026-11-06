# Screen 19 - Change Password

## Access and navigation

Profile -> Settings gear -> Change Password. The existing Settings placeholder now has one functional Change Password entry; it has not been redesigned. A typed ChangePassword route is registered in the existing Drawer navigator with its native header hidden and swipe drawer gesture disabled. The screen provides one centered custom header/back action to Settings. No navigation container, navigator duplication, tab bar, new drawer item or password deep link was introduced.

## UI and form

The screen uses centralized colors, shared AppInput/GradientButton, safe areas, scrolling and keyboard avoidance. It includes a local lock/check icon composition, navy explanation, burgundy focus rings, three independently controlled secure inputs, a pale-pink security tip and pending/disabled/error states. Input focus order and return-key submission are functional.

React Hook Form + Zod require current/new/confirmation values and matching new passwords. The existing repo has no verified password-change policy. No minimum length, reuse rule or complexity requirement is invented. The UI explicitly states that the verified policy is unavailable. A typed schema factory can enforce confirmed minimum length, uppercase/lowercase, number, symbol and non-reuse rules when supplied by the verified contract. Registration's previous local UI baseline is deliberately not treated as backend policy.

## Backend boundary

There is no verified authenticated password-change endpoint, payload mapping, acceptance response or session-revocation policy in the repo. changePasswordService therefore validates domain input, checks authentication, and returns an honest unavailable error without any HTTP request. Development UI preview is accessible without creating a real session; submission remains unavailable and never fabricates an update or forces a fake-success logout.

The future verified adapter must use the existing Axios client and actual Laravel field names. It must validate a real accepted response and map authoritative session behavior to the internal updated/session result. Unexpected responses are rejected. No endpoint or token rotation response is assumed.

## Security and session behavior

- Passwords stay in form/mutation memory only. They are never stored in AsyncStorage or logged. Mutations do not automatically retry, use an in-flight duplicate guard, reset after settlement and have zero inactive cache retention. Fields and visibility reset on confirmed success and when leaving the screen.
- Validation errors and incorrect-current-password feedback are inline and sanitized. Network/timeout, rate-limit and server failures never produce a success message.
- Only a validated response for the still-current authenticated owner can show retained-session success or trigger revoked-session cleanup. Stale account responses cannot sign out another account.
- A confirmed revoked session or unauthorized response clears form secrets and uses the shared logoutSession flow: Keychain removal, user-specific cache/draft cleanup and authentication entry reset.
- If secure credential removal fails, the password form stays removed, the back action is disabled, native hardware back is intercepted and a Retry secure sign out action remains. Partial local-cache cleanup is reported by the existing logout flow.
- Existing Axios 401 handling can already clear authentication before this screen's catch handler runs; central cleanup still handles the remaining local state. Backend ownership/authentication, current-password validation, uniform error codes and session revocation remain server responsibilities.

Confirmed result and error paths are tested with mocked service responses, not a live Laravel password update. Production integration requires the actual endpoint/payload, verified policy, field-error mapping, success/session response and any token rotation/re-authentication semantics.

## Changed files

- src/features/settings/screens/ChangePasswordScreen.tsx
- src/features/settings/schemas/changePasswordSchema.ts
- src/features/settings/services/changePasswordService.ts
- src/features/settings/screens/SettingsScreen.tsx (one entry action)
- src/navigation/navigationTypes.ts, DrawerNavigator.tsx
- __tests__/ChangePassword.test.tsx, changePasswordService.test.ts, App.test.tsx
- README.md and this report

## Validation

Final check results recorded below. No packages installed. Live backend password update/revocation and iOS runtime are not verified.

- TypeScript: passed.
- ESLint: passed with no warnings.
- Full Jest run: 36 suites / 232 tests passed, covering visibility, required/matching inputs, configurable verified policy, no unverified HTTP request, confirmed retained/revoked outcomes, secure cleanup failure/retry, account-switch protection, duplicate submissions and Settings navigation.


- Android: npm run android succeeded in 1m 38s; APK installed on Infinix X655C and launch completed. Existing Gradle deprecation warnings remain.
- Physical visual check: the guarded device inspection returned not_foreground, so actual-phone layout/interactions were not confirmed. No other app was inspected or controlled. iOS build/runtime was not tested on this Windows host.

