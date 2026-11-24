# Contact category: verified blocker

## Root cause

`src/features/support/services/contactService.ts` initializes `supportConfig.categories` to an empty array. `ContactUsScreen` renders that array directly. There is no category fetch, loading state or network failure to retry. The existing empty-state text accurately says support categories are unavailable.

The mobile `category` field is a required string in its provisional form schema. `contactService.submit` checks membership in the configured array, then deliberately throws an unconnected-service error; it has no contact endpoint or Axios POST. Existing tests inject test-only categories. Their passing does not establish real backend integration.

## Backend inspected read-only

- `routes/web.php`: GET/POST `/contact` goes to `ContactMessageController.contact`.
- That controller requires `g-recaptcha-response`, reads name/email/phone/subject/message and returns a website redirect after saving/sending email. It does not consume a category.
- `resources/views/frontend/contact.blade.php` has name, email, phone, subject and message; no Contact category selector.
- `database/migrations/2024_10_22_052347_create_contact_messages_table.php` defines those contact fields and date/timestamps, no category field.
- Inspected API routes, API support/validation source and API inventory supply no mobile Contact submission or Contact-category contract.
- Marketplace `GET /categories` is a different listing taxonomy and is not a verified Contact catalogue.

## Result and required dependency

**BLOCKED: no backend-supported category options or request mapping can be verified.** No options, endpoint, category IDs or persistence behavior were invented. No application, test, backend, database or UI code was changed. No live form submission or personal-data POST was made. Existing form values and discard behavior are untouched.

To unblock the requested category integration, an authoritative mobile Contact contract must establish the category values/source, accepted request field and validation, submission endpoint and success/error envelope, plus phone/CAPTCHA requirements. If the intended product instead has no Contact categories, removing that unsupported control/requirement needs an explicit scope decision. Neither alternative was implemented here.

## Verification

Logs are under `.validation/contact-category/`.

- `node node_modules/jest/bin/jest.js --runInBand --silent __tests__/ContactUs.test.tsx __tests__/contactService.test.ts`: exit 1, 5 passed / 1 failed, 2 suites (one passed/one failed), 109.078s. Failure: `prefills real identity; required validation prevents request` exceeded the existing 5,000ms timeout. This first run overlapped static checks.
- Same command rerun after static checks finished: exit 1, same 5 passed / 1 timeout failure, 24.236s. Therefore the timeout is reproducible here, not demonstrated to be caused solely by competing static checks. No source/test changes were made, no timeout increased and no assertions weakened. This task's category-contract blocker does not establish the timeout's cause.
- `node node_modules/typescript/bin/tsc --noEmit`: exit 0, no diagnostics.
- `node node_modules/eslint/bin/eslint.js src/features/support/screens/ContactUsScreen.tsx src/features/support/services/contactService.ts src/features/support/schemas/contactSchema.ts __tests__/ContactUs.test.tsx __tests__/contactService.test.ts`: exit 0, no diagnostics.

Only this findings document was added. No new category selection behavior, loading/retry state, request mapping or successful live Contact integration is claimed. Runtime/device verification was not performed.
