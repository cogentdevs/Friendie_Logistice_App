# Premium Reviews implementation

## Screen and navigation

One MyReviewsScreen now contains exactly Visitors Reviews and Your Reviews. Profile retains its seven approved actions. Profile, Drawer, Dashboard Total Reviews and Dashboard Visitor Review View All open the existing MyReviews route. Typed initialTab supports visitors/your; returning from listing details preserves the selected tab. Back returns to the originating Profile, Dashboard or Home. Existing tabs, drawer and NavigationContainer are reused.

## Changed files

- src/features/reviews/screens/MyReviewsScreen.tsx
- src/features/reviews/components/: ReviewsTabBar, ReviewCard, ReviewsRatingSummary, ReviewsEmptyState, ReviewsSkeleton
- src/features/reviews/hooks/useReviews.ts
- src/features/reviews/services/reviewsService.ts
- src/features/reviews/types/reviews.types.ts
- src/components/ui/AppAvatar.tsx: optional image-error callback
- src/features/dashboard/hooks/useProfileDashboard.ts
- src/features/dashboard/services/dashboardService.ts
- src/features/dashboard/screens/ProfileDashboardScreen.tsx
- src/features/dashboard/components/VisitorReviewSection.tsx
- src/features/profile/screens/ProfileScreen.tsx
- src/features/listings/screens/ListingDetailsScreen.tsx
- src/navigation/navigationTypes.ts, DrawerNavigator.tsx, components/CustomDrawerContent.tsx
- jest.setup.js and focused Reviews, service, Profile, Dashboard, App and Listing Details tests

## Confirmed backend semantics and integration boundary

Read-only inspection of sibling friendie_logistics_backend confirmed:

- routes/web.php: GET /user/reviews calls UserController.reviews and returns Blade HTML, not a verified mobile JSON API.
- UserController.php dashboard and reviews methods: visitor reviews match to_user_id; authored reviews match from_user_id. Dashboard visitor preview uses the same received-review meaning.
- Review migration defines post_ads_id, from_user_id, to_user_id, rating, review, date_time and timestamps.
- Website authored query joins the author rather than the reviewed recipient. The mobile mapper does not present that author name as the reviewed member.

No mobile endpoint was invented or called. No backend files were changed. Live production feeds and aggregate summary report unavailable until authenticated JSON contracts are verified. Required contracts include pagination, authoritative rating aggregate/count, visibility/moderation, recipient identity, image URLs and listing access. No edit/delete or public-profile actions are exposed without verified authorization and routes.

The normalized TypeScript page model is an internal adapter contract, not an assumed Laravel response. Runtime validation rejects invalid ratings, ownership mismatches, unconfirmed visibility and invalid pagination cursors. Names, avatar URLs, transaction verification and permissions are never inferred.

## State and UI

Separate account-scoped TanStack Query keys reviews.received, reviews.authored and reviews.summary prevent tab/account mixing. Dashboard and Reviews share received/summary queries. Average rating is never calculated from a paginated subset. Query invalidation helper is available for future verified review mutations. Pagination guards duplicate requests and records; refresh, retry, loading, empty, permission and unavailable states are provided.

Development UI preview is explicitly labeled and uses empty datasets; its zero count describes that empty preview only. Real authenticated sessions take priority over preview state. Production does not substitute demo ratings, comments or counts. Existing Profile statistics remain dependent on their separate profile service contract.

The UI uses centralized burgundy/navy/pink/grey tokens, accessible two-tab selection with reduced-motion support, FlatList cards, safe-area header, rating announcements and image fallbacks. Listing navigation is enabled only by an explicitly authorized adapter record.

## Executed validation

- TypeScript: passed (npm run typecheck).
- ESLint: passed (npm run lint).
- Focused Jest: 7 suites, 53 tests passed. Coverage includes tab isolation, initial authored selection, late responses, ownership/visibility, pagination deduplication, refresh, empty/error states and Profile/Dashboard/details navigation.
- Android build/install: npm run android passed on connected arm64 Android device (407 tasks).
- git diff --check: passed; existing Windows line-ending warnings only.
- Physical screen inspection: pending; guarded device check returned not_foreground. No other app was inspected or operated.

Live API behavior cannot be validated until the missing mobile contracts are supplied. No fake reviews, average ratings, edit/delete success or production backend success were introduced.
