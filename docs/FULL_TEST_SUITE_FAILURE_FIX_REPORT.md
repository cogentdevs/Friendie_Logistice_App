# Task 11 — full test-suite failure fixes

## A. Executive summary

The original **16 failures are resolved; final failure count is zero**. Corrections are confined to four test
files. Production behavior, backend contracts and global test configuration were
preserved. Six focused safety cases were added rather than deleting or skipping
existing coverage. Final execution results are recorded in section H.

Branch: `main`; HEAD: `d375d3645d38041f53ef529f8fa2465b05fca273`.
No commit, reset, checkout or history change was performed.

The workspace contained earlier uncommitted Messages/listing work and untracked
reports/tests. These were preserved. At the delivery-verification stage, the
Task 11 fixture corrections and per-group execution logs were already present on
disk. They were reviewed against the investigation and actual contracts instead
of being overwritten or reverted. Fresh affected/full/worker/static checks were
then run, and two redundant test imports producing lint warnings were removed.

## B. Original failure-to-correction mapping

The original affected-suite baseline is preserved in
`.validation/task11/baseline.json` and `.log`: 52 passed, 16 failed, exit 1.
Original failure identities were compared with Task 10's investigation. No
historical failing baseline was recreated by discarding workspace changes.

| # | Original suite and test | Actual correction and retained evidence |
| --- | --- | --- |
| 1 | App — Home dashboard uses the real first name and routes every action through existing navigators | Establish matching secure session before authenticated routing; route/name assertions retained. |
| 2 | App — guest drawer My Listings is guarded and resumes only after membership | Existing auth helper now writes secure credentials; guard/resume assertions retained. |
| 3 | App — authenticated Profile preserves seven menu actions; confirmed logout returns Guest Home | Valid session and authenticated read fixtures allow the test to reach all existing menu and Logout assertions. |
| 4 | App — Phase 3 guest Messages preserves origin, prevents duplicate Login and resumes OPEN_MESSAGES | Guest remains guest until the helper establishes real-shaped test credentials; pending-action/destination assertions retained. |
| 5 | App — Phase 3 direct ProfileDashboard route gates account content and restores exact destination | Matching token plus empty Dashboard/Reviews contracts; direct-route gating/resume assertions retained. |
| 6 | App — Phase 3 direct MyListings route gates account content and restores exact destination | Matching token plus paginated own-listings response; destination assertions retained. |
| 7 | App — Phase 3 direct MyReviews route gates account content and restores exact destination | Matching token plus Received/Given response fixtures; destination assertions retained. |
| 8 | App — Phase 3 authenticated Messages and Post open directly; account switch clears private history | Coherent session for each injected account; existing Post, Messages, account-switch and private-history assertions retained. |
| 9 | App — static marketplace browsing stays public while request, Post and Messages still require login | Explicitly select and restore existing static-testing build mode; assert no Categories HTTP request while keeping guest/protected-action checks. |
| 10 | App — guest Profile never requests private backend data even when real Profile API is enabled | Explicit API mode; assert public `/categories` call without Authorization and no private endpoint calls; Guest Profile/Sign In assertions retained. |
| 11 | loginService — unverified auth contract sends no credentials to the API | Test actual `loginApiEnabled=false` gate, safe rejection and zero POST; renamed to describe the current gate. |
| 12 | loginService — successful Sanctum contract stores token securely before loading the validated user | Verified HTTP 200 envelope, exact public email/password request, real secure-storage write, storage-before-auth ordering and no extra profile request. |
| 13 | loginService — keychain refusing a write prevents profile hydration and authentication | Valid Login response first, then native write refusal; verify native storage is reached and authentication remains guest. |
| 14 | loginService — invalid profile removes the newly saved token and leaves a guest | Invalid inline Login user is rejected before storage; assert no write, no authentication, no removal of an unsaved token and no profile GET. Added separate genuine post-write cancellation rollback case. |
| 15 | auth — an offline restore keeps the credential and exposes retry to bootstrap | Mock the actual `getSession` read failure; assert propagation, one read, no deletion and no `hydrate` call. |
| 16 | developmentPreview — explicit testing APK allows UI navigation without creating authentication | Set actual native metadata before isolated module initialization; verify testing-build detection and unchanged auth, then restore descriptor/module isolation. |

Files for rows 1–10: `__tests__/App.test.tsx`; rows 11–14:
`__tests__/loginService.test.ts`; row 15: `__tests__/auth.test.ts`; row 16:
`__tests__/developmentPreview.test.ts`. Final affected-suite JSON records each
corrected scenario as passed, including renamed cases.

## C. Navigation and secure authentication fixtures

`establishNavigationSession(user)` calls the unchanged real
`secureStorage.setSession(dummyToken,user)`, verifies `getSession()` reads the
same pair, then injects the existing auth state. Local native Keychain mocks keep
username/password state only inside this suite, including actual reset behavior.
No customer credential or token is used.

The existing Axios client uses a controlled local adapter. Public Categories
responses require `Authorization: false`; private responses require an
authenticated owner and the exact Bearer token held by the native mock. Only
documented Dashboard, listings, conversations, Received/Given Reviews and Logout
responses are supplied. Empty lists retain correct pagination. Unexpected routes
or failed adapter assertions are collected and cause `afterEach` to fail, so
query error UI cannot silently swallow an incorrect request.

Cleanup cancels/clears queries, restores the original adapter and native mock
implementations, clears credentials and timers, and restores flags. No global
Keychain or Jest setup was changed.

Added negative coverage injects a user **without** credentials, opens Messages,
and verifies guest cleanup, no private HTTP request, return to Home and Login
required on the next attempt. Logout tests verify the real-shaped token is
removed and protected Post requires authentication again. Existing account-switch
and pending-action tests remain meaningful.

## D. Login contract and storage expectations

Source of truth: saved `docs/API_REFERENCE.md` Login response and the unchanged
`authService` / `loginResponseSchema` implementation agree:

```text
POST /api/v1/auth/login
Request: {email, password}; public, no device_name
HTTP 200: {success:true, data:{token, token_type:"Bearer", user:{id,name,email}}}
```

The test fixture supplies that complete envelope and status. Tests now assert
exact normalized email/password, `Authorization: false`, secure
`setSession(token,user)` and the underlying Keychain write. Authentication occurs
after persistence; no `/auth/me` request is invented.

Malformed-token coverage now changes only the token in an otherwise valid
response. Malformed inline user, native write refusal and disabled API remain
negative tests. A new cancellation-after-persistence case verifies exactly one
credential removal and guest state, preserving genuine rollback coverage.

## E. Session restoration

Tests select the actual current Login restoration branch and mock
`secureStorage.getSession`. Added cases verify valid restoration exactly once,
missing session guest fallback, malformed native stored identity rejection and
aborted old-account restoration preserving a replacement account. No fresh
server validation or token-expiration claim is invented.

The previous revoked-session test explicitly selects the retained legacy branch
and continues checking unauthorized cleanup. Existing malformed/late profile
hydration tests remain. Two redundant local `apiClient` declarations were removed
to reuse the already imported client and resolve scoped lint warnings.

## F. Public Categories versus static mode

The local public adapter returns a documented Categories envelope with a real-
shaped numeric fixture ID and nullable image URL. The Guest Profile test selects
normal API mode and checks no authentication header/private reads. Existing
Categories API tests continue to cover search, mapping and failure/empty states.

The static browsing case selects existing `appConfig.staticTestingBuild` for that
scenario only, restores it in `finally`, and asserts zero `/categories` requests.
Guest listing browsing and Post/Messages/Request authentication guards remain
asserted. No new flag or production fallback was introduced.

## G. Preview/native build isolation

`NativeModules.FriendieAppMetadata.staticTesting=true` is supplied inside
`jest.isolateModules` **before** requiring `appConfig` and the preview store.
The native property descriptor is restored in `finally`, and the outer module's
static-build state is verified unchanged. The normal release-runtime negative
test remains. Generic JavaScript preview preferences do not bypass production
gates.

## H. Executed checks and exact commands

Diagnostic files are in `.validation/task11`; fresh delivery checks are in its
`delivery` subdirectory. Commands below used output redirection plus JSON reporting
for Jest; every Jest exit code was saved in a corresponding `.exit.txt` file.

Original affected baseline:

```powershell
npx jest --runTestsByPath __tests__/App.test.tsx __tests__/loginService.test.ts __tests__/auth.test.ts __tests__/developmentPreview.test.ts --runInBand --testTimeout=60000 --json --outputFile=.validation/task11/baseline.json
```

Per-group logs preserve incremental verification: Group A verified 16 selected
navigation tests; Group B 6 Login tests; initial Group C 7 restoration tests (8
after adding stored-identity safety); Group D 2 category/privacy tests; Group E 4
preview tests, all exit 0. Filtered group checks are not described as full suites.
An early Group A attempt failed and was corrected; its output was retained.

Fresh combined affected suites:

```powershell
npx jest --runTestsByPath __tests__/App.test.tsx __tests__/loginService.test.ts __tests__/auth.test.ts __tests__/developmentPreview.test.ts --runInBand --testTimeout=60000 --json --outputFile=.validation/task11/delivery/affected.json
```

Fresh complete regression — no test filtering/exclusions:

```powershell
npx jest --runInBand --testTimeout=60000 --json --outputFile=.validation/task11/delivery/full.json
```

Fresh determinism check:

```powershell
npx jest --runTestsByPath __tests__/App.test.tsx __tests__/loginService.test.ts __tests__/auth.test.ts __tests__/developmentPreview.test.ts --maxWorkers=2 --randomize --seed=17011 --showSeed --testTimeout=60000 --json --outputFile=.validation/task11/delivery/workers2.json
```

Independent runs use `--runTestsByPath __tests__/<suite> --runInBand
--testTimeout=60000 --json --outputFile=<diagnostic path>`. Independent final
results: App 56 pass, Login 6 pass, auth 8 pass, preview 4 pass; zero failures,
exit 0. Earlier independent repetitions are retained, and the small suites were
rerun after final lint cleanup. Current App test content was unchanged by that
cleanup. Two-worker execution uses the allowed process-spawn environment because
the Windows sandbox previously blocked Jest child workers.

| Fresh delivery check | Actual suites/tests | Duration | Exit |
| --- | --- | --- | --- |
| Affected suites in-band | 4 suites; 74 passed, 0 failed, 0 skipped | 135.241 s | 0 |
| Complete suite | 80 passed suites, 2 existing skipped suites; 909 passed, 0 failed, 2 skipped tests; 911 total | 224.917 s | 0 |
| Two workers, randomized order, seed 17011 | 4 suites; 74 passed, 0 failed, 0 skipped | 113.377 s | 0 |
| Independent auth after lint cleanup | 1 suite; 8 passed | 4.378 s | 0 |
| Independent Login | 1 suite; 6 passed | 2.066 s | 0 |
| Independent preview | 1 suite; 4 passed | 1.517 s | 0 |

The retained unchanged-App independent final run passed all 56 cases, exit 0;
earlier independent App repetitions also passed. Fresh in-band/full/two-worker
runs include the same final App file. All 16 original scenarios now pass. Full
Jest output, stack/warning output and machine-readable per-test evidence remain
in the named diagnostics; no failure output was suppressed.

### Inventory change

Baseline was 905 tests: 887 passed, 16 failed, 2 skipped. Six safety tests were
added: one missing-token navigation test, one post-write Login cancellation
rollback test, and four secure-session restoration tests. Final inventory is 911.
The all-green target therefore becomes **909 passed, zero failed, two existing
skips**. No original test was deleted, newly skipped or marked `.only`. Existing
two skips are retained, not added to force the result.

## I. Static/build validation

```powershell
npm run typecheck
npx eslint __tests__/App.test.tsx __tests__/loginService.test.ts __tests__/auth.test.ts __tests__/developmentPreview.test.ts
# Working directory: android
.\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain
```

TypeScript: **PASS, exit 0**. Scoped ESLint: **PASS, exit 0, no warnings or errors**.
Android arm64 debug: **BUILD SUCCESSFUL, exit 0, 2m 51s**; 407 tasks (16 executed,
391 up-to-date). Scoped Git whitespace check also passed.

No package installation, dependency upgrade,
snapshot update, timeout increase or build configuration change was required.
Android compilation does not constitute a physical-device/live API test.

## J. File changes and production integrity

Only these test files differ from the investigation's 334-file integrity baseline:

- `__tests__/App.test.tsx`
- `__tests__/loginService.test.ts`
- `__tests__/auth.test.ts`
- `__tests__/developmentPreview.test.ts`

Added documentation: `docs/FULL_TEST_SUITE_FAILURE_FIX_REPORT.md`.
Diagnostics are ignored under `.validation/task11`. No shared Jest setup/config
or fixture package was changed. Pre-existing source changes visible in Git belong
to earlier integrations and were preserved; they are not changes made to fix tests.

Final SHA-256 verification against Task 10's baseline found **only the four test
paths above changed**. Every production/configuration/other-test hash matches.
The baseline contains 334 hash records for 333 unique paths because
`test/setupAnimations.js` was listed twice; both records remain unchanged.
Branch/HEAD and before/after status records are preserved with the diagnostics.
See `delivery/after-hashes.json`, `delivery/final-differences.json` and
`delivery/summary.json` for final evidence.

## K. Remaining issues and limits

Passing navigation/full tests can still emit existing React `act` warnings.
These are recorded, not suppressed. They do not convert any failed assertion to
success. Existing Gradle deprecation notices are nonfatal. Scoped test lint
warnings from redundant imports were corrected.

**Unresolved failing tests: none.** The two retained environment-gated skips are
the live Laravel registration test and live public Categories test. They were
already skipped in the baseline; they are not substitutes for mocked integration
or physical-device verification.

No genuine production defect requiring separate authorization was found in this
task. No live authenticated Laravel or device verification is claimed. Proposed
future production behavior, token refresh, API expansion and notification/UI
refactoring were not added.

## L. Scope confirmation

No Laravel, website, admin panel, database or migration changes. No API-contract,
authentication service, secure storage, Messages, Categories or Dashboard service
changes. No UI, theme, font, spacing or navigation changes. No production behavior
changes. Existing negative security assertions and API request assertions remain.
