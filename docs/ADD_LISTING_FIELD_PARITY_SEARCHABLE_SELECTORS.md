# Task 30 — Add Listing field parity and searchable selectors

## Pre-implementation audit

Comparison recorded before implementation. The website screenshot was not available in this conversation; the supplied website field inventory is the reference. Branch main, HEAD 9fc4317432d0b8e7c08f287f9922851b337e3151. Existing dirty/untracked work is preserved.

| Website field | Existing app field | Present? | API mapping | Laravel validation | Action |
|---|---|---|---|---|---|
| Type | Carry/Send choice | Yes | ad_type | Carring / Send | Preserve |
| Category | Category selector | Incomplete | category_id | Active real integer ID | Add search |
| Listing Title | Title | Yes | title | Required string, max 255 | Preserve |
| Description | None | Missing | description | Optional nullable string, max 10000 | Add optional multiline input |
| From Country | From location/Country | Incomplete | from_country_id | Required active ID | Add search |
| From City | From location/City | Incomplete | from_city_id | Required active city in country | Add search |
| From Area | Area (optional) | Yes | from_area | Optional max 255 | Preserve |
| Travel On | Departure Date | Yes | departure_on | Required Y-m-d | Preserve |
| To Country | To location/Country | Incomplete | to_country_id | Required active ID | Add search |
| To City | To location/City | Incomplete | to_city_id | Required active city in country | Add search |
| To Area | Area (optional) | Yes | to_area | Optional max 255 | Preserve |
| Reach On | Arrival / Reached Date | Yes | reached_on | Required Y-m-d, >= departure | Preserve |
| Weight Limit | Weight / capacity | Yes | weight | Optional integer 0..2147483647 | Preserve |
| Price per KG | None | Missing | weight_price | Optional finite numeric >= 0 | Add optional decimal input |
| Currency | Currency selector | Incomplete | currency | Required actual code, max 11 | Add search by returned code |
| Show Phone/Email | Safe payload constant | Equivalent restricted behavior | show_contact_info | Integer 0 only | Preserve privacy; no Yes option |
| Featured Image / Upload File | Choose image, preview, local Remove | Yes | Separate image multipart endpoint | Existing JPEG/PNG/WebP constraints | Preserve |
| Submit | Continue then Create listing | Yes | POST /customer/listings | Authenticated explicit action | Preserve |

## Authoritative sources (read-only)

Backend `app/Support/Api/CustomerListingFields.php`; `app/Queries/Api/ReferenceDataQuery.php`; API V1 Category/Country/City/Currency controllers. Reference endpoints return HTTP 200 `{success:true,message,data:{items:[]}}`, complete unpaginated lists; optional search max 100, city country_id filter. Currency returns code only, not a name or ID. Local filtering can therefore search all loaded options without partial-page omissions or repeated requests. Description is optional despite website marker. Contact 1 is unsupported.

## Implementation

- Added Description (optional, multiline, max 10000) and Price per KG (optional decimal keyboard) to the existing Create form only. Existing Edit controls were not expanded. Both new fields persist through the existing draft store and appear on the existing review step when populated. Existing inputs and their relative order remain intact.
- Description maps to `description` preserving entered text; empty/whitespace-only optional description is omitted. Price maps from `weightPrice` draft text to numeric `weight_price`; blank is omitted, zero is preserved, negative/nonfinite/malformed values are rejected. Decimal and scientific numeric representations are accepted, matching Laravel numeric validation. No price maximum was invented.
- Existing required fields, local Y-m-d dates, arrival ordering, integer weight including zero, real-reference identity registry and country/city relationship validation remain intact. No free-text area is used as an ID.
- Extended the existing shared ListingReferencePicker once for all four reference types. Search is trimmed, case-insensitive substring matching against the complete loaded list; country/category/city names and currency code (the only currency field returned). It preserves backend option values/order, deduplicates by actual key, offers Clear search and a distinct no-match state. No invented currencies or names. No new endpoints, client, search store, modal library or per-keystroke requests.
- Search resets when kind/country changes and on normal picker remount. Query keys remain kind + country; AbortSignal and React Query's isolated cache prevent old country results replacing new results. No placeholder data from other countries is used. Existing From/To location instances remain independent; changing country clears that side's selected city, and Apply validates the pair.
- Existing Android Back/Cancel callbacks remain. Added the existing KeyboardScreen around the existing scroll container; keyboard-aware scroll behavior and handled taps are reused, without nested vertical lists. Existing AppButton labels wrap naturally. No shared global component or theme edits.
- The shared picker also serves Search/Filters and Edit: they receive the same search addition, with existing selection/navigation/API contracts retained and regression-tested.

## Privacy, images and submission

Contact visibility stays payload constant `show_contact_info:0`, with no new Yes control or private contact disclosure. Existing account guards, token lookup, pending/unknown mutation guard, Toast/error handling and explicit review-step submission remain unchanged. No real listing POST was performed.

Image selection, local Remove, preview, validation, create HTTP 201 then image upload HTTP 200 sequence, authoritative listing ID and image-only retry remain unchanged. The website Featured Image / Upload File is represented by this existing optional image workflow; no unrelated attachment upload is added. Description's website required marker and contact visibility toggle differ from mobile backend rules; backend rules are preserved.

## Task-specific files

1. `src/features/post-listing/components/ListingReferencePicker.tsx`
2. `src/features/post-listing/screens/PostListingScreen.tsx`
3. `src/features/post-listing/screens/ListingReviewScreen.tsx`
4. `src/features/post-listing/types/listingDraft.ts`
5. `src/features/post-listing/services/createListingService.ts`
6. `__tests__/ListingSelectorSearch.test.tsx` (new)
7. `__tests__/PostListing.test.tsx` (existing prior changes preserved)
8. `__tests__/createListingApi.test.ts`
9. This report.

## Verification

Initial focused run: 7 suites / 175 tests passed, exit 0 (21.820 s). Expanded final focused run: 9 suites / 266 tests passed, exit 0 (96.984 s), including image upload and image-flow regression. Twenty tests added in total: seven selector tests, twelve optional payload/validation cases and one optional input/draft test. Existing country dependency, guest/session, update/create, privacy and image safety cases retained.

Focused command:
`node node_modules/jest/bin/jest.js --runInBand --silent __tests__/ListingSelectorSearch.test.tsx __tests__/PostListing.test.tsx __tests__/createListingApi.test.ts __tests__/FilterRoutePickers.test.tsx __tests__/CreateListing.test.tsx __tests__/UpdateListing.test.tsx __tests__/updateListingApi.test.ts __tests__/ListingImageFlow.test.tsx __tests__/listingImageUploadApi.test.ts`

`node node_modules/typescript/bin/tsc --noEmit`: exit 0. Initial execution caught TS18046 in a new test mock's unknown params; corrected the test-only type and reran successfully.

Scoped ESLint: exit 0, no diagnostics. Command: `node node_modules/eslint/bin/eslint.js src/features/post-listing/components/ListingReferencePicker.tsx src/features/post-listing/types/listingDraft.ts src/features/post-listing/services/createListingService.ts src/features/post-listing/screens/PostListingScreen.tsx src/features/post-listing/screens/ListingReviewScreen.tsx __tests__/ListingSelectorSearch.test.tsx __tests__/createListingApi.test.ts __tests__/PostListing.test.tsx`.

`git diff --check`: exit 0; existing Windows LF/CRLF notices only.

Android arm64 build: `cd android; .\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain`, exit 0, BUILD SUCCESSFUL in 3m 4s, 407 actionable tasks (16 executed, 391 up-to-date). Existing AGP/Gradle deprecation warnings; no build errors.

Full Jest: **105 passed suites, 2 existing skipped suites, 107 total; 1550 passed tests, 0 failures, 2 existing skipped tests, 1552 total; 0 snapshots; 209.791 seconds; exit 0**. Exact command `node node_modules/jest/bin/jest.js --runInBand --silent`; full output captured at `.validation/task30/full-jest.log`. Run after build/static/focused checks completed. Previous Task 29 baseline was 1530 passing tests; twenty focused additions explain the new count. No tests were removed, newly skipped or weakened.

Full regression includes App/navigation/authentication/session, Create/Edit Listing, image upload/delete, My Listings/details, Search/Filters, Home, Dashboard, reviews and messaging suites. This demonstrates mocked regression coverage; it is not live API or physical rendering verification.

## Visual/live limitations and scope

Screenshot visual comparison: NOT VERIFIED (reference screenshot unavailable). Emulator/physical interaction and visual equivalence: NOT VERIFIED for Task 30. Connected physical phone was in another foreground app; no interaction was attempted. Keyboard configuration and selection behavior are tested in Jest, not claimed as physical rendering proof. No live authenticated create/upload request was made.

No Laravel, database, website/admin, migrations, endpoints, authentication, global theme or navigation changes. Existing unrelated working-tree changes were preserved. Only Add Listing and its directly shared selector, mapping and tests changed in this task.
