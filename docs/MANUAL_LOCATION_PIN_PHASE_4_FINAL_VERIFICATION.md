# Manual location pins — Phase 4 final verification

Date: 24 November 2026. Scope: existing owner Listing Details presentation and isolated local verification only. No Maps, links, clipboard library, dependency or native configuration changes.

**Final verdict: PHASE 4 BLOCKED — ISSUE IDENTIFIED**

Owner pin presentation and isolated localhost API/database verification are implemented and passing. Final full regression is not green: one existing Home Dashboard navigation test exceeds its 5-second limit. Physical-device pin selection/copy is also not verified. No production defect in coordinate persistence or privacy was confirmed, and no unrelated application/test assertion changes were made to force a pass.

## Implementation and access boundary

Read the Phase 2/3 reports and backend `docs/api/LISTING_LOCATION_COORDINATES_V1.md`. The existing owner detail screen did not present the saved coordinate fields. It now appends From Location Pin / To Location Pin rows inside the existing details card, using the existing MapPin icon, typography, row styling and shared strict coordinate formatter. No image, footer, route or theme changes.

Only complete valid numeric pairs appear. Zero is valid; missing, null, unavailable, partial and invalid pairs are never rendered as fallback coordinates. Text uses React Native `selectable`, allowing the native text selection/copy menu. There is no programmatic clipboard access.

The screen requires both the private My Listings route and `isVerifiedOwnedListing(record)`. That existing WeakMap binds the actual parsed owner response to the current authenticated user object and is reset on logout/account changes. A numeric ID, cached object, public listing or claimed owner ID alone does not establish coordinate access. Public models, public queries and public cache data remain unchanged. Existing private query keys include account and listing ID; existing update invalidation/refetch and logout cache cleanup are reused. Changed/removed pins follow the refreshed owner record; stale unverified owner records cannot render pins.

## Changed files

- `src/features/listings/screens/ListingDetailsScreen.tsx`: owner-only selectable pin rows; existing styles reused.
- `__tests__/ListingDetails.test.tsx`: focused owner display/update/removal/account-switch/public/unverified-record coverage; deterministic local query scheduling/flush and native component preloading for the first interaction.
- `__tests__/LocationAutofill.test.tsx`: preload the preset's lazy native view modules before the existing GPS interaction timer. No GPS mocks, behavior, assertions, test cases or timeout changes.
- `docs/MANUAL_LOCATION_PIN_PHASE_4_FINAL_VERIFICATION.md`: this report.

Ignored local diagnostics/logs are under `.validation/phase4-*`; they are not application or backend source. Diagnostic PHP bootstraps the existing backend safety infrastructure without changing it. The diagnostic Jest harness imports the actual mobile services and Axios instance; only secure token/native image sizing/local-file transport are bridged for Node. Credentials are temporary and never printed.

Transport boundary: the harness substitutes the Node HTTP adapter for native XHR and bridges React Native multipart files to Node streams. Its token getter supplies a real Sanctum token issued only to the isolated synthetic customer; native secure-storage access and image sizing are mocked. Thus these checks exercise actual mobile builders/services/response parsers against real HTTP/Laravel/SQL, **not Android native transport or physical-device UI**. Backend guest/non-owner/public denial checks use separate direct HTTP clients. Mocked regression tests separately exercise mobile guest/session/cache guards.

Pre-existing dirty work from earlier tasks was retained. Baseline branch `main`, HEAD `42398f8e51d3f0dd3d73c7d1f5d301ecda095f02`; no commit, reset, checkout or deployment.

## Isolated localhost verification

Verified coordinate contract: owner `POST /api/v1/customer/listings` returns 201; partial JSON `PUT /api/v1/customer/listings/{id}` returns 200; owner GET detail/list return `success`, `message`, `data` with the existing listing envelope. Private reads/mutations use the existing Bearer client. Fields are `from_latitude`, `from_longitude`, `to_latitude`, `to_longitude`: nullable numeric pairs, latitude -90..90, longitude -180..180, at most seven decimals, zero allowed. PUT omission preserves an unchanged pair; null/null clears; changing that side's country/city clears its stale pair unless a valid replacement is provided. Public GET never exposes these fields, even to an authenticated owner. Image upload remains the separate multipart image endpoint; coordinates stay in the JSON listing operation.

The old isolated HTTP listener was unavailable. Restored a loopback-only PHP listener on `127.0.0.1:18084` using existing `Tests\Support\LocalTestSafety`. Its preflight verifies a timestamped testing schema, restricted testing database user, matching connection identity and grants, and explicitly verifies original-schema access is denied. Original `.env`/original database credentials were not used for mutations. No migrations, schema changes or original business-data writes occurred. Existing safety provider fakes mail/notifications/queues and forbids stray outbound HTTP. Runtime/media paths are isolated temporary paths.

Synthetic owner, second customer and reference records were created in the isolated schema. The actual mobile client used public reference GETs to register real test IDs, then its existing JSON create/update builders, owner parser and multipart image service against Laravel over HTTP.

Verified through actual local HTTP:

| Check | Result |
|---|---|
| Create with both pins; owner GET/hydration | PASS |
| Create without pins | PASS; null pairs |
| Create with image and pins, then owner GET | PASS; image URL and saved pins |
| Unchanged pins during unrelated title edit | PASS |
| Replace From pin and explicitly clear To pin | PASS |
| City change and country change each clear affected stale origin pair | PASS; tested separately |
| Zero coordinates | PASS; numeric 0 retained |
| Invalid range, incomplete pair, excessive precision | PASS; HTTP 422 |
| Guest private detail read | PASS; HTTP 401 |
| Non-owner private detail read | PASS; HTTP 404 |
| Public detail as guest, owner, other customer | PASS; coordinate keys absent |

The JSON create response currently returns status 1, as established by the current backend contract. Phase 4 does not change status semantics.

Actual mobile/local API command:

```text
php .validation/phase4-local.php image-fixture
node node_modules/jest/bin/jest.js --runInBand --roots .validation --testRegex phase4-mobile.localtest.js --runTestsByPath .validation/phase4-mobile.localtest.js
```

First successful log: `.validation/phase4-local-mobile-final-pass.log`: 1 suite, 2 tests PASS, 0 failures/skips, 78.006s, exit 0. This explicit isolated diagnostic is excluded from normal Jest roots; the standard suite never makes real listing mutations.

Extended the isolated run with a second synthetic country and its own city, verifying country-change clearing in addition to the first city-change check. `.validation/phase4-local-mobile-complete.log`: 1 suite / 2 tests PASS, 0 failures/skips, 146.783s, exit 0. The extra reference reads register actual IDs through the same mobile service. No hardcoded backend IDs or guessed mappings. Both runs use the same explicit diagnostic command above, with fresh controlled fixtures for the extended run.

Earlier diagnostic attempts are retained: PHP child execution inside Jest was denied (`spawnSync php EPERM`), so persistence checks were moved to a separate permitted command. Initial image fixture/transport checks received definite HTTP 422: aligned the harness with existing React Native FormData test setup and replaced an undecodable synthetic PNG with a GD-generated PNG. No production upload code was changed. These were diagnostic failures, not reported as successful runs.

## Database persistence

```text
php .validation/phase4-local.php persist-check
```

Exit 0: `ISOLATED_DB_PERSISTENCE_ZERO_CLEAR_NO_PINS_IMAGE_PINS_PASS`. Restricted direct SQL verifies the actual final DECIMAL values `0.0000000`, cleared NULL destination, an all-null no-pin listing, and a stored server image on a record retaining both pin pairs. This is real isolated DB evidence, separate from mocked tests. Intermediate updates were also observed through authoritative owner GET/PUT responses. No claim of an original-database content fingerprint is made.

Repeated after the extended run: `.validation/phase4-db-complete.log`, exit 0. Both isolated fixture sets were cleaned with `php .validation/phase4-local.php cleanup` (exit 0); restricted deletion targeted only synthetic owner listings, those test accounts/tokens/role pivots and their exact inserted reference IDs. `.validation/phase4-cleanup.log` and `phase4-cleanup-complete.log` confirm cleanup. Temporary token manifests were deleted; temporary HTTP listeners stopped. Original database access remained denied by the preflight. No broad data/table cleanup was used.

## Regression and static validation

Initial Details test executions encountered 5-second first-render timeouts and subsequent overlapping-act failures; those failed logs are retained under `.validation/phase4-details*`. Mount tracing showed render act completed but the timer-based settle helper completed after test termination. Replaced that arbitrary sleep with an act/promise flush and the existing image-delete suite's synchronous query-notification convention, restored after each test. One cold first-render timeout remained; preloading the real preset native component modules before interaction timing resolved it. The first existing owner interaction then completed in 258ms, and all 21 Details tests passed in 24.357s (exit 0, `.validation/phase4-details-preloaded.log`). No native components were stubbed out, test timeout increased, test skipped, assertion weakened or production behavior changed to hide failures. The original 19 tests and their assertions remain, with two new tests. Name-filtered diagnostic runs temporarily excluded other tests; this is not a skip added to the suite.

An initial development full run loaded the failing old helper and was explicitly stopped (exit 1) while the local test-only correction was investigated; `.validation/phase4-full.log` is retained. It is not counted as a completed regression pass. Final full results follow below.

A subsequent run while extended local verification was running passed Details but timed out in two existing `App.test.tsx` tests: “guest onboarding supports both introductions, Global Reach, Back and Skip without authenticating” and “returning guest opens public Home, public navigation works, and private screens remain unmounted” (5-second timeouts). That concurrent run was stopped (exit 1) and retained as `.validation/phase4-full-final.log`; it is not a complete-suite pass. No unrelated App tests/source or their timeouts were changed. The final complete-suite run uses the unchanged standard command alone, without API/build/static-check concurrency.

The next **completed** standalone run (`node node_modules/jest/bin/jest.js --runInBand`, `.validation/phase4-full-standalone.log`) returned exit 1: 107 suites passed / 2 failed / 2 existing skipped; 1,725 tests passed / 2 failed / 2 existing skipped / 1,729 total; 401.269s. Failures: `App.test.tsx` “static marketplace browsing stays public while request, Post and Messages still require login”, and `ListingDetails.test.tsx` “My Listings opens the owner endpoint without public/demo data or demo cover”, both 5-second timeouts. These are not classified as proven unrelated or dismissed as load-only failures. The latest Details fixture additionally preloads Text/View and uses a retained test-owned query cache with explicit teardown, following the existing owner-image suite; its isolated rerun passed 21/21 in 19.836s. Public detail rows now receive no selectable prop; only private pin rows receive it.

The following completed serial run (`phase4-full-complete.log`) passed App and Details but returned exit 1: 108 suites passed / 1 failed / 2 existing skipped; 1,726 tests passed / 1 failed / 2 skipped / 1,729 total; 275.205s. The only failure was existing `LocationAutofill.test.tsx` “native address autofills for preview=false without authentication or backend requests”, a 5-second timeout. Its unchanged isolated suite passed 16/16 in 7.017s, exit 0 (`phase4-gps-isolated.log`); first render was 1,564ms versus 21ms for the next equivalent case. This identified lazy native initialization as a timing contributor, not a confirmed GPS production defect. Added only local native-view preloading before interaction timing in that GPS regression fixture. No GPS utility, permission/native code, location provider, test expectation, mock behavior or timeout was changed. Final verification below follows this test-only initialization correction.

Focused command:

```text
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath __tests__/ListingDetails.test.tsx __tests__/listingPinApi.test.ts __tests__/manualListingPin.test.ts __tests__/ownListingDetails.test.ts __tests__/UpdateListing.test.tsx __tests__/ListingImageFlow.test.tsx __tests__/sessionLogout.test.ts __tests__/ListingImageDelete.test.tsx
```

Exit 0; 8 suites, 199 tests PASS, 0 failures/skips, 69.271s. Log `.validation/phase4-focused-final.log`. Covers strict parsing/precision/zero, create/edit/clear/stale pair rules, owner/public privacy, session/cache cleanup and existing image workflows. Earlier seven-suite attempt: 6 passed / 1 failed, 163 tests passed / 20 failed (Details timeout cascade), exit 1; retained as `.validation/phase4-focused.log`.

Repeated on the final source/test state: `.validation/phase4-focused-final-state.log`, exit 0, 8 suites / 199 tests PASS, 0 failures/skips, 60.6s. Then the same serial command starts the complete standard suite; final results are recorded at the end of this report. No test inventory was removed or newly skipped.

After the GPS fixture initialization correction:

```text
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath __tests__/ListingDetails.test.tsx __tests__/LocationAutofill.test.tsx
```

Exit 0; 2 suites / 37 tests PASS, no failures/skips, 26.871s (`phase4-ui-gps-verified.log`). Existing GPS and private pin display interactions are both retained. Counts overlap the other focused runs; do not add them together as unique coverage.

| Validation | Exact command | Result |
|---|---|---|
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit --incremental false` | PASS, exit 0; `.validation/phase4-types-complete.log` |
| Scoped ESLint | `node node_modules/eslint/bin/eslint.js src/features/listings/screens/ListingDetailsScreen.tsx __tests__/ListingDetails.test.tsx` | PASS, exit 0; `.validation/phase4-lint-complete.log` |
| Whitespace | `git diff --check` | PASS, exit 0; `.validation/phase4-whitespace-final.log` |
| Offline Android arm64 | `./gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --offline --console=plain` (from `android`) | PASS, exit 0, 14m45s; 407 tasks: 28 executed / 379 up-to-date; `.validation/phase4-android.log` |

The Android command used the existing Gradle cache with approved cache access; no downloads or dependency/config changes. Existing AGP/Gradle deprecation warnings and cross-drive hard-link fallback-to-copy warnings were emitted. Initial TypeScript caught two new test-fixture typing errors; corrected and rerun to exit 0. Initial whitespace check caught a new blank EOF line in the test; corrected and rerun to exit 0. An incorrect initial Prettier executable path was corrected to the installed 2.8.8 `bin-prettier.js`; final formatting exited 0. No test result is inferred from any of these failed initial commands.

Final-state TypeScript and scoped ESLint repeated with the same commands: both exit 0 (`phase4-types-final-state.log`, `phase4-lint-final-state.log`). A redundant offline build repetition started new CMake work and was deliberately cancelled (exit 1; `phase4-android-final-state.log`); it is not claimed as a second successful build. The completed successful offline build above remains the actual build evidence; no native source/configuration/dependency changes followed it. The subsequent source adjustment only limits the JSX selectable prop to owner pin text. No device APK/rendering verification is inferred from the build.

Final GPS-inclusive lint command: `node node_modules/eslint/bin/eslint.js src/features/listings/screens/ListingDetailsScreen.tsx __tests__/ListingDetails.test.tsx __tests__/LocationAutofill.test.tsx` — exit 0 (`phase4-lint-verified.log`). Final TypeScript command unchanged — exit 0 (`phase4-types-verified.log`). No broad/global Jest setup edits were made by Phase 4.

## Device / visual status

A physical Android phone was detected. User approved interaction. Device API forwarding was temporarily pointed to the isolated listener before opening Friendie; no device test targeted original data. Other applications repeatedly became foreground, preventing a stable owner-details selection/copy interaction. Device testing was stopped; temporary device captures were removed, and original forwarding restored. Native long-press/copy behavior, visual rendering, clipping and physical-device end-to-end integration remain **NOT VERIFIED**. No visual equivalence claim is made from Jest.

## Scope

No backend/controller/route, website, admin, database schema/migration, dependency, native permission/configuration, auth architecture, public cache projection, GPS, contact privacy, image workflow, theme or navigation changes. Only owner pin display and directly related tests/documentation changed. No production API exists for this verification; actual verification targets isolated localhost only. Stop after Phase 4.

## Final complete regression and remaining blockers

```text
node node_modules/jest/bin/jest.js --runInBand
```

Final source/test-state run: `.validation/phase4-full-verified.log`, **exit 1**:

| Measure | Actual |
|---|---:|
| Suites passed | 108 |
| Suites failed | 1 |
| Existing suites skipped | 2 |
| Total suites | 111 |
| Tests passed | 1,726 |
| Tests failed | 1 |
| Existing tests skipped | 2 |
| Total tests | 1,729 |
| Duration | 262.183s |

Only failure: `__tests__/App.test.tsx:601`, **“Home dashboard uses the real first name and routes every action through existing navigators”**, `Exceeded timeout of 5000 ms for a test`. Full error/stack is retained in the log. Final App suite took 100.008s. Owner Details, GPS autofill, coordinate services, privacy/cache/logout, listing create/update/images, reviews, messaging and other suites passed. Two new owner-pin tests account for the increase from the Phase 3 test inventory. The two existing skips were not added or changed by this task.

Independent reproduction, with no source changes:

```text
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath __tests__/App.test.tsx --testNamePattern 'Home dashboard uses the real first name'
```

Exit 1; same 5-second timeout, 1 test failed, 57 tests excluded by the diagnostic name filter, 46.279s (`phase4-app-timeout-isolated.log`). The filter does not add skips to source or change the full-suite inventory. This timeout also occurs independently; it must not be attributed solely to parallel API/build execution.

This is an unresolved full-suite timing failure, not a successful full regression. Its deeper cause and relationship to the wider test environment have not been conclusively established; earlier runs failed different navigation cases. Do not infer a production Home/navigation defect from a timeout, or dismiss it as definitely pre-existing/unrelated solely because focused tests pass. `App.test.tsx` and Home/navigation production code were left unchanged under the coordinate-only scope. Broader test-harness investigation is required before claiming a green full suite.

Final TypeScript and GPS-inclusive scoped ESLint: exit 0. Final `git diff --check`: exit 0 (`phase4-whitespace-verified.log`). Branch and HEAD unchanged. The only new tracked modifications relative to the preserved Phase 4 starting tree are the owner Details screen and the two directly related test files; the report is new/untracked. All earlier dirty/untracked work remains.

Remaining gates:

1. Resolve/reverify the full-suite App navigation timeout without weakening assertions or raising timeouts merely to obtain a green result.
2. Stable Android owner-details rendering and native long-press/copy verification, including edited/removed pins, are **NOT VERIFIED**. Android native API transport is not certified by the Node-adapter HTTP run.

Local isolated API and SQL persistence are **VERIFIED** as qualified above. No further feature or Phase 5 work was started.
