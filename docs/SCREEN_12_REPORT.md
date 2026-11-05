# Screen 12 - Post a Listing

Implemented src/features/post-listing/screens/PostListingScreen.tsx in the existing Post native stack. No new packages, navigation containers or backend calls were introduced. Existing Sign In UI preview and labeled Listings demo remain available.

UI:
- Centered native Post a Listing header with Back; white safe-area layout and existing burgundy/navy theme.
- Equal Send/Carry selection cards with Lucide package/plane icons, selected burgundy/white styling and the supplied descriptions.
- Bordered structured From/To fields, single travel/delivery date field, numeric capacity/parcel-weight field with Kg accessory, and fixed gradient Continue action with arrow.
- Scrollable form, multiline location values, keyboard avoidance using existing native-header offset, accessible radio/field controls, inline errors and at least 44px input/control targets. The existing tab bar hides on the Post flow and returns on Home; no second bar is rendered.

Form and draft behavior:
- React Hook Form with Zod discriminated Send/Carry schemas. Labels and weight error text follow the selected type. Required structured locations retain country/city/area IDs and optional coordinates through the existing RouteLocationPicker.
- Positive finite decimal kg values are required. Blank, zero, negative, NaN, Infinity, exponent and malformed numeric input are rejected. Decimal commas are normalized to a dot. No unsupported business-specific maximum capacity was invented.
- Date validation uses actual local calendar dates, allows today/future dates and rejects invalid/past dates. Identical structured endpoints are rejected without treating city-name strings as unique identities.
- Existing SearchDatePicker now has an optional single-date mode, preserving its default range behavior. ListingDateField and ListingFormField provide reusable date/selection presentation. No date-picker dependency was installed.
- Typed Zustand draft state records changes in memory as the form is edited. Navigation between form and next step preserves all values, and type changes preserve unrelated fields. Drafts do not survive process termination; they are not written as precise location plaintext to storage. Account changes clear another account's draft.
- Native route removal uses usePreventRemove. Header/Android Back at the Post root also confirms Stay, Discard or Keep Draft before returning Home. Stay keeps editing, Keep Draft retains values for the current app session, and Discard clears them.
- Existing Home SendParcel/CarryParcel routes reuse this form with the requested initial type; the Post tab defaults to Carry as shown in the reference.

Continue / integration scope:
- Continue validates and opens a minimal typed ListingReview next step with the preserved type, route, date and weight plus Edit listing details. This necessary navigation destination was added because no next listing step existed.
- Review explicitly says additional details/publishing are unavailable. There is no publish action, fake success or Laravel submission. Future item details, pricing, upload and final publication steps require their own references and verified contracts.
- The existing structured manual location entry is reused because no verified country/city/area catalog was supplied. Native GPS remains explicitly user-triggered by that picker; this form does not automatically request permission or replace manual locations.

Changed files:
- Added src/features/post-listing/screens/PostListingScreen.tsx
- Added src/features/post-listing/screens/ListingReviewScreen.tsx (minimal required next step)
- Updated src/features/post-listing/screens/PostScreens.tsx to reuse the form for existing Send/Carry entry routes
- Added src/features/post-listing/components/ListingFormField.tsx and ListingDateField.tsx
- Added src/features/post-listing/types/listingDraft.ts and store/listingDraftStore.ts
- Updated src/features/search/components/SearchDatePicker.tsx (optional single-date mode)
- Updated src/navigation/PostNavigator.tsx, navigationTypes.ts and components/CustomTabBar.tsx
- Added __tests__/PostListing.test.tsx; updated __tests__/App.test.tsx for the implemented flow
- Added this report and README link

Validation (2026-11-05):
- TypeScript passed. ESLint passed without warnings.
- Full Jest run: 22 suites, 138 tests passed. Includes invalid forms/numeric values, single-date application, structured route preservation, Send/Carry labels, draft remount, actual native-stack Continue -> Review -> Back and root Back/Keep Draft. Existing search range-date tests still pass.
- Added a further focused Stay/Discard test after the full run; its focused suite result is recorded below.
- Android BUILD SUCCESSFUL in 52s; 407 tasks, 17 executed. Installed and launched on connected Infinix X655C, Android 10, arm64.
- Physical keyboard/visual smoke test not completed because Friendie was not foreground during the guarded device check. No other app UI was inspected. No iOS build/keyboard test on Windows. Device system fonts may differ from the reference.

Focused PostListing suite: all 11 tests passed, including the added Stay/Discard check.
