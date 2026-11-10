# UI testing APK without credentials

The earlier release APK disabled UI preview through __DEV__. No hardcoded email/password or test account exists. The user's ongoing UI-only testing workflow now works in an explicitly configured testing release too.

TESTING_UI_PREVIEW=true in local .env opts this APK into preview; the example configuration defaults false. configure-env.cjs emits the public flag. appConfig and isUiPreviewAllowed centrally require either development runtime or explicit testing opt-in, plus UI_PREVIEW_ENABLED. Normal production builds without opt-in retain actual authentication.

In the testing APK, leave email/password blank and tap Sign In. It enters the existing labeled preview navigation and demo services. No login request, token, secure credentials, or authenticated user is synthesized. Existing protected backend operations retain their authentication checks. Preview remains in-memory and Logout returns to Login.

Changed files: scripts/configure-env.cjs, .env.example, generated public configuration, src/constants/appConfig.ts, src/store/developmentStore.ts, RootNavigator.tsx, LoginScreen.tsx, ForgotPasswordScreen.tsx and listings/development/demoListings.ts. Tests updated: developmentPreview, Login and App (Home search assertions brought into line with the current dedicated Results navigation).

Validation: TypeScript passed; Login/development-preview 11 tests and App integration 23 tests passed (34 total). App suite retains a nonfatal act warning for an existing direct search-store reset. Final lint and APK packaging result will be appended after completion.

Production release preparation: set TESTING_UI_PREVIEW=false and UI_PREVIEW_ENABLED=false, regenerate configuration and rebuild. This testing configuration does not establish a real backend account.

Final validation: lint passed; release APK BUILD SUCCESSFUL in 11m 7s (741 tasks, 51 executed). APK signature verification passed. Updated installer: android/app/build/outputs/apk/release/friendie-ui-preview.apk. Device installation/runtime inspection was not performed for this change.

Superseded login behavior: the later demo-login testing APK now requires the public demo email/password requested by the user. See DEMO_LOGIN_APK_REPORT.md. Blank-field entry is no longer supported in that APK.
