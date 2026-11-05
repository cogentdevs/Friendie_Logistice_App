# Screen 02 — Send & Carry onboarding

Implemented src/features/onboarding/screens/SendCarryIntroScreen.tsx using the supplied src/assets/02_traveler_suitcase.png unchanged. The reference's light background, dark status content, upper-right Skip, large traveller illustration, centered two-line navy heading, paragraph, first active burgundy dot and gradient Next action are native components. Widths are constrained on tablets and the shared safe/scroll layout keeps content accessible on small screens and with larger text. No swipe gesture was added.

Navigation:
- Existing root Onboarding route now renders SendCarryIntroScreen.
- Welcome Get Started pushes this route so normal Android Back returns to Welcome. Direct-link entries with no previous route explicitly replace themselves with Welcome on hardware Back.
- Next pushes VerifiedReliable. Screen 03 update: its destination now renders VerifiedIntroScreen; Global Reach is the next labeled placeholder.
- Skip resets to AuthStack/Login, without completing onboarding or setting authentication. Guest routes expose no bottom tabs or drawer.
- friendie://onboarding remains supported; friendie://onboarding/verified points to the next destination.

Changed files:
- src/features/onboarding/screens/SendCarryIntroScreen.tsx
- src/components/ui/GradientButton.tsx (shared accessible gradient/arrow action, disabled/pressed states)
- src/features/onboarding/screens/WelcomeScreen.tsx (push rather than replacement, required for Back)
- src/features/onboarding/screens/OnboardingScreen.tsx (existing placeholder reused for next destination)
- src/navigation/RootNavigator.tsx
- src/navigation/navigationTypes.ts
- src/navigation/linking.ts
- __tests__/App.test.tsx
- docs/SCREEN_01_REPORT.md (updated Welcome back-stack documentation)
- docs/SCREEN_02_REPORT.md

Reference differences / pending dependencies:
- Original local illustration is preserved, including its existing transparent margins/edge quality.
- System typography is used because no reference font files were supplied; device font customization can affect visual fidelity.
- Native status/navigation bars follow the device; no screenshot frame or fake clock is rendered.
- Screen 03 now implements Verified & Reliable; Global Reach awaits its individual prompt. No backend endpoint is needed for this informational screen. No packages were installed and the original logo asset policy is preserved.

Validation: TypeScript and ESLint passed. Jest passed: 5 suites / 22 tests, including the real guest router flow through Welcome, Back, Next and Skip, without authentication or onboarding completion. Android arm64 debug build/install passed on Infinix X655C / Android 10 (3m 41s; 407 tasks, 17 executed / 390 up-to-date). Device checks passed: Welcome Get Started opened the intro, Next opened Verified & Reliable placeholder, hardware Back returned to intro and then Welcome, and Skip opened Login. A package-guarded screenshot was inspected. Existing NativeWind ImageBackground development notification was acknowledged during QA; warnings were not globally suppressed. App process had no captured ReactNativeJS/AndroidRuntime errors. git diff --check passed. iOS and additional physical screen sizes remain unverified on Windows.

After successful device interaction checks, the phone disconnected from adb during the final route-restoration attempt. The final foreground route could not be reconfirmed; completed build, tests and earlier device results above remain recorded separately.

Screen 03 update: Send & Carry now uses the shared OnboardingLayout and useOnboardingNavigation hook. Its existing off-white background, first active dot, content and route are preserved.
