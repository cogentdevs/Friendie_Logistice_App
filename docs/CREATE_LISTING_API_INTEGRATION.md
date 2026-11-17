# Task 14 - Create Listing API integration

## Outcome and previous blockers

Implemented the user's explicitly authorized controls inside the existing Post / Add Listing -> ListingReview flow. The previous report stopped because required title, category, currency, a second date and a final creation action were missing. That UI approval was supplied; those blockers are resolved. Existing free-text location picking could not prove backend identities, so Post now uses real country/city selectors. Shared Search/GPS route selection is unchanged.

The existing Carry/Send cards, Continue/Edit flow, form confirmation dialogs, navigation stacks and application theme remain. No new listing screen, listing mutation beyond creation, or image-upload operation was introduced.

## Verified backend contract

Read-only sources in the sibling Laravel project:

- routes/api.php
- app/Http/Controllers/Api/V1/CustomerListingController.php: store, input, serialize, lockCustomer and rate limiter
- app/Support/Api/CustomerListingFields.php
- Existing public category, country, city and currency controllers and shared ApiResponse/PublicData handling

**POST /api/v1/customer/listings**, JSON, Sanctum customer Bearer token. Uses the existing environment-aware Axios client and existing `endpoints.myListings`; no host or duplicate API prefix is embedded in the UI.

Required fields:

| Field | Binding and validation |
|---|---|
| ad_type | Existing Carry Parcel -> `Carring`; Send Parcel -> `Send` |
| title | New Title input, required nonblank string, maximum 255 characters |
| category_id | Real category selected from existing getCategories service; positive 32-bit backend ID |
| from_country_id / to_country_id | Real active country choices; positive 32-bit backend IDs |
| from_city_id / to_city_id | Real city choices belonging to the respective country |
| currency | Selected backend code from currencies API, maximum 11 characters; not a currency ID or assumed three-letter code |
| departure_on | Existing calendar control, now explicitly labelled Departure Date; date stored directly as Y-m-d |
| reached_on | Authorized Arrival / Reached Date calendar; required valid Y-m-d, on/after departure |

Optional request values actually supported by this UI: from_area, to_area and weight. Blank areas/weight are omitted. Weight must be an integer from **0 through 2147483647**; `0` is retained and decimals/exponents/negative values are rejected. No blank-to-zero conversion. Title and optional area outer whitespace are normalized to match Laravel's trimmed request values. No default category/country/city/currency/date/title is fabricated.

`show_contact_info` is always the integer **0**. No phone visibility toggle or contact disclosure was added. Description (nullable string max10000) and weight_price (nullable finite numeric >=0) are optional backend fields; the existing Post form has no corresponding input, so they are omitted rather than invented.

No backend past-date restriction or different-origin/destination requirement exists for creation. Post's old positive-decimal weight, future-only date and different-route constraints were corrected to this contract. Search's existing future-date behavior remains the default; its reusable calendar only gained an opt-in `allowPast` property for Post.

Success requires **HTTP 201** and `{success:true,message:string,data:listing}`. The authoritative listing is validated using the existing `ownListingApiSchema`. The response must identify a real listing, match submitted supported fields, retain contact visibility 0 and have **status 0 (Pending)**. A 200, invalid envelope, mismatched submitted identity or Published response cannot produce success. Existing statuses 0/1/2 and the absence of a Completed equivalent are unchanged.

The DTO contains id, category/country/city IDs, ad_type, title, description, areas, weight, weight_price, currency, departure_on, reached_on, created_at, updated_at, status, is_featured, show_contact_info and image_url. Nullable fields retain their documented semantics. No DTO, image URL, ID, timestamp or statistic is fabricated.

Backend eligibility, active records, verified customer/current-token checks and rate limiting remain authoritative. Current creation limit is 10 attempts/account/IP per hour. Error envelope remains `{success:false,message,errors?}`. No verified idempotency key or safe create-reconciliation endpoint exists.

## Real reference data and authorized UI

Public reads explicitly use `Authorization:false` on the existing Axios instance:

- GET /api/v1/categories: reuse existing getCategories, not static-testing Home fixtures.
- GET /api/v1/countries: real id/name choices; no invented ISO code from short_name.
- GET /api/v1/cities?country_id={id}: real id/name/country_id choices.
- GET /api/v1/currencies: actual backend code strings.

Envelopes are `{success:true,message,data:{items:[...]}}`. No undocumented query parameters or request bodies are sent. Missing/unusable option labels are not replaced with invented place names. Malformed responses reject; empty arrays remain empty and network errors do not substitute fixtures.

The new selectors use the existing React Query client, themed ListingFormField, AppButton, AppInput, SafeScreen, KeyboardScreen and ScreenContainer patterns. Options load on opening a selector, cache for 30 seconds, and do not fetch on every form render. Loading, empty, error, explicit Retry and Cancel states are provided within these authorized selectors. Failed explicit retries use the existing Toast system; automatic successful loads do not notify.

Each From/To location dialog retains its own country, dependent city and optional free-text area. Changing country clears the selected city immediately. Apply remains disabled until a city belongs to that country. City query keys contain the country ID, obsolete requests receive cancellation signals, and callbacks verify the country relationship. Opening the other side creates independent state; one side cannot replace the other's selection. Cancel preserves the applied parent location. Optional areas remain text and are never treated as IDs.

A small non-UI ID registry records only identities returned by actual public reference reads. Creation requires those registered IDs/codes, `source:api` locations and matching city-country relationships; bare numeric fixtures/free-text identities are insufficient. This is validation provenance, not another marketplace/authentication store. Post's actual selectors never present fixture records. Explicit Home/static testing sources and other public marketplace services were not changed.

## Submission, drafts and session safety

- Continue still validates and opens the existing review step; it never creates a listing.
- Authorized Create listing button submits only on explicit press after complete validation.
- Service-level synchronous session-scoped guard plus hook in-flight guard prevent concurrent/remount/re-render duplicate submissions.
- Existing secure token is read and attached explicitly. User object/session and token identity are checked around asynchronous work. Missing secure credentials use existing invalid-session cleanup.
- Guest uses existing POST_LISTING Login gate. Authentication never automatically submits. Preview/demo cannot call the protected endpoint with fake credentials.
- Existing memory-only listing draft store is reused. It now clears on session object/status replacement, including same-ID reauthentication, as well as account switches/logout.
- Post resets/closes selectors on account transition and ignores callbacks from a previous account. Review cancels/ignores stale completions after blur/unmount/account change; stale results cannot navigate or restore private state.
- Validation and rejected requests preserve the draft. Laravel 422 field errors are shown on the review step, with a Toast and the existing Edit action for corrections.
- Network failure, timeout, cancellation after dispatch, server error or malformed success may mean the listing was saved. The full attempted draft is retained in the session mutation guard, a warning is shown when the screen remains current, and repeat creation is held. No automatic POST retry or guessed matching-listing reconciliation occurs.
- The unknown guard survives component remount and cannot be cleared by pressing Continue or discarding the editable working copy. It blocks further creation for that session rather than risking duplicates. There is no frontend claim of exactly-once delivery.
- Confirmed requests cannot replay the same draft through ordinary repeated presses/Continue. An intentional changed draft may start a new post-success creation. Successful submitted values clear only if the user has not made newer edits; newer values remain.

## HTTP 201, My Listings and Dashboard synchronization

After confirmed 201, existing account-specific My Listings reads and Dashboard summary reads are cancelled before invalidation/refetch:

- `['myListings.read', 'user:' + id]`
- `['profileDashboard', 'user:' + id, 'summary']`

Active observers refresh authoritatively; inactive data is invalidated for its next normal lifecycle. Existing pagination/filter data is not manually rebuilt, and no listing/count is optimistically inserted. Unread/review statistics are never incremented or decremented. Pending is not mapped to Active/Published.

One existing success Toast reports that the listing is Pending approval. The existing parent ListingsStack -> ListingDetails route opens the returned authoritative ID with returnTo MyListings, which already uses the private owner-details API and supports Pending. Navigation structure is unchanged. The existing My Listings tabs still show Published/Expired; this task does not add a Pending tab or invent Completed semantics.

## Error and notification handling

Existing Axios normalization handles 400/401/403/404/409/422/429/500, network, timeout and cancellation. Confirmed rejection statuses release only the rejected mutation guard so a deliberate corrected submission can proceed. Ambiguous outcomes remain held. Session invalidation preserves the existing authentication cleanup behavior.

All new notification feedback uses only **react-native-toast-message / Toast.show** and the unchanged global white-card/colored-left-bar configuration. Success, error, warning and informational feedback are used appropriately. Existing Post Stay/Discard/Keep Draft dialogs are actual confirmation workflows and remain. No Alert notification, ToastAndroid, Snackbar, extra Toast root/library, raw server stack trace or sensitive logging was introduced. Existing unrelated legacy notification code was not refactored.

## Files changed for Task 14

Production:

- src/services/api/endpoints.ts - countries/cities/currencies registry entries only; reuse existing myListings POST path.
- src/features/post-listing/types/listingDraft.ts - verified full-form/location validation and partial draft values.
- src/features/post-listing/store/listingDraftStore.ts - session replacement cleanup.
- src/features/post-listing/services/listingReferencesService.ts - new public reference adapter/provenance checks.
- src/features/post-listing/services/createListingService.ts - new guarded JSON mutation and response validation.
- src/features/post-listing/hooks/useCreateListing.ts - new submission lifecycle, notifications and authoritative invalidation.
- src/features/post-listing/components/ListingReferencePicker.tsx - new authorized reference selector using existing themed primitives.
- src/features/post-listing/components/ListingLocationPicker.tsx - new Post-only country/city/optional-area selector.
- src/features/post-listing/components/ListingDateField.tsx - opt into the verified date rules.
- src/features/post-listing/screens/PostListingScreen.tsx - authorized required controls and real selection bindings.
- src/features/post-listing/screens/ListingReviewScreen.tsx - required-value summary and authorized Create action.
- src/features/search/components/SearchDatePicker.tsx - optional allowPast, default false; no unrelated Search layout/style change.

Tests/documentation:

- __tests__/createListingApi.test.ts - new API/reference/safety contract coverage.
- __tests__/CreateListing.test.tsx - new controller/UI/city/cache/session coverage.
- __tests__/PostListing.test.tsx - actual required controls and corrected documented date/integer expectations; confirmation/remount coverage preserved.
- __tests__/App.test.tsx - only this task's Post fixture adapted to the new valid form; unrelated pre-existing changes preserved.
- test/fixtures/createListing.ts - explicit dummy API reference/create fixtures.
- docs/CREATE_LISTING_API_INTEGRATION.md - this report.

Pre-existing dirty/untracked work was preserved on branch main at HEAD d375d3645d38041f53ef529f8fa2465b05fca273. No reset, branch change, history rewrite or commit was performed. Git diff against HEAD includes prior tasks; the list above identifies this task's scope. Diagnostic output is under .validation/task14.

## Verification

Executed on 2026-11-17 against the current working tree. All commands use the existing project dependencies; no dependencies or test-runner configuration changed.

| Check | Actual result | Exit | Evidence |
|---|---|---|---|
| Focused final with open-handle detection | 3 suites / 86 tests PASS; 0 failures, 0 skips; 44.421 seconds | 0 | .validation/task14/focused-final.json and .log |
| Full project Jest suite | 88 total suites: 86 PASS, 2 existing skipped; 1108 total tests: **1106 PASS, 0 FAIL, 2 existing SKIP**; 286.664 seconds | 0 | .validation/task14/full.json and .log |
| TypeScript | PASS, no diagnostics | 0 | .validation/task14/typecheck.log and .exit.txt |
| Scoped ESLint | PASS, no errors or warnings | 0 | .validation/task14/eslint.log and .exit.txt |
| Android arm64 debug | BUILD SUCCESSFUL in 5m20s; 407 tasks, 30 executed / 377 up-to-date | 0 | .validation/task14/android-arm64.log and .exit.txt |
| Non-mutating public connectivity | Timeout, HTTP 000, zero response bytes | 28 | .validation/task14/connectivity.log and .exit.txt |

Exact commands:

```powershell
npx jest __tests__/createListingApi.test.ts __tests__/CreateListing.test.tsx __tests__/PostListing.test.tsx --runInBand --testTimeout=60000 --detectOpenHandles --json --outputFile=.validation/task14/focused-final.json
npx jest --runInBand --testTimeout=60000 --json --outputFile=.validation/task14/full.json
npx tsc --noEmit
npx eslint src/features/post-listing src/features/search/components/SearchDatePicker.tsx src/services/api/endpoints.ts __tests__/createListingApi.test.ts __tests__/CreateListing.test.tsx __tests__/PostListing.test.tsx __tests__/App.test.tsx test/fixtures/createListing.ts
# Working directory: android
.\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain
```

The 86 focused tests comprise 55 API/reference tests, 19 Create controller/UI tests and 12 existing Post-flow tests. Coverage includes exact payload/header/endpoint, Carry/Send, zero/blank/invalid integer weights, date format/order and equal/past dates, required values, real-reference provenance, country-dependent clearing and late-city response isolation, cancellation, malformed responses, Pending status, all requested rejection statuses, ambiguous network/server outcomes, duplicate guards, explicit Create button, one success Toast, authoritative cache refresh, draft/newer-edit retention, Login gate, no automatic post-login submission, demo isolation and logout/account/blur/unmount protection. No listing-image request is made.

Relative to the historical 1031-pass baseline, 74 new tests were added in the two new suites and the existing Post parameterized validation cases gained one net test. Actual inventory is therefore 1106 pass + 2 existing skip; no tests were newly skipped or deleted to reach this result.

The unfiltered full run includes the existing App navigation (56 PASS), My Listings, own listing details, Dashboard, auth/session/logout, Profile/avatar/password, Reviews, public Listings/Categories and Inbox/Details/History/Send/Read/Create-Reuse regressions. This is automated regression evidence, not a claim of live endpoint execution. Dashboard/listing cache tests confirm existing data and pagination are not replaced with fabricated counters/records. The two existing skips are registration.live.test.ts and categories.live.test.ts; no new skips were added. No snapshot updates were made.

The final focused run with --detectOpenHandles exited 0 without an open-handle warning. Existing App tests can emit React act warnings; these were recorded, not suppressed or counted as failures. Android logs include the existing Gradle deprecation notice and a cross-drive native-library hard-link fallback to copy; both were nonfatal. The output artifact exists at android/app/build/outputs/apk/debug/app-debug.apk. No APK installation/device action was performed.

Initial development checks found a missing Jest icon mock, query-notification scheduling in selector tests and a TypeScript test-helper global. Controls reuse existing icons; test-only scheduler and GC settings are locally restored/cleared. These were corrected without skipping/removing assertions. Earlier failed attempts remain in diagnostic logs, not counted as successful verification.

## Live verification and remaining limitations

A non-mutating public Categories connectivity check used apiBaseUrl from existing environment.generated.json with a 10-second timeout. It returned **curl exit 28 / HTTP 000**, no response bytes. No live customer login or creation POST was attempted, and no real credentials were invented or logged.

**LIVE AUTHENTICATED API: NOT VERIFIED**

**PHYSICAL DEVICE: NOT VERIFIED**

No device installation, rendering, keyboard interaction, live field existence/eligibility, backend persistence or physical-device navigation is claimed. Automated tests use explicit dummy authoritative-shaped responses.

Unknown submissions cannot be safely resolved automatically with the documented contracts. Their guard/draft are in memory for the current session, consistent with the existing Post draft architecture; they are not a durable backend idempotency guarantee across application termination or a new login. A verified reconciliation/recovery contract would be required to unlock uncertain attempts safely without guessing. The UI warns against resubmission.

Listing image upload remains **Task 15**. No image picker exists in this current Post form, and no image UI was removed. No POST /customer/listings/{id}/image, file payload, upload library or uploaded-image success claim was added. Existing backend default-image behavior remains authoritative.

## Scope confirmation

No Laravel, website, admin, database, tables/columns, migrations, listing status or backend business-rule changes. No API contract changes or new backend endpoints. No new Axios instance, auth/token store, profile/review/message cache architecture or notification library. No unrelated screen/theme/font/navigation redesign. Only authorized Create Listing controls and their required data, validation, lifecycle and cache bindings were added. Existing Reviews, Messaging, profile integrations and marketplace static gates remain intact.
