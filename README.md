# Friendie Logistics mobile foundation

Bare React Native Community CLI, React Native 0.88.1, React 19.3.0, strict TypeScript, npm. No Expo packages. This repository contains infrastructure, reusable components and navigation placeholders; detailed screens come later.

## Run on Windows / Android

Prerequisites: a React Native supported Node release (`^22.13.0 || ^24.3.0 || >=26.0.0`), JDK 17, Android Studio, SDK platform 37, build-tools 37.0.0, NDK 27.1.12297006, and a connected device/emulator. ANDROID_HOME must point to the Android SDK. Existing Gradle 9.4.1 / AGP 9.2.1 settings are retained; Kotlin is aligned to 2.2.10 with the RN Gradle plugin and AsyncStorage KSP.

```powershell
npm ci
Copy-Item .env.example .env
# Edit .env, then:
npm run configure:env
npm start
# Second terminal:
npm run android
```

Windows C++ staging uses a short, checkout-specific directory under the system temporary folder to avoid Ninja's 260-character limit. Override it with the FRIENDIE_CXX_ROOT Gradle property when necessary. Keep several GB free on the project drive; npm run android builds only the connected device architecture and uses Metro on port 8081. Start npm start in a separate terminal first; automatic packager startup is disabled to prevent an accidental switch to port 8082. Direct Gradle builds retain all configured architectures. Metro and Jest exclude native build trees from file discovery.

On Windows, generated Android build directories are junctions into a checkout-specific `%TEMP%/friendie-native-*` cache (C: on this machine). Sources/assets stay in the checkout and APK paths remain unchanged. `preandroid` ensures these links before building. Existing populated build folders can be migrated with `npm run android:cache` while Gradle is idle; migration verifies copied file counts/sizes before removing the old generated copies. Do not run a build concurrently with the one-time migration. If temporary-cache cleanup removes a target, the next `npm run android` recreates it and Gradle regenerates outputs.

`npm start` now checks Metro health and the project-root response header. It reuses a healthy server for this checkout instead of starting a duplicate on 8081. A different project/server is rejected. Startup flags such as `--reset-cache` require stopping the existing server first. Use `npm run test:workflow` to check the build-cache and Metro startup helpers.

The postinstall script adds AGP namespaces to the published geolocation 5.3.1 and linear-gradient 2.8.3 Android sources and removes their obsolete manifest package attributes. This is a repeatable, narrow compatibility shim, not manual module linking. Revisit it when those packages update. Never use --force or --legacy-peer-deps.

`npm start`, `npm run android`, and `npm run ios` generate public environment configuration automatically. Direct Gradle/Xcode/Metro bundle commands require `npm run configure:env` first. Variables are generated from .env into a TypeScript-imported JSON file; React Native does not read process.env at runtime. Generated configuration is public mobile data, never secrets. The committed JSON is safe and unconfigured by default.

## Preview and authentication

Set `NAVIGATION_PREVIEW=true` in .env to browse the drawer and tabs in a debug build, then regenerate configuration and reload Metro. The preview is also gated by `__DEV__`, creates no token, does not authenticate a user, and is disabled in release. Keep it false for onboarding/auth tests. Production entry requires a securely stored Sanctum token and successful profile hydration. Sign In now uses React Hook Form/Zod with the supplied logo, field validation and secure auth service. Register and password recovery remain placeholders awaiting their designs. Social providers are omitted because no provider SDK/configuration is supplied.

Bootstrap hydrates preferences and location, restores the secure session, and exposes retry on connection/configuration errors. A 401 removes the token, clears protected state and the React Query cache, and returns to guest navigation. Offline restoration preserves the token and displays retry. Logout attempts server revocation and clears local state after secure token removal; a failed revocation requires backend follow-up. Tokens are stored only with react-native-keychain, never Zustand persistence or AsyncStorage.

## Laravel API contract (proposed, not verified)

Set `API_BASE_URL` to your actual Laravel API prefix, for example `http://YOUR_COMPUTER_LAN_IP:8000/api/v1` for Android debug. Android emulator can use `http://10.0.2.2:8000/api/v1`. A physical device needs LAN access. Release APIs must use HTTPS. iOS transport security remains enabled; prefer HTTPS there.

Confirm these routes with the backend before connecting:

| Operation | Proposed route | Expected response |
| --- | --- | --- |
| Login | POST /auth/login | `{token: string}` for a Sanctum personal access token |
| Session/profile | GET /user | `{data: User}` |
| Logout | POST /auth/logout | revoke current token |
| Listings | GET /listings | `{data: Listing[], meta: {current_page,last_page,per_page,total}}` |

Set AUTH_API_VERIFIED=true only after confirming the login/profile paths and response DTOs with the actual Laravel backend. With the default false or an empty API_BASE_URL, Sign In fails locally as unavailable and sends no credentials. Login sends normalized email, unchanged password, and device_name. Adapt endpoints.ts and DTO mapping to the real contract. No Laravel files were modified. Axios includes JSON headers, secure bearer tokens, timeout, AbortSignal cancellation, and normalized 401/403/404/422/429/5xx/network errors. Field validation errors remain available on ApiError.fields. Query hooks own server data and pagination; Zustand owns preferences and local filters only.

## Navigation

One NavigationContainer mounts after restoration so cold-start links are processed after session state is known. RootStack gates Splash / Onboarding / AuthStack / AppDrawer. The application drawer wraps MainTabs, and each tab owns a module-scoped native stack:

```text
RootStack
  Splash
  Onboarding
  AuthStack: Login, Register, ForgotPassword, ResetPassword(token,email?)
  AppDrawer
    MainTabs
      HomeStack: Home, Search, Filters
      ListingsStack: Listings, ListingDetails(listingId)
      PostListingStack: PostListing, SendParcel, CarryParcel
      MessagesStack: Conversations, Chat(conversationId)
      ProfileStack: Profile, EditProfile
    MyListings, SavedListings, MyReviews, Notifications,
    Tracking, Settings, HelpSupport, About
```

Typed NavigatorScreenParams connect all stacks. Headers appear at feature stack level, with menu access at primary routes and back buttons on details. Drawer pages use drawer headers. Custom tabs include safe-area bottom padding and the burgundy center Post action. Tabs currently remain visible on nested feature screens; future full-screen details can move to a root presentation as needed. Authenticated routes are not available to guest links. Deferred notification targets route after authentication. `friendie://listings/123`, `friendie://messages/456`, and `friendie://reset-password/TOKEN?email=...` are configured. Universal/app links require real domains and association files later.

## Design and structure

Brand tokens live in src/theme. palette.json supplies both colors.ts and Tailwind so they cannot drift. Primary #C10037, dark #97002B, navy #0D233E, white backgrounds and soft pink surfaces follow the supplied specification. Typography uses system fonts; no Inter files were supplied. No visual reference image was attached, so exact image matching has not been claimed.

NativeWind 4.2.7 uses Tailwind 3.4.19, nativewind/babel, withNativeWind and global.css. The namespace-export Babel transform supports Zod v4 ES modules; the Worklets Babel plugin is last. Placeholder branded surfaces use NativeWind classes so styling is exercised in the shell. Reusable components use centralized tokens and typed props.

```text
assets/                     (add real fonts/images when supplied)
src/
  app/                      providers, bootstrap, generated public config
  navigation/               typed root/auth/drawer/tab/feature stacks, linking
    components/             custom tabs, drawer, menu and back buttons
  features/
    auth/                   schemas, hooks, service, placeholder screens
    onboarding/             splash and onboarding placeholders
    home/                   home placeholder
    listings/               service, paginated query hook, placeholders
    search/                 filter store and placeholders
    location/               types, persisted selection, GPS/Places services
    post-listing/           send/carry placeholders
    messages/               conversation/chat placeholders
    profile/                profile/edit placeholders
    notifications/ reviews/ saved/ settings/ tracking/  placeholders
  components/               ui, layout, shared placeholder shell
  services/                 API, storage, notification abstraction
  store/                    auth state and persisted UI preferences
  theme/ hooks/ utils/ types/ constants/
scripts/                    public environment generation, native compatibility
__tests__/ test/             foundation tests and native test doubles
android/ ios/ docs/
```

Only meaningful implemented folders are created. Add assets/fonts, images, icons and animations when real assets are supplied. Existing Android package `com.friendie_logistics_app`, native folder names, and Xcode target remain stable to avoid recreating an existing project. The JavaScript registered component is FriendieLogistics and displayed application name is Friendie Logistics. Choose final release bundle IDs before creating Firebase apps.

## Foreground location and maps

LocationSelection is explicitly either worldwide or a radius filter with source gps/manual, real latitude/longitude and a positive radiusKm. GPS originates from the device coordinates and exposes measured accuracy. Manual resolution and map pin changes supply the radius origin; geographical area centers are never substituted for GPS. An explicit GPS request cannot overwrite a manual choice made while that request is pending. Stored selection is a preference; GPS acquisition does not start automatically.

Only foreground fine/coarse location is declared. Runtime handling covers denial, permanent blocking, unavailable services, disabled services, timeout and accuracy. Android allows approximate permission; callers should inspect accuracyMeters when choosing a radius. No background location or continuous tracking. Laravel remains authoritative for listing distance calculations; the Haversine utility is for display only.

PlacesProvider and placesService prepare search, place resolution and reverse geocoding through a configured authenticated Laravel proxy (`PLACES_PROXY_URL`). The proposed proxy responses are `{data: PlaceSuggestion[]}`, `{data: Coordinates}`, `{data: string}` at /search, /resolve and /reverse respectively. These endpoints must be implemented separately. No paid Google request is made by default, and no Google server credential belongs in the mobile bundle.

Android Maps API key: set FRIENDIE_MAPS_API_KEY in your user-level Gradle properties (`~/.gradle/gradle.properties`) or build environment. The manifest placeholder reads it. Mobile SDK keys are extractable from an APK: restrict them to the Android application ID and signing SHA fingerprints. Enable Maps SDK and billing in your own project. Without a key, map rendering is pending; no map screen is mounted by the placeholder foundation.

## Firebase and notifications

Packages are installed; delivery remains disabled until real Firebase configuration is supplied. Android: register the actual application ID, download google-services.json into android/app, then set FIREBASE_ENABLED=true and rebuild. Gradle applies the Google Services plugin only when that file exists. iOS: add the real GoogleService-Info.plist to the Xcode target; AppDelegate initializes Firebase only when the bundled file exists.

The notification service provides user-triggered permission requests, device-token retrieval, foreground subscriptions, token refresh subscriptions, background handler registration, cold/background-open handling and validated listing/chat navigation targets. The headless background handler is deliberately inert until the inbox/backend contract exists. Nothing pretends to send or receive notifications. Bind token updates to the authenticated backend when the endpoint exists; bind onForeground to the later inbox/UI implementation. RNFirebase 27 retains the requested FCM token interface but marks it deprecated in favor of Installation ID messaging; coordinate a server migration before opting into FID.

## iOS on macOS (not tested on Windows)

1. Install supported Xcode/CocoaPods and run bundle install, then `cd ios; bundle exec pod install`.
2. RNFirebase 27 / Firebase Apple SDK 13 requires SPM plus dynamic frameworks. The Podfile uses `use_frameworks! :linkage => :dynamic` per the installed package instructions. Do not copy older static-Firebase pod guidance. Review Xcode SPM resolution and deployment targets on macOS.
3. Permission handlers and descriptions cover foreground location, camera, photo library and notifications. No background location capability is enabled. Image library selection uses the native picker.
4. MapKit is the default iOS map provider. For Google Maps, install pods with FRIENDIE_IOS_GOOGLE_MAPS=true, provide an iOS-restricted Maps SDK key via the FRIENDIE_MAPS_API_KEY Xcode build setting, and select Google provider only after configuration. The Info.plist build-setting entry and conditional AppDelegate initialization are prepared.
5. Add real Firebase plist to target membership, enable Push Notifications, configure APNs credentials in Firebase, and enable Remote notifications background mode only when delivery is configured. Do not enable background location.
6. Choose signing team/bundle ID, verify URL schemes, then run npm run ios. No Xcode, CocoaPods, signing or iOS build has been executed on Windows.

## Checks

```powershell
npm run typecheck
npm run lint
npm test -- --runInBand
npx react-native doctor
npm ls --depth=0
```

See docs/SETUP_REPORT.md for the actual results and remaining limitations, and docs/DEPENDENCIES.md for installed runtime versions. Do not infer a passing device test from an automated mock-based test. Release signing still uses the original template debug configuration and must be replaced with the real upload keystore/CI signing before any release distribution.

Official setup references used: [NativeWind bare installation](https://www.nativewind.dev/docs/getting-started/installation), [Reanimated compatibility](https://docs.swmansion.com/react-native-reanimated/docs/guides/compatibility/), [React Native Permissions](https://github.com/zoontek/react-native-permissions), [RNFirebase setup](https://rnfirebase.io/), [RNFirebase v27 migration](https://rnfirebase.io/migrating-to-v27). Installed package READMEs and native source were also inspected.

### Logo asset

Use the shared BrandLogo component from src/components/common/BrandLogo.tsx for every logo placement. Welcome uses the user-supplied src/assets/logo.png; all other screens use src/assets/logo1.png. Preserve original proportions and colors; do not recreate the logo with text/icons, tint it or substitute another image.

### UI-only development workflow

Debug builds currently default UI_PREVIEW_ENABLED=true: tap Sign In to open Home with no credentials or API request. This is labeled development navigation, creates no session/token, and can be exited from the drawer. Set UI_PREVIEW_ENABLED=false in .env and regenerate configuration for real auth testing. Release builds always require real authentication. See docs/UI_PREVIEW_REPORT.md.

### Advanced location filters

See docs/SCREEN_08_REPORT.md for GPS/manual radius behavior, validation and integration limits. Places requests require both PLACES_PROXY_URL and PLACES_API_VERIFIED=true after its contract is verified. Listings and count previews remain unavailable until the Laravel contract is verified.

### Listings results

See docs/SCREEN_09_REPORT.md for the results UI, pagination, device-local bookmarks, checks and pending verified Laravel integration.

### Listing details

See docs/SCREEN_10_REPORT.md for the details layout, action guards and pending Laravel request/contact integrations. The detail contract has its own LISTING_DETAILS_API_VERIFIED flag and remains disabled until verified.

### Chat conversation

See docs/SCREEN_11_REPORT.md for the chat lifecycle, foreground polling fallback, memory-only drafts and pending verified chat/idempotency/upload contracts. CHAT_API_VERIFIED and CHAT_IDEMPOTENCY_VERIFIED default false.

### Listings UI demo

Debug UI preview now shows labeled sample listings and matching details. Tap Sign In, then Listings. See docs/LISTINGS_DEMO_REPORT.md. Real-auth/release builds keep verified API behavior.

### Post a Listing

The Post tab and existing Send/Carry entries now open the validated route/date/weight form. Continue opens an in-memory draft review; no listing is published. See docs/SCREEN_12_REPORT.md for draft/back behavior, validation and remaining publishing steps.

### UI development: screen access

In active debug UI preview, keep every implemented app screen reachable with demo IDs. Bottom tabs stay visible; Messages contains sample chats plus Post/Details/Search/Filters shortcuts. Demo listing Message opens a local-only sample chat. No real login is needed for these preview flows. See docs/UI_PREVIEW_ACCESS_REPORT.md.

### My Listings

Open Home -> My Listings or Messages -> Preview My Listings in UI preview. Active/Completed/Expired have labeled sample rows and matching details IDs. Real reads require MY_LISTINGS_API_VERIFIED and an authenticated server-scoped endpoint; management mutations are not connected. See docs/SCREEN_13_REPORT.md.

### Premium Profile

Open the existing Profile bottom tab. UI preview includes labeled sample statistics; real profile reads require PROFILE_API_VERIFIED. Confirmed Logout clears the secure session and user-specific local state. See docs/SCREEN_15_REPORT.md for changed files, validation and pending integrations.

### Premium Register

Sign In -> Register opens the validated account form. Configure real TERMS_URL and PRIVACY_URL for legal documents. Registration remains honestly unavailable until a verified Laravel registration contract is supplied; no account or session is fabricated. See docs/SCREEN_16_REPORT.md for implementation, tests and remaining dependencies.

### Forgot Password

Sign In -> Forgot Password opens the validated recovery form. Debug UI preview includes a clearly labeled confirmation preview. Real reset requests and reset-token links remain unavailable until the Laravel endpoint and approved HTTPS contract are verified. See docs/SCREEN_17_REPORT.md for security decisions, changed files and checks.

### Edit Profile

Profile -> avatar/name opens the prefilled editor. Development preview supports local camera/gallery drafts with an explicit preview limit; real Save/upload remain unavailable until verified update/upload contracts are supplied. See docs/SCREEN_18_REPORT.md for navigation, validation, permission handling and backend dependencies.

### Change Password

Profile -> Settings gear -> Change Password opens the secure password form. Real updates remain unavailable until the authenticated Laravel endpoint, password policy and session-revocation contract are verified. See docs/SCREEN_19_REPORT.md for session handling, changed files and validation.

### Advanced Premium Home

Home now includes the website-inspired hero, structured search, categories, destinations, latest-ad carousel and a single carrying promotion. Existing navigation and radius modes are preserved. New feeds are clearly labeled demo data in UI preview; production feeds and country/weight query mappings require verified backend contracts. See docs/ADVANCED_HOME_REPORT.md for files, navigation, APIs and validation.

### Approved Profile dashboard

Profile now has exactly Dashboard, Edit Profile, My Listing, Messages, Reviews, Change Password and Logout. The editor contains identity/contact fields and photo upload/remove previews with a 10 MB client limit; City/Area are omitted. Existing global features remain available. See docs/PROFILE_RESTRUCTURING_REPORT.md for current navigation, backend dependencies and checks (supersedes earlier Profile/Edit Profile descriptions).

Profile > Dashboard now opens the dedicated account dashboard (not Home). Implementation, backend limitations and validation: [Profile Dashboard report](docs/PROFILE_DASHBOARD_REPORT.md).

Contact Us is available directly from Drawer > Contact Us. Configuration and backend dependencies: [Screen 25 report](docs/SCREEN_25_REPORT.md).

About Us is available from the existing drawer About entry. Draft copy, native version metadata and legal-link dependencies: [Screen 26 report](docs/SCREEN_26_REPORT.md).

Privacy Policy opens from Drawer, About and Register in the existing root stack. The bundled outline is explicitly a draft until approved company policy is supplied: [Screen 27 report](docs/SCREEN_27_REPORT.md).

Terms & Conditions opens from Drawer, About and Register using the shared legal reader. Content remains a draft pending approved Terms and backend consent/version rules: [Screen 28 report](docs/SCREEN_28_REPORT.md).

Disclaimer is available from Drawer and About and links to Terms, Privacy and the shared public Contact Us form. Approved legal copy remains pending: [Screen 29 report](docs/SCREEN_29_REPORT.md).

Account Settings is available from Drawer > Settings or Profile settings. Supported navigation and preference-source limitations: [Screen 30 report](docs/SCREEN_30_REPORT.md).

Profile, Settings and Drawer share the premium auth-feature Log Out confirmation. Secure cleanup and validation details: [Screen 31 report](docs/SCREEN_31_REPORT.md).

Profile and Dashboard share one two-tab Reviews screen. Backend findings, changed files and validation: [Reviews report](docs/REVIEWS_REPORT.md).

Phase 1 public startup: completed/skipped onboarding now opens guest Home. Architecture, privacy boundaries, backend limits and validation: [Phase 1 report](docs/PHASE_1_GUEST_STARTUP_REPORT.md).
