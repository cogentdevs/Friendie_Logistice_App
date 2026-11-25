# Phase 4C — Requests and deals

25 November 2026. Supported Deal API workflow implemented; listing-level availability has the contract limitation below.

- Existing Listing Details request dialog selects the caller's complementary Published listing with the identical directional country/city IDs. A public detail read verifies eligibility/ownership before submission. Fixture IDs cannot pass the remote-record provenance check. Whole sender weight supplies `requested_kg`; capacity is never calculated locally.
- Added account-protected Incoming Requests, Outgoing Requests and Deal Details to the existing drawer. Incoming/outgoing are classified by `initiated_by`, not sender/carrier identity. The API has no direction filter, so filtering covers loaded pages with explicit Load More. IDs are deduplicated.
- Create uses `POST /customer/deals` (201). Accept/reject/confirm/cancel use empty `POST /customer/deals/{id}/{action}` (200); only returned `allowed_actions` appear. Deal status, acceptance expiry, Available/Not Available and remaining KG use backend fields. Focused request screens refresh every 30 seconds and support manual refresh; no background tracking or notifications.
- Session/token checks, cancellation, account-scoped queries and synchronous mutation guards protect private data and prevent concurrent POSTs. No automatic POST retries. Ambiguous create outcomes remain blocked in memory for that session/pair; users must inspect Outgoing Requests. A fresh authoritative Deal GET can resolve an uncertain action before another deliberate action. No exactly-once guarantee across process restarts is claimed.
- Confirmed mutations cancel stale reads and invalidate current-account request/owner-listing caches and affected public listing/Home caches. Dashboard unread/review counts, contact permissions and coordinates are not altered or exposed.

## Changed files in this task

New: `src/features/deals/dealsService.ts`, `src/features/deals/DealScreens.tsx`, `__tests__/deals.test.ts`, `__tests__/DealScreens.test.tsx`, this report.

Modified: `src/features/listings/components/RequestConfirmationDialog.tsx`, `src/features/listings/screens/ListingDetailsScreen.tsx`, `src/features/listings/services/publicListingsService.ts`, `src/services/api/endpoints.ts`, `src/navigation/navigationTypes.ts`, `src/navigation/DrawerNavigator.tsx`, `src/navigation/components/CustomDrawerContent.tsx`, `src/features/auth/types/pendingAction.types.ts`.

Earlier Home/login/avatar changes were present before this task and are preserved.

## Verification

- Focused Jest: `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath __tests__/deals.test.ts __tests__/DealScreens.test.tsx __tests__/ListingDetails.test.tsx __tests__/authFlow.test.ts __tests__/sessionLogout.test.ts` — 5 suites, 89 tests PASS, exit 0, 13.791s. Log: `.validation/phase4c-focused-final.log`.
- TypeScript: `node node_modules/typescript/bin/tsc --noEmit --incremental false` — exit 0. Scoped ESLint on the changed source/test files — exit 0. Logs: `.validation/phase4c-types-final.log`, `phase4c-lint-final.log`.
- Configured original local database: metadata SELECT confirms `listing_deals` exists; unauthenticated localhost Deal GET returns 401. No original database mutations or migrations.
- Existing `LocalTestSafety` verified restricted isolated database grants, including original-schema access denial. Temporary localhost listener: 13 real HTTP checks PASS (guest 401, participant privacy/404, create, duplicate 409, accept authorization/hold/idempotency, confirm, cancel, reverse-initiator request, reject, zero-KG 422). Logs: `.validation/phase4c-local-http.log`, `phase4c-availability.log`, `phase4c-original-route.log`. Native mobile transport/device rendering was not tested; these HTTP checks used a Node diagnostic client, with mobile services covered by Jest.
- Isolated fixtures/tokens removed and listener stopped; private manifest absent. Cleanup exit 0 (`phase4c-local-cleanup.log`). Runtime diagnostics are ignored under `.validation`.
- No full Jest or Android build requested/run for this task. No backend source, original database data, schema, dependency, native configuration, delivery/history/notifications/review changes.

## Remaining API limitation

`PublicData::listing` and customer listing serializers do not expose Deal capacity or availability. No per-listing availability/eligible-pair endpoint is documented. Therefore listing-wide pre-submit capacity badges/disablement for *every* listing cannot be implemented authoritatively. Deal screens show actual availability and honor allowed actions; the server checks capacity under locks on submission and returns conflicts safely. The frontend does not label unknown availability as Available or infer it from a partial deal list. Full listing-wide availability requires an additive backend contract supplied separately; backend changes were not made.
