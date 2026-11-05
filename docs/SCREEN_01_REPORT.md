# Screen 01 — Welcome

Changed files: src/features/onboarding/screens/WelcomeScreen.tsx, src/navigation/RootNavigator.tsx, src/navigation/navigationTypes.ts, src/navigation/linking.ts, __tests__/App.test.tsx, jest.setup.js, and this report.

The screen uses theme colors, NativeWind layout, native gradient/decorative curves, supplied local globe illustration, safe areas, light status bar, accessible buttons, pagination and a scroll fallback for small phones/large text. No dependencies were installed.

Screen 02 update: Get Started now pushes the implemented Send & Carry introduction so Android Back returns to Welcome. Sign In replaces Welcome with AuthStack/Login. Neither completes onboarding or authenticates the user. The existing single NavigationContainer and protected app flow are preserved. friendie://welcome opens Welcome; friendie://onboarding opens the introduction.

Reference differences / unresolved assets:
- Updated after logo delivery: Welcome now uses the original full-color src/assets/logo.png through shared BrandLogo, preserving its 132:49 proportions and original colors. Per user instruction this asset is used for all logo placements; its full-color appearance differs from the white logo in the reference.
- The supplied src/assets/01_globe_airplane_parcels.png is used unchanged and differs slightly from the screenshot artwork.
- No matching font file was supplied; existing system typography is used.
- Send & Carry introduction is implemented in Screen 02; Verified & Reliable is implemented in Screen 03 and Global Reach remains a labeled placeholder pending its own prompt.

Validation: TypeScript passed; Jest passed (5 suites, 22 tests). Full lint completed with zero errors; two inline-style warnings were subsequently corrected and targeted lint passed without warnings. Android arm64 debug build passed (:app:assembleDebug, 406 tasks, 23 executed / 383 up-to-date). Production Android Metro bundle passed with 24 assets, saved under the system temporary friendie-logistics-screen01 directory. The initial sandbox bundle attempt failed with spawn EPERM when NativeWind forked Tailwind; the elevated retry passed. git diff --check passed. Physical-device visual fidelity and iOS remain unverified.

Storage: G: was full. Only project-local regenerable Android native intermediates (merged/stripped libraries, a duplicate library and unused Worklets ABI outputs) were removed to permit edits/build validation; sources, supplied assets and existing APK were preserved.
