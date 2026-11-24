# Location pins — Phase 1 audit and implementation plan

Date: 24 November 2026. Scope: audit/documentation only. No feature implementation.

## 1. Executive summary and verdict

**PHASE 1 COMPLETE — CONFIGURATION APPROVAL REQUIRED.**

The backend source and coordinate handover support optional, independent, owner-only From/To pins on existing listing endpoints. The mobile app already has react-native-maps, foreground geolocation, permissions, a native Android geocoder, owner details and separate creation/edit drafts. It does not yet preserve listing coordinates in form state, request payloads or owner response parsing. There is no current map-rendering component in application source; Search's ExactPointPicker is numeric input, not an embedded map.

Reuse installed maps 1.29.11 rather than install another map library. Installed documentation declares Fabric support for RN >=0.81.1; this project uses RN0.88.1/New Architecture. That establishes declared compatibility, not successful map rendering on this SDK/AGP/device combination. Android key injection/autolinking already exist, but key validity, restrictions, Cloud API enablement and billing were not verified. These are Phase 2 operational gates. Clipboard support needs separately approved installation before Phase 4. No phases automatically started.

## 2. Actual mobile baseline

| Item | Inspected value |
|---|---|
| Repository/branch | `G:/friendie_logistics_project/friendie_logistics_app`, `main` |
| HEAD | `42398f8e51d3f0dd3d73c7d1f5d301ecda095f02` |
| Framework/runtime | Bare React Native CLI0.88.1; React19.3.0; TypeScript6.0.3; Nodev24.13.0; npm11.6.2 |
| Android | minSDK24; compileSDK37; targetSDK36; buildTools37.0.0; NDK27.1.12297006 |
| Build | Gradle9.4.1; AGP9.2.1 from installed RN Gradle plugin version catalogue; Kotlin2.2.10 |
| Architecture | `newArchEnabled=true`, `hermesEnabled=true`, edge-to-edge enabled |
| Identity | `com.friendie_logistics_app`; staticTesting application suffix `.static_testing` |
| Testing | Jest29 declared, installed RN Jest preset, react-test-renderer19.3.0; local mocks; TypeScript no-emit; ESLint8 |

Package versions above were read from installed package metadata/runtime where applicable, not assumed from historical reports. SDK/build settings are configured values; no build was executed in Phase 1.

Initial Git state: **17 unstaged modified tracked files, zero staged changes, five untracked files**. All pre-existing work was preserved:

```text
M __tests__/ContactUs.test.tsx
M __tests__/CreateListing.test.tsx
M __tests__/ListingImageFlow.test.tsx
M __tests__/Listings.test.tsx
M __tests__/Profile.test.tsx
M __tests__/Search.test.tsx
M __tests__/createListingApi.test.ts
M __tests__/profileAvatarDeleteDrawer.test.tsx
M src/components/ui/AppAvatar.tsx
M src/features/auth/components/LogoutConfirmationModal.tsx
M src/features/listings/screens/ListingsScreen.tsx
M src/features/post-listing/hooks/useCreateListing.ts
M src/features/post-listing/services/createListingService.ts
M src/features/profile/screens/ProfileScreen.tsx
M src/features/search/screens/SearchScreen.tsx
M src/features/support/screens/ContactUsScreen.tsx
M src/navigation/components/CustomDrawerContent.tsx
?? docs/CONTACT_CATEGORY_FIX_FINDINGS.md
?? docs/CREATED_LISTING_STATUS_VERIFICATION.md
?? docs/LISTING_REQUEST_ACCEPTANCE_CONTACT_FINDINGS.md
?? docs/SEARCH_ADVANCED_FILTER_FIX.md
?? src/features/profile/components/profileAvatarUri.ts
```

## 3. Backend evidence and documentation discrepancy

Read the full `../friendie_logistics_backend/docs/api/LISTING_LOCATION_COORDINATES_V1.md`, including final executed verification and captured synthetic HTTP examples. Cross-checked `routes/api.php`, `CustomerListingController.php`, `CustomerListingFields.php` and `ListingCoordinates.php` under `app/Http/Controllers/Api/V1` and `app/Support/Api`.

The document's opening status still says migration/runtime tests pending. Its later dated verification explicitly reports successful migrations and tests, consistent with the supplied handover. This is a stale heading, not evidence to rerun migrations. Backend-reported 38/682 focused tests/assertions, 434/4319 regression and 23 HTTP checks are **reported backend evidence**, not tests independently executed by this audit. No database connection/fingerprint/migration inspection was performed here. Runtime schema and live authenticated behavior remain unverified by Phase 1.

## 4. Exact endpoint and envelope inventory

All paths include existing `/api/v1` prefix supplied by environment-aware configuration. Never hardcode a device host.

| Method | Full path | Purpose/authentication | Successful envelope |
|---|---|---|---|
| POST | `/api/v1/customer/listings` | Create; eligible real customer Sanctum Bearer | HTTP201 `{success:true,message,data: ownerRecord}` |
| PUT | `/api/v1/customer/listings/{id}` | Partial update; same customer, owns ID | HTTP200 same owner-record envelope |
| GET | `/api/v1/customer/listings/{id}` | Owner-only details | HTTP200 same owner-record envelope |
| GET | `/api/v1/customer/listings` | Own collection; page/per_page, documented status/type/search/sort | HTTP200 `{success:true,message,data:{items:ownerRecord[],pagination:{current_page,per_page,total,last_page}}}` |
| GET | `/api/v1/listings/{id}` | Public, guests allowed; existing eligibility | HTTP200 `{success:true,message,data:publicRecord}`; exact coordinates omitted even for logged-in owner |
| GET | `/api/v1/listings` | Public discovery/search | Existing public pagination envelope; no private pins |

Headers: `Accept: application/json`; JSON writes `Content-Type: application/json`; private requests `Authorization: Bearer <current customer token>`. Active, verified, exclusively customer-role eligible token required. Non-owner private ID returns404, not coordinate access. Owner responses carry `Cache-Control: no-store, private`.

Existing create required keys: `ad_type,title,category_id,from_country_id,from_city_id,to_country_id,to_city_id,currency,departure_on,reached_on`. Existing optional keys: `description,from_area,to_area,from_address,to_address,weight,weight_price,show_contact_info`. `Carring`/`Send` unchanged, dates Y-m-d, reached>=departure, contact0 only. Current backend creates status1; pins do not change publication rules. PUT validates submitted editable fields against current values. Unsupported fields remain rejected.

Owner record retains IDs/type/title/description/areas/addresses/weight/price/currency/dates/timestamps/status/is_featured/show_contact_info/image_url and adds four numbers-or-null. Public record retains category/origin/destination/owner projections and no exact coordinates. No new endpoint is needed.

### Coordinate validation and transport

Exact keys: `from_latitude`, `from_longitude`, `to_latitude`, `to_longitude`. Optional, independent pairs; both axes must be present if touched. Latitude [-90,90], longitude [-180,180], finite, at most seven decimal places. **0 and 0,0 are valid**. Numeric JSON and plain decimal strings supported; malformed values, booleans, nonfinite values, string exponents, mixed null/number, incomplete pair and invalid precision return422. Backend does not round invalid precision to pass validation. Owner JSON returns numbers/null, not decimal strings; trailing zero formatting is not promised.

| Operation | Contract |
|---|---|
| Create omits pair | No pin, stored null/null |
| PUT omits pair; same geography | Preserve saved pair |
| PUT complete numbers | Replace that side only |
| PUT null/null | Clear that side only |
| Country/city actually changes without replacement | Backend clears that side's stale pin |
| Same country/city IDs or unrelated field changes | Preserve pin |
| Changed geography plus explicit replacement | Save replacement |
| Invalid pair |422, no partial listing update |
| Coordinate schema unavailable | Legacy omission still works; explicit coordinate input422 |

JSON POST and JSON PUT are preferred and already used by mobile. Multipart POST creation accepts text coordinate parts and required listing text fields; two empty coordinate parts normalize to null. Literal string `null` is invalid. Raw multipart PUT is not guaranteed; `_method` spoofing is rejected by strict allowlist. Image remains a separate multipart POST `/customer/listings/{id}/image` field `image`, not a create image part. Never combine or alter this sequence for pins.

Errors:422 `{success:false,message:"Validation failed",errors:{from_latitude:["Supply both latitude and longitude, or set both to null."]}}`; range/precision errors use the affected key and finite decimal/range message.401 `Unauthenticated`,403 `Forbidden`,404 `Resource not found`, existing429/500 normalization. No raw exceptions to users. Geographic containment is **not** enforced: valid numbers do not prove a pin is in the selected city.

## 5. Add Listing architecture

`src/features/post-listing/screens/PostListingScreen.tsx` hosts shared `ListingForm`; Send/Carry exports in `screens/PostScreens.tsx` reuse it. React Hook Form/Zod from `types/listingDraft.ts`; memory-only Zustand `store/listingDraftStore.ts`; review and explicit submission in `screens/ListingReviewScreen.tsx` and `hooks/useCreateListing.ts`.

Current controls: type, title, real category, currency, From/To country-city-area, separate optional From/To Address, departure/arrival dates, optional description/price/weight (including0), optional image. No editable contact visibility; service forces0. Continue validates, persists and navigates to existing review. Successful creation clears unchanged draft only, cancels/invalidates account listing/dashboard queries, selects My Listings All and navigates once via existing root callback. Image selection uses existing separate upload/recovery; definite retry uploads only image, unknown outcome held.

`ListingLocation` currently has `{country,city,area?,source:'api'}`; neither it nor ListingDraft has pin fields. Zod object parsing drops unknown fields: simply attaching coordinates at runtime would silently lose them. `createListingPayload()` explicitly lists JSON keys and does not serialize pins. Need explicit future form/schema/request additions; no FormData rewrite.

Searchable `ListingReferencePicker` loads complete unpaginated lists, filters trimmed case-insensitive labels locally, deduplicates options and scopes cities by country query key. Clear/loading/error/retry remain. `ListingLocationPicker` keeps tentative country/city/area until Apply; changing country clears incompatible city, same ID preserves it. Apply requires real country/city. Cancel does not commit. Future pin consistency must compare IDs, not object identity/labels.

Draft persists on edits/blur/navigation through existing Keep/Discard flow, resets on auth identity/status changes. Existing Post form uses a native Alert for its legacy draft prompt; audit does not replace it or extend that notification pattern. Future pin feedback uses existing Toast only. No source changed.

## 6. Edit Listing architecture and state recommendation

`ListingEditLoader.tsx` calls `loadListingEdit()` in `services/updateListingService.ts`, reads private own details, fetches real reference lists, reconstructs initial form and stores separate `useEditListingDraft`. Edit contexts retain original owner record, initial draft, newer draft, user and ready/pending/unknown/confirmed mutation state. Changed fields are diffed against original; JSON PUT includes only changed supported fields. Unknown update outcomes reconcile through private details rather than blindly repeat PUT. `useUpdateListing` cancels older readers then invalidates private/public relevant queries without copying private data into them.

Smallest safe future representation (design only): immutable validated `Pin={latitude:number,longitude:number}`; each form side has `pin?: Pin|null`, where undefined means unchanged/absent from response, null means explicit removal, numeric pair means confirmed value. Keep original response presence in context (`unknown`, `empty`, or `saved`) separately from edit intent (`unchanged`, `replace`, `clear`). This avoids treating omitted unauthorized/legacy fields as an instruction to clear.

Saved unchanged -> omit pair; selected replacement -> serialize both numeric keys; remove saved pin -> null/null; no saved pin/no edits -> omit. Missing response fields -> no actions and no assumed0. Inconsistent backend pairs -> fail closed/unavailable, never infer missing axis. Country/city changes invalidate that side's pin; explicit replacement confirmed afterward may accompany changed IDs. Same IDs preserve. Edit dirty tracking/diff/unknown reconciliation must inspect both axes, including explicit clear and server geography-triggered nulls. Never use `{...createPayload}` alone to represent edit removal because omission cannot mean clear.

## 7. Listing Details, owner access and caches

`src/features/listings/screens/ListingDetailsScreen.tsx` is shared. `returnTo:'MyListings'` calls `useListingDetails(id,true)` -> `getOwnListingDetails`. MyListingsScreen passes ID and that returnTo; Dashboard links to existing account listing view. Home/public Listings and MyReviews details remain public, even if viewer happens to own the listing. Do not silently upgrade every public view to a private request.

`types/myListingsApi.types.ts` owns Zod owner DTO. It currently **strips coordinate keys** because they are absent from the schema. Add optional nullable numeric fields and complete-pair validation in Phase3. Keep them on owner backend DTO only, not public ListingDetail/listingSchema. `ownListingDetailsService` retains raw parsed `backend`, verifies ID/token/current account and registers ownership via WeakMap. Own listing cards also retain owner backend DTO; no pin UI belongs on public cards.

Query keys: private details `['ownListingDetails',userId,id]`; private collection `['myListings.read','user:'+id,status]`; public detail separate `listingDetails` keys. `sessionLogout.ts` cancels/removes nonpublic-home queries; RootNavigator clears private memory on owner replacement; drafts/edit contexts and owned-record WeakMap reset on auth changes. Preserve all, prohibit private pin persistence/public navigation payloads, and add coordinate-specific race/cache tests. Owner-only data should be read fresh under same session, not inferred from local `ownerId` or chat membership.

Future minimal details presentation: owner-only From/To pin action rows beside existing route/location information, without resizing image or changing screen hierarchy. View/Open Maps/Copy only for complete validated authorized pairs. If owner entered through public details, no pin actions there; use existing My Listings path. No new details endpoint or navigation route.

## 8. Current Location audit and reuse

`locationService.ts`: installed geolocation-service5.3.1 and permissions5.6.3; foreground fine/coarse checks, Android requests both together and accepts coarse permission; blocked -> app Settings; one-shot high-accuracy request,15s timeout, maximumAge0. No continuous watch/background permission. Approximate permission does not guarantee precise fix.

`currentLocationService.ts` obtains valid coordinates, accuracy/capture time, then best-effort address; failed reverse geocode retains point. `placesService.ts` uses existing Android `FriendieGeocoder.reverse`; its search/resolve proxy is gated/proposed, not approval to add Places API. Native module checks device location enabled; Android Geocoder uses worker/API33 callback and12s timeout, extracts countryCode/name/locality/area and street address only when thoroughfare exists. No new external geocoder needed.

`listingGpsService.detect()` shares a pending device-fix promise, matches exact unique API short_name/country code or name and unique city within that country. It returns country/city/area/address **but discards raw coordinates**. Area/address only use sufficiently accurate fixes (existing maxGpsAccuracyMeters in filterLocationService). Partial unique country may return without city; ambiguous/unmatched values require manual choice, no guessed IDs.

`useListingGps` automatically attempts only focused Create, permission already granted, services enabled, untouched origin. No auto permission/settings prompts. Explicit action requests permission, offers App/Location Settings and resumes once on return. Generation, abort, user-object/status checks and flight guard ignore stale work; manual origin/address changes invalidate. Edit and destination currently do not invoke automatic GPS. Preserve this behavior.

For future pins: reuse `locationService.currentPosition`/`detectCurrentLocation` rather than duplicate provider. Return a short-lived validated coordinate candidate separately from ID matching; retain point even when city matching fails, but never silently replace selected country/city. Existing automatic From behavior may offer a candidate; **do not automatically save an exact pin without confirmation**. Explicit To GPS is user-triggered only. Manual pin edits/country-city edits/account/blur increment side generation; late GPS cannot overwrite confirmed pin. In-flight native GPS may finish after JS cancellation but its result must be ignored. Clear precise candidates when picker closes or session changes.

## 9. Navigation, theme and UX plan

RootNavigator -> AuthStack/AppDrawer -> MainTabs with HomeStack/ListingsStack/PostListingStack/MessagesStack/ProfileStack. Post stack owns PostListing, SendParcel, CarryParcel, ListingReview, protected by AccountAccessBoundary/requireAuth pending POST_LISTING. Existing params contain listing ID/edit ID, not private coordinates. Preserve route names/back behavior/auth gates.

Recommend an About-unrelated, listing-specific reusable **React Native Modal** map picker owned by ListingForm, following ListingLocationPicker pattern. No new navigator/route needed; no private coordinates in navigation params. Keep separate optional From pin/To pin controls near existing location/address fields. Existing SafeScreen, KeyboardScreen, AppButton/AppText and centralized colors/spacing/radius/shadows/typography apply. Theme palette matches supplied burgundy/navy/slate values; no new global token needed.

Lifecycle: open side -> initialize temporary pin from existing valid saved pin, otherwise map viewport only -> tap/drag sets candidate -> Confirm validates and commits correct side -> Cancel/Android Back discards temporary changes -> Remove explicitly sets that side null. Camera center is not selection; Confirm disabled until a real candidate exists. Missing pin never becomes0,0 by default; explicit0,0 allowed. A viewport can be world-level or existing verified point, without claiming city-centroid data not returned by API.

Country/city IDs remain authoritative listing references. On actual change invalidate only same side; same IDs/unrelated fields preserve; temporary canceled country change cannot clear saved form pin. A map pin does not prove containment: no backend geographic containment or verified city bounds API exists. Tell user to choose a matching point; do not add unapproved reverse-geocoding service or claim containment enforced. Search/radius flows untouched.

## 10. Dependencies, compatibility and Android configuration

Declared navigation7 packages; Query5, Axios1, Zustand5/Zod4; maps1.29.11; geolocation5.3.1; permissions5.6.3; Toast2.5.2. Exact installed key framework versions in section2; manifest ranges are not installation instructions.

Installed maps README Fabric table:1.26.1+ requires RN>=0.81.1. Its installed package peers React>=18.3.1/RN>=0.76; app exceeds both. MIT license, codegen config and Android CMake/autolinking present. Generated existing PackageList and autolinking JSON contain MapsPackage. Library Gradle inherits project SDK/Kotlin, depends on Maps19.1.0 and Location21.3.0; root already aligns GPS/Maps Location21.3.0. Hermes enabled; native View/Fabric support is declared, but no device/Hermes map runtime claim. AGP9.2.1/Gradle9.4.1 compile must be validated later; declared RN compatibility alone is not build certification. Existing APK size/added map-picker size not measured. Library already contributes native SDK footprint; no second map engine recommended.

Package is actively documented/maintained upstream (installed README describes small maintainer group); no future maintenance guarantee. Keep installed version rather than upgrade speculatively. Google provider usage also subject to Google terms/attribution; do not hide map attribution or cache tiles outside permitted terms. No Expo installation/plugin workflow recommended.

`android/app/src/main/AndroidManifest.xml` already has fine/coarse/Internet and `com.google.android.geo.API_KEY` placeholder. `android/app/build.gradle` resolves FRIENDIE_MAPS_API_KEY Gradle property/environment, default empty. Existing application has adjustResize. No new permission/background service or manifest change appears necessary for standard pin picker. Do not print key or inspect secret-bearing properties. Presence/validity/billing/restrictions not established; generated native files are historical artifacts, not fresh build proof.

Future operator setup: approve Maps SDK for Android Cloud project/billing, enable SDK, supply key via existing injection, restrict Android application by package **and signing SHA-1** (actual debug/release/Play signing certificate as applicable; staticTesting variant separately if used), API restrict to required SDK, verify map rendering. Do not commit unrestricted key. Billing requirement does not imply a charge estimate or verified entitlement. No Cloud changes in audit. iOS support not configured/audited for new map UI; Android is current scope.

### Dependency decision table

| Requirement | Existing support | Recommended solution | Installation required | Approval required |
|---|---|---|---|---|
| Embedded maps | maps1.29.11 installed, Fabric metadata/autolinking | Reuse installed MapView/Marker | No | Phase2 implementation; Cloud configuration if absent |
| GPS | Existing foreground one-shot provider/native geocoder | Reuse locationService/currentLocationService | No | Phase2 behavior extension |
| Runtime permissions | permissions5.6.3 + fine/coarse manifest | Existing flow; no background permission | No | No new permission; Phase2 integration |
| Clipboard | No clipboard dependency/native bridge; Share is not clipboard | Candidate `@react-native-clipboard/clipboard` | Yes, later | Explicit package/native integration approval before Phase4 |
| External Maps links | React Native Linking already used | HTTPS Maps URL, browser fallback | No | Phase4 feature approval |

Clipboard official upstream metadata inspected:1.16.3, MIT, RN peer>=0.61.5/React>=16.9, codegen configuration. Candidate satisfies peer floor but RN0.88/AGP9 native compile/device support **not yet verified**; do not promise exact compatible release until approved installation/build. Prefer maintained package over inventing custom native bridge; no package installed. React Native core Clipboard is removed.

## 11. Maps/Copy and privacy plan

Existing ListingDetailsScreen uses Linking for telephone and Share for public listing URL. No current coordinate URL or Clipboard implementation. Construct only from revalidated owner DTO: `https://www.google.com/maps/search/?api=1&query=<encoded latitude,longitude>`. HTTPS opens Maps where supported and browser otherwise; no embedded SDK/API key required for URL itself. Handle rejected Linking/copy via existing Toast. Copy only after explicit owner action; externally copied/shared coordinates cannot be revoked by backend. Do not add pins to public Share listing payload.

Owner-only matrix: guests none; authenticated non-owner none; chat/review participant none; owner via authorized private endpoint allowed; accepted-request sharing unsupported. Do not derive access from local numeric ID, successful chat or review. Never cache coordinates in public query data, log exact coordinates/addresses/tokens, emit analytics pin metadata or persist into general search state. Backend authorizes access; frontend gates visibility and lifecycle. Both nullable/omitted pairs hide actions; valid zero pair shows actions.

Toast plan: warning GPS/permission/timeout, existing Settings action for blocked/disabled, validation feedback for invalid pair, optional info selection/removal, success Copy, error Maps/Clipboard/backend rejection. No automatic-load success Toast, no duplicated feedback, no new notification UI/library. Reuse `src/components/ui/AppToast.tsx`: existing white card, colored left bar, dark bold title/gray description, standard success/error/warning/rejected/info colors.

## 12. Proposed exact future source-file inventory

All paths below are under mobile repository. **Existing files are not edited in Phase1.** New paths are explicit proposals, not claims that files already exist.

| Path | Existing responsibility -> proposed change/reason | Impact and regression risk | Phase |
|---|---|---|---|
| `src/features/post-listing/types/listingDraft.ts` | Form schema -> optional separate pins/intents; avoid Zod stripping and zero loss | Create/edit validation, medium |2/3 |
| `src/features/post-listing/screens/PostListingScreen.tsx` | Shared Create/Edit form -> minimal independent pin controls/modal state, side invalidation | Keyboard/dirty state/manual GPS, medium |2 |
| `src/features/post-listing/screens/ListingReviewScreen.tsx` | Review/submission -> optional confirmed-pin summary and coordinate validation errors | Review layout/submit, low-medium |2/3 |
| `src/features/post-listing/components/ListingLocationPicker.tsx` | Tentative Country/City -> expose actual geography change result if needed; keep searchable controls | Dependency/reset/cancel, medium; avoid edits if parent comparison sufficient |2 |
| `src/features/post-listing/services/listingGpsService.ts` | GPS reference matching -> optional short-lived point candidate, preserve existing matches | Existing GPS callers; test return compatibility, medium |2 |
| `src/features/post-listing/hooks/useListingGps.ts` | Focus/session/flight guards -> candidate generation/manual pin cancellation only if needed | Automatic GPS/Settings resume, medium |2 |
| `src/features/post-listing/store/listingDraftStore.ts` | Memory draft/image recovery -> verify pin reset/recovery snapshots via extended Draft type | Account isolation/image recovery, medium |2/3; likely type propagation only |
| `src/features/post-listing/store/editListingDraftStore.ts` | Separate edit memory -> preserve/reset added pin intent via shared type | Cross-listing/account drafts, medium |2/3; likely no algorithm change |
| `src/features/post-listing/services/createListingService.ts` | JSON allowlist/confirmation -> serialize numeric confirmed pairs and verify echoed pins | Unknown hold/duplicate create, high |3 |
| `src/features/post-listing/services/updateListingService.ts` | Owner initial/diff/PUT/reconcile -> presence-aware hydration, pair replacement/clearing and echoed validation | Omission vs null/data loss, high |3 |
| `src/features/post-listing/hooks/useCreateListing.ts` | Mutation/image/cache state -> coordinate field error mapping only if needed; retain invalidation | Draft/image unknown protection, medium |3 |
| `src/features/post-listing/hooks/useUpdateListing.ts` | Update result/cache invalidation -> coordinate errors only if needed | No extra resubmit/cache contamination, medium |3 |
| `src/features/listings/types/myListingsApi.types.ts` | Owner DTO -> optional nullable numeric coordinate pairs with finite/range validation | All owner list/detail/create/edit parsing, high |3 |
| `src/features/listings/services/ownListingDetailsService.ts` | Owner-authorized DTO -> retain validated private pin access (backend DTO may suffice) | Ownership/session proof, high |3 |
| `src/features/listings/screens/ListingDetailsScreen.tsx` | Shared public/owner display -> owner-only action component, no public model additions | Private/public visibility, high |4 |
| `src/features/post-listing/components/ListingPinPicker.tsx` **NEW proposed** | No existing file -> listing-specific Modal MapView/temp candidate/confirm/cancel | No navigation change; back/accessibility/map lifecycle, medium |2 |
| `src/features/post-listing/types/listingPin.ts` **NEW proposed** | No existing file -> validated Pin/state/precision helpers shared by form/private DTO | Central finite/range/null/zero semantics, medium |2/3 |
| `src/features/listings/components/OwnerListingPinActions.tsx` **NEW proposed** | No existing file -> authorized Maps/Copy actions only | Privacy/external link handling, high |4 |
| `src/features/listings/services/ownerLocationLinks.ts` **NEW proposed** | No existing file -> private coordinate link/Clipboard integration | No public sharing/leaks, high |4 |
| `package.json`, `package-lock.json` | Existing dependencies -> approved clipboard package only; no maps upgrade | Native/codegen build, medium-high |4; separate approval |

No expected navigationTypes/navigator/theme/endpoints change. No expected native change for Maps if existing injection works; if fresh build reveals necessary changes, scope/document them before applying. Clipboard autolinking may produce build artifacts later; iOS pods only if separately in scope. Shared core GPS/provider/geocoder files should stay unchanged unless a concrete integration defect warrants narrowly tested change.

Tests: extend actual `__tests__/createListingApi.test.ts`, `updateListingApi.test.ts`, `ownListingDetails.test.ts`, `PostListing.test.tsx`, `UpdateListing.test.tsx`, `CreateListing.test.tsx`, `listingGpsService.test.ts`, `useListingGps.test.tsx`, `ListingDetails.test.tsx`, `guestListingDetails.test.ts`, `ListingSelectorSearch.test.tsx`, `ListingImageFlow.test.tsx`; proposed new `__tests__/ListingPinPicker.test.tsx`, `__tests__/ownerLocationLinks.test.ts` for pin-specific cases. Do not weaken/skip legacy tests or globally enable fixtures.

## 13. Phases and dependencies

**Phase2 — selection:** explicit approval, confirm Maps key/config readiness, reuse installed maps. Build listing-only modal and independent optional pin state, precision/finite helper, manual confirm/cancel/remove, GPS candidate reuse and generation guards. Preserve automatic From reference behavior, searchable selectors, keyboard/safe area/theme. No coordinate API submission yet; make staged scope clear and do not advertise unsaved pins as persisted.

**Phase3 — API:** depends on stable selection/intent model. Extend private owner DTO, create request and partial edit serialization; validate touched pairs, distinguish unknown/no-pin/clear. Preserve snapshots, unknown-outcome holds, separate image upload, reference IDs and cache keys. Read owner API for persisted state; do not infer saved pins from public GET. Automated mocked contract/privacy tests before any separately authorized live writes.

**Phase4 — owner actions and release checks:** approved clipboard installation/version/native build, authorized Maps/Copy only, full regression/static checks/Android arm64 build; emulator and physical device permissions/GPS/map/link/copy/logout verification. No acceptance-sharing feature, no backend changes. Live creation/update requires explicit test-environment/account authorization; no original DB mutation in this audit.

Approvals needed later: Phase2 implementation, operator Cloud/key/billing work if missing; Phase3 implementation; Phase4 package/native integration and testing. Do not request secret keys in chat. Installed map has declared compatibility, but runtime credential and native rendering checks are remaining gates, not passed checks.

## 14. Executed verification baseline

Inspected package scripts/setup and selected tests before running: Jest uses mocks/spies/adapters for Axios, secure storage, permissions and GPS; selected mutation tests do not POST to Laravel. No backend test runner, app server, migrations, network mutation or snapshot update invoked. Local binaries only; no npx download/install. Jest transform cache is disposable tool output, not application source.

Command1:

```text
node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath __tests__/createListingApi.test.ts __tests__/updateListingApi.test.ts __tests__/ownListingDetails.test.ts __tests__/listingGpsService.test.ts __tests__/useListingGps.test.tsx __tests__/ListingSelectorSearch.test.tsx
```

Actual: **exit1, 5 suites PASS/1 FAIL;187 tests PASS/1 FAIL;188 total;0 skipped;0 snapshots;67.601s.** Failure: `categories searches complete public options locally, clears and preserves authoritative identity`, existing5000ms timeout at `ListingSelectorSearch.test.tsx:50` (test.each). No feature-code exception or pin test exists. Do not treat timeout as proven harmless or full baseline green.

Command2 isolated unchanged suite:

```text
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath __tests__/ListingSelectorSearch.test.tsx
```

Actual: **exit0,1 suite/7 tests PASS,0 skipped,0 snapshots,3.814s**; previously timed-out category case1488ms. Combined-run timeout did not reproduce in isolation; underlying cause not established in this audit. No timeout increase or test changes.

Command3: `node node_modules/typescript/bin/tsc --noEmit --incremental false` -> **exit0**, no diagnostics.

Command4 scoped ESLint (no fix):

```text
node node_modules/eslint/bin/eslint.js src/features/post-listing/types/listingDraft.ts src/features/post-listing/components/ListingLocationPicker.tsx src/features/post-listing/services/listingGpsService.ts src/features/post-listing/hooks/useListingGps.ts src/features/listings/types/myListingsApi.types.ts src/features/listings/services/ownListingDetailsService.ts src/features/location/services/locationService.ts src/features/location/services/currentLocationService.ts src/features/location/services/placesService.ts
```

Scoped ESLint: **exit0**, no diagnostics. No full Jest suite/Android build executed: Phase1 permits selected safe existing verification, prohibits build dependency downloads/native changes. Full regression is **PENDING**, focused batch **FAIL**; isolate **PASS**, not a substitute for full suite. Physical device/emulator/map rendering/live authenticated API **NOT VERIFIED**. Historical counts do not establish present health. Git inspection emitted existing LF/CRLF conversion warnings; no line-ending rewrite performed.

## 15. Future test matrix (planned, not executed)

| Area | Automated mocked coverage required | Emulator/physical coverage required |
|---|---|---|
| Selection | From/To independent; confirm/cancel/back; edit/remove; optional; viewport not pin; explicit0,0; finite/range/7dp | Touch/drag marker, scrolling, keyboard, accessibility, narrow screen |
| GPS | Granted/denied/blocked, services disabled, Settings resume once, timeout/provider/geocoder failure, approximate accuracy; manual pin wins; generation/flight; no background watch | Fine/coarse denied/allowed, GPS off/on, actual fix quality, app background/return |
| Geography | From/To country/city change clears same side only; same IDs/unrelated fields preserve; Cancel preserves; stale references/GPS cannot commit | Manual override during slow GPS/reference request |
| Create | No pins, From-only, To-only, both; no fake defaults; numeric JSON; zero/negative/boundaries; echoed coordinate check; unknown response hold | Approved isolated persistence only, no real customer record for tests |
| Edit | Omit preserves, numeric replaces, null/null clears one/both; missing fields unknown; incomplete/mixed pair rejects; stale geography clearing; same IDs preserve | Reopen owner details/edit and confirm saved/cleared behavior |
| Transport/media | JSON POST/PUT; pair field errors422; multipart creation text fields if actually adopted; separate image POST preserves pins and retries image only | Android image selection/upload with unchanged pin state |
| Privacy | Guest/nonowner/public owner sees no actions; own private fields valid; omitted/null hide; logout/account replacement/conversation has no entitlement; public cache/navigation/share pin-free | Account switch/logout while picker/read/write pending; clipboard disclosure only explicit |
| External actions | Encoded URL,0,0, browser fallback, Linking rejection, copy success/failure, no logs/no public Share coordinates | Maps installed/absent, browser opens, copied link accurate, no hidden location leak |
| Regression | Create/Edit/own/MyListings/public listing; image upload/delete; selectors; keyboard tests; auth/guest/session/phone privacy; navigation; toast; no auto retry | Existing form layout/back/drawer/tabs/keyboard and image dimensions preserved |

Existing relevant suites also include `MyListings.test.tsx`, `MyListingsDashboardConsistency.test.tsx`, `listingDetailsService.test.ts`, `listingImageUploadApi.test.ts`, `ListingImageDelete.test.tsx`, `LocationAutofill.test.tsx`, `location.test.ts`, `filterLocation.test.ts`, `KeyboardLayout.test.tsx`, `keyboardVisibility.test.ts`, `auth.test.ts`, `authFlow.test.ts`. These are identified inventory, not all executed results. Future mutation tests must remain mocked/isolated.

## 16. Risks, limitations and readiness

- No accepted-request authorization: owner-only scope must stay owner-only.
- Cloud key/config/billing and actual embedded map rendering not verified; no new key generated.
- Clipboard not installed; candidate compile compatibility pending approval/build.
- Owner Zod currently drops pins; merely adding controls would not persist them.
- Zero/null/omitted semantics and geography changes can destroy pins if treated as ordinary truthy scalar fields; pair-aware validation/diff mandatory.
- Existing automatic GPS must not silently create exact saved pins or overwrite manual choices.
- No geographic containment guarantee; no unapproved Places proxy/alias guessing.
- Existing baseline timeout and stale review-step Pending approval copy noted as pre-existing findings; no unrelated correction in audit. Current backend creates Published1; pin work must not revive old status assumption.
- Runtime build/app size, live original schema, backend fingerprints and operational deployment not verified here.

| Area | Verdict |
|---|---|
| Backend coordinate contract | READY from source/handover; live runtime not independently verified |
| Add Listing architecture | CHANGES REQUIRED |
| Edit Listing architecture | CHANGES REQUIRED |
| Owner Details architecture | CHANGES REQUIRED (private path already exists) |
| Current Location reuse | READY provider; CHANGES REQUIRED for candidate retention/confirmation |
| Maps dependency | AVAILABLE; declared Fabric compatibility, fresh build/render pending |
| Clipboard support | INSTALLATION REQUIRED for Phase4 |
| Native Android configuration | CONFIGURATION REQUIRED/verification of existing key injection; no source edit presumed |
| Privacy architecture | READY account boundary; CHANGES REQUIRED pin-specific schema/actions/tests |
| Existing regression baseline | FAIL combined focused run; isolated retry PASS; full suite PENDING |
| Phase2 implementation | BLOCKED pending explicit next-phase approval and Maps configuration readiness |

## 17. Final integrity and scope

Before documentation creation, all576 existing Git-enumerated tracked/nonignored-untracked files were hashed as ordered `path:SHA256` lines, joined with LF and hashed again. Initial and repeated digest both:

`DF9C14172CE18DF3D462CB355E21927A30FE7B2C190E13D8069DB03BD98369A7`.

Final post-document comparison excluded this new audit and again returned **576 files and the identical digest**. Git status retained all original17 modified and five untracked paths and added only this document; staged changes remain empty, branch/HEAD unchanged. Only new persistent task deliverable: `docs/LOCATION_PIN_INTEGRATION_PHASE_1_AUDIT.md`. No production/test/package/lockfile/native source edits, no backend writes or database commands, no installs, staging/commits/push/reset/stash/deployment, no Phase2 implementation. Ignored build/media trees are not fingerprinted by this Git-file digest; no claim of database/media or all backend fingerprint verification. Backend was accessed only with source reads.

## 18. Compatibility sources

Primary source review on audit date; web sources describe requirements, not proof that this installation/device passed:

- Installed `node_modules/react-native-maps/README.md`, `package.json`, `android/build.gradle`, `react-native.config.js`: compatibility/peers/MIT/native dependency evidence. [Official map repository](https://github.com/react-native-maps/react-native-maps).
- [Google Android API key setup](https://developers.google.com/maps/documentation/android-sdk/get-api-key): enable SDK and restrict key by application package/signing SHA-1.
- [Google Android usage and billing](https://developers.google.com/maps/documentation/android-sdk/usage-and-billing): billing-enabled project requirement; no pricing estimate made.
- [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started): HTTPS link syntax, no API key, Maps app/browser behavior.
- [Official Clipboard repository](https://github.com/react-native-clipboard/clipboard) and [package metadata](https://raw.githubusercontent.com/react-native-clipboard/clipboard/master/package.json): candidate version/peers/codegen/license; not installed or compiled here.
- [React Native Clipboard documentation](https://reactnative.dev/docs/clipboard): core API removed; Share is not a replacement for Copy.

**Final status: PHASE 1 COMPLETE — CONFIGURATION APPROVAL REQUIRED. Stop here; await explicit approval before Phase2.**
