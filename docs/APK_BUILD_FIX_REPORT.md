# Windows release APK build fix

Changed android/build.gradle and android/app/build.gradle only, plus this report. No dependencies, architectures, screens or application behavior were changed.

## Causes and fixes

1. Reanimated 32-bit release failed with `manifest build.ninja still dirty after 100 tries`. Ninja reported a generated Worklets prefab CMake dependency missing even though it existed under the long node_modules staging path. Android library CMake staging now uses shorter project-specific Windows temporary paths. All four Worklets/Reanimated release architectures passed after this change.
2. App codegen then failed with `Filename longer than 260 characters` for Gesture Handler. App staging now defaults to a short system-drive `flcxx-<project hash>` directory, preserving the FRIENDIE_CXX_ROOT override. Windows defaultConfig passes CMAKE_OBJECT_PATH_MAX=240 so CMake hashes long codegen object paths. The previously failing object path measured 221 characters after the fix.

These Gradle settings survive dependency reinstalls; node_modules was not patched. Only generated build files are staged outside the repository. No source/SDK files or caches were deleted. Hard-link fallback messages across C/G drives are warnings, separate from the fatal path errors.

## Validation

- Full default `android/gradlew.bat app:assembleRelease --console=plain`: BUILD SUCCESSFUL, 43m 6s, 741 tasks (698 executed, 43 up-to-date). First rebuild included all four ABIs and release JS/assets compilation.
- APK: android/app/build/outputs/apk/release/app-release.apk, 101755322 bytes (about 97 MiB).
- apksigner verify --verbose: passed, APK Signature Scheme v2, one signer.
- git diff --check: passed; Windows line-ending notices only.
- Existing dependency deprecation/D8 warnings remain nonfatal. No TypeScript/UI changes were made, so JS test suites were not rerun for this native configuration fix.

Existing release configuration signs with the debug key: this is a testing APK. Store distribution needs the project's proper release keystore; signing policy was not changed.

Build again from project root in PowerShell:

    cd android
    .\gradlew.bat app:assembleRelease

Detailed diagnostic logs are local ignored files: .validation/apk-release-diagnostic.log, .validation/apk-release-fixed.log and .validation/apk-release-final.log.
