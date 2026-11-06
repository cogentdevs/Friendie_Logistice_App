# Screen 28 - Terms & Conditions

## Implementation and files
- Added `src/features/legal/screens/TermsConditionsScreen.tsx` and versioned `content/termsConditionsContent.ts`: 15 requested proposed sections, explicitly draft with no binding provisions or invented dates.
- Added `services/termsConditionsService.ts`: runtime validation of approved version, actual Last Updated date, actual Effective Date, final nonempty paragraphs and safe document references.
- Extracted `components/LegalDocumentReader.tsx` and `services/legalDocumentSchema.ts` from the existing Privacy reader. Both documents share safe-area header, readable scalable text, dividers, validated links and error/retry handling. Terms adds burgundy section accents, contents actions and related Privacy Policy navigation. Privacy's old malformed metadata separator was normalized to plain text; draft/approved semantics remain unchanged.
- RootNavigator/navigationTypes add the TermsConditions route to the existing root stack. About and Register now open both legal documents natively. No second NavigationContainer, duplicate drawer/tabs, additional dependency or guessed API.
- Updated Privacy/About/Register/App tests; added TermsConditions tests including measured section navigation and date/schema validation.

## Content and approval
No approved Terms, CMS/API contract, effective date, governing law, company provisions or backend consent/version rules were found in the workspace. Bundled document is a draft editorial outline, explicitly not contractual terms. Last Updated is unavailable pending approval; the draft notice states that the effective date and provisions still need company-approved content.

To publish approved Terms, replace the versioned local module with approved final paragraphs, status approved, authoritative version, lastUpdated and effectiveDate. The runtime schema rejects missing/invalid dates, empty final sections, duplicate section IDs, editorial review notes in approved documents, and unsafe reference URLs. No legal wording, prohibited-items policy, fee schedule or liability terms were generated.

## Navigation, links and scroll
Access from About > Terms & Conditions or Register > Terms & Conditions. Back uses the root stack and returns to its originating screen. Privacy Policy opens the existing root route; Back restores the mounted Terms reader and its native scroll position. No focus-triggered reset or programmatic jump to top occurs.

Contents actions scroll to section positions measured by layout, not assumed heights, so text scaling is respected. Jumps are nonanimated. References provided by approved content open their exact validated HTTPS URLs, with failure feedback and duplicate-open protection. No external legal links were invented. The local document remains readable offline.

## Consent boundary
Reading Terms or Privacy never writes acceptance, sets the registration checkbox, persists consent, submits a consent event, or fabricates a re-acceptance prompt. Existing registration checkbox/validation/service behavior is preserved. Registration remains explicitly unconnected until its verified Laravel request and consent/versioning mechanism are supplied. Backend-authoritative consent capture and re-acceptance remain dependencies; no local-only mechanism has been presented as legal acceptance.

## Validation
Executed results are recorded below. Physical layout and iOS build are not claimed without execution.

Executed checks:
- TypeScript passed after extracting the shared reader and adding the Terms date/schema tests.
- Full ESLint passed; final legal-reader/tests lint and whitespace checks recorded at completion.
- Five focused suites passed (42 tests): TermsConditions, PrivacyPolicy, Register, About and App navigation. An additional measured-section-navigation test was then added; the Terms suite rerun passed all 5 tests, including missing/invalid effective-date rejection. No full-repository test run is claimed.
- Android arm64-v8a debug build/install passed on Infinix X655C: 407 tasks, 17 executed, 1m 33s. Existing Gradle deprecation warnings remain. Later edits were confined to JavaScript styling/tests.
- Device foreground guard briefly inspected the Friendie Sign In screen. Before navigating to Register, focus changed and the guarded action returned not_foreground. Physical Terms layout and scroll preservation therefore remain unverified; no interaction with another app was attempted. iOS build was not executed on Windows.

Remaining dependencies: approved versioned Terms, actual legal dates, and verified backend consent/re-acceptance rules.
Final legal-reader/tests ESLint completed successfully with no warnings; whitespace diff check passed.
