# Listing request, acceptance and private contact: blocked integration

## Verified findings

- `ListingDetailsScreen.reviewRequest()` is a request-confirmation preparation handler, not Submit Review. It authenticates through REQUEST_LISTING, refetches authoritative listing availability, checks ownership and guards stale session responses before opening the existing dialog.
- `RequestConfirmationDialog` explicitly states that requests are not connected; Send Request is disabled and has no submission service.
- `listingDetailsService.permittedPhone()` deliberately always returns undefined. The provisional requestStatus/contact fields in UI types are not proof of a backend authorization contract.
- `ListingContactSection` does not receive actual contact values. Its future-tense acceptance copy is not evidence that acceptance is implemented.
- Backend routes/controllers and migration source were inspected read-only. No verified parcel-request submission, owner acceptance/rejection, request status or accepted-participant contact-read API was found.
- `docs/api/MOBILE_API_INTEGRATION_GUIDE.md`, Phone/contact policy and unsupported features, explicitly says no accepted-request state or another-account phone-reveal feature exists; request acceptance is unsupported. Chat/review/login/listing ownership cannot establish accepted-participant authority.
- The `post_ad_rooms` schema stores a listing and two conversation participants, not an accepted parcel request. Conversation creation must not be substituted for acceptance or used to reveal contact information.

## Implementation decision

**BLOCKED by missing backend functionality.** No request endpoint/path, request IDs, status transitions or contact access rules were invented. No application/test/backend/database changes were made for this request. No live requests, acceptance actions, contact lookups or customer mutations were performed. Prior Contact/avatar/post-create changes in the working tree are preserved.

The existing disabled Request action and fail-closed private-contact handling remain in place. The actual missing Messages dependency is not sufficient to solve this parcel-request requirement: conversation APIs already exist but do not implement acceptance.

## Minimum dependency for a future authorized implementation

An owner-approved backend contract must define:

1. Authenticated request creation against a real eligible listing, with server-derived requester/owner, documented eligibility, duplicate semantics, response identity and errors.
2. Owner-authorized request inspection and acceptance/rejection, including persistence, valid transitions, concurrency and revocation behavior.
3. Authoritative request status scoped to the current listing/account relationship.
4. A private contact response authorized by the server only for the appropriate accepted participants, with explicit permitted phone/email fields and denial behavior.
5. Exact routes, methods, payload/envelopes, privacy/cache policy and testable ownership rules. No suggested route in this document should be treated as an existing API.

The mobile owner-acceptance action, if missing from existing UI, also needs a separately approved minimal entry point. Only after those contracts/UI decisions exist can the existing Axios/session/Toast architecture be wired safely. `show_contact_info=1`, login, a conversation ID or client `callPermitted` must never bypass server authorization.

## Verification

Focused command: `node node_modules/jest/bin/jest.js --runInBand --silent __tests__/ListingDetails.test.tsx __tests__/listingDetailsService.test.ts __tests__/guestListingDetails.test.ts` — 3 suites / 36 tests passed, exit 0, 9.552 seconds. Coverage includes unsupported request action, invalid IDs, self-request/availability gates, guest login, contact stripping, refusal of fabricated permissions and stale-session responses. These passing guards do not establish a working request/acceptance integration.

Full command `node node_modules/jest/bin/jest.js --runInBand --silent`: **exit 1**, 105 passed / 2 failed / 2 existing skipped suites (109 total); 1,622 passed / 2 failed / 2 existing skipped tests (1,626 total), 304.781 seconds. Failures exceeded existing 5-second test/hook limits:

- `ChatScreen.test.tsx`: `bubbles preserve real statuses and composer uses lifecycle callbacks without fake presence`.
- `SubmitReview.test.tsx`: `dialog opens without submission; accessible selector includes explicit 0..5, initially unselected` (beforeEach timeout).

Both suites independently rerun together with `node node_modules/jest/bin/jest.js --runInBand --silent __tests__/ChatScreen.test.tsx __tests__/SubmitReview.test.tsx`: 2 suites / 27 tests passed, exit 0, 24.808 seconds. The isolated pass does not turn the original full run green or establish a precise cause of its timing failures. No skips, timeout increases, assertion changes or application fixes were applied.

Logs: `.validation/listing-request/focused.log`, `full-jest.log`, `timeout-rerun.log`.

`node node_modules/typescript/bin/tsc --noEmit`: exit 0, no diagnostics. Scoped ESLint on ListingDetailsScreen, RequestConfirmationDialog, ListingContactSection, listingDetailsService and the three focused test files: exit 0, no diagnostics. Logs: `typescript.log`, `eslint.log` in the same diagnostic folder.

LIVE REQUEST / ACCEPTANCE / PRIVATE CONTACT API: NOT VERIFIED (no verified endpoints). PHYSICAL DEVICE: NOT VERIFIED. Backend/database/website/admin and all contact privacy rules remain unchanged.
