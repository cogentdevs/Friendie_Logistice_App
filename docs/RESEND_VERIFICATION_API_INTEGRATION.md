# Task 21 — Resend Verification API

Inspection date: 2026-11-19. **Case B: blocked, not integrated.**

## Existing UI inspection

- RegisterScreen submits registration, shows the existing Check your email Toast and returns to Login. It has no resend action or verification confirmation screen.
- LoginScreen has email/password, sign-in, Forgot Password and Register actions. Verification-related login errors are informational text, not a resend action.
- AuthNavigator contains Login, Register, ForgotPassword and the ResetPassword placeholder; no verification screen exists.
- Repository-wide source search for resend/activation/verification found no reachable resend-verification control. Drawer verification badges and Edit Profile's verify-new-email message are not submission actions and were not repurposed.
- Existing authService uses the centralized apiClient and explicitly suppresses Authorization for public login. Existing email schemas and recovery service provide reusable validation/public-request patterns for a future authorized integration.
- AppToast delegates to react-native-toast-message and already registers the required white-card status-bar design. No notification configuration change is needed.

## Verified Laravel contract (read-only inspection)

Sources in sibling friendie_logistics_backend: routes/api.php; app/Http/Controllers/Api/V1/AuthController.php::resendVerification, email, input, limit, delivery and RECOVERY; app/Services/EmailActivationService.php; app/Support/ApiResponse.php.

- Public `POST /api/v1/auth/resend-verification`; JSON `{email:string}` only, no required Bearer token. Use the existing environment-aware base URL if subsequently implemented.
- Email is required, string, email format, max 255 characters. Controller normalizes using lowercase/trim after validation. Unknown input keys are rejected.
- HTTP 200: `{success:true,message:"If an eligible account matches that email, a link will be sent. Please check your inbox and spam folder.",data:{}}`.
- Unknown email, already-verified account, ineligible role and inactive account retain neutral acceptance. No frontend account-existence or delivery claim is justified.
- Activation send requires exactly the customer user role, isActive=1 and isVerified=0. Resending does not activate an account or authenticate the caller.
- IP limit: 10 requests/900 seconds. Normalized email limit: 5 requests/3600 seconds. Email cooldown: 60 seconds; cooldown suppression returns the same neutral success. Rate-limit rejection is HTTP 429 with Retry-After.
- Validation raises Laravel validation exceptions; no speculative frontend error envelope/parser was added. Unexpected transport/server failures would require existing normalized safe error handling, not raw exception feedback.
- Eligible requests use existing MobileAccountMail with an authoritative signed activation_url. EmailActivationService generates a website activation link with a 24-hour lifetime. Non-local/testing delivery requires HTTPS. Delivery exceptions are caught and logged with a fixed message without email/link/token details; neutral API acceptance is not proof of mail delivery.

## Implementation status and authorization blocker

**Existing Resend Verification UI found: NO. API integrated: NO. Consuming screen: none.**

Task 21 explicitly forbids adding buttons, links, screens or routes without authorization and forbids an unused service. Therefore no endpoint/service/screen/test/configuration code was added or changed.

Smallest proposed addition, requiring explicit authorization: one Resend verification email action on the existing Login screen, using its current email input. This would avoid a new screen or route. It would validate the email, require a deliberate tap, prevent concurrent submissions, make the public request without customer credentials and show only neutral acceptance through the existing Toast configuration. No automatic login, account-state change, retry or claim that delivery occurred.

## Files and scope

Only `docs/RESEND_VERIFICATION_API_INTEGRATION.md` was created for Task 21. The pre-existing untracked `docs/RESET_PASSWORD_API_INTEGRATION.md` was preserved. No Laravel, website/admin, database, token policy, API contract, UI, navigation, session, dependency or Toast changes.

## Executed verification

Source/document inspection and `git diff --check` only. Focused Jest, full Jest, TypeScript, scoped ESLint and Android build: **NOT RUN** because implementation is blocked and Task 21 explicitly says not to run unnecessary builds for this case. No tests were added, weakened or skipped.

Task 19 protected-navigation failure: not reproduced or re-tested in this task. Existing SEARCH_FILTERS_COMPLETION.md Part 2 records a later historical green full run (1,443 passed, 0 failed, 2 skipped); this is context, not fresh Task 21 verification. No timeout change was made here.

**LIVE API: NOT VERIFIED. PHYSICAL DEVICE: NOT VERIFIED.** No email was initiated for a customer or synthetic account, no credentials were used, and no live success is claimed.
