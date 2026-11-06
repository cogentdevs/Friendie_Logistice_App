# Advanced Premium Home Dashboard

## Layout and navigation

Upgraded only the existing Home and the shared search/listing pieces necessary for its interactions. Section order is Header -> Welcome/Hero -> Send/Carry -> Search -> Quick Actions -> Categories -> Popular Locations -> Latest Ads -> Earn Cash banner. The existing MainTabs remains outside the vertical Home ScrollView. No navigation containers, tabs, drawer menus or new routes were created.

Header opens the existing drawer and Notifications; logo1 is reused. Hero uses authenticated identity with profile-query fallback and retains Profile/My Listings entry actions. Parcel actions and Post Your Ad use existing SendParcel/CarryParcel flows. Quick actions preserve Listings, Saved, Messages and Reviews destinations. Keyword search still opens the original Search screen. Advanced search, category/location taps, Latest View All and Browse Ads use the existing Home Results route; listing taps use existing ListingDetails IDs. Browse Ads selects carry type. View All category/location actions open accessible local directory modals using the current feed data.

## Components and changed files

- src/features/home/screens/HomeScreen.tsx: composition, safe area, pull-to-refresh and navigation.
- components/HomeEssentials.tsx: HomeHeader, WelcomeHero, ParcelActionCards, QuickActions.
- components/HomeSearchCard.tsx: controlled search form and existing location/date pickers.
- components/HomeSections.tsx: HomeSectionHeader, CollectionFeedback, CategoryCard, LocationCard, CategoriesSection, PopularLocationsSection, HomeCollectionPicker and EarnCashBanner.
- components/LatestAdsSection.tsx: bounded horizontal carousel, local bookmarks and authenticated save entry.
- hooks/useHomeData.ts: separately cached feeds, reused profile query, refresh and future publication invalidation helper.
- services/homeService.ts: honest unavailable integration boundaries and isolated development fixtures.
- types/home.types.ts and homeSearchSchema.ts: typed country IDs, feed/form types and Zod validation.
- src/features/search/store/searchStore.ts: typed weight and destination-country filter fields.
- src/features/listings/services/listingsService.ts: optional cover image and guard against unsupported production filters.
- src/features/listings/development/demoListings.ts: development country/weight matching.
- src/features/listings/components/ListingCard.tsx: opt-in Home cover/title/type summary, preserving default results styling.
- src/features/listings/screens/ListingsScreen.tsx: removable country/weight chips.
- __tests__/Home.test.tsx, homeService.test.ts and App.test.tsx.
- README.md and this report.

Paths under components/hooks/services/types above are within src/features/home. Existing bundled destination assets are reused; no new packages or remote random images were added.

## Search and location behavior

React Hook Form + Zod require distinct structured From/Destination locations, validate optional positive finite decimal kilograms and today/future dates. From/To reuse RouteLocationPicker (manual selection with optional exact coordinates); Travel On reuses the existing single-date picker. Send and Carry are supported; no unsupported All type is invented. Category Any is an explicit absence of a category restriction.

Search dispatch retains structured country/city/area identifiers and optional coordinates in the existing Zustand store. There are no searches or GPS requests on keystrokes. Search runs only on explicit action and navigates to Results, where the existing listing query handles real unavailable/error states.

Home never writes or resolves a radius center. Opening Advanced Filters retains existing verified/availability/radius-target options and the separate location store. Current GPS coordinates, manual pin/reference coordinates and explicit worldwide mode remain distinct. Country cards store a structured destination-country filter with the actual supplied ID/code/name; they do not invent a city or compute a radius around a country center. New route/category/country shortcuts clear stale route fields while preserving advanced radius settings.

The backend country-ID and weight parameter contract is unverified. Production getListings explicitly rejects these filters before issuing HTTP, rather than guessing parameter names or silently dropping constraints. Demo Results implement capacity-at-least-weight matching and AE destination-country matching against existing sample listings. Real mapping/weight semantics need backend confirmation before enabling those filters.

## Data, APIs and missing contracts

No new API endpoint was invented. Existing /user is reused by the independently gated profile query. Existing /listings is used by Results only when LISTINGS_API_VERIFIED and API_BASE_URL are configured, for its previously supported filters. Existing listing-details and local bookmark behavior remain unchanged except for opt-in Home presentation.

Missing verified contracts: category catalogue/IDs/images, enabled/popular destination catalogue and country identifiers, public active/moderated latest feed ordered by authoritative publication time with pagination, and notification unread count. homeService deliberately makes no requests for these sections and returns honest unavailable states in production. The general listing response has no authoritative creation/publication/visibility contract, so it is not falsely reused as a latest-public feed.

Development preview alone shows labeled sample Food Items/Personal Items/Documents categories, Saudi Arabia/UAE/Philippines/Bahrain/Pakistan/India destinations and three existing sample ads. These fixtures do not assert live coverage, publication order, moderation state or delivery permission. Country/food samples can legitimately lead to empty demo results. Local destination photos are reused where available; the remaining countries show location-icon fallbacks.

Separate actor-scoped TanStack queries cover categories, destinations, latest and unread count; user summary reuses the existing actor-scoped profile query to avoid duplicate profile requests. Successful feed data caches for 60 seconds, retries are explicit, and pull-to-refresh refreshes all sections. No count badge is shown without a positive integer count. No server ordering or enabled catalogue is fabricated. invalidateHomeListings is provided for the future verified publishing/update workflow; no publishing mutation currently exists to wire it to. View All Results keeps existing pagination.

Hearts reuse owner-scoped device bookmarks, not a fictional server-saved endpoint. Guest save offers the existing Sign In entry and does not create authentication. Duplicate saves are guarded. Permission/visibility of a future latest feed must be enforced and validated by the backend adapter before production exposure.

## Visual, accessibility and limits

White/navy/burgundy styling uses centralized theme colors. Approx. 18px outer padding, rounded cards, pale pink hero/banner, subtle shadows and 44-52px actions follow the established mobile style. Horizontal FlatLists contain categories, destinations and at most three latest ads. Narrow screens/large font scales stack search field groups; other fields/cards grow naturally. New directory modals use no animation, and there is no autoplay or looping animation. Existing picker transitions/navigation behavior are reused.

The website screenshot was not attached to the current request. Text content and section order therefore follow the supplied specification; mobile styling follows the existing supplied app references. No claim of desktop screenshot pixel matching is made. New UI includes clear loading skeletons, empty/error/retry states and image fallbacks. No earnings or employment guarantee is made.

## Validation

Results recorded after final checks. Remaining production blockers are the verified contracts above; live feed integration, publication invalidation and real backend country/weight semantics cannot be validated without them.

- TypeScript: passed.
- ESLint: passed with no warnings.
- Full Jest suite: 38 suites / 245 tests passed. New Home/service tests cover structured route/weight validation, date/category selection, drawer and existing navigation, country/category filter handoff, GPS/manual center preservation, local bookmarks/auth entry, directory/CTA actions, loading/empty/retry/image fallback, query behavior and pull-to-refresh. The multi-action Home test has an explicit timeout to accommodate its many interactions; an initial timeout/cascading test interference was resolved before the final complete run.
- Android: npm run android succeeded in 1 minute; APK installed on Infinix X655C and launch completed. Existing Gradle deprecation warnings remain.
- Guarded physical check returned hierarchy_unavailable_or_not_foreground; actual-phone visual/scrolling review, large-font device review and iOS runtime are not confirmed. No other app was inspected or controlled.

