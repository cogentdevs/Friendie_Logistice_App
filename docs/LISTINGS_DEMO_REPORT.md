# Listings demo preview

Requested sample data is now available only when __DEV__, UI_PREVIEW_ENABLED and the in-memory UI preview session are all active. Tap Sign In in the current debug workflow and open Listings. A visible Development demo label identifies sample names, verification/rating examples and prices. Release and real-auth navigation retain the verified-backend gates.

Eight isolated sample listings show Carry/Send, capacity, route, future dates, USD fees, ratings and review counts. Pagination uses four rows per page. Type, route, date, verified-only, query/category and straight-line demo radius filters update the count; no real GPS reading is requested by fixtures. All sample routes are Karachi to Dubai. Sample availability is active for all rows.

Card taps open the matching sample details. The locally bundled UAE photo is used for demo cover images. No contact number, conversation, request, payment or successful authentication is fabricated. Original server bookmarks/auth guards remain unchanged.

Demo cache keys are separated from real results/details; the Search handoff seeds the correct mode's cache. No packages/native changes were required. This user-authorized demo supersedes the earlier Screen 09/10 report notes that UI preview did not contain sample listings.

Files: listings/development/demoListings.ts; listings list/detail services and hooks; ListingsScreen; ListingDetailsScreen; SearchScreen; App test cache isolation; listingDemo.test.ts; README and this report.

Validation: TypeScript and ESLint passed; all 21 suites / 127 tests passed. Tests cover demo gating, pagination, matching details and filtering, alongside existing app navigation. No native files changed; a new Android build was unnecessary for these JavaScript-only changes. Physical preview was not inspected because Friendie was not foreground.
