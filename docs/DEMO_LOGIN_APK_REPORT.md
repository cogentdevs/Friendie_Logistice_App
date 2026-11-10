# Demo-login testing APK

Supersedes the previous credential-free UI-preview APK. Requested public demo credentials:

- Email: demo@friendie.test
- Password: Friendie@123

LoginScreen runs its existing React Hook Form/Zod validation in UI testing mode, then checks the explicit demo credentials. Empty/invalid credentials remain on Login with validation errors; a wrong pair shows an inline error. Email is normalized, password matching is exact. Correct credentials enter the existing UI preview, without calling Laravel login, creating an authenticated user, issuing a token, or storing the demo password.

The pair lives in src/features/auth/development/uiTestingLogin.ts and is a public UI-testing gate, not an actual backend account or security boundary. Non-preview login still uses the original API authentication. Explicit TESTING_UI_PREVIEW build configuration remains required for release UI preview; production configuration must leave it disabled.

Changed files: isolated uiTestingLogin.ts, LoginScreen.tsx, Login.test.tsx and App.test.tsx navigation scenarios. No native configuration or dependency changes are required for this update. Previous native APK path fixes remain in place.

Updated installer will be android/app/build/outputs/apk/release/friendie-demo-login.apk after successful packaging. Verification results will be appended at completion.

Completed validation: TypeScript and lint passed; 3 test suites / 34 tests passed, including blank and wrong login rejection, normalized email, correct demo credentials, no API login and no authenticated session. Existing App-suite act warning remains nonfatal. Release APK BUILD SUCCESSFUL in 8m 15s (741 tasks, 51 executed). Signature verification passed. Installer: android/app/build/outputs/apk/release/friendie-demo-login.apk. Device installation/runtime inspection was not performed. Detailed ignored log: .validation/apk-demo-login.log.
