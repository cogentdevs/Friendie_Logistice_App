# Profile Dashboard implementation

Profile > Dashboard now opens a dedicated ProfileStack `ProfileDashboard` route. It no longer sends the user to Home. Existing drawer and five tabs remain; back returns to Profile.

## Files
- Added `src/features/dashboard/{screens,components,hooks,services,types}`: ProfileDashboardScreen, DashboardStatCard, VisitorReviewSection, DashboardEmptyState, useProfileDashboard, dashboardService and dashboard.types.
- Updated ProfileNavigator, navigationTypes and the Profile menu destination.
- Updated My Listings preview guards so authenticated sessions take precedence over a stale development-preview flag.
- Updated navigation assertions and added dashboard component/service tests; added MessagesSquare to the existing icon mock.

## Content and state
Exactly three statistic cards: Active Listing and Total Reviews side by side, New Messages full width. Compact pink introduction and Visitor Review card. Centralized theme tokens, accessible actions, responsive widths, skeletons, unknown-count placeholders, partial errors/retry and pull-to-refresh.

Active Listing opens My Listings with Active selected; Total Reviews opens MyReviews; New Messages opens the existing Messages tab. No Home redesign, new navigator container, tab bar, newsletter, footer or extra analytics.

## Data contracts and remaining dependencies
Active Listing reuses the existing owner-scoped `getMyListings('active', 1)` adapter and its verification-gated user-listings endpoint. Only authoritative active-count or filtered-total metadata is accepted, never page length. Conflicting totals fail safely. No new endpoint URLs were introduced.

No website Dashboard controller, API resource or verified dashboard contract was accessible in this workspace. Total Reviews and New Messages remain explicitly unavailable; they are not replaced with average rating, profile review statistics or conversation totals. Visitor Review semantics and endpoint remain unverified, so production shows an unavailable/retry state rather than pretending there are no records. The internal visitor presentation type is not an assumed backend response schema.

Development UI preview can show sample active-listing count and an explicitly labeled Visitor Review empty-state design. Other counts remain unknown. A real authenticated session always takes priority over preview data.

Queries are isolated by account, cached, refreshed on focus and pull-to-refresh. Existing owner-scoped listing/message cache success/invalidation events invalidate matching metrics without polling. Future verified review writes and realtime/read events must emit matching cache invalidations or call invalidateProfileDashboard. Production counts/visitor records require the missing verified contracts.

The requested website screenshot was not attached to this turn; content follows the supplied specification and existing mobile theme.

## Validation
See final task response for executed results. Physical screenshot fidelity is not claimed without device inspection.

Executed checks: TypeScript passed; full Jest suite passed (40 suites, 256 tests, runInBand with a 15-second timeout for existing multi-action navigation tests); Android build/install passed on the connected Infinix X655C (arm64-v8a). Initial checks found stale Dashboard-to-Home test expectations, which were corrected; an existing Home navigation test timed out under concurrent validation load, and passed in the complete rerun. Foreground-guarded physical inspection returned not_foreground, so Dashboard device layout and screenshot fidelity remain unverified. Gradle reported existing deprecation warnings, without build failure.
Final lint and git diff whitespace checks also passed. The reused endpoint is GET /user/listings behind its existing verification gate; no Dashboard-specific endpoints were added.
