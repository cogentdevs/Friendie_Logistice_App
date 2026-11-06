# Screen 25 - Contact Us

## Implementation
- Added `src/features/support/screens/ContactUsScreen.tsx`: safe-area header/back, soft pink Lucide support composition, configured business-detail cards, RHF/Zod form, category modal, multiline message, gradient CTA, keyboard-safe scrolling, loading/disabled state, inline errors and confirmed-success state.
- Added `schemas/contactSchema.ts`: trimmed required name/subject/category, normalized valid email, message minimum 10 and maximum 5,000 characters. Name max 100 and subject max 150 are client safety limits, not a claimed Laravel policy; reconcile with the verified backend contract.
- Added `services/contactService.ts`: typed configuration, validated submission boundary and explicit unavailable behavior. No guessed API URL or fake submission.
- Added the ContactUs drawer route with its own header and disabled drawer swipe. Existing HelpSupport screen now links to Contact Us. Profile menu and existing tabs remain unchanged.
- Added component/service tests, support-route navigation coverage in App.test.tsx and Clock icon test mock.

## Access
Drawer > Help & Support > Contact Us. Header and Android hardware Back return to HelpSupport, including direct entry. No duplicate NavigationContainer, tabs or drawer.

## Data and missing integrations
No approved business email, phone, office address, business hours, category IDs or Laravel support endpoint/response schema were found. `supportConfig` intentionally starts empty; business cards render only supplied values. The category picker shows an honest unavailable state rather than inventing a production catalogue. No support HTTP request is made.

A verified backend adapter is still needed for category loading, request field mapping, endpoint, acceptance mapping, ticket/reference field, authentication requirements, rate limits and authoritative length limits. The screen renders success only after validating an accepted response; a reference appears only if actually returned. In current unconfigured runtime, successful submission is deliberately unavailable. Acceptance tests inject service responses only inside tests.

Attachments are omitted because no upload contract/file rules are verified. No new packages or remote images. No personal form data is persisted or logged; mutation retention is disabled. Unsaved removal requires confirmation and pending requests block removal. Server validation, network/rate-limit/session and unexpected failures preserve the draft and do not claim delivery.

## Validation
Results recorded below after completion. Physical screenshot fidelity is not claimed without device inspection.

Executed validation:
- TypeScript: passed after adapting TextInput refs for React Native 0.88.
- Changed-files ESLint: passed with no warnings; whitespace diff check passed.
- Contact component/service and App navigation suites: 3 suites, 28 tests passed after fixing drawer Back behavior.
- Earlier complete regression run: 41 suites passed; one newly added Contact Back assertion failed, identifying the drawer default-back issue. That assertion and all App tests passed after the fix. No final full-suite rerun is claimed.
- Android arm64-v8a debug build/install: passed on connected Infinix X655C (407 tasks; existing Gradle deprecation warnings). Subsequent changes affect JavaScript navigation only.
- Foreground-guarded device check returned not_foreground; physical screen layout remains unverified.

Current blockers are business details, category catalogue and verified support submission/upload contracts. No submission endpoint is used yet.
