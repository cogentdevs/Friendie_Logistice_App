# Screen 17 - Forgot Password

## Implementation and access

Open Sign In -> Forgot Password?. The new src/features/auth/screens/ForgotPasswordScreen.tsx replaces the existing placeholder within AuthNavigator. Header/footer and confirmation CTA pop back to the existing Login screen. No extra navigation container, auth routes, tabs or drawer changes.

The white, safe-area-aware, responsive screen reuses BrandLogo (logo1), AppInput, GradientButton, KeyboardScreen and ScreenContainer. Its local icon composition combines a burgundy lock/envelope, soft pink circles and check badges; no suitable reset illustration asset was supplied and no remote artwork is used. The email field has a focus ring, email keyboard and inline validation. Scroll/keyboard layout uses existing Android adjustResize and iOS keyboard avoidance.

React Hook Form and Zod require a valid email and normalize whitespace/case. Query mutations do not retry; pending controls and an in-flight guard prevent duplicate keyboard/button submissions. Mutation state is reset after settlement with zero inactive cache retention; emails are not persisted, logged or displayed on confirmation.

## Request and confirmation security

No verified Laravel reset endpoint or acceptance response exists in this repository. passwordResetService is an explicitly unavailable integration boundary and makes no API request. It validates the domain input, then returns an honest unavailable error. No endpoint name, URL, emailed link, account or delivery result is fabricated.

A verified future API adapter must return the typed internal accepted result only after validating the actual server contract. The screen rejects unexpected results and shows the neutral confirmation only after that accepted result. Network/timeout, validation, rate-limit, server and unexpected failures are inline; backend message/field text is deliberately suppressed so account existence is not disclosed. Tests simulate server results/errors at this boundary and are not live email-delivery verification.

For the user's UI-only workflow, debug UI preview exposes Preview confirmation (UI only). This makes no request and prominently states that no request was made or email sent. It has a Back to reset form action. This preview is gated by both __DEV__ and UI_PREVIEW_ENABLED and does not imply accepted delivery.

No resend button or cooldown timer is implemented because support and cooldown policy are unknown. Before production integration, confirm reset request URL/payload, accepted response format, uniform anti-enumeration behavior, rate limits, timeouts and any resend policy. Connect through the existing Axios client only after verification.

## Reset links

Existing linking had an unverified friendie://reset-password/:token mapping. It is now removed: reset-token paths cannot enter ResetPassword. Generic Forgot Password navigation remains supported. No approved HTTPS host/path, app-domain association, token schema or required query parameters were supplied. Therefore no token links, custom-scheme reset links, reset URLs or analytics integration were added. ResetPassword itself remains the existing placeholder, outside this screen's scope. There is no configured secure web reset flow in this repo to invoke; configure the backend's real web flow or approved mobile flow before enabling recovery.

## Changed files

- src/features/auth/screens/ForgotPasswordScreen.tsx
- src/features/auth/schemas/forgotPasswordSchema.ts
- src/features/auth/services/passwordResetService.ts
- src/features/auth/screens/AuthScreens.tsx (removed Forgot Password placeholder)
- src/navigation/AuthNavigator.tsx (component and single custom header)
- src/navigation/linking.ts (disabled unapproved token route)
- __tests__/ForgotPassword.test.tsx, passwordReset.test.ts, linking.test.ts, App.test.tsx
- README.md and this report

## Validation and limits

Final checks are recorded below. No packages installed. Live Laravel acceptance/email delivery and iOS runtime cannot be verified without their integrations/platform.

- TypeScript: passed.
- ESLint: final check passed with no warnings.
- Full Jest suite: 32 suites / 202 tests passed. Coverage includes normalization, validation, neutral accepted confirmation, unexpected responses, sanitized validation/network/timeout/rate-limit/server failures, duplicate requests, back navigation, labeled UI preview and rejected reset-token paths.


- Android: npm run android succeeded in 41 seconds; APK installed on Infinix X655C and launch command completed. Existing Gradle deprecation warnings remain.
- Physical-screen review: guarded device inspection returned not_foreground, so visual/layout behavior on the actual phone was not confirmed. No interactions were sent to another app. Android layout is covered by the responsive implementation and component/navigation tests, not a completed visual smoke test.

