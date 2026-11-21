# Task 28 — App-wide keyboard visibility and form scrolling

Date: 2026-11-19. Scope: keyboard/layout infrastructure, focused-input measurement, related scroll wiring and tests only. Existing uncommitted work was preserved; no repository reset, commit, dependency installation, API or backend changes.

## Root cause and evidence

Multiple interacting causes (B/C/G), rather than an incorrect manifest:

1. `src/components/layout/KeyboardScreen.tsx` previously left `androidBehavior` undefined. Android consequently rendered a flex container without JS keyboard height avoidance on Create/Edit Listing, Edit Profile, Change Password, Home, Contact Us, location pickers and Chat. Login/Register/Forgot Password explicitly selected height and were already better protected. The app targets SDK 36 with edge-to-edge enabled; native adjustResize alone is not a sufficient universal fallback. API 36 device behavior was not directly tested.
2. `ScreenContainer.tsx` had a bounded flex ScrollView and flexGrow content (these were already correct), but no shared focused-input reveal on focus, keyboard frame changes or viewport resizing. Most non-auth forms had no equivalent of auth's explicit keyboard hook.
3. On-device testing caught a second real problem in the first implementation: React Native 0.88.1's `ScrollView.js:1137-1173` scroll-to-keyboard helper compares content-space input coordinates with global keyboard screenY. It does not subtract this app's header origin or fixed Continue footer. Focusing the already visible last field moved it back below the form viewport. A Jest mock of that method alone had passed and did not prove visibility. The final implementation therefore measures actual content/input/viewport geometry instead of using that helper. Existing auth reveal hooks use the same corrected geometry so they cannot undo the shared correction.
4. Home and Contact Us explicitly used keyboardDismissMode=on-drag, dismissing the keyboard during scrolling. They now use none so users can scroll without losing the keyboard.
5. The default keyboard offset was zero even for screens under headers or safe-area origins. When no explicit offset is supplied, KeyboardScreen now measures the real window origin relative to its parent. Existing explicit offsets on Listing and Chat are retained.

Android evidence: `android/app/src/main/AndroidManifest.xml:23` already sets adjustResize; `MainActivity.kt` uses the existing ReactActivity/default Fabric delegate; `android/build.gradle:5-6` sets minimum SDK 24 and target SDK 36; `android/gradle.properties:44` enables edge-to-edge. No native configuration was changed, and no speculative inset/manifest workaround was introduced.

## Screen and overlay inventory

| Screen / interaction | Actual editable controls | Existing handling and final coverage |
|---|---|---|
| Create Listing, Send/Carry | Title; integer capacity/parcel weight | Shared KeyboardScreen + ScreenContainer; height avoidance and measured focus reveal. Existing fixed Continue footer remains in the avoidance region. |
| Edit Listing | Same ListingForm through ListingEditLoader | Same fix; draft/dirty fields/update payload logic untouched. |
| Listing location modal, From/To | Optional Area text; country/city are selection buttons | Existing KeyboardScreen + ScreenContainer receives shared fix independently in each modal. |
| Listing review step | Read-only review and actions; no editable description/weight-price input found | Existing architecture retained; no invented fields. |
| Login | Email, password | Existing height avoidance and Next focus retained; existing manual reveal now measures the actual viewport. |
| Register | Full name, email, phone, password, confirm password | Existing height avoidance and keyboard hook retained; corrected reveal geometry, Next behavior and validation unchanged. Calling-code choices are not text inputs. |
| Forgot Password | Email | Existing height avoidance/hook retained with corrected geometry. |
| Reset Password | Placeholder only | No editable form exists; no unrelated implementation. |
| Edit Profile | Full name, email, phone | Existing form and avatar controls unchanged; shared height avoidance/scroll reveal. |
| Change Password | Current/new/confirm password | Shared wrappers fix avoidance and scrolling; password visibility/validation unchanged. |
| Chat | Multiline message draft and Send | Existing FlatList and composer stay siblings inside KeyboardScreen; default height now enabled, explicit header offset retained. No form ScrollView wraps the FlatList. |
| Inbox | No TextInput found | No screen or inbox logic changed. |
| Home search card | Keyword and optional weight | Existing Home ScrollView gains focus measurement; no on-drag keyboard dismissal. |
| Search and Filters | Existing selection/date/filter controls; no direct TextInput found | Existing containers retained. Actual editable manual-location/exact-point modals are covered separately. |
| RouteLocationPicker | Country, country code, city, optional area | Existing KeyboardScreen + ScreenContainer gains shared behavior. |
| ExactPointPicker | Latitude, longitude | Existing KeyboardScreen + ScreenContainer gains shared behavior. |
| ListingReferencePicker | Country/city/category/currency option buttons; no search TextInput | Existing selection layout and data logic unchanged. |
| CallingCodeSelector | List of supported codes; no search TextInput | Existing modal and selection logic unchanged. |
| Contact Us | Name, email, subject, multiline message | Existing ScrollView replaced by the same native ScrollView abstraction with focus measurements; no drag dismissal. |
| InitialMessageDialog | Multiline initial message | Existing modal/KAV/card/button styles preserved; scrolling gains focus measurement. |
| SubmitReviewDialog | Multiline review; rating is existing selectable buttons | Existing modal/KAV/card preserved; scrolling gains focus measurement. |

The inventory was obtained by searching all `src/**/*.tsx` TextInput/AppInput usages, then inspecting their owning screens and overlays. No additional form/input was created.

## Implementation and files changed in this task

Production files:

- `src/components/layout/KeyboardScreen.tsx`: Android default height behavior; measure real parent/header/safe-area offset only when caller does not provide one. Uses existing native KAV ref; no extra host layout wrapper or spacing. Ignores outdated measurement callbacks.
- `src/components/layout/KeyboardScrollView.tsx` (new): forwards all ScrollView props and native ref; tracks input focus only within its own subtree. Reveals on focus, keyboard show/frame change, content change while keyboard is open, and shrinking native viewport. Blur/unmount/scroll/dismiss invalidate stale measurements; all event subscriptions are removed. Keeps handled taps and non-dismissive scrolling.
- `src/components/layout/keyboardVisibility.ts` (new): measures input in content coordinates, input in window coordinates, and native viewport. Visible bottom is the smaller of viewport bottom and actual keyboard top. Scrolls only when the focused input is outside the visible region, with the existing theme spacing as a small gap. Never scrolls a visible input simply to align it with a global keyboard position; no guessed keyboard height, screen-height sizing, timers, artificial delays or added blank padding.
- `src/components/layout/ScreenContainer.tsx`: uses KeyboardScrollView for its existing scrolling branch. The same native ScrollView styles, content flexGrow, padding, max-width, callbacks and non-scroll branch remain intact.
- `src/features/auth/hooks/useFormKeyboardScroll.ts`: existing Register/Forgot behavior now uses measured viewport helper, retains screen-focus guard and lifecycle.
- `src/features/auth/screens/LoginScreen.tsx`: existing reveal callback uses measured helper; all authentication/form/API logic unchanged.
- `src/features/home/screens/HomeScreen.tsx`: existing ScrollView uses shared focus behavior; drag no longer dismisses keyboard.
- `src/features/support/screens/ContactUsScreen.tsx`: same scroll-only changes.
- `src/features/listings/components/InitialMessageDialog.tsx`: existing ScrollView uses shared behavior; existing KAV and card styles retained.
- `src/features/reviews/components/SubmitReviewDialog.tsx`: same overlay scroll-only binding.

Tests/fixtures:

- `__tests__/KeyboardLayout.test.tsx` (new): keyboard/show/frame/resize/focus/blur/hide cleanup, measured offset, stale offset callbacks, input switching, draft preservation and scroll configuration.
- `__tests__/keyboardVisibility.test.ts` (new): actual coordinate calculations, already-visible field regression, keyboard overlay, above-viewport input, nonnegative offset, stale measurements and missing/zero-sized targets.
- `test/fixtures/keyboard.ts` (new): explicit native geometry fixture, not a mocked successful scroll-to-keyboard method. Viewport 100..450, input 600..648, content Y 800 yields target Y 514 with 16 gap.
- `__tests__/AuthFormKeyboard.test.tsx`: keeps existing focus/Next/blur/iOS assertions, verifies actual measured scroll target rather than obsolete helper call.
- `__tests__/Login.test.tsx`: existing keyboard test uses geometry fixture; login/API assertions retained.
- `__tests__/PostListing.test.tsx`: adds Android lower-field/zero-weight draft preservation across focus/resize without POST/navigation.
- `__tests__/ChatScreen.test.tsx`: adds Android avoidance/header offset/list-composer structure and no form ScrollView around chat.
- This report.

No styles, input props, field order, labels, theme, image layout, bottom tabs, drawer, route contracts, APIs, business validation, mutations, notification system or dependency manifests changed. Existing working-tree modifications from earlier tasks were not overwritten. Unrelated untracked `src/assets/images/` was left untouched.

## Device verification

A connected Infinix X655C physical device, Android 10 / API 29, 720x1600 was available. The user explicitly confirmed availability for keyboard testing. Used existing debug app, existing Metro at port 8081 and existing USB reverse mappings; no API host/environment/transport settings changed. Reloaded the dev app to load current source, then navigated existing screens/deep links. Did not clear storage, log out, enter credentials, submit a listing, save a profile, send a message or change backend data.

Actual observations:

| Scenario | Result / evidence |
|---|---|
| Create Listing Title focus | Keyboard visible, Title above keyboard. |
| Form scrolling with keyboard open | Multiple swipes expose later controls while native mInputShown remains true. |
| Last capacity field, final fix | Focused=true; field bounds [134,460][563,548], label above it, keyboard top approximately 898 screen pixels. Focusing it again no longer jumps it below the viewport. |
| Continue reachable | Existing Continue bounds [36,762][684,866], above keyboard. No submission performed. |
| Android Back | mInputShown becomes false; field/footer restore to normal full-height layout (capacity bounds [134,1130][563,1218], Continue [36,1432][684,1488]). |
| Edit Profile phone | Focused phone bounds [118,770][644,866], above keyboard. No edits entered. |
| Edit Profile Save reachable while keyboard stays open | After scrolling: phone [118,586][644,682], Save [36,746][684,850]; native mInputShown=true. No Save pressed. |
| Login/Register on device | NOT VERIFIED. Existing authenticated navigation returns to Home on attempted auth deep link; session was preserved rather than logging the user out for this test. |
| Edit Listing / Change Password / Contact Us / picker / multiline dialogs | Source and automated coverage; native/device coverage not completed for each. |
| Chat composer | Source/automated verified; device NOT VERIFIED. Did not open a real private conversation merely to test layout, which could trigger existing Mark as Read. |
| API 35/36 edge-to-edge, other screen sizes/keyboards, emulator, iOS | NOT VERIFIED. No emulator tested. |

The first device pass exposed the legacy helper's jump; it was corrected and the lower-field focus test repeated successfully. Physical screenshots were inspected for the form/keyboard; diagnostic screenshots containing incoming OS notification overlays were removed, and no private notification/customer content is included in this report. No before/after pixel comparison across every screen is claimed. Closed-state style preservation is source/diff verified and observed on the two tested forms; app-wide visual equivalence remains NOT VERIFIED.

## Verification history and final results

Initial focused run: 29 pass (4 suites) after fixing test fixture isolation. Expanded initial run exposed two new tests using Jest's default iOS platform while asserting Android height; explicitly selecting Android corrected those fixtures, without changing production behavior or weakening assertions.

Before device-discovered coordinate correction, complete Jest: 103 suites passed, 2 skipped; 1,517 tests passed, 2 skipped; exit 0; 244.568 seconds. This is **not substituted for final-source verification**.

Final geometry-focused command:

```powershell
node node_modules/jest/bin/jest.js --runInBand __tests__/keyboardVisibility.test.ts __tests__/KeyboardLayout.test.tsx __tests__/AuthFormKeyboard.test.tsx __tests__/PostListing.test.tsx __tests__/Login.test.tsx --silent
```

Result: **5 suites, 45 tests PASS, exit 0, 67.137 seconds**. A preceding run had one existing PostListing 5-second timeout while Metro/device/build checks were active (38 pass, 1 fail); the exact same test passed on the completed focused rerun. No test timeout was increased, skipped or weakened.

Final-source full-suite command: `node node_modules/jest/bin/jest.js --runInBand --silent`.

First final-source attempt: **103 suites passed, 1 failed, 2 skipped; 1,522 tests passed, 1 failed, 2 skipped (1,525 total), exit 1, 273.494 seconds**. The only failure was the pre-existing `App.test.tsx` test `Home dashboard uses the real first name and routes every action through existing navigators` exceeding its existing 5,000 ms limit. It ran alongside TypeScript/ESLint, Metro and device work. The other 1,522 tests passed. Resource contention is a plausible explanation, not a proven diagnosis from that output alone. No timeout/assertion changes were made. Identical full rerun, without concurrent build/static/device activity: **104 suites passed, 0 failed, 2 existing skipped (106 total); 1,523 tests passed, 0 failed, 2 existing skipped (1,525 total); exit 0; 156.440 seconds; 0 snapshots**. App.test.tsx passed in 55.454 seconds, including the previously timed-out navigation test. No production/test changes were made between these two final-source full runs. This resolves the executed test failure for delivery while retaining the timing limitation in this report.

Final inventory increased by **17 meaningful tests** from Task 27's 1,506 passing baseline: nine shared keyboard-layout cases, six viewport-coordinate cases, one Create Listing case and one Chat case. Existing skips were not changed.

The full run includes Create/Update Listing, image upload/delete, Login/Register/Forgot Password/session/guest, Edit Profile/Change Password, Home/Search/Filters/pickers, reviews, Inbox/Chat History/Send/Mark as Read, and navigation regressions. All passed on the final complete run.

Native build executed:

```powershell
cd android
.\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain
```

**BUILD SUCCESSFUL, exit 0, 3m13s; 407 tasks, 16 executed, 391 up-to-date.** Existing Gradle cache access outside the workspace required the usual approved escalation. Existing AGP/Gradle deprecation warnings remain. No native/dependency files changed; subsequent geometry refinement is JS-only, loaded on the device through Metro (debug assembly does not bundle that JS).

TypeScript: `node node_modules/typescript/bin/tsc --noEmit`, final execution exit 0. Scoped ESLint without --fix: final execution exit 0, no diagnostics. Earlier new-code TS fixture/type mismatches and one lint ref-cleanup warning/error were corrected before final checks. Exact scope: the production and test/fixture files listed above, excluding the Markdown report.

## Safety and remaining limits

No Laravel, database, website/admin, API payload/contract, auth/session lifecycle, listing/profile/messaging business logic, navigation, style/theme or Toast changes. No new notification or keyboard library. Existing actual confirmation dialogs remain intact.

A single Android 10 physical device does not prove every Android keyboard/inset implementation. Additional release/modern edge-to-edge, small/large-screen, multiline/dialog and authenticated Chat checks remain recommended. Automated success is never represented as proof of keyboard visibility on untested devices.


