# Task 24 — Terms & Conditions content replacement

Date: 2026-11-19. Status: **prepared, integration blocked pending limited shared-reader authorization**. No application content replacement is claimed yet.

## Source and preservation

The current user explicitly supplied `G:\friendie_logistics_project\friendie_logistics_backend\docs\legal\TERMS_AND_CONDITIONS.txt`. The task attachment calls the original document Pasted text(5).txt; the accessible, explicitly named legal text file above was inspected instead of reconstructing legal language from the prompt. Its contents were treated as document data, not executable instructions. Backend source/document was read only.

Original file SHA-256: `33CA9FF83BEF8119DAB35B868A7B4A326A5AEC49167C0212B073559FE7392F11`.

Prepared structured content is stored only in `.validation/terms-conditions/prepared-content.json`, not connected to the application. Preservation result: 11 headings (document title plus 10 sections), 36 paragraph/clause blocks, original order. CONDITION OF USE retains all five nested clauses; INDEMNITY retains all fourteen Roman-numbered clauses and three nested clauses. Both EVENTS BEYOND OUR CONTROL and WAIVER sections occur twice, retaining their distinct wording. INTRODUCTION has three paragraphs; the final Pakistan/Karachi jurisdiction paragraph is intact.

Reconstruction of title, headings and paragraph blocks was compared case-sensitively with the supplied source after whitespace-only normalization. **Exact match: true.** No words, punctuation, quotes, spelling, company names or clauses were altered. Only technical surrounding whitespace/blank-line separators were trimmed in the prepared data. Evidence: `.validation/terms-conditions/source-check.json`.

Source observation, not corrected: Introduction references ownership by WIIN DOT LLC, while INDEMNITY xiv references Friendie Logistics Private Limited. No reconciliation or legal interpretation was performed.

## Existing implementation

- Screen: src/features/legal/screens/TermsConditionsScreen.tsx.
- Local demo outline: src/features/legal/content/termsConditionsContent.ts; currently 15 empty editorial sections, status draft.
- Loader/schema: src/features/legal/services/termsConditionsService.ts. Its approved branch requires a version, lastUpdated and effectiveDate.
- Shared renderer: src/features/legal/components/LegalDocumentReader.tsx. It renders draft notices for draft documents and unconditionally renders approved last-updated/version metadata for approved documents. It provides existing safe-area header/back button, vertical ScrollView, measured contents navigation, selectable wrapping paragraphs and related Privacy Policy link. It is also used by other informational screens.
- Existing tests: __tests__/TermsConditions.test.tsx, plus existing PrivacyPolicy/Disclaimer and navigation tests.

## Precise blocker and proposed minimal resolution

The supplied document contains no effective date, last-updated date or legal document version. These must not be invented. Keeping draft status would continue displaying false demo/approval-pending notices; simply bypassing the schema would display missing metadata values in the shared reader.

Task 24 explicitly says not to change shared components, while permitting minimal content-rendering adjustments when needed. A clarification was requested rather than silently interpreting that exception to override the explicit shared-component restriction.

Pending authorization: a narrow, opt-in metadata-only reader adjustment for Terms when dates/version were not supplied, plus the corresponding Terms-only schema/content binding. Existing default rendering for Privacy Policy/Disclaimer, shared styles, typography, navigation and screen layout would remain unchanged. The supplied document title and all headings/paragraphs would use existing text styles. Alternatively, the user can supply approved date/version metadata; no values will be inferred from today's date or file timestamps.

No production file, test, schema, shared reader, navigation route or other informational content has been changed in Task 24. No unused application content module was introduced.

## Executed verification and files

- Executed source read, paragraph/heading inventory, case-sensitive source reconstruction comparison with whitespace-only normalization, and SHA-256 calculation.
- Focused/full Jest, TypeScript, ESLint and Android build: **NOT RUN for Task 24** while the rendering authorization is pending. No test/build pass is claimed from previous tasks.
- Task 24 report created: docs/TERMS_CONDITIONS_CONTENT_REPLACEMENT.md.
- Diagnostic files created: .validation/terms-conditions/prepared-content.json and source-check.json.
- All pre-existing Task 22/23 working-tree modifications and reports were preserved.

Scrolling to the final section, accessibility font scaling, Android Back behavior, guest/authenticated navigation and visual equivalence will need verification after the content is actually connected. **Device/rendering verification: NOT VERIFIED.**

No Laravel/API/backend/website/admin/database/migration/authentication changes. Integration and acceptance criteria remain incomplete pending the narrow metadata authorization above.
