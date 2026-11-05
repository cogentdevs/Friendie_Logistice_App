# Screen 10 - Listing Details

Implemented `src/features/listings/screens/ListingDetailsScreen.tsx` in both existing Home and Listings native stacks. Removed the old details placeholder module. No new navigation container, packages or unrelated screens were introduced. Existing UI-preview Sign In remains enabled without real authentication.

UI and actions:
- Centered Listing Details native header, Back, heart and More controls; shared theme tokens and Lucide icons.
- Rounded destination cover with neutral missing/error fallback, overlapping traveller avatar/identity, optional genuine verified badge and rating/review count, pink call/message controls, divider-separated route/date/weight/item rows and currency-explicit fee summary.
- Scrollable content plus safe-area-aware sticky request CTA. Missing contact/ratings/verification are not fabricated. Weight uses server value/unit (kg/g/lb) or the existing explicitly kg capacity; Carry and Send labels differ. Dates and currency reuse shared formatters.
- Details fetch uses the actual navigation ID and AbortSignal. Query keys include listing ID and account identity; ID changes reset local image/menu state. Old mismatched IDs are rejected. Loading skeleton, network/retry, 404/410 removed/unavailable and explicit expired/deleted/unavailable states are handled. Failed refreshes do not expose stale details actions.
- Save/unsave reuses authenticated, per-account device bookmarks, with loading/error handling and duplicate-save protection. Guest UI preview does not claim to be authenticated. Device-local storage is labeled; no server save synchronization is claimed.
- Call requires an explicit permitted number and authenticated user, validates safe phone syntax and opens the native dialer only after confirmation. Missing contact is disabled. Message requires a supplied conversation ID plus actual authentication and opens the existing typed Chat route; no conversation creation or message delivery is claimed.
- More exposes Share only when a valid server-supplied HTTPS share URL exists. It opens the native share sheet, without claiming anything was sent. Unsupported Report is omitted.
- Request Now remains disabled with an explicit reason because no supported request workflow exists in the repo. Own listings, pending/accepted requests and expired/deleted/unavailable listings have specific reasons; no fake successful request is produced.

Verified-integration limits and reference deviations:
- API_BASE_URL is empty and no verified detail endpoint/DTO was supplied. `LISTING_DETAILS_API_VERIFIED=false` independently guards the proposed `GET /listings/:id` contract; the existing listings-search flag does not enable it. Before enabling, confirm the route and map the detail envelope/owner/status/contact/weight fields to Laravel. Unverified builds render unavailable/retry rather than sample traveller data or a sample fee.
- No request, conversation-creation, report or remote-save endpoint exists. A live request workflow needs the verified business rules and endpoint/navigation destination. The existing Chat route is still a placeholder, so opening it does not provide live messaging. These dependencies were not replaced with mock success.
- No destination photo/identity is assumed from the reference. Actual URLs are used when supplied; otherwise fallback panels/icons are shown. Currency codes remain explicit. Device fonts may differ from the reference.
- Live backend and physical detail-data validation remain unavailable. The connected phone repeatedly left Friendie foreground; no unrelated app UI was inspected. Android install/launch passed, and details/navigation/actions were verified using test-only fixtures.

Changed files:
- Added src/features/listings/screens/ListingDetailsScreen.tsx
- Added src/features/listings/services/listingDetailsService.ts
- Added src/features/listings/hooks/useListingDetails.ts
- Removed src/features/listings/screens/ListingsScreens.tsx (obsolete placeholder)
- Updated src/navigation/HomeNavigator.tsx and ListingsNavigator.tsx imports
- Updated scripts/configure-env.cjs, src/app/config/environment.generated.json and .env.example
- Added __tests__/ListingDetails.test.tsx and __tests__/listingDetailsService.test.ts
- Updated __tests__/App.test.tsx and jest.setup.js icon mocks
- Added this report and README link

Validation (2026-11-05):
- TypeScript and ESLint passed, no lint warnings.
- Android BUILD SUCCESSFUL in 1m 8s; 407 tasks (17 executed); installed on connected Infinix X655C, Android 10, arm64 and launched.
- Tests cover real ID fetching, isolated verification gate/no unauthorized endpoint call, response-ID mismatch, owner/status/request guards, units/currency, safe permitted phone/confirmation, conversation navigation, guest contact handling, image failure, device save/share, network retry and real-stack card/details/back navigation.
- iOS build not run on Windows. Existing upstream Gradle deprecation warnings remain.

Final full Jest run: 17 suites, 113 tests passed (26.169 seconds).
