# Screen 04 ? Global Reach, Local Trust

Implemented the final introduction using the original src/assets/04_global_delivery_route.png unchanged. White safe-area background, centered two-line navy heading, supplied description, four dots with the final burgundy dot active, and a burgundy gradient Get Started button with Lucide Check follow the reference. The shared scroll layout preserves aspect ratio and remains scrollable on short displays and larger text. No Skip, logo, drawer, bottom tabs or duplicate navigation header is added to this screen.

Completion is saved to AsyncStorage before the Zustand flag changes. The existing root navigator then selects Login for guests or the existing app entry for an actual restored authenticated session. Authentication remains independent. Missing, malformed or incorrectly typed preferences default safely; valid existing version-0 preferences remain compatible. Read failures reach bootstrap retry instead of silently overwriting a stored preference. Failed writes keep this screen open with accessible error copy and a retryable button; pending writes disable repeated presses and show an activity indicator. Serialized preference writes preserve notification settings when actions overlap. Preference persistence uses explicit awaited AsyncStorage operations within the existing Zustand store, replacing its fire-and-forget persist middleware; the key and saved envelope remain unchanged. Notification permission handling now awaits its preference write.

Hardware Back returns to Verified; direct entries rebuild Welcome / Send & Carry / Verified history. Successful completion removes onboarding routes through the existing root route gate, so Back cannot reopen a completed introduction. Original logo assets and all unrelated navigation architecture remain unchanged. No packages, API endpoints or fake sessions were introduced.

Changed files:
- src/features/onboarding/screens/GlobalReachIntroScreen.tsx (new)
- src/features/onboarding/screens/OnboardingScreen.tsx (obsolete placeholder removed)
- src/features/onboarding/components/OnboardingLayout.tsx
- src/features/onboarding/hooks/useOnboardingNavigation.ts
- src/components/ui/GradientButton.tsx
- src/navigation/RootNavigator.tsx
- src/store/uiStore.ts
- src/app/AppBootstrap.tsx
- src/services/notifications/notificationService.ts
- __tests__/App.test.tsx
- __tests__/preferences.test.ts (new)
- jest.setup.js
- docs/SCREEN_03_REPORT.md (obsolete destination notes updated)
- docs/SCREEN_04_REPORT.md

Visual limitations: no font file was supplied, so existing system typography is used and the phone's font theme can affect appearance. The image's original fringe/shading is preserved. The requested final fourth dot is active; earlier introductions retain their existing progress behavior. No backend dependency is required for this informational screen. The Login destination was subsequently implemented by Screen 05; see SCREEN_05_REPORT.md for its backend configuration requirements. iOS and additional physical device sizes remain unverified.

Validation: TypeScript and full ESLint passed. Jest passed all 6 suites / 38 tests, covering durable completion, guest Login routing, rehydration after remount, malformed/missing preferences, storage read/write failures, retry, serialized notification writes, authentication independence and direct-entry hardware Back. Android arm64 debug build/install passed on Infinix X655C / Android 10 in 1m 50s (407 tasks: 17 executed, 390 up-to-date). The restricted sandbox initially denied Gradle process launch; the build succeeded with the required access. Package-guarded device inspection and a screenshot confirmed the supplied globe artwork, heading/copy, final active dot and checkmark action. Actual Android Back opened Verified; Next returned to Global Reach; Get Started opened the existing Login entry. An existing NativeWind development warning overlay was dismissed for tapping; no application warnings were suppressed. git diff --check passed. After force-stop and cold launch, Login reappeared without onboarding, confirming real-device persistence. Package-scoped ReactNativeJS/AndroidRuntime error logs were empty.
