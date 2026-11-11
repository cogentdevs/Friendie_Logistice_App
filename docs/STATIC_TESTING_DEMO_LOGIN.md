# STATIC_TESTING demo login fix

Credentials: demo@friendie.test / Friendie@123.

Only the explicit native STATIC_TESTING variant can resume protected UI destinations using demo preview. Normal guarded login still uses the existing backend authentication. No token, real authenticated user or contact authorization is fabricated.

Changes:
- src/features/auth/screens/LoginScreen.tsx: accepts testing credentials for guarded entry only in STATIC_TESTING, then coordinates pending UI navigation.
- src/store/developmentStore.ts: explicit static-preview predicate, memory-only.
- src/features/auth/services/authFlowCoordinator.ts: resumes pending target once for this explicit preview.
- src/navigation/RootNavigator.tsx: preserves public navigation group while static preview starts.
- src/navigation/components/AccountAccessBoundary.tsx: permits explicit testing preview UI; ordinary guests remain gated.
- src/navigation/ProfileNavigator.tsx: shows existing Profile UI during explicit testing preview without inventing user data.
- src/features/post-listing/screens/PostListingScreen.tsx: lets the testing user continue to draft review, without publication.
- __tests__/Login.test.tsx, __tests__/authFlow.test.ts, __tests__/App.test.tsx: credential, production isolation, idempotency and actual navigator tests.

Executed checks:
- TypeScript passed.
- Targeted ESLint passed.
- Login/auth-flow tests: 23/23 passed.
- Actual navigator demo login tests: 4/4 passed (Post, Send Parcel, Carry Parcel, Messages).

No device installation or interaction was performed for this update, as requested. Backend authentication, real requests, private contacts and account mutations remain unavailable without verified backend support. Preview is not a real authenticated session and resets when the app process restarts.

Build: android/gradlew.bat app:assembleStaticTesting -PreactNativeArchitectures=arm64-v8a --console=plain
Install/open Friendie STATIC TESTING, not normal app-release.apk.

Android build: BUILD SUCCESSFUL in 16m 50s; 711 tasks, 45 executed. Log: .validation/demo-login-apk.log. APK: android/app/build/outputs/apk/staticTesting/app-staticTesting.apk.
