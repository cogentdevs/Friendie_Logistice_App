# Task 20 — Reset Password API inspection

Date: 2026-11-19. Status: **BLOCKED; not integrated**.

## Inspection findings

- `src/features/auth/screens/AuthScreens.tsx` registers only a `PlaceholderScreen` titled Reset password. There are no password inputs, visibility controls or submission handler to connect.
- `src/navigation/navigationTypes.ts` declares ResetPassword parameters `{token: string; email?: string}`; this is not the API's required user_id/token handoff.
- `src/navigation/linking.ts` deliberately excludes reset-token links. AndroidManifest.xml registers the existing friendie scheme only; no verified HTTPS reset host/app-link association exists here.
- Existing ForgotPasswordScreen and passwordResetService.request implement recovery initiation, not token consumption. They receive neutral acceptance, not a user ID or token.
- Read-only backend inspection: WebPasswordResetService::requestLink builds the website URL from configured app.url plus `/reset-password/{user_id}-{token}`. routes/web.php sends that route through UserController and the web password-reset controller. No supported mobile handoff was found.

## Verified backend contract

Sources in sibling friendie_logistics_backend, inspected read-only: routes/api.php; app/Http/Controllers/Api/V1/AuthController.php::resetPassword, passwords, input, limit; app/Services/WebPasswordResetService.php; app/Support/ApiResponse.php; config/auth.php.

- Public `POST /api/v1/auth/reset-password`, JSON; no query parameters or customer authentication required.
- Exactly user_id, token, password, password_confirmation. Unknown input keys are rejected.
- user_id: required, decimal representation matching `[1-9][0-9]{0,18}`. Preserve it as a string to avoid JavaScript integer precision loss.
- token: required string, exactly 64 lowercase hexadecimal characters. This must come from legitimate recovery mail, never generated or substituted by the frontend.
- password: required string, confirmed, Laravel Password::defaults(), maximum 72 bytes via explicit custom validator. Confirmation is required string. No frontend password rule was invented; framework defaults must be checked before future implementation.
- HTTP 200: `{success:true,message:"Password reset successfully.",data:{}}`.
- Invalid/expired/consumed token or ineligible account: HTTP 422 `{success:false,message:"Invalid or expired reset link."}`. Validation errors follow Laravel validation handling; separate expired/used classifications are not exposed by this controller.
- Configured expiry: 60 minutes. Successful consumption deletes the scoped reset token; subsequent use fails. API success revokes tokens with the mobile:account ability and does not authenticate the caller or return a new session.
- Submit limits: 10/IP/900 seconds, 5/account/900 seconds; HTTP 429 with Retry-After. Controller checks IP limit before validation and account limit after validation.

## Implementation and security

Only this report was added. No endpoint/service/form/navigation/deep-link changes were made. No speculative unused reset service was added while its required user-facing workflow is blocked. Existing Forgot Password, Login, Toast styling, session isolation and password handling remain unchanged. No reset token/password was obtained, logged, persisted or consumed. Backend, website, database and email templates were not modified.

## Required authorization / blockers

1. Authorize replacing the existing placeholder with a minimal new-password/confirmation form and necessary route parameter binding.
2. Supply and authorize a supported secure handoff for legitimate user_id and token (approved HTTPS host/path and app-link configuration, or another explicitly approved design). Existing email links currently open the website; the frontend cannot safely invent a mobile token source.

Authorizing the form alone does not resolve the missing token handoff. No automatic login, fake IDs/tokens, manual token workaround or unapproved custom-scheme reset link was implemented.

## Verification

This task stopped affected implementation at the explicit missing-UI/handoff restriction. Focused Reset Password tests, authentication regression, full Jest, TypeScript, ESLint and Android build were **not run** in Task 20; no application/test/configuration code changed. No passing implementation or regression result is claimed.

The prompt's old Task 19 timeout is superseded historically by docs/SEARCH_FILTERS_COMPLETION.md Part 2, which records 1,443 passed, zero failures, two skips after an investigated per-test navigation budget adjustment. That report was read as context only; its results were not re-executed or independently verified in Task 20. No timeout setting was changed here.

**LIVE AUTHENTICATED API: NOT VERIFIED.** No live reset submission was performed and no customer's token was consumed.

**PHYSICAL DEVICE / VISUAL VERIFICATION: NOT VERIFIED.**

Task 20 acceptance criteria remain unmet pending the two authorizations above.
