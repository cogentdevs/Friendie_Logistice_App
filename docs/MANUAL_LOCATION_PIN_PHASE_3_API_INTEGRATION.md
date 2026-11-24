# Manual location pins — Phase 3 API integration

Date: 24 November 2026.

**PHASE 3 IMPLEMENTATION COMPLETE — LIVE API VERIFICATION PENDING.** Automated checks and build passed; actual isolated API/device verification has not been performed. No Maps/Copy/Details presentation work started.

## A. Scope, baseline and evidence

Reviewed Phase1 audit, Phase2 implementation report, current form/parser/services, and backend `docs/api/LISTING_LOCATION_COORDINATES_V1.md`. Backend source remains read-only. Its stale opening “migration pending” heading conflicts with its later dated completed verification section; this task does not rerun migrations or independently certify its database.

Current branch `main`; HEAD `42398f8e51d3f0dd3d73c7d1f5d301ecda095f02`; no staged changes. Initial worktree:22 modified tracked files and10 untracked files. Existing dirty work includes Contact/avatar/search/status fixes and Phase2 manual inputs/tests/report. No reset, stash, cleanup or overwrite of unrelated work.

Fresh baseline command:

```text
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath __tests__/manualListingPin.test.ts __tests__/createListingApi.test.ts __tests__/updateListingApi.test.ts __tests__/ownListingDetails.test.ts
```

**Exit0;4 suites/180 tests PASS;0 skips/snapshots;3.596s.** Historical Phase2 counts were not reused as current evidence.

## B. Verified backend contract

Existing environment-aware API base includes `/api/v1`; no host hardcoded. Reuse centralized Axios, existing request/response interceptors, secure Bearer token, eligible customer/account/session checks.

| Method | Full endpoint | Successful envelope |
|---|---|---|
| POST | `/api/v1/customer/listings` |201 `{success:true,message,data:ownerRecord}` |
| PUT | `/api/v1/customer/listings/{id}` |200 same owner envelope |
| GET | `/api/v1/customer/listings/{id}` |200 same owner envelope; owner only |
| GET | `/api/v1/customer/listings` |200 `{success:true,message,data:{items:ownerRecord[],pagination:{current_page,per_page,total,last_page}}}` |
| GET | `/api/v1/listings/{id}` | Public existing envelope; no exact coordinate fields, including when caller owns listing |
| POST | `/api/v1/customer/listings/{id}/image` | Existing separate image multipart endpoint, not a coordinate request |

Protected calls require current real customer Sanctum Bearer; owner data has private/no-store response policy. Wrong owner404; authentication401; eligibility403. Existing public browsing remains public. No new endpoint.

Four optional fields: `from_latitude`, `from_longitude`, `to_latitude`, `to_longitude`. Latitude[-90,90], longitude[-180,180], finite, maximum7 decimal places;0/negative values valid. Touched pair must have both numeric axes or both null. JSON numbers/plain decimal strings supported by backend; mobile uses JSON numbers. Responses are numbers/null. No coercion of null/undefined to0. Public projections omit pins; chat/review membership grants no access; accepted-request sharing unsupported.

Omitted PUT pair preserves when geography unchanged. Null/null clears. Numeric pair replaces atomically. Changed country/city without replacement clears that side; same IDs preserve. Coordinates do not infer Country/City and backend does not verify geographic containment.

Create required keys remain `ad_type,title,category_id,from_country_id,from_city_id,to_country_id,to_city_id,currency,departure_on,reached_on`. Optional existing description/area/address/weight/weight_price/contact0 unchanged. Types `Carring`/`Send`, status semantics, date validation, price/weight0, publication/DELETE behavior unchanged.

422 envelope: `{success:false,message:"Validation failed",errors:{from_latitude:["Supply both latitude and longitude, or set both to null."]}}`; range/precision errors use affected field. Existing401/403/404/429/server/network normalization reused, no raw exceptions displayed.

## C. Exact files changed by Phase3

| Path | Responsibility/change |
|---|---|
| `src/features/post-listing/services/listingPinPayload.ts` NEW | Four-field request type, complete pair serialization, owner hydration adapter, coordinate echo matching and grouped field errors |
| `src/features/post-listing/services/createListingService.ts` | Merge validated numeric pairs into existing JSON body; require submitted coordinate echo before confirmation |
| `src/features/post-listing/services/updateListingService.ts` | Owner pin hydration, atomic pair diff, expected preserved/cleared pin confirmation and reconciliation; avoid slow duplicate read replacing newer draft |
| `src/features/listings/types/myListingsApi.types.ts` | Optional nullable numeric owner coordinate fields; pair/precision/range validation |
| `src/features/post-listing/types/manualListingPin.ts` | Update phase-boundary comment only; original parser/formatter reused |
| `src/features/post-listing/hooks/useCreateListing.ts` | Map coordinate422 fields to matching manual-input key |
| `src/features/post-listing/hooks/useUpdateListing.ts` | Same field grouping; existing failure/success/cache lifecycle preserved |
| `src/features/post-listing/screens/ListingReviewScreen.tsx` | Existing field-error output names From/To Location Pin correctly |
| `src/features/post-listing/components/ManualListingPinInput.tsx` | Replace temporary “not saved yet” notice with owner-only privacy guidance |
| `__tests__/listingPinApi.test.ts` NEW | Request/parser/hydration/update/privacy/race/error/timeout regression |
| `__tests__/manualListingPin.test.ts` | Replace obsolete Phase2 nonserialization expectation with exact Phase3 coordinate body assertions; preserve other-field comparisons |
| `__tests__/ListingImageFlow.test.tsx` | Pins+JSON creation then separate image multipart; coordinate422 draft retention |
| `__tests__/UpdateListing.test.tsx` | Actual owner-response Edit input hydration and private cache invalidation on clear |
| `docs/MANUAL_LOCATION_PIN_PHASE_3_API_INTEGRATION.md` NEW | This implementation/verification record |

No changes to public models/services, endpoint registry, own-details transport, auth, GPS, location selectors, navigation, theme, image service, dependencies or native configuration. Owner GET/collection services already use the shared private DTO parser; changing its schema is sufficient to retain pins without duplicate clients/requests.

## D. Create and transport

Reuse Phase2 raw input/parser. Existing Zod draft validation runs before any POST; invalid nonempty/incomplete/overprecision/range/URL text blocks dispatch. Serializer emits both numeric axes per nonempty pair, never raw text, intent flags, undefined or unintended null. Empty pins omit four keys; one-side input emits only its pair.0 and small7-decimal numeric values preserved. JSON numeric exponent representation of very small numbers is accepted by backend; no multipart decimal-string workaround is introduced.

Coordinate fragment merged with existing full verified create fields (synthetic example, not a standalone complete create body):

```json
{"from_latitude":0,"from_longitude":0,"to_latitude":-33.8688197,"to_longitude":151.2092955}
```

Current create is JSON, not multipart. Create response must be201, existing valid owner record, matching existing submitted fields and **all submitted coordinate axes**. Missing coordinates cannot silently pass the older “key exists” comparison. Wrong/missing echo or invalid response enters existing unknown hold; no fake success, draft loss or automatic repeat POST.

## E. Images and multipart boundary

Preserved sequence: JSON create201 -> backend-confirmed ID -> optional separate multipart image POST200. FormData contains only `image` with original URI/MIME/name; coordinates are already saved in JSON create, never appended to image upload. No image selected -> no image endpoint. Image-only retry/unknown-upload reconciliation unchanged; no duplicate listing creation.

Backend supports multipart **POST creation** with decimal-string coordinate text fields, for example `from_latitude=0`, `from_longitude=0`, plus required listing fields. Mobile does not use that alternate transport and no unused multipart-coordinate builder was added. Multipart creation contract is documentation evidence, not an actual HTTP test here. Raw multipart PUT/method spoofing is not promised; updates remain JSON PUT. Never send literal strings `undefined` or `null` as clearing syntax.

## F. Private owner parsing and hydration

Shared owner DTO accepts complete numeric pairs, null/null, or pair entirely omitted. It rejects strings/booleans/nonfinite/out-of-range/overprecision values, single axis, missing/null mixtures. Malformed owner response fails closed through existing service error path; never displayed as a valid saved pin. Precision validation reuses Phase2 formatter, not a competing parser.

Private details backend DTO and own collection retain actual fields. Public schema remains unchanged and strips unexpected coordinate properties; no owner row copied into public models or cache.

`loadListingEdit()` uses existing owner GET and real reference reads, then hydrates each side to `{text:'latitude, longitude',intent:'unchanged'}`. Null pairs -> empty unchanged field; absent pair -> undefined/empty UI, not a saved0. Zero and negative values format correctly. Initial hydration does not trigger geography change/dirty pin state. Existing edit.draft takes priority; slow duplicate reads cannot replace a newer context/draft. Listing-ID keyed form/edit memory and account guards preserve isolation. No new details fetch just to hydrate pins.

## G. Update semantics and confirmation

`changedListingFields()` still validates real references/full draft. Coordinate axes are removed from generic scalar diff and handled as complete pairs:

| Local state | Outgoing PUT pair |
|---|---|
| Saved untouched/unchanged intent | Omit both |
| Formatting-only change with same numeric pair | Omit both |
| Replacement/new valid pair | Both numeric fields, including0 |
| Saved numeric pair explicitly cleared | Both null |
| Both saved pairs cleared | Four null fields |
| Blank field with no saved pair | Omit; no redundant null |
| Unavailable original fields untouched | Omit; never infer deletion |
| Country/city change, unchanged old pin | Omit stale numeric pair; server clears |
| Country/city change and explicit new pin | Include both replacement axes |
| Changed geography then returned to original with local clear intent | Clear original saved pin; do not silently restore |

Valid standalone clear example: `PUT /api/v1/customer/listings/{real-owner-id}`, JSON body:

```json
{"from_latitude":null,"from_longitude":null}
```

Replacement example:

```json
{"to_latitude":0,"to_longitude":0}
```

Original and submitted/expected coordinates are compared numerically, not raw formatting. Save confirmation checks touched pairs and known saved pins expected to be preserved or cleared on geography change. Unexpected/missing echo cannot claim success. Unknown outcome uses existing owner GET reconciliation with same expected pairs plus existing payload-field checks, never repeat PUT automatically. Inconclusive GET retains unknown hold and raw text/removal intent. Definitive422 allows explicit correction/retry. Newer edits during an in-flight save remain protected by existing snapshot checks.

## H. Lifecycle, caches, GPS and errors

Phase2 same-side Country/City invalidation retained. IDs still chosen from actual reference APIs; no containment claims, URL parsing or GPS pin autofill. Existing GPS permissions, matching, auto-origin policy, Settings return, generations and destination independence unchanged. No background tracking/permissions.

Existing create/update hooks cancel older reads before invalidation. Private keys remain `['ownListingDetails',userId,id]`, `['myListings.read','user:'+id,status]`; existing filtered pages preserved and reloaded authoritatively. No optimistic coordinate insertion into public listing/home/search data. Saved-pin clear invalidates owner detail cache so stale pin data is not restored as a successful current result. Image sequence and root post-success navigation unchanged. Draft reset on confirmed create and account changes includes pins through existing store type; failure preserves pins and clear intent.

Coordinate validation keys group to `fromPin`/`toPin`, deduplicate messages, preserve unrelated errors. Existing review-step field errors label the correct From/To input. Existing Toast remains sole operation feedback; no pin-save success toast before confirmation.401 expiry cleanup,403/404 ownership rejection,429,500, network/timeout and cancellation reuse existing mechanisms. No message/token/coordinate logging added.

Owner policy: guest/nonowner hidden; owner private API allowed; chat/review participant has no entitlement; accepted-user sharing not implemented. Existing token/current user-object checks, aborts, edit-context clearing, draft-store auth subscriptions and logout cache clearing reused. No new persistence/local storage/analytics/navigation parameters. No public details pin UI is added in Phase3.

## I. Temporary notice

Removed `Preview only: pins are not saved with the listing yet.` after mocked create/GET/update/clear round-trip/echo checks passed. Replaced with `Exact location pins are private to your account.` Optional label, format helper, input layout and Clear remain. This notice states policy, not a claim of physical/live verification. Actual isolated/mobile runtime persistence is still pending as explicitly reported below.

## J. Automated and build verification

Tests use mock Axios methods/adapters, synthetic records/tokens, native permission/GPS/image mocks. No real listing POST/PUT or original-database writes. Existing tests not deleted/skipped/weakened; obsolete Phase2 assertion updated to stronger exact coordinate serialization expectation. No snapshot updates or timeout increases.

Executed intermediate checks:

- Baseline4 suites/180 tests PASS;3.596s;exit0.
- First coordinate API plus existing builder/parser run5 suites/227 tests PASS;10.117s;exit0.
- Create/Edit/GPS/selectors/privacy/image regression12 suites/276 tests PASS;35.777s;exit0.
- Expanded14-suite regression396 tests PASS;48.112s;exit0 (before final additional timeout/collection/cache cases).
- Final changed coordinate/Edit/image suites3 suites/90 tests PASS;10.489s;exit0 (overlapping coverage, do not add counts).
- Development TypeScript catches (missing closing brace, request-map inference, mock payload unknown spread) were corrected; no runtime test failures in the recorded Phase3 Jest runs above.

Baseline command in A; API run used `--runTestsByPath __tests__/listingPinApi.test.ts __tests__/manualListingPin.test.ts __tests__/createListingApi.test.ts __tests__/updateListingApi.test.ts __tests__/ownListingDetails.test.ts` with same local Jest binary/in-band. Expanded focused command:

```text
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath __tests__/listingPinApi.test.ts __tests__/manualListingPin.test.ts __tests__/PostListing.test.tsx __tests__/UpdateListing.test.tsx __tests__/CreateListing.test.tsx __tests__/ListingImageFlow.test.tsx __tests__/createListingApi.test.ts __tests__/updateListingApi.test.ts __tests__/ListingSelectorSearch.test.tsx __tests__/useListingGps.test.tsx __tests__/listingGpsService.test.ts __tests__/guestListingDetails.test.ts __tests__/ownListingDetails.test.ts __tests__/myListingsService.test.ts
```

Final changed-suite command: `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath __tests__/listingPinApi.test.ts __tests__/UpdateListing.test.tsx __tests__/ListingImageFlow.test.tsx`.

Static commands:

```text
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js src/features/post-listing/services/listingPinPayload.ts src/features/post-listing/services/createListingService.ts src/features/post-listing/services/updateListingService.ts src/features/post-listing/types/manualListingPin.ts src/features/listings/types/myListingsApi.types.ts src/features/post-listing/hooks/useCreateListing.ts src/features/post-listing/hooks/useUpdateListing.ts src/features/post-listing/screens/ListingReviewScreen.tsx src/features/post-listing/components/ManualListingPinInput.tsx __tests__/listingPinApi.test.ts __tests__/manualListingPin.test.ts __tests__/ListingImageFlow.test.tsx __tests__/UpdateListing.test.tsx
git diff --check
```

Final TypeScript:exit0, no diagnostics. Final scoped ESLint:exit0, no diagnostics. An initial lint check flagged an unused argument in the new image mock; removed unused argument without changing assertions/behavior and reran the full scope successfully. Git whitespace:exit0. Existing Git LF/CRLF notices are warnings, not source rewrites.

Full Jest command: `node node_modules/jest/bin/jest.js --runInBand`. **Exit0;109 suites PASS,2 existing skipped (111 total);1725 tests PASS,0 failures,2 existing skipped (1727 total);204.492s;0 snapshots.** No suite filtering. Added56 tests:52 in listingPinApi,2 image flow,2 Edit screen/cache; one prior Phase2 test now asserts new exact serialization instead of obsolete nonserialization. No tests removed/newly skipped. No Phase3 Jest timeout/failure occurred in these recorded runs. Existing HomeSearchCard/Login act warnings and registration configuration diagnostic remain; not suppressed. Native build completed before full run started.

Offline Android (from android): `.\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --offline --console=plain` — **BUILD SUCCESSFUL;exit0;2m29s;407 tasks (16 executed,391 up-to-date)**. Existing Gradle/AGP deprecation warnings remain. Used existing cache with required filesystem access; no downloads/dependency/native edits. Installed maps remains a build dependency but no new Maps usage.

## K. Actual API/device verification boundary

Read existing `docs/safety/LOCAL_TESTING.md` and safety harness source. Historical isolated DB name does not establish a current safe server/credentials/storage/mail configuration. A read-only TCP reachability check of previously documented isolated loopback port18084 returned **False**. No verified replacement isolated server/session available; did not start/reconfigure backend, read production credentials or assume port8000 is safe.

Therefore effective isolated DB identity/permissions, fake external services, storage and test account were not currently established; **no mutating HTTP integration requests executed**. No migrations/schema/seed commands or original data changes. Backend historical23 HTTP checks remain prior report evidence, not current mobile integration tests. No original DB/media fingerprints checked here.

| Verification kind | Actual status |
|---|---|
| Mocked mobile client builders/parsers/hooks | PASS as recorded |
| Actual isolated HTTP contract checks | NOT VERIFIED this task |
| Actual mobile client against Laravel | NOT VERIFIED |
| Android build | PASS |
| Emulator rendering | NOT VERIFIED |
| Physical Android device | NOT VERIFIED |

## L. Integrity and Phase4 boundary

Only files in C changed by this task; retain all prior staged/unstaged/untracked work. No backend writes, DB commands/schema changes/original mutations, installs/removals, dependency/lockfile changes, Android/iOS/native/permission changes, theme/navigation/auth/contact privacy changes, Maps components, commit/push/deployment. Existing unrelated dirty files are not claimed clean. Final source Git comparison recorded below; no unsupported all-database fingerprint claim.

No mandatory frontend implementation blocker identified by focused tests. Remaining gate: reachable verified isolated Laravel environment for real create/get/edit/clear/image/privacy checks using actual mobile builders, followed by emulator/device test. Phase4 owner-facing location presentation, optional external Maps/Copy, any required separately approved clipboard dependency and device verification remain unimplemented. Do not start them automatically or infer accepted-request pin access.

## M. Final verification matrix

PASS in functional rows below means **mocked mobile automated evidence**, not live delivery/persistence certification.

| Feature | Verdict |
|---|---|
| Create without pins | PASS |
| Create with From pin | PASS |
| Create with To pin | PASS |
| Create with both pins | PASS |
| Image upload with pins | PASS — JSON create then separate image multipart |
| Owner coordinate retrieval | PASS |
| Edit Listing pin hydration | PASS |
| Replace saved pin | PASS |
| Clear saved pin | PASS |
| Preserve untouched pins | PASS |
| Valid zero handling | PASS |
| Country/city consistency | PASS |
| Guest coordinate privacy | PASS |
| Non-owner coordinate privacy | PASS — mocked404 and public projection |
| Account-switching privacy | PASS |
| Existing GPS regression | PASS |
| Full Jest regression | PASS —1725 tests |
| Android build | PASS —offline arm64 |
| Actual isolated API integration | NOT VERIFIED |
| Physical-device verification | NOT VERIFIED |
| Phase4 readiness | BLOCKED for end-to-end sign-off pending isolated verification; future implementation also requires separate approval |

Final source review: no staged changes; branch/HEAD unchanged. Protected dependency/native/theme/GPS paths have no Git diff. All previously dirty unrelated paths remain; no claim that repository is otherwise clean. Coordinate work adds only the paths inventoried in C to the prior baseline. This is a source/status review, not original-database fingerprint verification.

**Stop after Phase3. Final status: PHASE 3 IMPLEMENTATION COMPLETE — LIVE API VERIFICATION PENDING.**
