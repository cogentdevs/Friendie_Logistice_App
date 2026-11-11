# Login keyboard and per-launch Splash fixes

Scope: only Login keyboard behavior and startup Splash visibility. Existing theme, image assets, auth/demo login, marketplace data and navigation destinations are unchanged by this update.

Root causes and changes:
- Android KeyboardScreen previously supplied no avoidance behavior. Login now opts into height avoidance; other screens retain the original default.
- ScreenContainer accepts an optional native scroll ref with unchanged styling. Login tracks the focused email/password input and reveals it through ScrollView's native keyboard scrolling method when the keyboard opens or focus changes while it is open.
- RootNavigator previously removed Splash immediately when restoration completed. Fast returning-user storage made it effectively invisible. A cancellable, per-mount 1000ms visibility gate now applies independently of saved onboarding completion. Startup restoration runs concurrently; slow restoration is still awaited. Onboarding preferences are not reset.

Application source files modified in this update:
- src/components/layout/KeyboardScreen.tsx
- src/components/layout/ScreenContainer.tsx
- src/features/auth/screens/LoginScreen.tsx
- src/navigation/RootNavigator.tsx

Tests updated:
- __tests__/Login.test.tsx: focused password gets scrolled above keyboard; existing login tests retained.
- __tests__/App.test.tsx: two cold launches both display Splash, then Home with completed onboarding; existing demo navigation tests retained.

Validation evidence is recorded under .validation/keyboard-splash-*.log and .validation/keyboard-login-tests.log. No device installation or interaction performed, preserving the user's APK-only preference. Physical keyboard behavior remains to be confirmed on the user's device.

Executed results: TypeScript PASS; targeted ESLint PASS; Login/Startup regression 18/18 PASS; Splash and demo navigator scenarios 5/5 PASS.

Android STATIC_TESTING build: BUILD SUCCESSFUL in 7m 6s; 711 tasks, 21 executed. Packaged source map confirms both fixes. APK bytes: 40024942. SHA256: 293E82E8319F95156F75E7D05CB5A4E5DDF22DFDC510E941118BB1A37185B7D0. APK: android/app/build/outputs/apk/staticTesting/app-staticTesting.apk.
