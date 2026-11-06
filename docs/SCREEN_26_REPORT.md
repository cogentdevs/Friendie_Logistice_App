# Screen 26 - About Us

## Scope and files
- `src/features/about/screens/AboutScreen.tsx`: premium responsive native screen, custom safe-area header, soft pink/burgundy-tinted gradient hero with supplied logo1, Mission, four numbered How It Works cards, three feature cards and footer links.
- `src/features/about/content/aboutContent.ts`: clearly marked draft content based on the requested platform description; visible draft notice pending company approval. No invented company history, delivery guarantees, insurance or certifications.
- `src/features/about/services/appMetadata.ts`: reads installed native application metadata, with an honest unavailable fallback; never package.json or React Native engine version.
- Android `AppMetadataModule.kt` / `MainApplication.kt`: small registered native metadata module reading the installed package versionName.
- iOS `FriendieAppMetadata.m` / Xcode project: module reads CFBundleShortVersionString from the running app bundle.
- DrawerNavigator points the existing About route to the new screen with the default header hidden. The old settings AboutScreen path re-exports the same screen for compatibility. No duplicate screen/navigation container/tab bar or dependency installation.
- About.test.tsx covers copy/steps/logo/version, navigation and configured/missing/unsafe/failed legal links. App navigation coverage now includes About > Contact Us.

## Navigation and legal dependencies
Drawer > About opens About Us. Back uses existing drawer navigation, falling back to Home for a direct entry without history. Contact Us opens the existing ContactUs route.

No internal Privacy Policy or Terms routes exist. The screen reuses the existing app's approved HTTPS URL configuration (privacyUrl / termsUrl) rather than inventing document routes or legal content. Both URLs are currently empty: tapping shows an unavailable message. When configured, links open the actual document via Linking; failed opening reports an error and duplicate opens are prevented. This is the deviation from the request for all footer links to navigate internal existing routes: only ContactUs has such a route.

User Verification feature card is omitted because the actual verification process/integration is not confirmed. Existing verified badges alone do not establish that process. Community Reviews and other descriptive copy remain explicitly draft pending approval.

## Validation
Results recorded below when complete. iOS build cannot be executed in this Windows environment.

Executed validation:
- TypeScript passed.
- Full lint initially passed with a warning for an intentionally unsafe URL test literal; changed the test to reject HTTP instead. Final changed-files lint passed without warnings. Whitespace diff check passed.
- Existing App navigation suite: 22 tests passed, including About > ContactUs. About suite: 3 tests passed after resetting shared Linking mock history between tests (initial assertion failure was test isolation). No full-repository test rerun is claimed for this screen.
- Android arm64-v8a build/install passed on Infinix X655C, 407 tasks (21 executed). Compiler warned about the legacy ReactPackage native-module API and parameter names; module compiled successfully. Existing Gradle deprecation warnings remain.
- iOS source and Xcode registration added, but iOS compilation/runtime remain unverified on Windows.
- Foreground-guarded physical check returned not_foreground. Actual device layout/version rendering and large-font screenshots remain unverified.

Outstanding: approve draft company copy and configure Privacy/Terms HTTPS documents (or provide existing internal legal routes if those are added later). No backend endpoint was introduced or required for static draft content.
