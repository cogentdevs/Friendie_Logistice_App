# Task 13 ? Submit Review API integration

Status: **Implemented following explicit UI authorization**. The previously missing review entry point is now the authorized Write a review button and minimal rating/text dialog. Existing read feeds, parcel-request workflow and messaging remain intact.

## A. Verified backend contract

Inspected read-only in the existing sibling Laravel project:

- `routes/api.php`: protected customer review POST route.
- `app/Http/Controllers/Api/V1/CustomerReviewController.php`: store, query, data, given and received.
- `app/Queries/Api/PublicListingQuery.php`: actual public-listing eligibility.
- `app/Support/ApiResponse.php`: success/error envelopes.

Endpoint: **POST /api/v1/customer/reviews**. JSON, Sanctum Bearer token, eligible mobile customer middleware. Reuse the existing environment-aware Axios client; no hardcoded host.

Only these required request fields are accepted:

```ts
{
  post_ads_id: number; // integer 1..2147483647, verified backend listing
  rating: number;      // integer 0..5, explicitly selected by the customer
  review: string;      // required, non-whitespace, no NUL
}
```

Unknown fields are rejected. No maximum review-text length is specified in this controller; the comment explicitly retains LONGTEXT rather than inventing a business cap. Do not copy the Send Message 10000-character limit. HTTP/server body limits are not a verified review business rule. Half stars are not supported. Zero is valid, but the frontend must still require an explicit selection rather than defaulting an untouched form to zero.

Verified eligibility and rejection behavior:

- The reviewer must remain an active, verified customer with a valid current token; transaction checks reject invalid authentication/eligibility.
- Target must exist and satisfy the public query: listing isActive=1, departure_on at least today's date, active category, and existing joined owner/category/country/city records. Missing/ineligible target returns 404.
- Self-review is rejected with Laravel field validation error on post_ads_id (422): “You cannot review your own listing.”
- The recipient is the listing owner. No caller-supplied recipient ID is accepted.
- One review per reviewer/listing: an existing matching record produces **409**, not a reused success or update. Eligibility is checked before duplicate detection.
- There is **no accepted-request, completed-transaction or conversation requirement** in the inspected submission path. Do not add one on the frontend or repurpose parcel-request workflows.
- Rate limit: 10 attempts per 900 seconds, per account and IP, with Retry-After on 429. Validation/rejected attempts enter the limiter too.
- Insert is direct; no moderation/approval flag or moderation transition exists in this controller/serializer. Given Reviews reads these rows directly in descending review-ID order using existing joins. Do not invent an approval state or promise a locally inserted record; refetch authoritatively.
- No idempotency-key interface is exposed. Duplicate detection must not be advertised as a universal exactly-once delivery guarantee.

Success: HTTP **201**:

```ts
{
  success: true;
  message: string; // Review submitted successfully.
  data: {
    id: number;
    listing: { id: number; title: string | null };
    reviewer: { id: number; display_name: string | null };
    reviewed_customer: { id: number; display_name: string | null };
    rating: number; // integer 0..5
    review: string;
    date_time: string;
    created_at: string;
    updated_at: string;
  };
}
```

Dates/text are written by the backend on creation. Existing read DTOs also support nullable historical review/date fields. No avatar, review status, average rating, approval flag or review total is returned. Shared error envelope is `{success:false,message,errors?}`; 422 uses field errors. Duplicate 409 message is “You have already reviewed this listing.” Existing normalized authentication, permission, rate-limit, server and network errors must remain authoritative.

## B. Authorized UI and authentication flow

- Existing Public Listing Details now has one secondary **Write a review** button, using the existing AppButton. It opens the new minimal SubmitReviewDialog.
- The dialog uses existing Friendie typography, colors, spacing, radius, AppInput/AppButton and safe-area/keyboard/scroll patterns. Rating choices are explicit accessible radio controls for integers 0,1,2,3,4,5. Initial/unselected rating is null; zero is never confused with missing input. Review input is required and multiline. Submit and Cancel are explicit actions.
- The button is disabled for fixture/unverified targets, fetch-in-progress and the current owner's own public listing. It is not added to Own Listing Details reached from My Listings.
- Guest actions use the existing auth coordinator with the narrow SUBMIT_REVIEW pending action. Login resumes the same Listing Details with resumeAction review, opening the form only. No review is automatically submitted.
- Demo/fixture sessions cannot submit. Task 12's isVerifiedPublicListing provenance protects the actual remote object and original ID; numeric IDs, clones and unverified navigation values do not establish a real target.
- Existing reviewRequest() remains the separate parcel-request confirmation workflow. No Submit Review behavior was attached to it. Existing message action/dialog, review cards, tabs, routes, Bottom Tabs and Drawer remain unchanged.

## C. Implementation and files

New production files:

- src/features/reviews/services/submitReviewService.ts ? typed draft/request/response, backend-compatible validation, shared review DTO parser, authenticated Axios submission and mutation coordination.
- src/features/reviews/hooks/useSubmitReview.ts ? dialog lifecycle, explicit submit handling, draft protection, current-session checks, Given invalidation and Toast feedback.
- src/features/reviews/components/SubmitReviewDialog.tsx ? authorized input dialog only.

Modified production files:

- src/services/api/endpoints.ts ? submitReview: /customer/reviews.
- src/features/auth/types/pendingAction.types.ts ? narrow protected action.
- src/features/auth/services/authActionResolver.ts ? return to review entry without submitting.
- src/navigation/navigationTypes.ts ? review resume-action type for existing Listing Details routes; no new route/stack.
- src/features/listings/screens/ListingDetailsScreen.tsx ? button, dialog and resume wiring.

Tests/fixture:

- __tests__/submitReviewApi.test.ts ? new contract/validation/authentication/uncertainty cases.
- __tests__/SubmitReview.test.tsx ? new controller/dialog/cache/lifecycle cases.
- __tests__/ListingDetails.test.tsx ? two additional real-button/fixture-safety cases; existing tests retained.
- test/fixtures/submittedReview.ts ? source-compatible authoritative response fixture, including valid rating zero.

This report was updated. No dependency, Axios implementation, auth-store implementation, secure-storage implementation or existing read-service contract was changed.

The HTTP body is constructed explicitly with only post_ads_id, rating and review. Original user text is preserved; no arbitrary maximum, default rating, reviewer ID, recipient ID, status, timestamp or idempotency key is sent. The verified listing ID is captured before asynchronous token access, so later object mutation cannot redirect a request. Response parsing reuses the existing CustomerReviewController serializer schema and validates HTTP 201, listing identity, current reviewer, non-self recipient, actual selected rating and nonempty returned review. No review is fabricated or optimistically added.

## D. Submission and account safety

- Synchronous local in-flight guard plus session/listing-scoped service coordination prevents double taps, multiple handlers and repeat POSTs. Only an explicit Submit invokes the mutation; no render/focus/Login effect POSTs.
- Rating/text remain until server confirmation. Submit captures a snapshot; newer edits are not cleared when an older submission succeeds. Cancel before submit makes no request. Cancel/blur/unmount during submission aborts and ignores stale completions.
- A live auth-object/status check before the controller calls the service prevents a stale callback from submitting a previous customer's draft as the next account. The service additionally checks the same session, token and abort signal around asynchronous work.
- Missing secure token uses existing current-token cleanup. Authorization failures respect the existing interceptor/session policy. No fake Bearer token or duplicate persistence mechanism.
- Known 400/401/403/404/422/429 rejection allows correction/retry. Duplicate 409 is a rejection, not fabricated success, and prevents another submission to the already-reviewed listing.
- Timeout/network/5xx/invalid-response/cancel-after-dispatch outcomes are uncertain: retain the exact draft, show a warning when the form is still current, and hold repeat submission. Remounting the dialog does not silently release the hold. Do not guess a review ID or infer absence from a partial Given page.
- Confirmed/duplicate states also prevent accidental repeat submissions in that session. There is no automatic retry and no exactly-once guarantee is claimed.
- Mutation coordination uses a session-keyed WeakMap, not a second reviews data store. Logout/account switching explicitly deletes the previous session's entries through the existing auth-store subscription pattern. Local form state clears on account/listing change. Uncertain drafts can be recovered on reopening for the same session/listing.
- Drafts/uncertainty holds are memory-only, not persisted across process restart; no automatic restart submission exists. Laravel's duplicate rejection remains authoritative. Ordinary unsaved/explicitly rejected input is retained in the mounted form, not a new persistent draft system.
- Passwords, tokens and review bodies are not logged.

## E. Given/Received Reviews and Dashboard synchronization

After confirmed 201, cancel stale reads and invalidate only **[reviews.authored, user:<id>]** using the existing reviewKeys helper, with active authoritative refetch. Existing infinite-query page parameters/order/totals/deduplication remain responsible for the result. Inactive Given data is stale for the next view. No local review record or fabricated total is inserted.

Tests exercise an active existing Given read hook/service returning the backend review record and pagination after submission. They also prove the submitting customer's Received cache and Dashboard reviews_received stay unchanged.

Do not use the broad invalidateReviews helper here: it invalidates Received and summary too. Received Reviews and Dashboard visitor preview retain their normal account-scoped lifecycle. No manual Received count, average rating, unread count or Dashboard statistic arithmetic was added. Another account's cache is never updated.

## F. Notifications and errors

Only the existing **react-native-toast-message** root/configuration and Toast.show are used. No new library, notification popup, Alert, ToastAndroid or Snackbar.

- Confirmed success: success Toast, submitted inputs clear only when unchanged.
- Validation/permission/unavailable/rate-limit errors: safe error/rejection feedback, draft preserved. Raw backend exception strings are not displayed.
- Duplicate 409: rejected Toast; no success record/count.
- Uncertain delivery: warning, saved draft and blocked retry; no claim of definite failure.
- A cache-refresh exception after confirmed persistence reports **Review submitted; refresh Your Reviews**, rather than falsely claiming submission failed.
- Session/navigation changes suppress stale notifications and private-state updates. No navigation away is introduced on success.

## G. Verification

Evidence is retained under .validation/task13, including Jest JSON, complete console logs, exit-code files, source hashes and a working-tree baseline. Existing local modifications were preserved; no reset, branch change or commit. HEAD remains d375d3645d38041f53ef529f8fa2465b05fca273.

Focused command:

~~~powershell
npx jest __tests__/submitReviewApi.test.ts __tests__/SubmitReview.test.tsx __tests__/ListingDetails.test.tsx --runInBand --testTimeout=60000 --json --outputFile=.validation/task13/focused-final.json
~~~

**3 suites / 91 tests PASS, exit 0** (focused-final.log/json). Includes all six accepted ratings, unselected/invalid rating, whitespace/NUL, no invented length cap, exact actual Axios adapter request, provenance, self/guest/demo restrictions, double submission, statuses, response validation, stale callbacks, logout, account/token switching, cancellation, unknown-draft restoration, Given refresh, Received/Dashboard isolation and the actual Listing Details action.

Selected regression command:

~~~powershell
npx jest --runInBand --testTimeout=60000 --testPathPattern='(Review|review|ProfileDashboard|Login|loginService|logout|sessionLogout|authFlow|auth.test|ListingDetails|Inbox|inboxService|Chat|chatService|Conversation|sendMessageApi|markReadApi)' --json --outputFile=.validation/task13/regression-final.json
~~~

**Final selected regression: 34 suites / 513 tests PASS, 0 FAIL, exit 0; 39.5 seconds** (regression-final.log/json/exit.txt). This includes Given/Received, Dashboard, authentication, Public Listing Details, existing Create/Reuse, history, Send and Mark as Read.

Full delivery command:

~~~powershell
npx jest --runInBand --testTimeout=60000 --json --outputFile=.validation/task13/delivery.json
~~~

**Final frozen-source delivery: 86 suites total, 84 PASS / 2 existing SKIP / 0 FAIL; 1033 tests total, 1031 PASS / 2 existing SKIP / 0 FAIL; exit 0; 163.618 seconds** (delivery.log/json/exit.txt). Earlier complete full run (full.json): **86 suites total, 84 pass / 2 existing skip / 0 fail; 1033 tests total, 1031 pass / 2 existing skip / 0 fail; exit 0; 343.938 seconds**. Counts increased from Task 12 by 75 tests: 50 service, 23 controller/dialog and 2 Listing Details tests. No test was deleted or newly skipped.

Static/build commands:

- npx tsc --noEmit ? **exit 0**, typecheck.log/exit.txt.
- npx eslint over all eight changed/new production files, the three changed/new test files and new fixture listed above ? **exit 0**, eslint.log/exit.txt; no warning/error output.
- From android: .\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain ? **BUILD SUCCESSFUL, exit 0, 5m 44s, 407 tasks (16 executed, 391 up-to-date)**; android.log/exit.txt. No device installation/control.

Intermediate diagnostics are retained, including UI harness failures caused by immediate test-cache garbage collection / invoking a pre-rerender callback, and an intermediate response-property refactor mistake. These were corrected and are not reported as final passing runs. Existing tests were not weakened to hide them. Existing React act/Gradle deprecation warnings are not suppressed.

## H. Live verification and limitations

A read-only public connectivity check used the existing configured API base URL and a 5-second timeout. It **timed out** (connectivity.json). No live review POST or duplicate live review was submitted. No valid test credentials were supplied.

**LIVE AUTHENTICATED API: NOT VERIFIED**

**PHYSICAL DEVICE: NOT VERIFIED**

Real 201/409 behavior, live Given visibility and Android dialog/keyboard rendering remain to be checked with a reachable backend/test account and device. Automated keyboard/accessibility checks verify component wiring, not physical-device behavior. Static-testing listings remain local and cannot submit. Backend eligibility/review constraints are verified from source, not inferred from a successful authenticated live request. No implementation blocker remains from the earlier missing UI; that interface is now authorized and implemented.

## I. Scope confirmation

No Laravel/backend/website/admin/database/table/column/migration changes. No unrelated API integrations or changes to existing review-read, Dashboard, auth, listing, message or contact-privacy contracts. Only the explicitly authorized review button/dialog and necessary functional/authentication wiring were added. Existing fonts/theme/card/Chat/Drawer/Bottom Tab design and navigation structure remain unchanged. Parcel request reviewRequest(), Send Message, Create/Reuse and Mark as Read remain separate and untouched.
