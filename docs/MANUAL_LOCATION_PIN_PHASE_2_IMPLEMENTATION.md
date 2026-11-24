# Manual Location Pin — Phase 2

Date: 24 November 2026. Manual input only; coordinate persistence is NOT implemented. This intermediate implementation must not be deployed as a completed pin feature.

## Scope and baseline

Read Phase1 audit and verified `../friendie_logistics_backend/docs/api/LISTING_LOCATION_COORDINATES_V1.md`. The manual-entry requirement supersedes Phase1 embedded-map plan: no MapView, map picker, Maps key, billing, Clipboard dependency, new GPS provider or native changes. Standard TextInput paste requires none of these.

Baseline branch `main`, HEAD `42398f8e51d3f0dd3d73c7d1f5d301ecda095f02`. Working tree already had17 modified tracked files and six untracked files (including Phase1 audit). Their previous work was preserved. Current shared Create/Edit form uses React Hook Form, Zod, memory-only separate create/edit Zustand drafts; owner edit loader resolves references, original/draft snapshots and partial PUT. Existing AppInput provides themed text/inline errors/right accessory. Existing GPS obtains country/city matches but does not provide a listing pin.

Safe pre-change baseline:

```text
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath __tests__/PostListing.test.tsx __tests__/UpdateListing.test.tsx __tests__/ListingSelectorSearch.test.tsx __tests__/listingGpsService.test.ts __tests__/useListingGps.test.tsx
```

Exit0;5 suites/76 tests passed;0 skips;13.863s. Phase1 category-selector5000ms timeout did not reproduce. This does not establish a root cause; no timeout/assertion/skip changes made.

## Files changed by this phase

| File | Change |
|---|---|
| `src/features/post-listing/types/manualListingPin.ts` NEW | Strict whole-string parser, numeric pair formatter, raw local intent and ID comparison helper |
| `src/features/post-listing/components/ManualListingPinInput.tsx` NEW | Shared compact themed optional input/helper/Clear/blur feedback |
| `src/features/post-listing/types/listingDraft.ts` | Two optional local pin fields and Zod validation |
| `src/features/post-listing/screens/PostListingScreen.tsx` | Two controllers in shared Create/Edit form; same-side geography invalidation |
| `__tests__/manualListingPin.test.ts` NEW | Parser, formatting, schema, reset/account isolation, unchanged API payload coverage |
| `__tests__/PostListing.test.tsx` | Manual input, validation, independent clear, dependency/GPS cases |
| `__tests__/UpdateListing.test.tsx` | Local draft hydration, unchanged/replace/clear intent, no write |
| `jest.setup.js` | Add only X icon to existing mocked icon inventory |
| `docs/MANUAL_LOCATION_PIN_PHASE_2_IMPLEMENTATION.md` NEW | This report |

No API service, API response parser, public listing model, navigation, theme, GPS utility, image service, package or native source changed by this phase. Other already-dirty files are unrelated pre-existing changes, not task edits.

## Inputs and validation

One **From Location Pin (Optional)** immediately after existing composite From Country/City selection, before From Address. One **To Location Pin (Optional)** after To selection, before To Address. Same controls appear on Edit because form is shared. Existing country/city selector/modal remains intact.

Each uses AppInput, default text keyboard (comma/minus/decimal available), normal paste/selection, autoCorrect/capitalization off, accessible Clear X action. Helper: `Copy latitude and longitude from Maps and paste here.` Additional explicit notice: `Preview only: pins are not saved with the listing yet.` Existing typography/palette/borders/keyboard wrapper reused. No placeholder is treated as actual data. No new notification popups/Alert/Toast library introduced; validation is inline, existing operation Toast behavior untouched.

Accepted plain pair format: optional surrounding/inter-axis whitespace, comma separator, plain signed decimal numbers, e.g. `24.8607343,67.0011364`, `-33.8688197, -151.2092955`, `0, 0`. Empty/whitespace input is valid and has no numeric pair. Both axes required together for nonempty input. Latitude[-90,90], longitude[-180,180], finite, max7 decimal places for each original number. Full-string regex/Number, not parseFloat; reject partial text, malformed separator, third axis, missing axis, NaN/Infinity, exponent/plus syntax, Maps URLs/short links. Range checked before precision/formatting. No clamping, truncation, rounding or URL resolution.

Raw text is preserved exactly while editing; numeric pair is derived by pure parser, not duplicated state. Incomplete typing is allowed. Blur and submit validate; no Toast per keystroke. After blur, inline error updates as user corrects input. Nonempty invalid input blocks Continue and existing submission schema. Clear makes an optional input valid. Formatter rejects invalid/overprecision input, supports small numeric coordinates without scientific text, and never converts null/undefined to0.

## Local state and Edit readiness

Draft fields `fromPin?` and `toPin?` each contain `{text, intent:'unchanged'|'replace'|'clear'}`. Missing state means no local edit; future authorized saved-pin hydration can populate formatted text with unchanged intent. Editing marks replace; clearing (including blank manual text) marks clear. Numeric parse distinguishes valid0,0 from blank. Saved/absent backend presence will be added to edit context in Phase3; no hydration from public responses or unparsed backend fields occurs now.

Form initialization uses existing draft reset; initial edit hydration is not treated as user geography change. Existing edit.draft preserves local values across review/back; create draft remains separate. Discard resets added fields with existing emptyListingDraft; auth user/status changes clear both stores. No persisted storage or public cache added. Existing successful listing submission only confirms listing fields, not pin persistence, as input notice explicitly explains.

When an applied Country/City ID actually changes, only that side's previous pin text is cleared and clear intent recorded. Same IDs, area-only edits and unrelated fields preserve both. Tentative/cancelled picker choices do not invalidate confirmed pins. Country/city IDs are not derived from pasted text; containment not verified/claimed.

Existing automatic/explicit Current Location, permissions, Settings resume, reference matching and request-generation guards remain. No GPS-to-pin population. If GPS actually commits changed origin IDs, same-side stale pin clears; it cannot set numeric pin text. Destination untouched. No new location collection/background tracking.

## API and Phase3 boundary

Existing create JSON payload and changed-field PUT remain unchanged. Tests compare payloads with/without local pin fields. Owner response parser is untouched and therefore still does not expose saved coordinates. No coordinate POST/PUT, Maps launch, Copy Link or backend mutation performed for this phase.

Phase3 must explicitly add private DTO fields, owner-only hydration, coordinate request serialization/echo validation and edit comparison/reconciliation. Required semantics: untouched omit both; replace both numeric; explicit removal of saved pin null/null; empty new pin omit;0 remains numeric. Distinguish omitted response from authorized null/no-pin. Keep existing image-only retry and unknown-create/update safeguards. Pins must never enter public models/cache/share/navigation params. No accepted-user access exists.

## Verification record

Initial development checks found TypeScript shape errors, missing reference GET test mock and inline-blur error display issue; corrected before final verification. The missing mock caused a reference GET timeout (no mutating API); corrected to existing synthetic referenceResponse adapter. No real listing was created/updated. Initial3-suite run70pass/2fail,21.679s; later9-suite run252pass/1fail,12.22s while blur feedback was under correction. These are not passing final results.

No existing test was skipped, deleted or weakened; no timeout increased. Device/emulator visual/paste interaction NOT VERIFIED. Automated tests verify props/state, not physical rendering equivalence.

### Final focused regression

```text
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath __tests__/manualListingPin.test.ts __tests__/PostListing.test.tsx __tests__/UpdateListing.test.tsx __tests__/createListingApi.test.ts __tests__/updateListingApi.test.ts __tests__/ListingSelectorSearch.test.tsx __tests__/listingGpsService.test.ts __tests__/useListingGps.test.tsx __tests__/ListingImageFlow.test.tsx
```

**Exit0;9 suites/254 tests PASS;0 skipped;0 snapshots;28s.** Covers local manual pins plus unchanged create/update payloads, GPS/Settings guards, selectors and image sequence. Separate post-form run23/23 passed,25.765s,exit0; final focused run includes it.

### Full regression

`node node_modules/jest/bin/jest.js --runInBand`

First full run: **exit1;107 suites passed,1 failed,2 existing skipped (110 total);1667 tests passed,2 failed,2 existing skipped (1671 total);337.996s;0 snapshots.** Inventory increased by41 tests (36 utility/state tests,4 Create form tests,1 Edit test), not by deleting/skipping old tests. All new/affected suites passed in this run; this first run was not green.

App.test.tsx failures:

1. `Home dashboard uses the real first name and routes every action through existing navigators` —5000ms timeout at line601.
2. `returning guest opens public Home, public navigation works, and private screens remain unmounted` —5000ms timeout at line1259.

Full run overlapped the offline native build. Timing/resource contention is a possible factor, not a proven root cause. Existing App/HomeSearchCard and Login act warnings appeared; no unrelated source/test fix made. Diagnostic isolated rerun result recorded below. A passing isolate does not erase failed full regression.

Diagnostic command: `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath __tests__/App.test.tsx --testNamePattern 'Home dashboard uses the real first name|returning guest opens public Home'`. **Exit0;2 selected tests PASS;56 other cases excluded by name filter;34.729s.** Selected cases took4116ms and3510ms. The56 filtered cases are not new `.skip` annotations and are not counted as full regression coverage. No behavioral source/test changes between failed full run and this diagnostic.

Final complete rerun, after native build/other checks completed, same unfiltered command `node node_modules/jest/bin/jest.js --runInBand`: **exit0;108 suites PASS,2 existing skipped (110 total);1669 tests PASS,0 failures,2 existing skipped (1671 total);147.942s;0 snapshots.** App suite passed in44.017s. No exclusions, skips, assertion changes or timeout changes were used to obtain this full result. Existing act warnings remain. Timing sensitivity is recorded; a green repeat does not prove that the first-run timeout cause has been comprehensively diagnosed.

### Static and native verification

- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: **exit0**, no diagnostics (final independent run).
- `node node_modules/eslint/bin/eslint.js src/features/post-listing/types/manualListingPin.ts src/features/post-listing/types/listingDraft.ts src/features/post-listing/components/ManualListingPinInput.tsx src/features/post-listing/screens/PostListingScreen.tsx __tests__/manualListingPin.test.ts __tests__/PostListing.test.tsx __tests__/UpdateListing.test.tsx jest.setup.js`: **exit0**, no diagnostics.
- `git diff --check`: **exit0**. Existing LF/CRLF notices do not indicate whitespace errors.
- Android: from `android`, `.\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --offline --console=plain`: **BUILD SUCCESSFUL;exit0;4m24s;407 tasks (16 executed,391 up-to-date)**. Initial restricted attempt exited1 on existing Gradle cache lock access; same offline command succeeded with cache access. No downloads/configuration edits. Existing AGP legacy APIs/Gradle10 deprecation warnings remain. Installed maps package participates in normal existing build but no new map usage was added.

### Integrity and limitations

Final Git review: task adds five modified tracked paths (PostListingScreen, listingDraft schema, two existing test suites, Jest icon mock) and four new files (manual utility/component/test/this report). Existing17 modified and six untracked paths remain. Index remains unstaged. package.json/package-lock/native Android/iOS diffs empty; no dependency install/removal or new permission. Existing CustomDrawerContent diff is pre-existing and untouched. No backend write, database/migration command, real listing mutation, commit/push/reset/stash/cleanup/deployment. No change to API parsers/payload builders/GPS providers/contact privacy/navigation/theme/image workflow.

**LIVE AUTHENTICATED API: NOT VERIFIED. PHYSICAL DEVICE: NOT VERIFIED.** No deployment. Owner saved-pin population, server persistence, precise-pin Details/Maps/Copy and Phase3 tests remain future work. The final complete regression passed; initial timeout sensitivity and existing act warnings remain recorded limitations. This intermediate local-only implementation is not release-ready as a persisted coordinate feature.

**PHASE 2 COMPLETE — MANUAL PIN INPUT READY FOR API INTEGRATION.** This means local feature implementation only, not saved coordinates or release readiness. Stop before Phase3 until explicitly approved.
