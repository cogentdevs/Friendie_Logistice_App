# Task 33 — My Listings visibility and public Listings tab navigation

## Confirmed causes and targeted changes

Task 32 source audit and current Laravel controller confirm: Create returns HTTP 201 with Pending status 0; My Listings previously exposed only Active=1 / Expired=2 / unsupported Completed. Create success navigated into the public Listings stack's private owner Details route. Real tab switches retained that child route, including cold Details-only stacks.

### My Listings

- Real customer selector now extends the existing segmented row with **All** and **Pending**. All is the initial real-session view. Existing remembered selections remain account-scoped. Demo keeps its previous three selections and Active default.
- All omits `status`; Pending sends `status:0`; Active retains `status:1`; Expired retains `status:2`. Existing Completed behavior is preserved: no invented backend equivalent, no Pending-to-Completed mapping, and the existing unsupported-state feedback for real accounts.
- View selection and record status are distinct types. All is never assigned as a record status. Every backend row maps its real 0/1/2 to Pending/Active/Expired; Pending cards reuse the existing neutral badge styling. No new colors or card redesign.
- Existing authenticated endpoint, Bearer-token checks, account/AbortSignal guards, latest-first backend default, pagination, ID deduplication and pull-to-refresh are unchanged. Only selected-view total is shown when authoritative; no counts or dashboard metrics are fabricated.

### Creation, refresh and image safety

- The existing verified create hook still cancels and invalidates the account's `myListings.read` prefix and authoritative Dashboard summary after confirmed creation. Active queries refetch, inactive ones become stale and fetch on return/focus. No fabricated record is pushed into a cache.
- Standard Create success now selects that account's All view and navigates to the existing `AppDrawer → MyListings` route. Public Listings is not touched by success navigation. No new route or navigator hierarchy.
- The existing image-upload/retry path continues to use the confirmed ID and invoke the same completion callback only under its existing safe success conditions. Definite/uncertain image failures, retry restrictions, draft preservation, newer-edit guard and duplicate-create prevention are unchanged.
- Edit success still uses its prior owner Details flow; this task does not redesign Edit. Explicit owner card taps still open the actual record's private Details.

### Public Listings entry/reselect

- Every deliberate Listings tab press supplies a fresh nested **Listings-only state**, index 0. This replaces only that child stack, not the Drawer/root or other tabs. It replaces stale nested Details params and handles both cold index-0 Details and previously visited root-plus-Details stacks.
- A first sequential child reset + navigate implementation was rejected by the new real-router tests because retained nested params could reinitialize Details. The final single nested-state action passes both cold and retained-stack tests.
- Existing tab labels/icons/order/styling are unchanged. The existing tab bar is now visible on the Listings stack's root/Details screens so the requested reselect is actually available. It stays hidden on that stack's Filters and all other previously hidden non-Listings screens. This is the minimal necessary visibility correction; no replacement navigation UI.
- Intentional listing card selection still opens Details. After a deliberate public-root tab press, removed Details cannot reappear through Android/root Back. Other tabs preserve their own navigation/draft state.
- Public read service, publication/expiry/active-category rules, Home Latest Ads and filters are unchanged. Pending is never injected into public data.

### Description confirmation

Backend `CustomerListingController.store` sanitizes Description using `ListingDescription::html` before insertion and returns the stored representation. Task 32 pure-function evidence: `Parcel & documents` becomes `Parcel &amp; documents`.

Creation confirmation now excludes **only Description** from raw payload equality. It still requires HTTP 201, the verified typed success envelope, positive server record ID, Pending 0, contact visibility 0, matching other submitted fields and current token/account/session. Arbitrary HTTP 200, malformed/unrelated objects and mismatched fields still fail existing tests. The authoritative returned Description is used; no frontend sanitizer or fabricated success record was added.

## Exact Task 33 files

Production:
1. `src/features/listings/services/myListingsService.ts`
2. `src/features/listings/hooks/useMyListings.ts`
3. `src/features/listings/screens/MyListingsScreen.tsx`
4. `src/features/listings/components/MyListingCard.tsx`
5. `src/features/post-listing/services/createListingService.ts`
6. `src/features/post-listing/screens/ListingReviewScreen.tsx`
7. `src/navigation/components/CustomTabBar.tsx`

Tests:
8. `__tests__/App.test.tsx`
9. `__tests__/CreateListing.test.tsx`
10. `__tests__/MyListings.test.tsx`
11. `__tests__/myListingsService.test.ts`
12. `__tests__/createListingApi.test.ts`

13. This report. Existing Task 28–32 changes in the working tree are preserved; no reset, branch change or commit.

## Tests and verification

New cases cover All/Pending real request mapping, omission of status, mixed actual row statuses, authoritative Pending UI, sanitized Description, account-scoped post-create destination, actual customer refetch after confirmation, and real-mode cold/reselect/tab-switch root behavior for guest/member. Existing Active scenarios explicitly configure Active so they keep testing that supported view; All is separately tested as the new default. Test response records never use All as a status.

Executed verification (all final commands exit 0):

- Full suite: `node node_modules/jest/bin/jest.js --runInBand --silent` — 107 suites passed, 2 existing suites skipped; **1,596 tests passed, 0 failed, 2 existing skipped**, 153.192 seconds. Eight additional cases versus the preceding 1,588-pass inventory. Log: `.validation/task33/full-jest.log`.
- Navigation independently: same Jest command with `__tests__/App.test.tsx` — 58 tests passed, 52.792 seconds. Log: `.validation/task33/navigation-jest.log`.
- Initial six focused suites (CreateListing, MyListings, myListingsService, createListingApi, ListingImageFlow, MyListingsDashboardConsistency): 148 passed, 13.741 seconds; the additional authoritative-refetch case was subsequently included in the full passing run.
- An intermediate 13-suite run had 299 passes and three App 5-second timeouts while static checks were running concurrently. No timeout/assertion weakening was applied. The complete App suite and complete full suite subsequently passed when run without competing static/build processes. This is an observed scheduling sensitivity, not proof that every possible timing issue is excluded.
- `node node_modules/typescript/bin/tsc --noEmit` — exit 0, no diagnostics. Log: `.validation/task33/typescript.log`.
- `node node_modules/eslint/bin/eslint.js` with the seven source and five test paths listed above — exit 0, no diagnostics. Log: `.validation/task33/eslint.log`.
- In `android`: `.\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain` — **BUILD SUCCESSFUL**, exit 0, 2m19s, 407 tasks (16 executed, 391 up-to-date). Existing Gradle deprecation warnings remain. Log: `.validation/task33/android-build.log`.

No live POST, image mutation, publication or database writes were performed for verification. Full regression includes image, GPS, searchable-selector, keyboard, auth, reviews, messages and existing navigation tests; it does not replace live backend/device coverage.

## Physical/live verification and remaining limits

Read-only interaction checks were performed on the connected Infinix Android phone with Friendie foreground: public Listings root opened; My Listings displayed All/Pending alongside existing status controls; All contained a real owner card; opening that card displayed Listing Details with the existing Listings tab available. A tab press removed Details, and the subsequent Android Back UI dump contained no Listing Details. A separate deep-link check confirmed the public root header. Active control was exercised. No message contents, tokens, precise addresses or credentials were logged.

These checks are partial device interaction evidence, not screenshot-based visual equivalence or exhaustive navigation verification. Cold/retained-stack guest/member behavior is covered by real-router automated tests. Exact pixel equivalence, a newly created Pending record appearing on this phone, and live create/image success navigation are **NOT VERIFIED**; no real submission was made. No claim is made about the specific listing reported in Task 32. Backend remains authoritative if a customer endpoint returns no records. Completed has no backend status and remains the existing explicit limitation.

## Scope confirmation

No Laravel/database/website/admin, endpoint contracts, approval/status rules, public eligibility, Home Latest Ads, GPS, keyboard utilities, contact privacy, image service/hook or unrelated navigation changes. No dependencies installed. All feedback continues through existing react-native-toast-message. Only the necessary status controls, Pending label and existing Listings-tab visibility/entry behavior changed; existing theme tokens, card styles, tab labels/icons/order are preserved.
