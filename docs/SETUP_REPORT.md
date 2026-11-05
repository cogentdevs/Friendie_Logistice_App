# Foundation setup report

Date: 2026-11-04. Scope: React Native CLI foundation and working placeholders only.

## Environment and versions

- Existing project extended in place; no reinitialization or Laravel changes.
- React Native 0.88.1 / React 19.3.0 / TypeScript 6.0.3, strict mode.
- Node 24.13.0, npm 11.6.2, Microsoft OpenJDK 17.0.17.
- Android SDK available at the configured ANDROID_HOME; Android Studio and connected arm64-v8a device detected.
- React Native Doctor: PASS, zero errors and zero warnings on the elevated retry. Initial sandbox run could not invoke wmic.
- Gradle 9.4.1, AGP 9.2.1, compile SDK 37, build-tools 37.0.0, target SDK 36, minimum SDK 24, NDK 27.1.12297006. Kotlin aligned to 2.2.10 / matching AsyncStorage KSP. New Architecture and Hermes retained.
- NativeWind 4.2.7 with Tailwind 3.4.19; Reanimated 4.7.1 with Worklets 0.13.1.
- 30 requested runtime dependencies; see [complete version table](DEPENDENCIES.md). No Expo installed and no dependency conflict bypass flags used. The unused React Native welcome-screen package was removed.

## Delivered

- AppProviders and AppBootstrap: Gesture Handler root, safe areas, React Query, lifecycle refetch integration, persisted preference restoration and secure session restoration.
- Typed Root/Auth/Drawer/Bottom Tabs/five feature stacks, one NavigationContainer, custom drawer/tab/header/back components, deep-link configuration, root navigation reference and deferred notification routing.
- Burgundy center Post tab; Home, Listings, Post, Messages and Profile tabs; all requested drawer destinations and feature placeholders.
- Centralized exact brand palette shared with Tailwind, typography with system fallback, spacing, radius and shadows. No font files or visual reference image were supplied.
- Typed buttons, text, inputs, cards, badges, avatars, dividers, loading/empty/error states, safe/scroll/keyboard layouts and section headers.
- Axios client, proposed Laravel endpoint contract, secure Sanctum token storage, auth hooks/form schema, field-error normalization and cancellation, paginated listings query hook.
- Zustand auth/UI/search/location stores; explicit GPS/manual/worldwide modes, foreground permission handling, accuracy and error states, geocoding proxy interfaces and radius/pin selection state. Pending GPS cannot overwrite a newer manual selection.
- Credential-gated Firebase notification service, foreground/token-refresh interfaces, headless handler registration and open-notification routing. No fake auth, endpoints, credentials or notification delivery.
- Android permissions, Maps key placeholder, conditional Google Services integration, deep-link scheme and screens activity restoration factory.
- iOS permission descriptions/handlers, URL scheme, conditional Firebase initialization, optional Google Maps provider setup and current RNFirebase v27 SPM/dynamic-framework preparation.
- npm public environment generation, strict TypeScript, Jest/native test doubles, lint configuration and repeatable AGP compatibility shims for geolocation/linear-gradient.

The [README](../README.md) contains the final folder structure, full navigation hierarchy, setup commands, API contract, native credential steps and macOS instructions.

## Validation

| Check | Actual status |
| --- | --- |
| React Native Doctor | PASS: 0 errors / 0 warnings |
| TypeScript | PASS: final npm run typecheck / npm run lint completed |
| ESLint | PASS: final npm run lint completed with zero errors |
| Jest | PASS: 5 suites, 21 tests, including authenticated navigation and rejection of malformed profile responses |
| Android debug arm64 | PASS: debug arm64 build and installation on Infinix X655C / Android 10 |
| Production Metro bundle | PASS: Android production JS bundle and 23 assets generated in system temporary storage |
| Device navigation and gestures | Not fully verified: APK installed and app process had no captured ReactNativeJS/AndroidRuntime errors; foreground repeatedly changed during guarded inspection, so drawer/tab/gesture checks remain pending |
| iOS build / CocoaPods | Not run: Windows environment |

Development navigation preview was restored to false after device QA. Metro remains available on port 8081.

## Native compatibility notes

The Zod v4 ESM namespace-export issue was fixed with @babel/plugin-transform-export-namespace-from 7.29.7, ordered before the final Worklets plugin. Session and profile responses are validated before authentication state changes.

The requested geolocation 5.3.1 and linear-gradient 2.8.3 publish old Android namespace metadata. scripts/prepare-native.cjs applies narrow idempotent namespace/manifest shims after npm install/ci. They are otherwise autolinked. The Android build reports upstream AGP legacy-DSL deprecations and library Kotlin/Java deprecations; these are not a claim of AGP 10 compatibility. A disk-full failure was resolved by removing only old generated APK/native merge outputs and unused non-arm64 object outputs (about 2.2 GB, including recoverable duplicate native-library copies). A confirmed Ninja 260-character path failure was resolved with short checkout-specific temporary C++ staging; FRIENDIE_CXX_ROOT can override it. Cross-drive C: Gradle cache to G: project hard-link failures fall back to slower copies during first C++ builds.

Firebase credentials, paid Maps configuration and backend endpoints are intentionally absent. A successful native shell build does not validate those external services. Images, fonts, full production screens, live chat, tracking, real account forms and backend integrations are outside this setup stage.

The G: project volume remains low on free space after native compilation. Free additional space before wider ABI/release builds or installing more native dependencies; only generated artifacts were cleaned during this task.

## Remaining configuration before integration/release

1. Supply the real Laravel API URL, confirm authentication/profile/listing/Places proxy routes and DTO shapes. Implement token registration/revocation for notifications when the backend contract is available.
2. Choose final Android/iOS release IDs. The existing native package/target identities were preserved; JS component name is FriendieLogistics and display name is Friendie Logistics.
3. Supply real Android google-services.json and iOS GoogleService-Info.plist, configure APNs/push capability, and then enable FIREBASE_ENABLED. Firebase v27 still exposes the requested FCM token API but deprecates it in favor of Installation ID messaging; plan backend migration separately.
4. Supply restricted mobile Maps SDK keys and enable the SDK/billing. Google server keys stay on Laravel. iOS MapKit can be used without a Google key.
5. Complete the documented macOS pod/SPM resolution, Xcode signing, push capabilities and device/simulator checks. No iOS build was tested.
6. Add real licensed fonts/images and implement each screen from the next detailed prompts. Development navigation preview is gated by __DEV__ and is not authentication.
7. Configure a real release/upload keystore and CI signing: the original template release signing remains a debug key and must not be used to distribute production releases.
8. Review npm audit before release. The actual audit reports 49 findings: 7 low, 36 moderate, 6 high, 0 critical. The high findings are in the Firebase dependency chain, and npm suggests major downgrades for some remedies; no unsafe --force downgrade was applied. This foundation is not a security-reviewed release.

## Run

```powershell
npm ci
Copy-Item .env.example .env
npm start
# Second terminal:
npm run android -- --active-arch-only
```

Edit .env for real configuration. Set NAVIGATION_PREVIEW=true only for debug browsing of placeholders. Use npm run typecheck, npm run lint, npm test -- --runInBand, and npx react-native doctor for development checks.
