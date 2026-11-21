# Task 23 — Profile Avatar Delete API

Date: 2026-11-19. Implemented using the existing Remove Photo / Save Changes flow; no new visible controls or navigation routes.

## A. Inspection and verified backend contract

EditProfileScreen already had Remove Photo, pending-removal copy, Restore original photo and Save Changes. Removal only staged local state; profileEditService explicitly rejected it before this task. ProfileAvatarService already owned upload recovery/guards. ProfileScreen consumes the existing account-scoped profile query; Drawer observes the same cache without starting its own request. No separate Dashboard identity screen exists in this module; Profile's existing header is retained.

Read-only backend sources in sibling friendie_logistics_backend: routes/api.php; CustomerController::removeAvatar/input/lockedCustomer/limit; EligibleMobileCustomer; ApiResponse; ApiExceptionRenderer; Support/Api/PublicData::image.

- `DELETE /api/v1/customer/profile/avatar`, current Sanctum Bearer token; no body/query parameters. Centralized configured Axios client/endpoint are reused.
- Middleware requires a real personal access token with mobile:account ability, active verified customer role. Controller rechecks eligibility/current token existence under the locked customer row.
- HTTP 200: `{success:true,message:"Avatar removed successfully.",data:{image_url:string|null}}`. A URL is authoritative backend media output; null is valid if the default file is absent/unusable. HTTP 204 is not the verified contract and is not treated as success.
- Database reference is reset to `avatar.jpg` in a transaction. **No physical file deletion occurs**: legacy/shared/default/other-account files are deliberately preserved. No-avatar/default-avatar deletion follows the same canonical response.
- No request fields accepted. Unknown fields produce validation errors. Upload/delete share the avatar rate limit: 10/account/hour and 10/IP/hour, with 429/Retry-After.
- Shared error renderer: success:false with safe message and optional validation errors; 401 Unauthenticated, 403 Forbidden, 404 Resource not found, 422 Validation failed, 429 Too many requests, 500 Server error. No special 409 delete business rule was found; generic HTTP error handling remains defensive without inventing one.

## B. Implementation and files

Task 23 production changes only:

- src/features/profile/services/profileAvatarService.ts: typed delete operation alongside existing upload; nullable canonical response validation; account-scoped mutation recovery; mutual upload/delete guards; conservative unknown-outcome hold and authoritative GET reconciliation.
- src/features/profile/services/profileEditService.ts: existing removeAvatar argument now invokes DELETE instead of rejecting it. Removal occurs before text changes, because an email change can revoke authentication. Avatar-only removal refetches Profile without PUT. Combined edits use the existing PUT response. Confirmed deletion plus later profile-save failure preserves canonical avatar state and retries remaining work without repeating DELETE.
- src/features/profile/screens/EditProfileScreen.tsx: existing actions remain in place. Saved avatar stays visible while removal is merely staged. After Save, authoritative cache update drives the avatar; local selected-photo preview retains priority. Existing busy/disabled/error/Toast/navigation flows are reused. Uncertain removal blocks further avatar mutations and uses warning feedback. Text fields and styles remain unchanged.
- src/navigation/components/CustomDrawerContent.tsx: binding-only fix; when an authoritative current-account profile has no avatar, do not revive an obsolete Login avatar. Login fallback remains available while no matching profile exists. No layout/style changes.

Tests added: __tests__/profileAvatarDelete.test.ts and __tests__/profileAvatarDeleteDrawer.test.tsx. Tests updated: __tests__/EditProfile.test.tsx (existing action integration, original-photo restoration makes no DELETE); __tests__/profileUpdateApi.test.ts (outdated unsupported-removal expectation replaced with a meaningful contradictory-replacement/removal rejection test).

Task 22 auth/session source and tests were already modified on entry, along with the Task 20/21/22 reports; they were preserved and are not Task 23 changes.

## C. Success, synchronization and safety

Remove Photo stages intent; Restore original photo cancels it without any DELETE. Only explicit Save submits. No optimistic shared-cache removal occurs, and the existing saved image remains visible until confirmation. ProfileEditService's existing save lock prevents duplicate Save submissions; avatar service guards also prevent direct concurrent upload/delete requests.

Only a verified HTTP 200 envelope counts as confirmed deletion. The returned URL/null is checked against authoritative complete Profile data, which replaces the same `['profile', customerId]` query after canceling obsolete query responses. Profile, Edit Profile and Drawer therefore observe one account-scoped dataset. No duplicate cache, guessed default URL, timestamp cache-buster, fabricated profile flag or statistics update was added. Auth identity/token persistence is not rewritten for avatar changes.

Guest/demo and missing-token requests are rejected before DELETE. Owner-reference checks, AbortSignal and post-response token comparison reject late logout/account-switch/token-replacement responses. Existing Logout/account-change subscriptions clear mutation recovery. Existing private-query cleanup and guest-first navigation are unchanged.

Definite rejection statuses release the failed-attempt guard; current avatar/draft stays intact. Network/timeout, 5xx, unexpected success envelopes and unverified status responses are **uncertain**, not proof of non-deletion. One safe Profile GET may reconcile visible authoritative state, but a changed/default URL alone does not prove which operation completed. No automatic DELETE retry occurs, and upload/delete stay blocked for the unresolved session. The warning explains the hold. A successful DELETE followed by failed text-save/refetch is a known partial save; its confirmed result is reused for the remaining save rather than repeating deletion.

## D. UI and notification preservation

No new buttons, icons, confirmation modals, screens, routes, dependencies or notification systems. Existing native camera/library choice and unsaved-change confirmations remain untouched; no Alert notification was added. Notifications use the existing react-native-toast-message configuration once at the screen layer: existing success/error feedback, warning for uncertain removal. No service Toasts or duplicate success feedback.

Unrelated existing notification violation observed during inspection: CustomDrawerContent's pre-existing partial-logout-cleanup path calls `Alert.alert('Signed out', ...)`. It was not introduced or changed by Task 23 and is recorded for a separately authorized notification cleanup. Camera/library and discard confirmations are workflow dialogs, not notification feedback.

Source comparison against HEAD confirmed identical StyleSheet blocks for EditProfileScreen and CustomDrawerContent (after newline normalization). Avatar dimensions/shape/layout are unchanged; only source selection and action-state bindings changed. **Device rendering/screenshot visual equivalence: NOT VERIFIED.** Source comparison and unit tests do not prove visual equivalence.

## E. Verification

Logs/results: `.validation/avatar-delete/`.

Executed commands from app root unless noted:

```powershell
node node_modules/jest/bin/jest.js --runInBand __tests__/profileAvatarDelete.test.ts __tests__/profileAvatarDeleteDrawer.test.tsx __tests__/profileAvatar.test.ts __tests__/profileUpdateApi.test.ts __tests__/EditProfile.test.tsx __tests__/Profile.test.tsx __tests__/profileApi.test.ts __tests__/currentAccountApi.test.ts __tests__/logoutApi.test.ts --json --outputFile=.validation/avatar-delete/focused-final.json
node node_modules/jest/bin/jest.js --runInBand --json --outputFile=.validation/avatar-delete/full.json
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/features/profile/services/profileAvatarService.ts src/features/profile/services/profileEditService.ts src/features/profile/screens/EditProfileScreen.tsx src/navigation/components/CustomDrawerContent.tsx __tests__/profileAvatarDelete.test.ts __tests__/profileAvatarDeleteDrawer.test.tsx __tests__/profileUpdateApi.test.ts __tests__/EditProfile.test.tsx
# Working directory: android, with approved access to the existing Gradle cache
.\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain
git diff --check
```

Focused final run: **9 suites, 144 tests passed, 0 failed, exit 0, 14.577 seconds**. Covers exact Axios DELETE/no body/no query/header, nullable/default canonical response, avatar-only save/refetch, no-avatar success, guest/demo/missing token, status handling, unknown-outcome holds/no retry, upload/delete mutual exclusion, duplicate requests, token/logout/account/abort races, partial-save retry without repeated DELETE, existing upload/Profile/auth tests, actual Remove/Save/cache/Toast/navigation wiring, and Drawer reactive null/account isolation.

**Final full Jest: 101 suites passed, 0 failed, 2 existing suites skipped; 1,490 tests passed, 0 failed, 2 existing tests skipped; 1,492 total, exit 0, 201.214 seconds.** Compared with Task 22's 1,461 passing tests, 29 cases were added: 26 delete-service cases, 2 Drawer binding cases, and 1 Edit Profile end-to-end frontend save case. Existing original-photo restoration coverage was also strengthened to assert zero DELETE calls. The final full run includes that assertion. No tests were deleted/newly skipped and no timeout/configuration was changed. Existing navigation act-warning output remains visible in full.log but no navigation test failed.

TypeScript and scoped ESLint: **exit 0**, no errors. Final full-run, typecheck and lint commands were executed sequentially after the Android build to avoid overlapping native-build resource contention. `git diff --check`: exit 0 (Windows newline notices only).

Initial focused runs: existing upload/Edit Profile/Profile PUT regressions passed (3 suites/56 tests), then delete coverage passed (4 suites/81 tests). A wider intermediate run had one failure in the newly written UI test because Toast.show had not been spied on; production success/cache/navigation behavior had succeeded. The test now explicitly spies on Toast.show and asserts exactly one success notification; no production change was made to bypass that assertion. Subsequent final focused run passed all 144 tests. Logs of these iterations are retained.

Android: **BUILD SUCCESSFUL, exit 0, 1m 45s**, 407 tasks (16 executed, 391 up-to-date). Output: android/app/build/outputs/apk/debug/app-debug.apk. Existing Gradle deprecation notices remain; no native/build configuration change. A debug build does not verify live API access or rendering.

Style-block comparison results are saved in ui-source-check.json; both comparisons returned true. This does not replace screenshot/device verification.

No authorized live test account/avatar was supplied or used. No customer's avatar was deleted during verification.

**LIVE AUTHENTICATED API: NOT VERIFIED.**

**PHYSICAL DEVICE: NOT VERIFIED.**

## F. Remaining limitations and scope

Unknown outcomes remain conservatively held rather than exposing an unsafe retry action; backend operation IDs/versioning are not provided. No physical-file cleanup behavior was introduced. No Laravel, website/admin, database/schema/table/column/migration, storage configuration, activation policy, authentication contract or unrelated API modifications.
