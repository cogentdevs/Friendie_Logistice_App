# Task 16 - Update Listing API integration

## Authorization and outcome

The original inspection found no owned-listing edit action, route or form. The existing Manage Listing button opens My Listings, and Edit listing details edits only an unsaved creation draft. The user's follow-up explicitly authorized exactly one owned-listing Edit action, reuse of the multi-step form in Edit mode, and Save changes. Those additions are now implemented. No duplicate form or image replacement UI was added.

Working-tree baseline: main at 25b3ed5592780aad3b9662feab581c2ae2fdf19f. Seven pre-existing modified files were preserved: ListingDetails.test.tsx, ListingImageFlow.test.tsx, LISTING_IMAGE_UPLOAD_API_INTEGRATION.md, ListingDetailsScreen.tsx, ListingImageInput.tsx, useCreateListing.ts and ListingReviewScreen.tsx. No reset, branch switch or commit was made.

## Verified Laravel contract

Read-only sibling backend sources: routes/api.php, CustomerListingController.php (update/owned/editable/lockCustomer/input/serialize/limit), CustomerListingFields.php and ApiResponse.php.

PUT /api/v1/customer/listings/{id}, real Sanctum customer Bearer, application/json. Partial updates are supported. Empty updates and unknown keys are validation errors. Existing centralized Axios client, endpoint registry and secure storage are reused.

Mutable fields: ad_type, title, description, category_id, from_country_id, from_city_id, from_area, to_country_id, to_city_id, to_area, weight, weight_price, currency, departure_on, reached_on, show_contact_info. No status, image, feature or owner fields may be submitted.

- Carring and Send are the exact backend ad types.
- Present required values use sometimes|required. Title max255; IDs positive integers <=2147483647 with active reference validation; currency supported active-country currency, uppercase/trimmed, max11; dates Y-m-d.
- Optional nullable fields: description max10000, areas max255, weight integer0..2147483647, finite numeric weight_price>=0. Null clears these values; omission preserves them. Request middleware normalization governs empty strings. The frontend explicitly uses null for cleared supported optional inputs, never blank-to-zero.
- Changed country/city values validate against the effective stored/submitted pair. Dates similarly validate the combined final state, reached_on>=departure_on.
- show_contact_info accepts only0. The editor has no visibility control and omits this field, preserving stored values without enabling disclosure.
- Pending0, Published1 and Expired2 are editable. Unsupported status409. Ownership is scoped to created_by=current customer; missing/non-owned IDs404. Active verified customer and current token are rechecked under transaction locks, with401/403 on invalid eligibility.
- Update applies validated fields plus updated_at=now(). It does not reset moderation status, alter the image, or change feature status. Description is sanitized by ListingDescription::html.
- Success HTTP200: {success:true,message:"Listing updated successfully.",data:listing}. Existing ownListingApiSchema validates the complete authoritative owner DTO including ID, references, type, nullable text/numbers/dates, timestamps, status, is_featured, show_contact_info and image_url.
- Shared errors: {success:false,message,errors?}. Update limit30/account/IP per900seconds,429 Retry-After.
- There is no ETag/version precondition. Database locks serialize writes but cannot detect a stale editor snapshot. Changed-only payloads reduce unrelated overwrites; same-field concurrent edits remain a backend limitation.

## UI and form reuse

ListingDetailsScreen adds one Edit action only on authenticated private owner details with a backend DTO. A numeric/public/fixture ID is not sufficient. The editor independently fetches the owner endpoint before creating its edit context. Real owner details remain eligible in a debug/static marketplace build; a global fixture flag is not used as a substitute for record-origin proof. Guest/demo details cannot expose or invoke the protected editor.

The existing PostListing route accepts editListingId, and ListingReview carries the same ID. PostNavigator retains its screens and account boundary; its parameter typing now includes edit mode. There is no new screen or navigation stack.

PostListingScreen renders the SAME form component with either the existing creation draft or separate account/listing edit memory. Loading/retry uses existing primitives. The edit loader fetches categories/countries/cities/currencies through existing real public services, resolving names only from returned options. Missing/inactive references remain unselected for correction; no location names or IDs are invented. Country-dependent cities and their existing cancellation/query-key behavior are reused unchanged.

Authoritative title, ad type, category, both locations/areas, currency, dates and optional integer weight prefill the form. Zero remains "0"; null weight remains blank. The current form has no description or price inputs, so those stored fields are retained by omission rather than adding unauthorized controls. Existing image URL is read-only in edit mode; Choose image/Remove/create-upload recovery are hidden and untouched.

The review layout is shared. Create mode retains Create listing and the existing unsaved-draft Edit listing details behavior. Edit mode uses Save changes and omits the Pending-after-creation message. Separate controller components ensure the Create hook is not mounted for edit review, including its image-recovery cleanup effects. Successful Save and leaving the edit form restore the Post stack to its normal Create entry and return to Own Listing Details. This prevents the Post (+) tab from being stranded in edit mode. Existing Stay/Keep/Discard confirmation is reused, with guarded redispatch rather than a second dialog; an unrelated creation draft is retained.

## Changed-field payload and validation

The existing validated form-to-request mapping is reused. It requires real reference identities registered by public reference reads and validates the complete final date/location state. The editor compares normalized numeric IDs, integer weight, dates, type, title and optional trimmed areas against the original owner DTO. It sends only differences. Empty optional weight/area clears via null; zero is valid. Description/price/contact visibility, image, status, timestamps and all unrelated fields are omitted.

No changes produces no PUT, stays in the flow and shows an informational Toast. Laravel422 field errors are preserved as field-keyed messages in the existing review error presentation; users return through Edit listing details to correct inputs. The draft remains editable. No raw server exception text is shown.

## Mutation, draft and privacy safety

Edit contexts are registered only by successful authoritative owner reads, keyed by listing ID and exact authenticated user object. Cloned/unregistered contexts and invalid IDs cannot submit. Logout or account replacement clears contexts and edit draft state. Secure token is read before PUT and checked again afterward. Existing interceptor session cleanup remains intact.

Both the controller and service synchronously guard in-flight submissions, across rerenders/remounts. Confirmed and unknown attempts cannot be replayed. Submission occurs only on explicit Save changes. There is no POST creation, image upload/delete, status transition or automatic PUT retry.

Existing Keep/Discard/Stay confirmation behavior is reused, scoped to edit memory; it never discards the creation draft or image recovery. Contexts retain per-listing edited values when switching listings. Active-listing guards prevent a background edit callback from writing another listing's draft. Newer edits made during PUT are retained; the authoritative returned record becomes their next comparison baseline.

Blur/unmount aborts or ignores completion and prevents late feedback/navigation. Account changes block cache writes and navigation. Definite HTTP400/401/403/404/409/422/429 rejections retain the draft and permit deliberate correction. Network/timeout/server/invalid-response outcomes remain unknown, not automatically retried. A read-only owner-details reconciliation compares every intended field. If all match, the current desired server state is confirmed without claiming exactly-once execution; a partial/inconclusive read leaves the mutation held. The original snapshot and edited draft remain available. Token/session cancellation is never reconciled through a replacement session.

## Cache synchronization and image preservation

After confirmed200 (or conclusive authoritative reconciliation), older matching readers are canceled before account-scoped My Listings, correct Own Listing Details and relevant real public list/details caches are invalidated/refetched. Infinite-query pages, filters and ordering are not reconstructed or overwritten. No fabricated listing is inserted.

The backend update preserves status and statistics. Dashboard is invalidated only if the authoritative returned status differs from the original; no received-review/unread/listing counters are manually changed. Public results continue to enforce visibility through their backend reads. No image field is sent and no image mutation endpoint is called. Create Listing, Task15 image-only retry and unresolved recovery remain isolated.

## Notifications

Only the existing react-native-toast-message Toast.show API/configuration is used. One success notification after confirmed saved state, info for no changes, error for validation/definite failures, and warning for unknown outcomes or saved-but-refresh-failed state. Existing white card/colored left-bar styling is unchanged. Existing confirmation dialogs remain actual confirmations.

## Task 16 files

New:
- src/features/post-listing/services/updateListingService.ts
- src/features/post-listing/store/editListingDraftStore.ts
- src/features/post-listing/components/ListingEditLoader.tsx
- src/features/post-listing/hooks/useUpdateListing.ts
- __tests__/updateListingApi.test.ts
- __tests__/UpdateListing.test.tsx

Modified for Task16:
- src/features/listings/screens/ListingDetailsScreen.tsx
- src/features/post-listing/screens/PostListingScreen.tsx
- src/features/post-listing/screens/ListingReviewScreen.tsx
- src/navigation/navigationTypes.ts
- src/navigation/PostNavigator.tsx
- __tests__/ListingDetails.test.tsx (meaningful owned Edit navigation assertion)
- docs/UPDATE_LISTING_API_INTEGRATION.md

## Verification

Final focused run: 9 suites,276 tests PASS,0fail,0skip,exit0,15.448seconds. Includes new Update/API tests plus My Listing Details, Create Listing, Post form and image upload regressions. Logs/JSON/exit evidence: .validation/task16/focused-finalized.*. No tests were deleted, newly skipped or weakened; existing owner navigation coverage was extended.

Initial diagnostics are retained. A changed create-navigation argument was corrected to preserve its original call contract. An initial owner-details timeout cascaded into renderer failures; unchanged checks passed on rerun. A new Edit assertion exposed an overly broad static-mode visibility guard, corrected to use authenticated private backend origin. Local test fixtures were corrected to spy on Toast and retain unobserved QueryClient data during cache assertions. These failures were not hidden by timeout increases or skips.

Final static checks: node node_modules/typescript/bin/tsc --noEmit exited0; scoped node node_modules/eslint/bin/eslint.js on all Task16 source/test files exited0 with no errors/warnings. Evidence: .validation/task16/typecheck-complete.* and eslint-complete.*. git diff --check exited0; only existing LF/CRLF checkout warnings were emitted.

First full-suite diagnostic run (overlapped with validation processes, not the final delivery result): 92 suites,87passed/3failed/2existing skipped;1248tests,1224passed/22failed/2skipped;exit1;451.394seconds. Failures included timeout/renderer cascades in App, ListingDetails and UpdateListing. Complete stdout/JSON are retained at .validation/task16/full.*. Resource contention is a possible cause, not a proven diagnosis. Tests/timeouts/skips were not weakened. This run also preceded the final four additional safety cases and final source fixes.

A subsequent full delivery attempt had1249passed/1failed/2skipped (92suites:89passed/1failed/2skipped),exit1,253.931seconds. The sole failure was the existing Home dashboard navigation test exceeding its5000ms timeout. App.test.tsx then passed independently:56/56,exit0,64.88seconds (.validation/task16/app-recheck.*). Another complete run passed1250tests/0fail/2existing skipped across90passed/2skipped suites,exit0,144.805seconds (.validation/task16/full-final.*). Final Post-entry navigation cleanup and one additional safety test were added afterward, so the final snapshot is being verified again rather than treating this earlier green run as delivery proof.

FINAL SNAPSHOT full suite:92suites total,90passed/0failed/2existing skipped;1253tests total,1251passed/0failed/2existing skipped;exit0;129.85seconds. Evidence: .validation/task16/full-finalized.log, .json and .exit.txt. This includes all existing Auth/Profile/Reviews/Messages, public listings, My Listings, Create Listing and image-upload regressions. The original1196passed baseline increased by55new meaningful Task16 tests in two new test files. Existing ListingDetails owner navigation coverage was also extended without removing assertions. The only skipped suites remain registration.live.test.ts and categories.live.test.ts; no new skips, snapshots or timeout changes.

Android arm64 debug build: PASS, exit0, BUILD SUCCESSFUL in2m58s;407actionable tasks,30executed/377up-to-date. Command: .\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain from android. Evidence: .validation/task16/android-arm64.log and .exit.txt. APK: android/app/build/outputs/apk/debug/app-debug.apk. No installation or runtime/device rendering claim is made.

### Exact verification commands

Commands executed from the app root, unless otherwise noted:

```powershell
node node_modules/jest/bin/jest.js --runInBand __tests__/UpdateListing.test.tsx __tests__/updateListingApi.test.ts __tests__/PostListing.test.tsx __tests__/CreateListing.test.tsx __tests__/ListingDetails.test.tsx __tests__/ListingImageFlow.test.tsx __tests__/listingImageUploadApi.test.ts __tests__/createListingApi.test.ts __tests__/ownListingDetails.test.ts --json --outputFile=.validation/task16/focused-finalized.json
node node_modules/jest/bin/jest.js --runInBand --json --outputFile=.validation/task16/full-finalized.json
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/features/post-listing/services/updateListingService.ts src/features/post-listing/store/editListingDraftStore.ts src/features/post-listing/components/ListingEditLoader.tsx src/features/post-listing/hooks/useUpdateListing.ts src/features/post-listing/screens/PostListingScreen.tsx src/features/post-listing/screens/ListingReviewScreen.tsx src/navigation/navigationTypes.ts src/navigation/PostNavigator.tsx src/features/listings/screens/ListingDetailsScreen.tsx __tests__/updateListingApi.test.ts __tests__/UpdateListing.test.tsx __tests__/ListingDetails.test.tsx
git diff --check
# From android:
.\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain
```

All command output/exit files are retained under .validation/task16. Initial failed runs remain visible and are not delivery PASS claims.

## Live verification and remaining limitations

LIVE AUTHENTICATED API: NOT VERIFIED.
PHYSICAL DEVICE: NOT VERIFIED.

Fresh public connectivity check against the configured /categories URL timed out after10015ms with no response: curl exit28,HTTP000 (.validation/task16/connectivity-direct.*). A preceding Node spawn attempt failed EPERM and is not connectivity evidence. No customer credentials, live PUT or device installation/render test was used.

Nonfatal warnings: existing React act/navigation diagnostics in regression logs, Gradle deprecation notices, and cross-drive native hard-link fallback to copying. No rules or warnings were suppressed to pass checks.

Remaining limitations: no backend concurrency version/idempotency token; inconclusive unknown outcomes stay held for the current session rather than inviting unsafe resend; draft/holds are memory-only, not durable across process restart; inactive/missing references require correction; description and price remain unchanged because the shared form has no existing controls. Backend remains the authorization and status authority.

## Scope confirmation

No Laravel/backend, website/admin, database/schema/migration, API contract, listing status/business-rule, dependency, theme or unrelated UI changes. Only the explicitly approved owned Edit action, shared form edit mode, Save changes and their necessary service/state/navigation/test bindings were added. Existing uncommitted work was preserved.
