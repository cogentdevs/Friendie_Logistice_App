# Android launch diagnosis — 2026-11-04

Observed: phone connected and Friendie installed, but adb reverse had no mapping for Metro. The old Metro server later timed out on /status while bundling. No Friendie AndroidRuntime/ReactNativeJS crash was captured.

Actions: restored adb reverse tcp:8081 tcp:8081, excluded generated android/build, android/.cxx and ios/build trees inside node_modules in metro.config.js, and restarted this project's Metro with two workers. Configuration syntax and exclusion patterns were checked against Windows/POSIX paths; JS source remains included. git diff --check passed.

Verified: Metro reported ready and completed index.js bundling. Package-guarded Android UI inspection found the Welcome heading, pagination, Get Started and Sign In. Navigation preview remains disabled. No app data was cleared and no packages were installed.

Development warning observed: ImageBackground deprecation. It did not prevent the welcome screen from loading; it has not been globally suppressed.

If USB reconnects, restore forwarding with adb reverse tcp:8081 tcp:8081. Leave Metro running on port 8081 during debug use.

Device checks also exposed dropped Pressable style callbacks under NativeWind. Welcome buttons and the shared AppButton now opt out of CSS interop for their native callback styles; NativeWind remains enabled elsewhere. Welcome ScrollView uses an explicit flex viewport with flexible content and extra bottom spacing. Get Started and Sign In were both tapped on the device and reached the existing introduction and Login placeholders respectively. No onboarding completion or fake authentication was performed.

Final validation: TypeScript passed, targeted ESLint passed, all 3 App/navigation integration tests passed, and git diff --check passed. The phone was left on Welcome with Metro running on port 8081. Current package-scoped JavaScript/native error logs were empty. Changed implementation files: metro.config.js, src/features/onboarding/screens/WelcomeScreen.tsx and src/components/ui/AppButton.tsx. Native sources and installed dependencies were unchanged.

## Follow-up: multi-architecture disk-space failure

The supplied Gradle log failed at react-native-worklets:externalNativeBuildDebug with java.io.IOException: There is not enough space on the disk. Cross-volume hard-link messages were copy-fallback warnings. The default run command had requested all four architectures and the failed invocation used Metro port 8082.

package.json now runs react-native run-android --active-arch-only --port 8081 --no-packager. README documents starting Metro separately. Direct Gradle/release architecture configuration is unchanged. No files were deleted or dependencies installed in this follow-up.

Verification: npm run android detected arm64-v8a, BUILD SUCCESSFUL in 5m 35s (407 tasks: 17 executed, 390 up-to-date), APK installed on Infinix X655C / Android 10, and CLI launched Friendie. Metro /status responded packager-status:running on 8081. G: had about 3.1 GB free after the build. git diff --check passed for package.json and README.md. No listener remained on 8082.

Latest durable workflow fix: see RUN_WORKFLOW_FIX.md. npm start reuses the verified healthy project Metro; generated Windows build folders are now linked to C: temporary cache and the build/install retry passed in 2m 55s.
