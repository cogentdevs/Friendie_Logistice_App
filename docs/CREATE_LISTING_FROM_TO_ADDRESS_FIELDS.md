# Task 35: Create Listing From / To Address

## Investigation and verified contract

The existing form has independently selected API Country/City records and optional Area for each side. Task 31 `useListingGps` already gates foreground permission, settings return, account identity, request generation and lifecycle cancellation; GPS is supplied to `ListingLocationPicker` only for Create's From picker. It is not supplied to To or Edit. Those behaviors remain intact.

Backend was inspected read-only. `app/Support/Api/CustomerListingFields.php` includes `from_address` and `to_address` in EDITABLE and validates each as `sometimes|nullable|string|max:255`. `CustomerListingController` stores validated fields and serializes both in owner list/detail/create/update responses. Migration `2026_11_21_000001_add_addresses_to_post_ads_table.php` defines nullable VARCHAR(255) columns. `docs/api/CUSTOMER_LISTINGS_V1.md` confirms owner-only address fields: omitted create defaults NULL, omitted update preserves, explicit NULL clears. No address schema or backend changes were made by this task. Source/migration presence does not prove deployment/migration status on a running server.

### Existing unrelated create-status incompatibility

The current backend store implementation inserts `isActive=1`, and its contract describes publication1. Existing mobile create confirmation still requires status 0. Task 35 explicitly preserves listing status/workflow. This pre-existing mismatch was **not changed** here. A real current-backend HTTP 201/status1 will still enter the existing unknown-confirmation protection rather than report confirmed creation. Resolving that status contract needs a separately scoped correction; successful live end-to-end creation is not claimed. Address tests retain the existing mobile status0 fixtures to isolate the address change, not to establish current backend publication semantics.

## Implementation

- Two independent optional multiline inputs, **From Address** and **To Address**, reuse AppInput, existing form scrolling/keyboard layout, typography and styles. Maximum 255, no new required constraint. Area is retained as a separate value.
- Draft keys `fromAddress` / `toAddress` map to JSON `from_address` / `to_address`. Nonblank optional values are trimmed; blank create values are omitted. Country/City IDs, dates, contact privacy, numeric zero and image sequence are unchanged.
- Review step displays the entered addresses so the user can inspect them before explicit submission.
- Owner response schema retains optional nullable addresses, remaining compatible with older response records. If a submitted nonblank address is missing/different in a create response, confirmation fails safely with the existing unknown outcome hold; it cannot silently claim address persistence.
- Edit loads owner-only addresses, preserves them during unrelated edits, and sends explicit NULL when cleared. Address changes are checked against authoritative update responses; existing uncertain-update reconciliation remains unchanged.
- Addresses are not added to public listing responses, public Details display, messages, GPS filters or contact exposure.

## From-only GPS and manual override

The existing Android reverse-geocoder now additionally returns `streetAddress` only when Android supplies a nonblank thoroughfare and a nonblank address line of at most 255 characters. City/country-only results do not manufacture a street address. Existing country/city/area fields and Home/Search behavior are unchanged; the added optional field is consumed only by Create.

Create's GPS service accepts that street line only within the existing finite positive accuracy threshold and after unique matching of both Laravel Country and country-dependent City. A country-only match does not fill an address. No coordinate is converted to text or ID, retained in the draft or logged.

Automatic origin detection also requires an empty From Address and no manual address edit. A GPS result fills From Address only while empty and not manually edited. Typing invalidates the pending GPS generation. Explicit re-detection still preserves manual address text; users can edit the address themselves. To Address has no detection callback, permission request or implicit copy. Account changes reset the local manual-edit marker; existing account-scoped draft cleanup and stale guards remain in place.

Permission denial, permanently denied/App Settings, disabled GPS/Location Settings, timeout, partial matches, navigation away, duplicate detection and settings resume continue through the existing Task 31 hook. No background tracking or background permission was added. Existing react-native-toast-message feedback is reused; no new notification system or Alert call was added.

## Files changed for this task

1. `src/features/post-listing/types/listingDraft.ts`
2. `src/features/post-listing/screens/PostListingScreen.tsx`
3. `src/features/post-listing/screens/ListingReviewScreen.tsx`
4. `src/features/post-listing/services/createListingService.ts`
5. `src/features/post-listing/services/updateListingService.ts`
6. `src/features/post-listing/services/listingGpsService.ts`
7. `src/features/listings/types/myListingsApi.types.ts`
8. `src/features/location/types/location.ts`
9. `src/features/location/services/placesService.ts`
10. `android/app/src/main/java/com/friendie_logistics_app/FriendieGeocoderModule.kt`
11. `__tests__/PostListing.test.tsx`
12. `__tests__/createListingApi.test.ts`
13. `__tests__/listingGpsService.test.ts`
14. `__tests__/updateListingApi.test.ts`
15. This report.

Pre-existing modified/untracked work from earlier tasks was preserved. No reset, branch switch, commit, dependency installation, backend/database/website/admin edits, endpoint changes or unrelated screen redesign.

## Verification

Initial focused command: `node node_modules/jest/bin/jest.js --runInBand --silent __tests__/PostListing.test.tsx __tests__/createListingApi.test.ts __tests__/listingGpsService.test.ts __tests__/updateListingApi.test.ts __tests__/useListingGps.test.tsx __tests__/ListingSelectorSearch.test.tsx __tests__/ListingImageFlow.test.tsx __tests__/CreateListing.test.tsx` — 8 suites / 218 tests passed, exit 0, 48.649 seconds. One further owner-address loading case was added afterward and is included in final regression.

TypeScript `node node_modules/typescript/bin/tsc --noEmit` and scoped ESLint across the nine changed TS/TSX source files and four tests — exit 0, no diagnostics. Logs: `.validation/task35/typescript.log`, `eslint.log`.

Final full suite, Android build and device results: pending below.

## Live status and limits

LIVE AUTHENTICATED CREATE/ADDRESS PERSISTENCE: NOT VERIFIED. No real listing POST or PUT is performed during automated verification. Public users cannot see these owner-only address fields by contract. Deployment of the new nullable address columns is not independently verified. The create-status mismatch above remains a live end-to-end blocker outside this address-only change.
