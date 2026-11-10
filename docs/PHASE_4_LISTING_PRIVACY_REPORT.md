# Phase 4: Public listing details and protected request review

## A. Architecture inspection

Phases 1?3 are present: public startup/Home/Listings, one Root NavigationContainer with existing Drawer/Tabs/stacks, a real-session Zustand store and Keychain, in-memory typed pending actions, central requireAuth coordinator, guest Profile and private route boundaries. These were reused.

Listing IDs arrive through the existing HomeStack/ListingsStack ListingDetails params. useListingDetails uses TanStack Query, focused-screen fetching, staleTime 0 and keys scoped to listing ID plus viewer ID/guest or explicitly isolated demo mode. Existing detail loading, retry, unavailable, card navigation and Back handling remain.

A read-only inspection also covered the sibling Laravel source at ../friendie_logistics_backend:
- bootstrap/app.php registers web, console and health routes; no API routes are registered there, and routes/api.php is absent.
- routes/web.php exposes Blade/session listing details, listing creation and message-room routes.
- FrontController::listing_details selects owner phone/email into website data and returns a website view; this is not an authorized mobile contact response.
- PostAdMessageController::createMessageRoom creates a room/message and redirects. It is not an accepted listing-request workflow.
- The post_ad_rooms migration stores listing/from-user/to-user IDs and timestamps, without request acceptance status.

No verified mobile request submission, current-viewer request-status/participation or authorized-contact contract was found. The existing mobile /listings/:id contract and enum are proposed/configuration-gated, not newly verified here. No backend file was modified, no .env/database dump was read, and no web route was repurposed as an invented REST endpoint.

## B. Files created

- src/features/listings/components/ListingContactSection.tsx
- src/features/listings/components/RequestConfirmationDialog.tsx
- docs/PHASE_4_LISTING_PRIVACY_REPORT.md

## C. Files modified

- src/features/listings/screens/ListingDetailsScreen.tsx
- src/features/listings/services/listingDetailsService.ts
- __tests__/ListingDetails.test.tsx
- __tests__/guestListingDetails.test.ts
- __tests__/App.test.tsx

No navigation routes, endpoints, auth stores, dependencies, Home UI, Results UI or Laravel files were added/replaced.

## D. Guest listing details

The entire screen remains public. It displays existing public title/type, route, date, capacity/weight, category/items, price, supplied images and public traveller/rating/verification metadata. No phone or private email is rendered. Existing service mapping strips unknown fields and all guest contact/request metadata. The new contact card receives only session/busy/availability properties, never a private user or contact object.

## E. Request Now

Guest Request Now and Sign In to Request delegate REQUEST_LISTING with the actual ID to the existing guard. Register/Forgot transitions retain intent. After actual authentication, the resolver returns to the same public listing route; no request is automatically sent.

Authenticated review explicitly refetches the listing, rechecks live session/viewer identity, active availability and ownership, then opens Send Request? confirmation. A synchronous in-flight guard deduplicates rapid revalidation taps; a generation guard rejects late responses after session loss, account change or unmount. Errors keep confirmation closed and expose existing retry/request actions. Owner listings show the existing Manage Listing -> MyListings destination instead of self-request.

IMPORTANT BACKEND DEPENDENCY: no request service/accepted-submission contract exists. The confirmation truthfully states this and keeps Send Request disabled. Cancel/Android modal Back work. No POST endpoint, fake success, request ID, pending transition or accepted state was invented. Actual submission, submission-success invalidation and retry/idempotency require a verified service contract before enabling the button.

## F. Request status

The pre-existing optional none/pending/accepted/rejected/cancelled enum is a proposed client DTO, not a verified current-viewer request contract. Unknown/malformed status now falls back to undefined instead of breaking public details. Exact existing enum parsing is retained; substring/case-insensitive acceptance checks are not used.

Because ownership/participant semantics for that field are unverified, the UI shows Request status unavailable rather than claiming a raw accepted/pending record belongs to the viewer. It does not simulate pending/rejected/accepted records. Backend-authoritative status-specific UI remains blocked until its actual values and current-viewer semantics are supplied.

## G. Contact privacy

Guest, checking, authenticated-without-proof, raw pending/rejected/cancelled/unknown/accepted and unrelated viewers remain locked. Existing permittedPhone remains fail-closed and real detail responses strip phone/call-permission fields. No number is obtained from a public profile/cache, navigation params, AsyncStorage or analytics. No optimistic unlock exists.

The contact card explains protection in accessible text. No new Call/WhatsApp action is enabled because no authorized number or approved WhatsApp capability was found. Existing call controls remain disabled. App phase-3 expiry/logout/account-switch cleanup and query scoping remain effective.

## H. Authorized contact

Secure contact unlocking is UNAVAILABLE in the inspected backend/mobile contracts. The website's owner phone/email fields and message-room existence do not prove an accepted request or viewer authorization. There is intentionally no positive contact renderer or fake authorized-contact API branch. An accepted status without backend-authorized contact and participant proof cannot unlock anything.

## I. Navigation

Existing REQUEST_LISTING target/resumeAction is reused. The screen now consumes a request resume only when the authenticated listing is available, revalidates it and opens explicit review. Native navigation retains the same listing route key in integration tests, avoids duplicate AuthStack/ListingDetails routes and preserves the source Home/Results stack. Cancel Login returns to the original public Details. Cancel review closes only the modal. Existing Search filters/list pagination are untouched.

## J. Cache and logout

No new private authorization query or persistent contact cache was created because there is no verified source. Existing member detail cache keys remain viewer-scoped and guest responses exclude private request/contact metadata. Contact UI never reads raw phone fields. Phase 3 clears private caches/drafts/history on logout, expiry and account switch. Review confirmation is dismissed on session/viewer changes; stale revalidation cannot reopen it. Focus refetch and request-time explicit refetch reuse the existing TanStack Query behavior; no polling/WebSockets were added.

## K. Validation

- npm run typecheck: PASS on the final source.
- npm run lint: PASS, no errors or warnings.
- npm test -- --runInBand --silent --testTimeout=30000: PASS, 53 suites / 362 tests, 97.772 seconds.
- Focused listing/privacy run: 3 suites / 29 tests PASS before the final additional private-email/offline assertions.
- Focused real-router Phase 4 return/confirmation test: PASS (1 executed, other cases intentionally filtered in that run); the same flow also passes in the full suite.
- Full suite includes public phone/email stripping, all proposed/raw/unknown status cases staying locked, guest guard, revalidation deduplication, offline/expiry races, owner management and unchanged auth/tab/drawer/logout behavior.
- Android ARM64 release: PASS, .\gradlew.bat app:assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain (android directory). BUILD SUCCESSFUL in 4m 12s; 711 tasks, 21 executed / 690 up-to-date.
- apksigner verify --verbose: PASS, APK Signature Scheme v2. Existing signing configuration is unchanged; production-store signing readiness was not established.
- Source-map verification confirms final locked-contact component, scrollable unavailable confirmation and REQUEST_LISTING generation guard are bundled.
- APK: android/app/build/outputs/apk/release/friendie-phase4-public-details.apk; 40012558 bytes; also app-release.apk.
- SHA-256: f6d395a733e41653a7a8f15227e0cae00957d43b6a879f9b021b7addd1248e74
- No live backend request, accepted-contact disclosure, native calling/WhatsApp or physical-device success is claimed. A positive authorized-contact test is unavailable until the backend contract exists.

## L. Phase 5 readiness

Required integrations: approved mobile public-detail DTO/endpoint; authenticated request creation and duplicate/idempotency behavior; exact per-viewer request statuses; participant/ownership proof; backend-authorized contact response; allowed phone/WhatsApp rules; success invalidation and notification-driven request refresh. Backend work remains outside this task.

Regression coverage must keep raw accepted-for-another-viewer and accepted-without-contact locked, test a genuinely authorized response only after a contract exists, and validate live expiry/offline/revocation, request retries, accessibility/font scaling and native gestures on devices. Phase 5 architecture/testing overhaul was not implemented here.
