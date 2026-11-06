# Home search alignment and results navigation

Changed files:
- src/features/home/components/HomeSearchCard.tsx
- src/features/home/screens/HomeScreen.tsx
- src/features/search/components/LocationField.tsx (shared origin/destination control)
- src/features/search/screens/FiltersScreen.tsx (recognize Home as valid return destination)
- __tests__/Home.test.tsx and __tests__/Filters.test.tsx (validated keyword/results and Home return regressions)

The form now follows heading, keyword, full-width equal listing-type segments, full-width category, origin, destination, equal-width weight/date, Search Listings and compact Advanced Filters. Card padding is 16, gap 14, corner radius 20; standard fields use minimum 56 height, location controls minimum 64. Labels and location text grow with content. No fixed screen widths, remote assets or dependencies were added. Existing keyboard-aware Home container and React Native calendar picker are reused.

Keyword submit and the main CTA use the same React Hook Form/Zod validation and navigate to existing Home-stack Results. There are no inline search results. Selected structured route IDs/coordinates, category, weight and normalized keyword enter the existing Zustand search state. Superseded route fields are cleared while advanced preferences remain. Home form observes applied search-state changes so returning from Results or Filters restores current values. Existing results FlatList, server-count handling, save/details navigation, cached pages, retry/empty/loading states and TanStack Query filter keys remain unchanged.

Advanced Filters now returns directly to Home when opened there, rather than replacing itself with Search. Reset still only changes the advanced filter draft; keyword and route selections are preserved. GPS/manual/worldwide selection remains in the separate existing location store; no new GPS requests, center substitution or radius math were added.

Backend inspection: sibling Laravel routes/web.php exposes GET/POST /listing/search/results, handled by FrontController.searchListings. It returns frontend.listings Blade HTML. Its web form uses ad_type, category_id, weight, from_city_id, to_city_id and departure_on, but this does not establish an authenticated mobile JSON/radius contract. Existing listingsApiVerified guard remains enforced. No endpoint, JSON response or unsupported radius/weight parameters were invented. Live backend search remains blocked until the mobile contract is verified; existing development preview stays isolated/labeled.

Validation:
- npm run typecheck: passed.
- npm run lint: passed.
- Focused Home/Search/Filters/Listings tests: 4 suites, 27 tests passed; Filters was rerun after adding the Home-return regression, all 5 tests passed (28 unique tests overall). Includes structured route/weight navigation, keyword normalization, state synchronization, validation and GPS/manual preservation.
- npm run android: build/install passed on Infinix X655C arm64 in 57 seconds (407 tasks).
- Physical layout check remains pending: guarded device inspection returned hierarchy_unavailable_or_not_foreground. Small-screen/font-scale geometry has not been visually certified.
- git diff --check: passed for modified tracked screen files, Windows line-ending warnings only.

No Profile Dashboard, Reviews, navigation containers, tabs or drawer implementation was changed.
