# Metro port and Android disk-space fix

Observed failures: npm start attempted a second server on occupied port 8081; the existing listener was healthy Friendie Metro with the matching X-React-Native-Project-Root header. Android failed separately with java.io.IOException: There is not enough space on the disk. G: had about 1.95 GB free during diagnosis, while C: had about 76.93 GB.

Fixes:
- scripts/start-metro.cjs checks health and project identity, reuses the correct Metro, and rejects another project/server. It launches a normal CLI server when the port is free. npm start now uses this wrapper; prestart environment generation remains intact.
- scripts/prepare-android-cache.cjs stores generated Windows Android build folders under a checkout-specific C: temporary cache, preserving the existing build/APK paths through directory junctions. preandroid ensures them; npm run android:cache explicitly migrates existing populated folders while Gradle is idle.
- 18 generated folders were migrated, totaling about 3.49 GB of logical output. Copy file counts and sizes were verified before the old copies were removed. Sources, assets and native Gradle architecture configuration remain in the project.
- Generated junctions are explicitly ignored by Git. ESLint supports the Node CommonJS helper scripts. README documents use and recovery if temporary caches are cleaned.

Verification:
- npm start exits successfully and reuses the existing Friendie server; no duplicate listener or EADDRINUSE.
- npm run test:workflow: 6 tests pass (migration integrity/idempotence, implicit-migration refusal, path/foreign-link refusal, missing-target recovery, correct Metro reuse and wrong-server rejection).
- Same-volume hard-link through android/app/build junction: PASS. Existing APK is readable through its original path.
- Targeted helper ESLint and git diff --check: PASS.
- G: free about 5.11 GB; C: free about 73.42 GB after migration.
- Android build/install PASS: BUILD SUCCESSFUL in 2m 55s; 407 tasks (17 executed / 390 up-to-date), APK installed on Infinix X655C / Android 10, and CLI launched Friendie. Native CMake steps completed without the earlier cross-volume hard-link warnings.

Run: keep an existing healthy Metro, or run npm start. Then run npm run android. Do not start a second raw react-native start server on 8081. Direct npx commands bypass the npm workflow helpers.

Changed files: package.json, scripts/start-metro.cjs, scripts/prepare-android-cache.cjs, scripts/build-workflow.test.cjs, .eslintrc.js, .gitignore, README.md, docs/ANDROID_LAUNCH_CHECK.md and this report. No packages were installed and no UI behavior was changed.

Final post-build observation: G: 7.27 GB free; C: 74.25 GB free. Friendie process PID 3590 was running, adb forwarding to 8081 was present, and its captured JavaScript/native error logs were empty.
