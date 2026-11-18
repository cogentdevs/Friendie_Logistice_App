# Task 17 - Listing Image Delete API integration

## Authorization and scope

The initial inspection stopped under Task17 section5 because only local Remove existed. The user subsequently authorized exactly one Remove uploaded image action near the server image and one minimal Cancel/Remove confirmation. Both are implemented; the local Remove handler remains onChange(undefined), with no server call.

Task17 began on main at25b3ed5592780aad3b9662feab581c2ae2fdf19f. Existing Task15/16 dirty and untracked work was preserved. No reset, branch switch or commit occurred.

## Existing UI inventory and preservation evidence

Before changes, Own Listing Details rendered its existing cover View containing Image or fallback, followed by identity/content, existing owner Edit/Manage controls, footer and existing dialogs. Edit mode reused the Post form with a read-only server-image preview. Create mode alone had Choose image, local preview/Remove and image-only Retry.

Task17 inserts one ghost AppButton immediately after the existing cover container and one separate confirmation alongside the existing dialogs. It does not wrap, replace, move or resize the cover Image. All existing parents, rendering branches, resizeMode, onError behavior and styles are retained. The new confirmation uses existing AppButton/AppText, SafeAreaView, theme spacing/radius/colors and exactly Cancel/Remove actions. No Alert.alert or extra notification library.

Source comparison against the pre-change copy confirms the original cover JSX and complete existing ListingDetails styles are byte-equivalent after newline normalization: .validation/task17/ui-integrity.json. An additional syntax-tree comparison, excluding only the approved imports/hook/action/confirmation, also matches the prior screen structure. This is source evidence, NOT device visual equivalence. MyListingsScreen, PostListingScreen, ListingReviewScreen, all existing image picker/preview/local Remove components and navigation files were not edited for Task17. Task16's pre-existing changes in those files remain intact.

VISUAL SCREENSHOT/DEVICE VERIFICATION: NOT VERIFIED. No screenshots or device rendering were performed.

## Verified Laravel contract (read-only)

Sources: sibling backend routes/api.php, CustomerListingController removeImage/owned/query/lockCustomer/editable/input/limit, PublicData image/mediaBaseUrl, ApiResponse and CustomerListingImageService.

DELETE /api/v1/customer/listings/{id}/image; Sanctum Bearer and EligibleMobileCustomer. No body or query parameters. Unknown supplied keys are rejected. Owner scope is created_by=current customer, with positive ID validation and404 for missing/non-owned records. Transaction locks recheck active verified eligible customer/current token (401/403). Supported statuses are Pending0, Published1 and Expired2; unsupported status409.

Success HTTP200:

```ts
{ success: true, message: 'Listing image removed successfully.', data: { image_url: string | null } }
```

The controller replaces image with listing.png, updates updated_at and returns the resolver's default image URL or null. It does NOT return a full listing or deletion timestamp. It does not change listing status or unrelated fields. The default file currently exists in the local backend, but live media access is unverified.

Important: it does not unlink the old physical media file. This removes the custom image from the listing by resetting its reference, not erasing stored bytes. No frontend claim of physical erasure or backend retention change is made. No-image deletion follows the same reset/timestamp update; the frontend hides it rather than issuing unnecessary requests. Repeated calls are rate-limited and may affect newer images, so they are never automatically retried.

Upload and delete share10attempts/account/IP per3600seconds;429 Retry-After. Error envelope is {success:false,message,errors?}, with field validation422 where applicable. Listing DELETE /customer/listings/{id} remains separately blocked409 and is never called.

PublicData returns null for missing files or invalid media configuration. Therefore null in an uncertain GET is not proof of successful deletion. A confirmed DELETE200/null is accepted because its controller outcome is known; a read-only reconciliation requires the canonical backend listing.png reference.

## Implementation

New files:

- src/features/listings/services/listingImageDeleteService.ts
- src/features/listings/hooks/useRemoveListingImage.ts
- src/features/listings/components/RemoveListingImageConfirmation.tsx
- src/features/post-listing/services/listingImageOperations.ts
- __tests__/listingImageDeleteApi.test.ts
- __tests__/ListingImageDelete.test.tsx

Modified for Task17:

- src/features/listings/screens/ListingDetailsScreen.tsx: approved action/dialog and hook binding only; existing styles/cover unchanged.
- src/features/listings/services/ownListingDetailsService.ts: session-scoped WeakMap proof for exact backend records returned by successful owner GETs.
- src/features/post-listing/services/listingImageUploadService.ts: shared operation acquire/release/unknown guard; existing upload validation, payload and sequencing retained.
- src/features/post-listing/services/updateListingService.ts: image-only refresh of retained edit context, conditional on its expected old image; draft and dirty snapshot fields retained.
- docs/LISTING_IMAGE_DELETE_API_INTEGRATION.md

One centralized Axios client and existing endpoint registry/secure storage are used. A numeric ID or frontend owner flag is insufficient. The action requires an authenticated owner GET-proven DTO with a custom image URL, not null/default. The service rechecks a fresh owned GET after acquiring the mutation guard and rejects a changed image before DELETE. No fixture/demo navigation identity alone authorizes a request.

The confirmation opens only on explicit action. Cancel clears selection and invalidates previously captured confirm callbacks without API calls. Remove locks the operation before asynchronous work; duplicate taps/remounts cannot send another DELETE. Image changes invalidate the old confirmation. Blur/unmount/session changes abort/ignore stale results, and stale callbacks cannot reopen or submit through an inactive hook.

## Upload/delete and editor coordination

A small session/listing operation registry contains mutation state only, not an image cache. Both upload and delete acquire it synchronously. Pending/unknown upload blocks delete; pending/unknown delete blocks upload. Retained Task15 recovery for the same listing also blocks deletion, including definite-failure image-only Retry context, without clearing it. Old retry callbacks cannot re-upload following deletion.

A confirmed deletion retains a guard for that old image. A different, newly uploaded image returned by a subsequent authoritative owner GET can be removed through a fresh deliberate confirmation. No automatic replacement or upload is added.

After success, older matching readers are canceled. The owner cache receives an image-only server-confirmed patch only if its old image still matches the user's selection, then authoritative owner/private-list/public-list details are invalidated/refetched. A newer cached image is not overwritten by an old completion. My Listings pages, filters and sort keys are preserved; no records/statuses/timestamps/counts are fabricated. Dashboard counts are not modified or needlessly refetched.

Retained edit contexts update only image_url when their expected old image matches. Edited text, original comparison fields and drafts are not reset. The existing form reads the refreshed image when revisited. No image flags go through PUT and no Create Listing POST occurs.

## Outcomes, privacy and notifications

Known400/401/403/404/409/422/429 failures retain the old image and release the guard for a deliberate safe retry. Arbitrary404 is never interpreted as image absence. Network/server/timeouts/malformed responses hold the operation as unknown. A read-only owner GET may resolve canonical default-image state without repeating DELETE; it uses informational feedback rather than fabricating the lost request's status. Null or remaining custom-image state is inconclusive because the original request may still complete; retries remain disabled. No automatic resend.

Exact user-object/status checks, secure-token rechecks and cleared WeakMaps prevent cross-account proof/operation reuse. Logout/account replacement suppresses late cache writes/toasts. No Bearer tokens or image contents are logged. All notification feedback uses the existing react-native-toast-message configuration, with success/error/warning/info types and no custom notification system.

Backend concurrency limitation: there is no inspected conditional image/version/ETag DELETE contract. Fresh preflight and local mutual exclusion cannot stop another device uploading between preflight and server deletion. No server behavior or exactly-once guarantee is invented. Recovery guards are memory-only, not durable across process restart.

## Verification

Initial focused run:4suites/167tests passed,exit0. Expanded focused run:5suites/181tests passed,exit0. Subsequent12-suite run passed336tests,exit0,19.944seconds; output included a transient Jest asynchronous-handle warning, retained in diagnostics. Further session/callback/new-image safety cases and final static corrections are being verified. No tests/timeouts/skips/snapshots were weakened to pass.

Final focused diagnostic: 12 suites,337 tests passed,0failed,0skipped,exit0,29.835seconds, with --detectOpenHandles; no open handles were reported. Evidence: .validation/task17/focused-final.log/.json/.exit.txt.

First full run:94suites,91passed/1failed/2skipped;1307tests,1304passed/1failed/2skipped;exit1,213.052seconds. The failure was the existing App navigation test "Phase 4 public Details request returns through Register/Login to the same listing for explicit review" exceeding its5000ms timeout. It ran while static validation was also active. Resource contention is possible, not proven. No App test, timeout or assertion was changed.

FINAL full suite:94suites,92passed/0failed/2existing skipped;1307tests,1305passed/0failed/2existing skipped;exit0,145.252seconds. Evidence: .validation/task17/full-final.log/.json/.exit.txt. The original1251passed baseline increased by54new Task17 tests across two new files. The final suite includes Auth/Profile/Dashboard/Reviews/Messages, My Listings, owner/public details, shared Create/Edit, image-upload/local Remove and image-only Retry regressions. Existing skipped live suites remain registration.live.test.ts and categories.live.test.ts.

TypeScript: PASS,exit0 (.validation/task17/typecheck-complete.*).
Scoped ESLint: PASS,exit0, no errors/warnings (.validation/task17/eslint-complete.*).
git diff --check: PASS,exit0; checkout LF/CRLF warnings only (.validation/task17/diff-check.*).
Android arm64 debug build: PASS,exit0, BUILD SUCCESSFUL in1m24s;407actionable tasks,16executed/391up-to-date. Evidence: .validation/task17/android-arm64.log and .exit.txt. Output: android/app/build/outputs/apk/debug/app-debug.apk. No install or rendered-device claim is made. Gradle deprecation/cross-drive native-copy notices were nonfatal; existing React act warnings in regression logs were not suppressed.

Exact commands (output redirected to the evidence paths above):

```powershell
node node_modules/jest/bin/jest.js --runInBand --detectOpenHandles __tests__/ListingImageDelete.test.tsx __tests__/listingImageDeleteApi.test.ts __tests__/ListingImageFlow.test.tsx __tests__/listingImageUploadApi.test.ts __tests__/ListingDetails.test.tsx __tests__/UpdateListing.test.tsx __tests__/updateListingApi.test.ts __tests__/CreateListing.test.tsx __tests__/createListingApi.test.ts __tests__/PostListing.test.tsx __tests__/ownListingDetails.test.ts __tests__/MyListings.test.tsx --json --outputFile=.validation/task17/focused-final.json
node node_modules/jest/bin/jest.js --runInBand --json --outputFile=.validation/task17/full-final.json
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/features/listings/services/listingImageDeleteService.ts src/features/listings/hooks/useRemoveListingImage.ts src/features/listings/components/RemoveListingImageConfirmation.tsx src/features/listings/screens/ListingDetailsScreen.tsx src/features/listings/services/ownListingDetailsService.ts src/features/post-listing/services/listingImageOperations.ts src/features/post-listing/services/listingImageUploadService.ts src/features/post-listing/services/updateListingService.ts __tests__/listingImageDeleteApi.test.ts __tests__/ListingImageDelete.test.tsx
git diff --check
# From android:
.\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain
```

Initial failed/diagnostic logs remain available. No forced exit, artificial waits, snapshot updates, skipped tests or timeout increases were used to obtain passing results.

## Live and visual status

LIVE AUTHENTICATED API: NOT VERIFIED.
PHYSICAL DEVICE: NOT VERIFIED.
VISUAL SCREENSHOT/DEVICE VERIFICATION: NOT VERIFIED.

A fresh public connectivity check against the configured /categories URL returned HTTP200, curl exit0 (.validation/task17/connectivity.*). This verifies public reachability only. No disposable customer credentials/image were supplied; no live DELETE or customer image mutation was attempted. Automated source/renderer tests do not replace visual or live API verification.

## Scope confirmation

No Laravel/backend, website/admin, database/schema/migrations, dependencies, listing statuses/business rules or navigation changes. No listing deletion, automatic re-upload or physical media cleanup. Only the approved action/confirmation and necessary image-operation/service/cache bindings were added. All unrelated local work was preserved.
