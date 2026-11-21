# Task 32 — Listing creation/navigation root cause audit

Date: 2026-11-19. **Read-only investigation; recommendations only.** No application, test, configuration, navigation, backend or database changes. No live listing creation, deletion, image mutation or status change. Only this report was created.

## 1. Executive summary

The two reported symptoms have separate, mutually reinforcing frontend causes:

1. **Pending is inaccessible in My Listings.** Laravel creates listings as Pending (`0`). My Listings defaults to Active, explicitly requests `status=1`, and offers only Active/Completed/Expired. Expired requests `2`; Completed deliberately rejects because it has no verified backend equivalent. There is no Pending/All route through this UI. A newly created Pending listing is therefore excluded by the **request filter**, not hidden by a card renderer and not required to be public.
2. **Create success deliberately enters the public Listings tab's nested private Details route.** The callback calls `navigate('ListingsStack', {screen:'ListingDetails', params:{listingId:String(serverId), returnTo:'MyListings'}})`. This is not navigation to the My Listings collection. `returnTo` controls the owner-details API/back behavior; it does not change the initial destination.
3. **Ordinary tab switching resumes that retained nested route.** The real-mode custom bar navigates to the tab with its existing params rather than explicitly to its public Listings child. Returning from owner Details to the My Listings drawer does not pop/reset the retained Listings stack. A cold nested Details navigation can even initialize the stack with Details as its only route.

The exact user's listing ID, actual POST response, account and database row were not available. **Specific live persistence/ownership is G: not verified.** The source-level causes above are confirmed, and existing tests explicitly assert the current Pending/Details behavior. Do not infer that the user's row failed to save or that it belongs to another account.

An additional confirmed contract issue was found: valid descriptions containing characters Laravel sanitizes can fail frontend strict response equality **after persistence**. This is distinct from the successful Details-navigation path; see API-003.

## 2. Actual navigation tree

```text
Root Native Stack / NavigationContainer
├─ onboarding / AuthStack (when applicable)
└─ AppDrawer
   ├─ MainTabs
   │  ├─ HomeStack → Home / Search / Results / ListingDetails / ...
   │  ├─ ListingsStack → Listings / Filters / ListingDetails
   │  ├─ PostListingStack → PostListing / SendParcel / CarryParcel / ListingReview
   │  ├─ MessagesStack → Conversations / Chat
   │  └─ ProfileStack → Profile / EditProfile / ...
   ├─ MyListings (account access boundary)
   └─ other drawer destinations
```

Evidence: `src/navigation/RootNavigator.tsx:107`, `:115`, `:136`; `DrawerNavigator.tsx:60`, `:65`; `BottomTabNavigator.tsx:19`; `ListingsNavigator.tsx:11`; `PostNavigator.tsx:16`.

Listings is a **nested native stack**, not a direct tab screen. Without nested destination params, its first registered screen is Listings (implicit initial route). Details is in the same stack. Home also has its own Details route; the Create callback specifically targets **ListingsStack**, not HomeStack.

## 3. Create Listing submission trace

1. Existing review-step Create button invokes `useCreateListing.submit`. The form is validated; guest uses the existing auth gate; demo/fake sessions do not submit real creation. Image metadata, if present, is validated before POST.
2. `createListingPayload` maps verified reference IDs and preserves `Carring`/`Send`, local dates, optional values and `show_contact_info:0`.
3. `createListing` reads the secure token, captures the account/session, uses the existing centralized Axios instance and `endpoints.myListings` (`/customer/listings`, base URL supplies `/api/v1`). It sends JSON with real Bearer authentication.
4. Response must have HTTP **201**, `{success:true,message,data:<owner listing record>}`, Pending status `0`, contact visibility `0`, and the expected typed fields. The server-provided positive listing ID is used; no ID is fabricated.
5. Service-level session-scoped pending/unknown/confirmed state and hook flight guards prevent concurrent or ambiguous duplicate POSTs. Token/account/AbortSignal checks reject stale completions.
6. Once service parsing succeeds, the hook sets `confirmed=true`, cancels and invalidates current-account My Listings + Dashboard summary queries, then handles optional image upload.
7. No-image success discards the submitted draft **only if unchanged**, shows one success Toast (`Listing created` / `Your listing is Pending approval.`), then calls `onCreated(row.id)` only for that unchanged draft. Newer edits are preserved and do not auto-navigate.

Evidence: `src/features/post-listing/screens/ListingReviewScreen.tsx:170` (Create action area); `src/features/post-listing/hooks/useCreateListing.ts:187`, `:208`, `:222`, `:223`, `:235`, `:244`, `:252`, `:256`, `:259`, `:262`; `src/features/post-listing/services/createListingService.ts:32`, `:138`, `:158`, `:167`, `:169`, `:173`, `:180`, `:192`; `src/services/api/endpoints.ts:22`.

Backend confirmation: `../friendie_logistics_backend/app/Http/Controllers/Api/V1/CustomerListingController.php:120` starts store, `:124` uses a transaction, `:128` inserts `created_by=request.user.id` and `isActive=0`, and `:134` returns serialized owner data with HTTP 201. Owner serialization starts at `:73` and returns actual status/IDs/image fields, not a public-feed wrapper.

### Image branch

After confirmed creation, an image recovery context holds the actual row/ID and selected image. Upload happens against that ID. On confirmed image success, `finish` clears recovery, conditionally discards the unchanged draft, shows its success Toast and calls the **same** Details callback (`useCreateListing.ts:144`, `:155`). Definite failure/unknown upload keeps the created listing/recovery and displays `Listing created; image not uploaded` / `Listing created; image status uncertain` (`:126`). It does not undo backend creation or re-POST the listing. Image failure can postpone success navigation, but does not explain status-0 exclusion from My Listings.

CreateReview itself does not reset the Post stack; the adjacent **EditReview** branch does reset it (`ListingReviewScreen.tsx:45`). Draft discard is not a navigator reset.

## 4. Post-submit navigation and retained state

**Exact action:** `src/features/post-listing/screens/ListingReviewScreen.tsx:28` defines `destination`; `:29` calls the parent tab navigator's `navigate('ListingsStack', ...)`; `:30` selects `ListingDetails`; `:31` supplies the actual string ID and `returnTo:'MyListings'`. CreateReview wires it at `:34`–`:37`. No `push`, `replace` or `reset` is used in this Create-success callback.

The resulting destination is:

```text
AppDrawer / MainTabs / ListingsStack / ListingDetails
params: listingId = confirmed server ID, returnTo = MyListings
```

`ListingDetailsScreen.tsx:99` interprets `returnTo==='MyListings'` as an **owner read**, so an unpublished Pending listing can legitimately display via the private details endpoint. It has not become public. Its Back action (`:264`, `:269`) navigates to the MyListings drawer; it does **not** remove the Details child from ListingsStack. `MyListingsScreen.tsx:73` also uses this same stack for private card details. My Listings Back (`:34`) targets HomeStack, leaving the other stack retained.

The real custom tab press (`src/navigation/components/CustomTabBar.tsx:73`) emits `tabPress`, then, when switching tabs, calls `navigation.navigate(route.name, route.params)` (`:88`–`:89`). Unlike the explicit preview-only branch (`:79`–`:87`), it does not select `screen:'Listings'`. There is no Listings-specific root listener in `BottomTabNavigator.tsx:20`. This explains a later Home → second tab switch reopening the created listing's owner Details.

### Cold stack versus previously visited stack

Installed React Navigation source, not an assumption:

- `node_modules/@react-navigation/core/src/useNavigationBuilder.tsx:309`: nested `screen` with no `initial:false` becomes the child navigator's initial state, with only that route.
- `node_modules/@react-navigation/native-stack/src/navigators/createNativeStackNavigator.tsx:67`: native stack handles tab reselect **only if already focused**, index > 0, and the event was not prevented (`:78`–`:89`). It is not a universal reset on tab switching.
- Cold nested Details can be index 0 with no public Listings route beneath it. Previously visited Listings can be index 1 with Details above root. Ordinary inactive-tab switching retains Details in either case.
- Real-mode CustomTabBar is also hidden on Listings/ListingDetails (`CustomTabBar.tsx:40`), so an already-focused tab reselect is not generally available on those screens as a user recovery path. Do not recommend “just tap the same tab twice” as a fix.

A read-only installed-router probe (no application state/records/API calls) returned:

```json
{"coldNestedScreen":{"index":0,"routes":["ListingDetails"]},"visitedRoot":{"index":1,"routes":["Listings","ListingDetails"]}}
```

This confirms the possible state shapes. **The user's actual runtime navigation snapshot was not captured.** No new UI test was added, per read-only instruction.

## 5. My Listings API/data trace

`src/features/listings/hooks/useMyListings.ts:28` selects the account's remembered tab, default `active`. Real query key (`:31`) is `['myListings.read','user:'+id,status]`; enabled only when focused and non-guest (`:32`), staleTime 30000 (`:33`). Query function calls `getMyListings(status,page,signal)` (`:35`).

`src/features/listings/services/myListingsService.ts:97` rejects Completed without a request. `:98`–`:101` calls the existing raw customer endpoint service with `status: active ? 1 : 2`. It does **not** request Pending or an unfiltered collection in the screen flow.

`src/features/listings/services/myListingsApiService.ts:41` retrieves a real secure token; `:50`–`:54` performs GET `/customer/listings` with `{page,per_page:20,status:1}` for default Active, Bearer token and AbortSignal. It rechecks token/account, validates HTTP 200 and `{success,message,data:{items,pagination}}`, pagination and returned status, then preserves owner ID and actual record fields (`:60`, `:74`, `:89`). No public Published/date/category query is reused for this endpoint.

Screen `MyListingsScreen.tsx:101` exposes only `active/completed/expired`. Items are flattened and deduplicated by backend ID (`:61`); access errors clear visible items, but there is no extra Pending-excluding card-render filter. Empty copy reflects the selected tab (`:187`). Pull-to-refresh (`:151`) uses the same selected-status request; it cannot reveal records excluded by `status=1`.

### A–G assessment

| Possibility | Evidence-based finding |
|---|---|
| A: saved but not returned | Confirmed general mechanism: status-0 row is excluded by screen's status-1 request. Specific user's row not queried. |
| B: returned then frontend-filtered | Not the primary mechanism. Filtering is sent to Laravel; service rejects responses that violate it. No later Pending card filter found. |
| C: returned but not rendered | No evidence for this report. Screen renders unique returned IDs unless access error. |
| D: no refresh after creation | Not supported as primary cause: matching My Listings key is explicitly invalidated. |
| E: different account | No evidence; both backend ownership and frontend stale-session guards exist. Specific account not independently verified. |
| F: never persisted | Not established. A parsed HTTP 201 implies backend transaction committed; no live response for the user's attempt was supplied. Sanitized-description ambiguity below is another possible post-persistence issue. |
| G: exact user row unknown | Yes. Actual listing ID/response/owner/persistence remain unverified. |

## 6. Customer visibility and sorting rules

Backend `CustomerListingController.php:26` scopes the query only to `created_by=request.user.id`. Collection `index` (`:92`) accepts optional status `0/1/2`, type `Carring/Send`, search, sort and pagination. It adds status filtering only when supplied (`:99`). **Default collection includes owned Pending, Published and Expired records**, without public departure/category eligibility filters. Default sort is descending ID (`:102`–`:104`); page 1/per_page 20 (`:106`) would include the newest owned record in an unfiltered request. Explicit oldest/departure sorts can change positioning, but the current My Listings screen supplies neither.

Pending does not mean Completed, Published or Active. No backend rule should be changed to make a fresh Pending record satisfy Active.

## 7. Public Listings stays separate

Second tab is registered as ListingsStack (`BottomTabNavigator.tsx:20`), whose root renders ListingsScreen, using the public service (`src/features/listings/services/listingsService.ts:103`; `publicListingsService.ts:165`, public `Authorization:false` at `:173`). It is not the My Listings drawer screen.

Backend `../friendie_logistics_backend/app/Queries/Api/PublicListingQuery.php:21` requires Published (`isActive=1`) and current/future departure, plus active category (`:22`). Fresh Pending must stay excluded. User's unexpected private Details is **navigation state reuse**, not evidence that the public API returned an unpublished listing. Do not switch the public catalogue to customer listings or alter approval rules.

## 8. Cache/refresh analysis

- Create confirms service response, cancels then invalidates `['myListings.read','user:'+currentId]` and `['profileDashboard','user:'+currentId,'summary']` (`useCreateListing.ts:235`–`:244`). These match the real screen query prefix. Active queries refetch; inactive queries become invalid and refetch when next enabled. This does not create a Pending screen/query.
- Focus changes control query `enabled`; there is no additional unconditional `useFocusEffect` refetch in useMyListings. Fresh cached results may be reused for 30 seconds in ordinary navigation, while invalidated results are stale. No evidence of a mismatched creation key.
- Image success additionally invalidates owner Details and public listings / API Home latest keys (`useCreateListing.ts:65`, `:79`, `:93`). No-image creation does not force public/Home refresh; a newly Pending item is ineligible there anyway.
- My Listings remembers tab per account in memory (`store/myListingsStore.ts:11`). Root account changes clear private account memory and rebuild private navigation epoch (`RootNavigator.tsx:64`–`:70`); logout cleanup clears query memory/drafts/tab choices (`src/features/auth/services/sessionLogout.ts:33`). No cross-account leak was demonstrated.
- Invalidating/refetching `status=1` correctly returns Published-only data. More invalidations will not repair Pending discoverability.

## 9. Route params, auth and persistence

- Create uses **actual returned ID**, not stale fixture ID. Owner detail card navigation uses actual record ID too.
- `returnTo:'MyListings'` is metadata choosing private read/back, not an instruction to open the My Listings collection immediately.
- Old nested `screen:'ListingDetails'`/ID params are not explicitly cleared by custom tab switching, and child state is retained. Repassing `route.params` is a stale-destination risk; do not claim every press replays them identically without runtime state. Retained active Details alone is sufficient to explain the symptom.
- No NavigationContainer `initialState` or AsyncStorage navigation-state save/restore is wired in `RootNavigator.tsx:107`. `onStateChange` only coordinates auth/notification handling (`:74`). This is current-session retained state, not evidence of disk restoration.
- Deep links distinguish `listings` / `listings/:listingId` / `my-listings` (`src/navigation/linking.ts:27`, `:51`). No create success deep-link use was found.
- Public Listings has no login gate; Post and private My Listings have existing protected access. Account changes reset private history; guest/preview differences do not convert Pending to public. Preview tab root behavior differs from real mode, so preview-only navigation assertions can miss the real defect.

## 10. Diagnostic matrix

| Workflow | Expected | Actual source/model behavior | Evidence | Root cause/finding |
|---|---|---|---|---|
| Create Listing | Server-confirmed creation, real ID | HTTP 201/Pending typed record; guarded response handling | createListingService:158–180; backend store:120–134 | General creation contract confirmed; exact user record G/unverified |
| Post-submit navigation | Safe owner destination without changing public tab root | Parent navigate to ListingsStack/ListingDetails with owner return metadata | ListingReviewScreen:28–37; existing Create test:146 | NAV-001 |
| My Listings | Owner can discover new Pending record | Default status=1; only Active/Completed/Expired UI | myListingsService:97–101; MyListingsScreen:101 | DATA-001; request-level exclusion, not public rules |
| Listings tab | Public Listings root | Ordinary switch resumes nested Details; cold Details may be only route | CustomTabBar:73–89; installed router probe | NAV-002 |
| Listing Details | Opened by explicit selection or clearly scoped owner flow | Create automatically enters it; Back drawer leaves stack retained | ListingReviewScreen:29; ListingDetailsScreen:269 | NAV-001/NAV-002; no public data leak shown |
| Cache refresh | Current account data | Correct private invalidation, but same status filter | useCreateListing:235–244; useMyListings:31 | No confirmed cache-key defect; refetch cannot add Pending |
| Description response | Accept authoritative sanitized successful record | Strict raw comparison can reject saved 201 | backend html:127; frontend comparison:173 | API-003, additional conditional defect |

## 11. Confirmed issues and minimum recommendations — do not implement

### DATA-001 — High: no Pending/All customer listing visibility

- **Files/lines:** `myListingsService.ts:97`–`:101`; `useMyListings.ts:28`; `MyListingsScreen.tsx:101`; backend `CustomerListingController.php:128`.
- **Expected:** owned Pending record can be found after creation while publication approval remains intact.
- **Actual/root:** new record status 0; screen only reads status 1 or 2. Completed is unsupported. No Pending UI exists.
- **Minimum safe correction:** separately authorize a correctly labeled Pending filter/tab (or an All view with actual status labels), use existing raw service status 0/unfiltered support, and select an appropriate owner view after creation. Preserve Active=1 and Expired=2. Never map Pending to Completed or force publication.
- **Tests affected:** MyListings UI/service, Create success flow, pagination/refresh and account isolation. Add a single workflow assertion that confirmed Pending is discoverable under the matching owner view.
- **Risk:** moderate UI/filter/count semantics; do not derive dashboard totals from a page. Navigation change for visibility alone: not required; post-success owner-view selection should be coordinated. **Backend change: no.**

### NAV-001 — High: creation uses public tab's owner Details as success destination

- **Files/lines:** `ListingReviewScreen.tsx:28`–`:37`; `useCreateListing.ts:155`, `:262`.
- **Expected:** agreed post-create owner collection/confirmation destination that does not hijack public browsing.
- **Actual/root:** explicit success callback selects ListingsStack/ListingDetails. `returnTo` does not route to collection.
- **Minimum safe correction:** use the existing MyListings drawer destination as post-create destination, coordinated with a Pending-capable view. Reuse existing root navigation helpers instead of guessing parent chains. If owner Details remains a deliberate destination, ensure it does not define public tab entry behavior. Preserve image-success/retry and newer-draft guard behavior.
- **Tests affected:** CreateListing success test currently explicitly expects this Details route; ListingImageFlow finish/retry navigation; real nested navigation integration test.
- **Risk:** moderate nested-parent/back/draft behavior. **Navigation change: yes, separately authorized. Backend change: no.**

### NAV-002 — High: second tab has no reliable public-root entry policy after private Details

- **Files/lines:** `CustomTabBar.tsx:73`–`:89`; `BottomTabNavigator.tsx:20`; `ListingDetailsScreen.tsx:269`; `MyListingsScreen.tsx:75`. Installed core `useNavigationBuilder.tsx:309` and native-stack `createNativeStackNavigator.tsx:78`.
- **Expected:** tapping Listings opens public Listings root regardless of previous private Details.
- **Actual/root:** retained child state + unchanged nested params; drawer Back does not pop; cold nested navigation can omit root entirely. Native reselect guard does not fix an inactive-tab switch or index-0 Details.
- **Minimum safe correction:** define Listings-specific root selection on a deliberate bottom-tab press, avoid replaying stale Details params, and handle cold stacks explicitly. If continuing to share private Details in this stack, preserve/create a root underneath it where appropriate (`initial:false` semantics must be tested), but do not rely on that alone to reset inactive tab switches. Do not reset all tabs, discard Post drafts, remove auth guards or change public APIs.
- **Tests affected:** real (non-preview) tab switch after Create/private card/Back; both cold and already-visited stacks; root and focused reselect semantics, guest browsing and correct details ID/private read.
- **Risk:** moderate/high back/deep-link semantics if overly broad resets are used. **Navigation change: yes. Backend change: no.**

### API-003 — High, conditional: sanitized Description can be misreported as unconfirmed creation

- **Files/lines:** `createListingService.ts:173`–`:179`, `:192`; backend `CustomerListingController.php:127`, `:80`; `app/Support/ListingDescription.php:28`.
- **Expected:** a valid authoritative 201 remains confirmed when Laravel legitimately sanitizes a field.
- **Actual/root:** frontend compares every returned payload field with raw submitted value. Backend sanitizes Description before insertion and serializes stored Description. Those representations can differ.
- **Read-only reproduction:** executed the backend's pure sanitizer through Composer autoload (no application bootstrap/DB/HTTP/mutation; definition cache explicitly disabled by existing helper). `Parcel & documents` becomes `Parcel &amp; documents`; strict equality is false. `Plain description` stays identical. No customer content was used. Thus this is conditional, not a claim that every plain description fails.
- **Consequence:** backend transaction may have committed a Pending record, yet frontend throws `Listing creation could not be confirmed`, retains unknown submission guard, and skips normal invalidation/navigation. It can compound missing-listing confusion. It cannot explain a Details-success callback from **that same rejected attempt**. User's actual submitted text is unknown.
- **Minimum safe correction:** separately authorize contract-aware response confirmation for backend-normalized fields while retaining strict real ID/status/contact/account checks. Use authoritative returned record; do not weaken validation generally or fabricate records. Add 201 tests returning actual sanitized text, and verify no duplicate retry on unknown outcomes.
- **Tests affected:** createListingApi description tests currently check payload length/mapping only, not sanitized response acceptance. Existing fixture omits this transformation.
- **Risk:** moderate mutation confirmation/idempotency behavior. **Navigation change: no. Backend change: no.**

## 12. Existing test analysis and executed results

Command (unchanged existing tests):

```text
node node_modules/jest/bin/jest.js --runInBand --silent __tests__/CreateListing.test.tsx __tests__/MyListings.test.tsx __tests__/myListingsService.test.ts __tests__/createListingApi.test.ts __tests__/ListingImageFlow.test.tsx __tests__/ownListingDetails.test.ts __tests__/App.test.tsx
```

**7 suites passed; 225 tests passed; 0 failed; 0 snapshots; 81.318 seconds; final process exit 0.** Jest emitted “did not exit one second after the test run” async-cleanup warning, then exited without a forced exit. This warning is recorded, not assigned as a cause of the reported app navigation/data symptoms.

Key coverage/evidence:

- `__tests__/CreateListing.test.tsx:106` verifies account-specific My Listings/Dashboard invalidation and Pending success message.
- `:146` **asserts the current ListingsStack/ListingDetails post-success destination**, so passing is evidence of the current implementation, not acceptance of desired navigation.
- `:303` verifies active-query authoritative refresh. Newer drafts and stale logout/account/blur/unmount cases are covered.
- `__tests__/myListingsService.test.ts:48` verifies Active/Expired request mapping; `:90` rejects Completed; `:100` proves existing raw service accepts Pending filters without inventing a Completed mapping.
- `__tests__/MyListings.test.tsx:84`, `:131`, `:190`, `:216` cover tab data, pagination, account isolation and real adapter parsing.
- `__tests__/App.test.tsx:856` covers explicit public card → Details → results Back; `:1066` guest My Listings guard; `:1621` account-switch private history. No existing test completes **Create → find Pending in My Listings → Home → second tab must be public root** in real mode.
- Selected image/owner-details suites pass; this does not live-verify the user's record.

No tests, snapshots, fixtures or expectations were changed. No new test file was created. Full Jest, build and TypeScript were not required for this read-only audit and were not rerun as substitutes for live evidence.

### Installed-router diagnostic execution

Inline Node imported existing `@react-navigation/routers` (7.6.5), rehydrated a child Details route and compared it with root-then-navigate state. Exit 0; state output is in section 4. It uses only route names and no listing IDs, credentials, API calls or application-state mutation. A deprecation warning referred to the probe's object-form CommonActions call, not an application code change.

## 13. Live verification gaps and evidence boundaries

- No live POST/DELETE/status change, database query/write, login/logout, Mark as Read or image mutation performed.
- No safe existing authenticated test session/record ID was exposed to this audit; no credentials or secure tokens were retrieved. Authenticated GET was therefore not attempted. Actual user row persistence, owner, dates/status, response payload and current navigation state remain unverified.
- No phone navigation was used to manufacture the defect, because the task is strict read-only and existing screen focus may trigger read-status mutations elsewhere.
- Source, installed library behavior, pure sanitizer/router probes and existing mocked tests establish the mechanisms above. They do not prove which optional field/image branch the user took.
- A future authorized verification should inspect the already-created record with a safe authenticated owner GET, without posting another listing; capture redacted navigation state and selected tab/status; then verify the new Pending view/tab-entry regression tests after separately authorized fixes.

## 14. Integrity and scope confirmation

Only `docs/LISTING_CREATION_NAVIGATION_ROOT_CAUSE_AUDIT.md` was created. Source/config/test content was fingerprinted immediately before report writing and checked afterward: 418 files under src, tests, Android app source and existing selected configs; SHA256 `7115DCA5F65E1F06A68909ADAA6919600C3F4C619B4517487ECBF3ECAB34AFA2`. Final comparison: **UNCHANGED — all 418 protected file contents match**. Pre-existing Task 31 and earlier working-tree changes were preserved.

No code fixes, UI/colors, route/tab changes, API/service changes, listing statuses, backend, website/admin, database or migration changes. Recommendations are **not implemented**. Pending must not be made public as a workaround.
