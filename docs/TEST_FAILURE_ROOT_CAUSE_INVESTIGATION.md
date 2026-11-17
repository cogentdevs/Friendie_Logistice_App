# Task 10: full-suite failure investigation

Analysis only. No application, test, configuration, dependency or snapshot fixes
were applied. All commands ran against the existing workspace. Diagnostic outputs
are under `.validation/task10/`; existing implementation reports were read as
historical context, not accepted as current proof.

## Independently reproduced full run

Actual runner: installed Jest **29.7.0**, Node **v24.13.0**, React Native preset, React Test Renderer,
React Navigation, Zustand and TanStack Query. `package.json` has `test: jest`.
The previous report does not print a literal full command; its saved task execution
used `npx jest --runInBand --testTimeout=60000`. The same full-suite selection and
execution mode were rerun with JSON reporting added:

```powershell
npx jest --runInBand --testTimeout=60000 --json --outputFile=.validation/task10/full-results.json > .validation/task10/full.log 2>&1
```

Exit **1**, elapsed **309.375 seconds**:

| Result | Suites | Tests |
| --- | ---: | ---: |
| Passed | 76 | 887 |
| Failed | 4 | 16 |
| Skipped | 2 | 2 |
| Total | 82 | 905 |

The exact same 16 failing test names were reproduced. The previous full-run total
was 903; that report explicitly precedes final Task 9 test refinements. Current
905 is the independently observed total, not a claim that the older total was
rerun unchanged. Complete error output and stack traces are preserved in
`full.log` and `full-results.json`; `failure-index.json` provides a compact index.

## Isolation and reproducibility

Each suite was run independently, twice, in fresh Jest processes:

```powershell
npx jest --runTestsByPath __tests__/<suite> --runInBand --testTimeout=60000 --json --outputFile=.validation/task10/<suite>-isolated-<run>.json
```

| Suite | Run 1: pass / fail | Run 2: pass / fail | Seconds 1 / 2 | Both exits |
| --- | --- | --- | --- | --- |
| `App.test.tsx` | 45 / 10 | 45 / 10 | 121.654 / 104.600 | 1 / 1 |
| `loginService.test.ts` | 1 / 4 | 1 / 4 | 20.135 / 17.783 | 1 / 1 |
| `auth.test.ts` | 3 / 1 | 3 / 1 | 16.831 / 2.071 | 1 / 1 |
| `developmentPreview.test.ts` | 3 / 1 | 3 / 1 | 1.670 / 1.374 | 1 / 1 |

Assertions and failure identities match the full run. Other suites are not
necessary to cause any of these failures. Timing varies with transform caches
and instrumentation; the failing assertions remain the same.

An individual test was also selected, excluding every other App scenario:

```powershell
npx jest --runTestsByPath __tests__/App.test.tsx --testNamePattern='^guest drawer My Listings is guarded' --runInBand --detectOpenHandles --testTimeout=60000 --json --outputFile=.validation/task10/App-single-open-handles.json
```

Result: **1 failed, 54 skipped**, exit **1**, **185.746 seconds** including
instrumented loading; the selected test itself took approximately 6.3 seconds.
It still expected `MyListings` and received `Home`. Jest did not identify an open
handle in this diagnostic. It is not a 60-second test timeout.

Worker/order diagnostic:

```powershell
npx jest --runTestsByPath __tests__/App.test.tsx __tests__/loginService.test.ts __tests__/auth.test.ts __tests__/developmentPreview.test.ts --maxWorkers=2 --randomize --seed=17011 --showSeed --testTimeout=60000 --json --outputFile=.validation/task10/randomized-workers2-escalated.json
```

Result: **4 failed suites; 52 passed / 16 failed tests; 68 total**, exit **1**,
**89.169 seconds**. The complete failed-name set exactly matches the full run and
the union of each isolated run. Within-file test order was randomized and suites
used two workers. This supports the diagnosis under both tested execution modes;
it is not proof that all possible orderings are equivalent.

The first sandboxed two-worker attempt could not spawn workers (`spawn EPERM`,
exit 1, zero tests). That environment failure is distinct from the 16 assertions.
The allowed rerun outside that process-spawn restriction above completed without
changing any source or configuration file. Its output is preserved separately
from the blocked attempt.

## Root cause 1: eight navigation fixtures have no secure credential

Evidence:

- `App.test.tsx:151` explicitly describes its fixtures as synthetic membership
  without a backend token. `authenticatePhase3` at line 1337 calls only `setUser`.
- `jest.setup.js:20` makes `Keychain.getGenericPassword()` return `false` by
  default. `setGenericPassword()` returns true but does not implement a persistent
  mock credential store.
- The App setup disables `profileApiVerified`; this does not disable the now-real
  Inbox, Dashboard, My Listings or Reviews reads.
- `inboxService.ts:33-40`, `dashboardService.ts:59-68`,
  `myListingsApiService.ts:41-48`, and `visitorReviewsService.ts:53-60` obtain the
  secure token. When it is absent they conditionally clear the current synthetic
  session and reject the protected read.
- Root session handling (`RootNavigator.tsx`, `AppProviders.tsx`) responds to the
  owner becoming guest by clearing private state and remounting navigation. The
  observed final route is Home, exactly as reported by the assertions.

This is a real test-fixture incompatibility introduced by adding private API
dependencies to previously UI-only navigation tests. It does not demonstrate
that real users with stored sessions are being logged out incorrectly.

| # | Exact failing App test name | Actual assertion / source | Private dependency |
| --- | --- | --- | --- |
| 1 | Home dashboard uses the real first name and routes every action through existing navigators | `Conversations` expected, `Home` received, line 508 | Inbox |
| 2 | guest drawer My Listings is guarded and resumes only after membership | `MyListings` expected, `Home` received, line 951 | My Listings |
| 3 | authenticated Profile preserves seven menu actions; confirmed logout returns Guest Home | `ProfileDashboard` expected, `Home` received, line 973 | Dashboard / Visitor Reviews |
| 4 | Phase 3 guest Messages preserves origin, prevents duplicate Login and resumes OPEN_MESSAGES | `Conversations` expected, `Home` received, line 1364 | Inbox |
| 5 | Phase 3 direct ProfileDashboard route gates account content and restores exact destination | `ProfileDashboard` expected, `Home` received, line 1483 | Dashboard / Visitor Reviews |
| 6 | Phase 3 direct MyListings route gates account content and restores exact destination | `MyListings` expected, `Home` received, line 1483 | My Listings |
| 7 | Phase 3 direct MyReviews route gates account content and restores exact destination | `MyReviews` expected, `Home` received, line 1483 | Reviews |
| 8 | Phase 3 authenticated Messages and Post open directly; account switch clears private history | `Conversations` expected, `Home` received, line 1490 | Inbox |

Test 8 fails before the account replacement at line 1507. Its failure is not
evidence of cross-account message leakage. Similarly, test 3 fails before its
Logout assertions. These failures must not be reported as actual Logout bugs.

**Minimal proposed correction, not applied:** give navigation tests scoped,
coherent session/read fixtures. Either mock the relevant read service boundaries
with their actual empty/success contracts for route-only tests, or provide secure
credential mocks matching the injected user plus controlled API responses. Restore
those mocks per test. Keep actual missing-token/401 cleanup security tests intact.
Disabling production token checks or returning fabricated production API success
would be an incorrect fix.

## Root cause 2: two App category/privacy assumptions

### 9. `static marketplace browsing stays public while request, Post and Messages still require login`

Failure: `TypeError: Cannot read properties of undefined (reading 'props')`,
inside the `press` helper at line 139 when line 1621 requests
`Browse category Documents`. The category control is absent.

`categoriesService.categoriesDataSource()` selects fixtures only when the explicit
native `staticTestingBuild` flag is true. Debug runtime alone is not sufficient.
The Jest native metadata mock does not supply this flag, so the existing generated
API configuration leads Home to call the real **public Categories data path**.
This test neither selects explicit static mode nor supplies a successful Categories
fixture. Public static listings remaining enabled does not imply static categories.

**Minimal proposed correction:** explicitly scope this static-build test to the
existing static-testing build flag and restore it, or mock the documented public
category result. The test must choose which data mode it intends to verify. Do
not restore a production fallback to invented static categories.

### 10. `guest Profile never requests private backend data even when real Profile API is enabled`

Failure at line 1764: expected `apiClient.get` never to have been called; received
one `/categories` GET with `headers.Authorization: false`.

The spy is installed **before Home opens** and observes every GET. The displayed
Guest Profile assertion already passes. The failing assertion conflates an
allowed public Home request with a forbidden private profile request.

**Minimal proposed correction:** assert that private endpoint calls are absent
(for example `/customer/profile`, private dashboard/messaging routes and `/auth/me`),
while allowing public `/categories`. A scoped/cleared spy around the Profile
action may help, but filtering by privacy contract is more robust against public
background refresh. Keep Guest Profile and unauthenticated-header assertions.

## Root cause 3: four Login tests target a superseded contract

Current source and saved Laravel contract agree:

- Active gate: `loginApiEnabled`, not `authApiVerified`.
- Public POST body: exactly `email`, `password`; no `device_name`.
- Successful HTTP status: 200.
- Response: `success: true`, `data.token`, `data.token_type: Bearer`, `data.user`.
- Validate the returned user, then `secureStorage.setSession(token, user)`, then
  authenticate. No extra `/auth/me` request is used to finish real Login.

Sources: `docs/API_REFERENCE.md:47-67`, `authService.ts:37-64`,
`sessionSchema.ts:12-19`. The passing `loginApi.test.ts` tests this current contract.
Its passing result alone is not the root-cause evidence; the conflicting request,
parser, gate and storage code above provide the causal evidence.

| # | Exact failing `loginService.test.ts` name | Actual error and cause | Minimal proposed correction |
| --- | --- | --- | --- |
| 11 | unverified auth contract sends no credentials to the API | Expected `currently unavailable`, received network feedback. Test sets `authApiVerified=false` while `loginApiEnabled` stays true, and leaves POST unmocked. | Test the actual disabled gate and assert no POST plus safe error kind/current copy. Merely changing the flag is insufficient if the test retains obsolete exact error text. |
| 12 | successful Sanctum contract stores token securely before loading the validated user | `ApiError: Unable to sign in securely. Please try again.` Mock has only `data.token`, no HTTP status, success, nested user or token type. Parsing fails before storage; obsolete assertions also require `device_name`, `setToken` and a profile GET. | Use the complete documented HTTP 200 fixture; expect exactly email/password, public headers, `setSession(token,user)`, then authenticated state, with no profile GET. |
| 13 | keychain refusing a write prevents profile hydration and authentication | Expected `securely store`, received generic invalid-sign-in feedback. Same malformed reply is rejected before Keychain is reached. | First provide a valid Login reply, then make the existing Keychain write fail; assert no authentication and no unrelated GET. |
| 14 | invalid profile removes the newly saved token and leaves a guest | Expected `removeToken` once, received zero. Current inline user validation rejects this malformed reply before any session is saved. | Assert no session write, no authenticated state and no removal of an unsaved token. If post-persistence cancellation/rollback coverage is intended, test that separate actual path with a valid reply rather than an invented hydration step. |

The malformed-token test in this suite passes, but its incomplete fixture is not
proof that it isolates token validation: several missing fields can reject it.
Future fixture alignment should retain focused malformed-token/user cases.

No real Laravel outage or missing backend table is established by these failures.
The unmocked request targets the test example host through the test transport,
not a verified authenticated Laravel request.

## Root cause 4: Restore test selects the wrong branch

### 15. `an offline restore keeps the credential and exposes retry to bootstrap`

`auth.test.ts:32` expects rejection with `kind: network`; the promise resolves
`undefined`. The test mocks `getToken` and `hydrate`. Generated configuration has
`loginApiEnabled: true`; `authService.restore()` therefore calls `getSession`,
not `hydrate`. The default Keychain mock yields no session; restore clears local
auth and resolves. The mocked offline error is never executed.

**Minimal proposed correction:** for the current restoration design, mock the
secure-session read failure/success itself and assert the documented behavior
without an invented server validation call. If the older fallback branch is
intentionally retained as separate coverage, explicitly select and restore its
flags in that test. Do not add `/auth/me` calls to production restoration to make
a legacy mock run.

## Root cause 5: preview test does not select an explicit native testing build

### 16. `explicit testing APK allows UI navigation without creating authentication`

Expected preview active `true`, received `false`. The test sets `testingUiPreview`
and `uiPreviewEnabled` true and changes `__DEV__` to false. However,
`isUiPreviewAllowed()` requires `uiPreviewEnabled && (__DEV__ || staticTestingBuild)`.
The native testing build flag is false in this fixture. `testingUiPreview` is not
an authorization input to this function.

**Minimal proposed correction:** model an explicit native testing build using the
existing metadata/configuration seam, and restore that test flag. Retain the
separate negative production-build case. Do not relax the production preview gate
to trust a generic JavaScript testing preference.

## Mark as Read and asynchronous-causality assessment

None of the 16 failing assertions checks a read POST, its body, unread arithmetic,
message ordering or send delivery. Eight failures occur when private list/summary
screens mount, before entering/presenting a Chat conversation. Two concern Home
categories, and six are isolated auth/configuration unit assertions.

The new read hook cannot mutate auth on import: its auth subscription only drops
operation evidence. Its network path requires focused/active, successful history
and actual latest-message presentation. Inbox/Dashboard invalidation occurs only
after that guarded operation. The observed synthetic-session clear is explicitly
performed by the earlier private read services' missing-token branches.

The evidence supports **test fixtures/expectations not kept aligned with earlier
Login, private-read, Categories and native-build behavior**, rather than these 16
being caused by Mark as Read. This is a current causal investigation, not a
historical claim that a clean pre-Task-9 checkout was tested. No revert/bisect,
test rewriting or temporary feature-disable modification was performed here.

All 16 reproduce in-band, in separate-suite runs, and again on repetition.
Cross-suite shared mocks and parallel workers are not necessary to cause them.
Jest provides separate suite environments; the mocked Keychain deliberately lacks
state in every fresh run. The selected single-test diagnostic also reproduces one
navigation failure without earlier tests in its file.

The full log has React `act` warnings in passing Login tests; they should be
investigated separately, but do not explain these deterministic branch/fixture
assertions. No reproduced failure is an exceeded test timeout. The focused
open-handle diagnostic reports no open handle. This does not prove the entire
application has no asynchronous cleanup issues.

## Proposed correction order — not implemented

1. Align the four legacy Login cases with the saved contract and active gate.
2. Align the restore fixture with the actual secure-session branch.
3. Scope native build metadata correctly in the preview/static-category tests.
4. Give route-only tests coherent private-read/session fixtures and cleanup.
5. Make the Guest Profile privacy assertion distinguish public/private requests.
6. Re-run each changed suite twice, full suite, and existing real API/Message
   regressions after a separately authorized fix. Investigate any remaining
   warnings without weakening security or hiding failures.

No production fix is justified by these 16 failures alone. Proposed test changes
have not been applied or claimed to pass. No backend/device/live authenticated
verification was attempted in this analysis task.

## Scope and evidence preservation

Before/after SHA-256 comparison covered **334 files**: all enumerated source,
tests, test utilities, package manifests/lockfile and Jest/Babel configuration.
**Zero hash differences**. Git status comparison shows only this new report in
addition to the pre-existing dirty workspace. Diagnostic logs are ignored under
`.validation/task10`. No existing application/report file was overwritten to hide
earlier results.

Evidence index:

- `full.log`, `full-results.json`, `full-exit.txt`: exact current full-suite output,
  complete stacks, machine-readable assertions and exit code.
- `failure-index.json`: the 16 exact failing names and compact messages.
- `*-isolated-1/2.log`, `.json`, `.exit.txt`: all eight independent suite runs.
- `isolated-summary.json`: counts and timings for independent repetitions.
- `App-single-open-handles.*`: individual assertion and open-handle diagnostic.
- `randomized-workers2.*`: original environment-limited worker attempt.
- `randomized-workers2-escalated.*`: completed two-worker/random-order experiment.
- `before-hashes.json`, `after-hashes.json`, `hash-differences.json`,
  `before-status.txt`, `after-status.txt`: source/test/config integrity evidence.

All reproduced failing executions exit 1 because assertions fail; they are not
reported as successful runs. The commands containing a PowerShell loop finish
after saving each individual Jest exit; consult the per-run exit files, not the
loop shell's final completion status.
