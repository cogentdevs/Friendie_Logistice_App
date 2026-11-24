# Created listing status verification

## Confirmed defect and current fix

Read-only inspection of Laravel `CustomerListingController.store` and `docs/api/CUSTOMER_LISTINGS_V1.md` confirms that current creation is HTTP 201 with stored status 1 (Published). The earlier mobile validator required 0, incorrectly marking a successful current response unknown. The immediately preceding post-create navigation task already corrected that validator and its Pending-only success message; those changes are preserved, not reimplemented.

Current `createListingService` validates the typed owner record, positive ID, exact submitted fields (except documented sanitized Description), contact privacy and current session. It accepts authoritative 1 plus previously supported 0 for backward compatibility. It never changes the returned status or sends client status/isActive. HTTP 200, malformed responses, unexpected status 2 and mismatched data remain unconfirmed. This task adds regression coverage rather than redundant production edits.

## State meanings and intentional backend behavior

- Local draft: unsent/editable memory-only form, not a server listing status.
- Submission `pending`: local in-flight mutation guard, not server Pending.
- Submission `unknown`: delivery cannot be confirmed; preserve draft and forbid unsafe duplicate create. This does not mean the server failed to save.
- Server 0: Pending; shown as Pending, never Active/Completed.
- Server 1: Published; existing Active UI corresponds to this value.
- Server 2: Expired; not a valid expected create response.

Confirmed unchanged/no-image draft is cleared, one success Toast is shown and existing navigation opens Drawer My Listings with account-scoped All selected. Newer draft edits are preserved rather than cleared/navigated away. My Listings/Dashboard cancel and invalidate their existing account-scoped keys; active observers fetch authoritative data, no counters/records are fabricated.

With a selected image, the existing sequence and recovery are retained: create once, upload against confirmed ID, finish after confirmed upload. Definite image failure retains image-only retry; unknown image outcome retains its safety hold. A retained recovery draft does not turn the saved server listing into Pending or an unsent listing. Logout/account changes/blur prevent stale navigation.

## My Listings versus public eligibility

Customer listings are ownership-scoped. All omits status; Pending sends 0; Active sends 1; Expired sends 2. Rows map their actual backend status. Completed has no backend equivalent.

`app/Queries/Api/PublicListingQuery.php` independently requires stored status 1, departure_on >= the server's current date, active category and its existing owner/category/country/city joins. Public listing show uses the same base query. An owner record can therefore appear in All/Active while absent publicly. No status updates, force publication, expiry/approval changes, public-filter bypass or database writes were performed. Laravel eligibility is verified from source, not through a live record or backend database test.

## Changes and tests

This task extends the existing authoritative-refresh test in `__tests__/CreateListing.test.tsx` to run for both server 0 and 1. It verifies that the customer endpoint is refetched without status filtering and that the refreshed record remains respectively Pending/Active with the original numeric backend value. Earlier tests retain coverage of strict HTTP/response checks, draft cleanup, duplicate/timeout/session guards, image recovery and navigation.

Existing dirty work from prior Contact/avatar/post-create tasks is preserved. Only the test extension and this report were added by this status-verification task; the previous validator/Toast fix remains part of the working result.

Initial focused run: `node node_modules/jest/bin/jest.js --runInBand --silent __tests__/CreateListing.test.tsx __tests__/createListingApi.test.ts __tests__/myListingsService.test.ts __tests__/MyListings.test.tsx __tests__/ListingImageFlow.test.tsx __tests__/Listings.test.tsx __tests__/HomeLiveApi.test.tsx` — 167 passed, 5 failed across 7 suites (6 passed, 1 failed), 100.141s. First failure was a 5-second timeout in Listings, followed by renderer/assertion failures in that suite. No test timeout/assertion changes were made; subsequent run results follow below. Logs: `.validation/listing-status/`.

## Verification status

Full Jest command `node node_modules/jest/bin/jest.js --runInBand --silent`: **exit 1**, 106 suites passed / 1 failed / 2 existing skipped (109 total); **1,624 tests passed / 1 failed / 2 existing skipped** (1,627 total), 315.197 seconds. The one failure was the existing 5-second timeout in `current Published 201 selects All and opens existing My Listings exactly once without polluting public Details`. No new tests were skipped or weakened.

Isolated follow-up command: `node node_modules/jest/bin/jest.js --runInBand --silent __tests__/CreateListing.test.tsx __tests__/Listings.test.tsx` — 2 suites / 28 tests passed, exit 0, 14.574 seconds. This reruns both the full-suite failure and initial focused Listings failures. The rerun does not make the full-suite result green or establish a precise cause for timing sensitivity. New inventory is one larger due to the additional Published refresh case.

`node node_modules/typescript/bin/tsc --noEmit`: exit 0, no diagnostics. Scoped ESLint on createListingService, useCreateListing, myListingsService and CreateListing/createListingApi/myListingsService tests: exit 0, no diagnostics.

Android command in `android`: `.\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain` — **BUILD SUCCESSFUL**, exit 0, 2m24s, 407 tasks (30 executed, 377 up-to-date). Existing Gradle deprecation warning remains. Logs: `typescript.log`, `eslint.log`, `android-build.log` in the diagnostic folder.

Initial focused command exited 1 and printed an async-cleanup warning before eventual exit; it was not force-exited. The complete suite also exited 1 as reported above. Remaining issue: full-suite timing failure despite passing isolated rerun; no blanket all-tests-pass claim.

Live authenticated creation/persistence and physical device: NOT VERIFIED. No live POST, PUT, image mutation or database change was used for testing. Unknown prior submissions require checking authoritative My Listings; this fix does not safely identify or automatically resend them.
