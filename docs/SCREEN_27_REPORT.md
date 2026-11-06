# Screen 27 - Privacy Policy

## Files and navigation
- Added `src/features/legal/screens/PrivacyPolicyScreen.tsx`: white safe-area legal reader, navy section headings, grey paragraphs, comfortable line spacing, selectable final text, thin dividers, accessible scroll, custom Back header and validated-content/error/retry states.
- Added `content/privacyPolicyContent.ts`: versioned draft editorial outline with 14 proposed sections. No approved legal text or dates were found, so no legal obligations or commitments were invented.
- Added `services/privacyPolicyService.ts`: runtime schema and bundled-content loader. Approved documents require version, valid ISO Last Updated date, nonempty final paragraphs per section and no review notes. Referenced links must be HTTPS without embedded credentials; errors fail closed.
- Added PrivacyPolicy to the existing root stack (outside authentication conditions). About and Register Privacy Policy links now open this native reader. Back restores the previous route; Register remains mounted with its form values. No new NavigationContainer, drawer, bottom bar, backend endpoint or dependency.
- Added PrivacyPolicy tests and updated About/Register/App navigation assertions.

## Current content state
No approved local privacy policy, CMS contract or verified policy endpoint was accessible. The versioned source explicitly declares draft status. The screen prominently says Draft / Development Preview and that the proposed headings are not legal terms or privacy commitments. Last Updated is unavailable while approval is pending; no current date or fabricated effective date is shown.

Fourteen proposed sections match the request. Unwritten paragraphs say Pending approved policy content. No claims about encryption, deletion rights, regulatory compliance, insurance, retention periods, children or payment handling are asserted.

Location review notes are based on inspected mobile implementation: actual GPS center, resolved manual point with exact-pin precedence, explicit worldwide mode. Precise-coordinate visibility to other members and backend disclosure/retention are unverified and explicitly identified as such. These are editorial implementation review notes, not a published privacy disclosure. A production-approved policy must resolve those facts.

## Approved-content path and links
Replace the versioned content module only with company-approved content, status approved, version, actual lastUpdated and final paragraphs. The schema prevents accidentally rendering an approved document with draft notes or empty sections. Optional section links render native accessible link actions, open the exact supplied HTTPS references, prevent duplicate opens and report failures. No referenced document URLs were supplied, so none were invented. Terms remains on the existing configured legal-document flow; it is not redesigned here.

This is a bundled local reader and remains usable offline; it does not fetch or log personal data, request GPS, or require server-state queries. A future CMS adapter requires a verified contract and the same validation boundary.

## Validation
Executed results recorded below at completion. Approved company policy, effective date and precise-coordinate sharing semantics remain external dependencies. iOS/physical layout verification are not claimed without execution.

Executed validation:
- TypeScript passed; RN Linking test mocks were corrected to return void rather than boolean.
- Full lint passed; final changed-files lint and whitespace diff check passed.
- Four focused suites passed: PrivacyPolicy, About, Register and real-router App tests (38 tests). Guest Register > Privacy > Back preserves the entered name; authenticated About > Privacy > Back returns to About. An initial Register test failure was due to its old mock exposing popTo but not navigate; the mock was updated and all four suites passed on rerun.
- Android debug arm64-v8a build/install passed on connected Infinix X655C, 407 tasks (17 executed), 1m 11s. Existing Gradle deprecation warnings remain.
- Foreground-guarded device inspection returned not_foreground; physical text-scaling/layout screenshots are unverified. iOS build was not executed on Windows.
- No full-repository test-suite rerun was required or claimed for this screen.
