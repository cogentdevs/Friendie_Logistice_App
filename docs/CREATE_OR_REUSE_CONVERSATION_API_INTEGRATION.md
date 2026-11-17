# Task 12 revised — Public Listings and Create/Reuse Conversation

## Outcome and previous blockers

Implemented the authorized frontend flow. Public Listings and public Listing Details now use the verified Laravel contracts on the non-static path. The existing Message traveller icon opens one new themed initial-message input dialog. No default message or guessed conversation ID is used.

The earlier blockers were resolved by the revised authorization: real public listing reads, an explicit initial-message entry interface, and a verified distinction between creation (201) and reuse (200). Existing Chat draft conflicts are preserved rather than overwritten.

## Verified backend contracts

Read-only authoritative sources in the sibling `friendie_logistics_backend`:

- `routes/api.php`: public listings and protected customer conversation routes.
- `app/Http/Controllers/Api/V1/ListingController.php`: index/show request rules.
- `app/Queries/Api/PublicListingQuery.php`: public eligibility, filters and ordering.
- `app/Support/Api/PublicData.php`: listing serialization and pagination.
- `app/Support/ApiResponse.php`: success/error envelope.
- `app/Http/Controllers/Api/V1/CustomerChatController.php`: store, messageRules, metadata, room and customer/token checks.

### Public reads

- `GET /api/v1/listings` and `GET /api/v1/listings/{id}`.
- Public requests explicitly use `Authorization: false`, so existing Axios interceptors do not attach real or demo tokens.
- List response: `{success:true, message, data:{items:[...], pagination:{current_page,per_page,total,last_page}}}`.
- Detail response: `{success:true, message, data:{...listing,description}}`.
- Documented fields: id, ad_type, title, short_description, image_url, category{id,name}, origin/destination{country_id,country,city_id,city}, weight, weight_price, currency, departure_on, reached_on, is_featured, created_at, owner{id,display_name,image_url}; detail adds description. Nullable fields are validated as such.
- `Carring` maps to Carry Parcel and `Send` to Send Parcel. Unknown types reject the response instead of being misclassified.
- ID is preserved; nullable price/currency stays null and displays the existing unavailable wording. Names/locations come only from returned labels. No phone, email, conversation ID, verification badge, or rating is invented. Extra private fields are discarded by explicit normalization.
- Public eligibility is enforced by Laravel's published/active public query. The existing detail UI's active state is derived from this verified query, not a new status transition.
- Supported server parameters are search, category_id, from_country_id, to_country_id, from_city_id, to_city_id, ad_type, weight, departure_on, sort, page and per_page. Existing UI filters map to documented keys only. The existing UI has no sort selector; Laravel's default latest ordering is preserved. Page size is 20; backend limit is 50.
- Country/city filters require real IDs. Exact date maps to departure_on; type maps to the actual backend enum. Radius/GPS distance, date ranges, verified-only, available-now and free-text legacy origin/destination filters have no equivalent verified API contract. These fail clearly before a request rather than silently returning a broader or incorrect result. The old structured-parameter helper remains a compatibility utility, but the real network path never uses its proposed keys.

### Create/reuse mutation

`POST /api/v1/customer/conversations`, Sanctum Bearer authentication, JSON body containing only:

```json
{"post_ads_id":123,"message":"Actual user-entered content"}
```

The number above illustrates the shape only; the implementation always uses the fetched listing ID. Listing ID is a positive 32-bit integer. Message validation reuses the existing Send Message validator: nonempty/non-whitespace string, maximum 10000 Unicode codepoints and 65535 UTF-8 bytes, no NUL, no silent trimming/truncation. Backend rejects unknown fields.

Both success statuses return:

```ts
{
  success: true;
  message: string;
  data: {
    id: number;
    listing: { id: number; title: string | null };
    other_participant: { id: number; display_name: string | null };
    created_at: string | null;
  };
}
```

The existing Conversation Details response schema is reused. Returned listing identity must match the requested verified listing; `data.id` is the authoritative conversation ID.

- **201:** new conversation, initial message persisted by Laravel. No Send Message POST follows. No local bubble is fabricated. Existing Chat GET history displays the authoritative record.
- **200:** existing conversation, supplied initial message NOT persisted. The input is handed to the existing account/conversation-scoped Chat draft store. Only an explicit later press of the existing Chat Send button sends it.
- If Chat already has a different draft or uncertain send, that draft is not overwritten. The initial draft stays saved in the initial-message dialog; a warning directs the customer to review the existing Chat draft. No automatic second POST occurs. Cancel and Inbox navigation remain available.
- Own-listing initiation is rejected by Laravel (422); absent/ineligible targets return 404. New rooms require a public listing with future departure. Existing reuse matching and ownership remain entirely backend-controlled.
- Existing middleware/transaction validates active verified customer, current token and participant access. Shared rate limit is 60/minute per account/IP with Retry-After. No idempotency-key contract is invented.

## Existing UI and listing-origin safety

- Existing Listings screen/cards, filters, route structure and guest browsing remain in place. Real list IDs reach the existing Listing Details route, which fetches that exact backend record.
- Only detail objects produced by the validated remote detail reader are registered in a module-private WeakMap with their original backend ID. Numeric fixture IDs, caller flags, clones, altered IDs and private owner-detail objects do not pass this provenance check.
- Query structural sharing is disabled for detail reads so provenance survives cache publication. No second listing/profile cache or Axios client was introduced.
- Existing explicit static marketplace configuration is preserved, including development/static-testing builds. In that configured mode browsing still uses fixtures and its prior demo behavior; these records cannot initiate this protected mutation. Turning off the existing static mode uses the real public path. Normal release remains non-static. This task does not silently convert the configured static debug catalogue into real records.
- The new dialog uses existing AppText/AppInput/AppButton/theme components, a multiline field, Send/Cancel, accessible title/input, safe-area container, scrolling and keyboard avoidance. Main screen/card/avatar/composer styles are unchanged.
- The existing Listings error area now displays safe validation feedback for unsupported filters. The existing messaging-unavailable caption is suppressed for a verified remote target so it does not contradict the now-enabled action. Phone disclosure and request-acceptance workflows remain protected and unchanged.

## Authentication, lifecycle and draft handling

- Guest Message action uses the existing authentication coordinator with a narrowly added START_CONVERSATION pending action. Login resumes Listing Details with `resumeAction: message`, opening entry only after data is available; it never sends automatically.
- Demo UI preview and fixture targets cannot call the protected endpoint. Real requests require a current secure token; missing-token cleanup follows the existing storage/auth pattern.
- Existing Chat draft store is reused with an account-scoped `initial:<listing ID>` thread key for the initial input and the real conversation key for reuse handoff. Logout/account-switch cleanup already clears these drafts.
- A synchronous session/listing in-flight guard blocks concurrent POSTs. React renders, focus events and authentication callbacks never submit.
- Network, timeout, server or invalid-response outcomes after submission are held as unknown. Draft remains; automatic retries and repeat sends are blocked for that session/listing, including after closing/remounting the dialog. The user is directed to authoritative Inbox inspection; no participant-based conversation guessing is performed. No exactly-once delivery guarantee is claimed, and unresolved state is in-memory, not persisted across process restart.
- Explicit known rejection statuses release the guard for correction/retry. Mutation requests are never automatically retried.
- Abort/generation/user-object/token checks prevent late results after logout, account switch, cancellation, listing change, blur or unmount from navigating or publishing private state.
- A successful result is retained in the mounted controller when navigation is temporarily unavailable or a draft conflict exists; continuing does not repeat the POST.

## Cache and existing Messages integration

- Confirmed results cancel older Inbox reads and invalidate `['messages.inbox',accountId]` for authoritative active refresh/next-view fetch.
- Existing conversation metadata/history keys for the returned room are canceled and marked stale without guessed insertion. The existing Chat readers perform the GETs on entry, including when the reused room had a fresh cached history. Existing history pagination and ID deduplication remain in their own implementation.
- No Inbox records, timestamps, message IDs, participant data or unread counts are fabricated.
- Dashboard unread/statistic data remains authoritative and untouched. No additional Dashboard API request or manual unread arithmetic was added.
- Existing Send Message and Mark as Read services/hooks were not modified. No automatic read request is added by this controller; the established active Chat lifecycle remains responsible.

## Error and notification behavior

Only existing `react-native-toast-message` is used. No new notification root, package, style or system. Validation/actionable failures use error feedback; unknown delivery and existing-draft conflicts use warnings. Server details are not exposed through generic failure feedback. No automatic success Toast or false sent bubble. Cancel before Send makes no API request. Cancel during submission aborts/ignores its completion and preserves the draft.

## Files changed for revised Task 12

New production files:

- src/features/listings/services/publicListingsService.ts
- src/features/listings/components/InitialMessageDialog.tsx
- src/features/messages/services/createConversationService.ts
- src/features/messages/hooks/useInitialConversation.ts

Modified production files:

- src/features/listings/services/listingsService.ts
- src/features/listings/services/listingDetailsService.ts
- src/features/listings/hooks/useListingDetails.ts
- src/features/listings/components/ListingCard.tsx (nullable price fallback only)
- src/features/listings/screens/ListingDetailsScreen.tsx
- src/features/listings/screens/ListingsScreen.tsx (existing error area displays safe unsupported-filter feedback)
- src/features/auth/types/pendingAction.types.ts
- src/features/auth/services/authActionResolver.ts
- src/navigation/navigationTypes.ts (resume action type only)

New tests/fixture:

- __tests__/createConversationApi.test.ts
- __tests__/InitialConversation.test.tsx
- test/fixtures/publicListing.ts

Existing contract tests updated:

- __tests__/ListingDetails.test.tsx (real button integration coverage added)
- __tests__/guestListingDetails.test.ts (actual public DTO, all privacy assertions retained)
- __tests__/listingDetailsService.test.ts (verified public endpoint replaces obsolete blocked-gate expectation)
- __tests__/listingDemo.test.ts (explicit non-static remote lookup, not fixture fallback)
- __tests__/searchRequest.test.ts (verified public request replaces obsolete unavailable-gate assertion)
- __tests__/homeService.test.ts (documented country/weight keys replace obsolete unsupported-contract assertion)

This report was updated. Other pre-existing working-tree changes were preserved. Branch main, HEAD d375d3645d38041f53ef529f8fa2465b05fca273; no commit/reset/checkout. Comparison against Task 11's hash baseline is saved in `.validation/task12/integrity-changes.json`.

## Verification

Logs, Jest JSON and exit files are under `.validation/task12`.

- Focused command: `npx jest __tests__/createConversationApi.test.ts __tests__/InitialConversation.test.tsx __tests__/ListingDetails.test.tsx --runInBand --testTimeout=60000 --json --outputFile=.validation/task12/new-focused.json`.
- Focused result: 3 suites / 62 tests PASS, exit 0. Includes real button integration, 201/200, actual Axios adapter/header/body, guest gate, draft conflicts, cancellation, unknown outcome, duplicate prevention and session safety.
- Earlier expanded focused contract selection: 7 suites / 75 tests PASS, exit 0 (`focused.json`).
- Selected regression command: `npx jest --runInBand --testTimeout=60000 --testPathPattern='(Inbox|inboxService|ChatReadScreen|ChatSend|MarkConversationRead|markReadApi|sendMessageApi|chatService|Login|loginService|logoutApi|sessionLogout|authFlow|auth.test|ProfileDashboard|Listings.test|listingDetailsService|guestListingDetails|staticMarketplace)' --json --outputFile=.validation/task12/regression.json`.
- Selected regression: 21 suites / 296 tests PASS, exit 0. Jest printed a delayed-exit warning and subsequently exited naturally; no forceExit or suppression was used.
- Full-suite delivery command: `npx jest --runInBand --testTimeout=60000 --json --outputFile=.validation/task12/delivery.json`. **84 suites total: 82 PASS, 2 existing SKIP, 0 FAIL. 958 tests total: 956 PASS, 2 existing SKIP, 0 FAIL; exit 0; 163.869 seconds.**
- Test inventory increased from 911 to 958: 33 new API tests, 13 new controller/dialog tests, and one actual Listing Details button test. No test was deleted or skipped. Existing contract scenarios were corrected, not removed.
- TypeScript: `npx tsc --noEmit`, exit 0 (typecheck.log).
- Scoped ESLint: `npx eslint` over all 13 changed production files, the eight changed/new test files and new fixture, exit 0. Final log/exit recorded after the final source review.
- Android command, from android: `.\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain`. Final build **SUCCESS**, exit 0, 1m 39s, 407 tasks (16 executed, 391 up-to-date); evidence `android-delivery.log` / `android-delivery.exit.txt`. No installation/device control.
- Initial full runs exposed obsolete proposed-contract tests and a real button-handler wiring omission. These were corrected without deleting/skipping tests. Intermediate logs are retained (`full-initial`, `full`) rather than hidden.

## Live verification and limitations

Public read check used the existing configured base URL and a 5-second timeout; it timed out (`public-live.json`). No successful live public read was claimed. No real credentials supplied; no message mutation was attempted against the server.

**LIVE AUTHENTICATED API: NOT VERIFIED**

**PHYSICAL DEVICE: NOT VERIFIED**

Android dialog rendering/keyboard behavior and real 201/200 delivery still require reachable backend/test-account and device checks. Unsupported radius/range filters remain an explicit backend capability limitation, not silently approximated. Existing static mode remains local. Ambiguous delivery requires manual Inbox inspection; no unsafe automatic reconciliation/resend is implemented. Existing unrelated React act/Gradle deprecation warnings are not suppressed.

## Scope confirmation

No Laravel/backend/website/admin/database/schema/migration changes. No new backend endpoint or contract modification. No unrelated API integration. No main screen/card/Chat/Inbox/Dashboard redesign or navigation restructuring. The only added visible input UI is the authorized initial-message dialog. Existing Toast design, authentication lifecycle, phone privacy, Send Message, Mark as Read and Dashboard counter logic remain unchanged.
