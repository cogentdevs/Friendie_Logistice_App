# Screen-wise API integration audit

18 November 2026. Strict read-only inspection of current source and read-only Laravel routes/controllers. Only this report was written for the audit. Existing Task15–18 working-tree changes were preserved. No API requests, tests, builds, dependency changes or implementation work were initiated for the audit.

## A. Executive summary

| Status | Count |
|---|---:|
| INTEGRATED | 30 |
| PARTIAL | 0 |
| NOT INTEGRATED | 5 |
| BACKEND BLOCKED | 1 |
| NOT APPLICABLE | 1 |
| **TOTAL** | **37** |

INTEGRATED means the exact operation has a reachable real-data UI flow and response handling. It does **not** mean live verification, all optional parameters are exposed, or the entire screen is complete. There are partial **screen workflows**, particularly Home and Search/Filters, even though no operation required PARTIAL at this operation-level threshold.

Key findings:

- Home never calls GET/home. Categories use their real endpoint. Popular Locations and Latest Ads are static-only and unavailable in normal real-data mode.
- Public Listings/details work in real-data mode. Debug/static gates can select fixtures instead. Search/Filters have incomplete real reference-ID and query compatibility.
- Avatar POST is already integrated through Edit Profile Save Changes, including preview, multipart/avatar and shared Profile/Drawer cache synchronization. Avatar DELETE is not integrated.
- Reset Password is a placeholder; Resend Verification has no frontend flow; GET/auth/me is missing. Current session restoration is local; a dormant legacy hydrate branch points at `/user`, not `/auth/me`.
- Own listing image DELETE is reachable and correctly separate from listing DELETE. Listing DELETE remains backend-blocked409.
- Contact Us is an unconnected form with unset contact configuration. It is outside the37-operation denominator.

## B. Screen-wise integration matrix

Paths are relative to the repository root. For compactness, `F` means `src/features/`; a service filename in a feature row is in that feature's `services/` directory unless its full path is given.

| Actual screen/component/route | API used | Status/behavior | Data source | Evidence: screen → controller/hook → service |
|---|---|---|---|---|
| Splash; Welcome; Onboarding/SendCarryIntro; VerifiedReliable; GlobalReach | No direct37-operation request | Local startup/onboarding; no health ping | Preferences/navigation | `src/navigation/RootNavigator.tsx`; `F/onboarding/screens/*`; `src/app/AppBootstrap.tsx` calls authService.restore |
| Home identity | GET/customer/profile | INTEGRATED for real customer | Profile cache; guest/preview fallback | `F/home/screens/HomeScreen.tsx` → `hooks/useHomeData.ts` → `F/profile/hooks/useProfile.ts` |
| Home Categories, View All/category picker, HomeSearchCard choices | GET/categories | INTEGRATED | API except native static-testing category mode | `F/home/hooks/useHomeData.ts` → `services/homeService.ts::categories` → `categoriesService.ts::getCategories` |
| Home Popular Locations/View All | None | Partial Home feature; fixtures or unavailable | Local country/destination list | `F/home/services/homeService.ts::destinations`; `components/HomeSections.tsx` |
| Home Latest Ads | None in real mode | Partial Home feature; fixture latest3 or unavailable | getDemoListings only | `F/home/services/homeService.ts::latest`; `components/LatestAdsSection.tsx` |
| Home notification badge | None | Count deliberately unavailable; distinct from Dashboard messages count | Unavailable service | `F/home/services/homeService.ts::unread` |
| HomeSearchCard → Results; Listings tab | GET/listings | INTEGRATED endpoint; partial filter compatibility | Real API or public demo gate | `F/listings/screens/ListingsScreen.tsx::{ListingsScreen,HomeResultsScreen}` → `hooks/useListings.ts` → `services/listingsService.ts::getListings` → `publicListingsService.ts::getPublicListings` |
| Search | GET/listings | INTEGRATED endpoint; manual route IDs/date ranges can be incompatible | Real API or demo | `F/search/screens/SearchScreen.tsx` → getListings; `F/listings/services/publicListingsService.ts::publicSearchParams` |
| Filters; BrowseFiltersScreen | No direct request; applies GET/listings state | PARTIAL screen workflow | Local filter stores, native GPS/geocoder | `F/search/screens/FiltersScreen.tsx`; `F/listings/screens/BrowseFiltersScreen.tsx`; `F/location/components/RouteLocationPicker.tsx` |
| Public ListingDetails | GET/listings/{id} | INTEGRATED; ID/schema/provenance validation | Public API or separate demo detail | `F/listings/screens/ListingDetailsScreen.tsx` → `hooks/useListingDetails.ts` → `listingDetailsService.ts::getListingDetails` → `publicListingsService.ts::getPublicListingDetails` |
| Public ListingDetails: Message traveller/initial dialog | POST/customer/conversations | INTEGRATED; explicit message, guest gate, no fixture mutation | Authoritative created/reused conversation | ListingDetailsScreen.message → `F/messages/hooks/useInitialConversation.ts` → `createConversationService.ts::createOrReuseConversation` |
| Public ListingDetails: Write a review/dialog | POST/customer/reviews | INTEGRATED; explicit integer0–5/text, real-ID guard | Authoritative201 review; Given refresh | ListingDetailsScreen.useSubmitReview → `F/reviews/hooks/useSubmitReview.ts` → `submitReviewService.ts::submitReview` |
| ListingDetails: parcel request/call/bookmark | No additional37-operation API | Request unavailable; phone fails closed; bookmark local | Request checks/AsyncStorage | `F/listings/screens/ListingDetailsScreen.tsx::reviewRequest`; `services/listingDetailsService.ts::{requestUnavailableReason,permittedPhone}`; `store/bookmarkStore.ts` |
| Login | POST/auth/login | INTEGRATED; secure session and pending-action transition | Real auth; separate UI preview | `F/auth/screens/LoginScreen.tsx` → `services/authFlowCoordinator.ts` → `authService.ts::login` |
| Register | POST/auth/register | INTEGRATED; verification acceptance then Login | Real API; configured country/calling-code snapshot | `F/auth/screens/RegisterScreen.tsx::submit` → `registrationService.ts::register` |
| ForgotPassword | POST/auth/forgot-password | INTEGRATED; acceptance is not proof of email delivery | Public API | `F/auth/screens/ForgotPasswordScreen.tsx` → `passwordResetService.ts::request` |
| ResetPassword | None | NOT INTEGRATED; registered placeholder | PlaceholderScreen | `F/auth/screens/AuthScreens.tsx::ResetPasswordScreen`; `src/navigation/AuthNavigator.tsx` |
| Verification/Resend Verification | None | No dedicated screen/action found | Register email/Login feedback only | `src/navigation/AuthNavigator.tsx`; `F/auth/screens/RegisterScreen.tsx` |
| Startup/session restore | No current GET/auth/me | Secure local restoration, not server validation | Keychain; protected401 cleanup | `src/app/AppBootstrap.tsx` → `F/auth/services/authService.ts::restore`; conditional hydrate uses `/user` |
| Profile; GuestProfile | GET/customer/profile for real customer | INTEGRATED; guest Sign In/Register without private fetch | Owner profile query/session fallback | `src/navigation/ProfileNavigator.tsx`; `F/profile/screens/{ProfileScreen,GuestProfileScreen}.tsx`; `hooks/useProfile.ts` |
| ProfileDashboard | GET/customer/dashboard; GET/customer/reviews/received | Both INTEGRATED | Authoritative counters; independent three-review preview | `F/dashboard/screens/ProfileDashboardScreen.tsx` → `hooks/useProfileDashboard.ts` → `dashboardService.ts::summary`; `F/reviews/hooks/useDashboardVisitorReviews.ts` |
| EditProfile text Save | GET/customer/profile; PUT/customer/profile | INTEGRATED; changed fields, reauth flags | Existing profile query/response | `F/profile/screens/EditProfileScreen.tsx::save` → `profileEditService.ts::save` |
| EditProfile photo picker/Save | POST/customer/profile/avatar; profile GET when needed | INTEGRATED; local preview then server URL/cache | Local draft + authoritative profile query | `profilePhotoService.ts::chooseProfilePhoto`; `profileAvatarService.ts::uploadProfileAvatar`; profileEditService.save |
| EditProfile Remove Photo | No DELETE | NOT INTEGRATED for saved-avatar deletion | Local removal draft; Save rejects it | EditProfileScreen.setRemovePhoto; profileEditService removeAvatar guard |
| ChangePassword | POST/customer/change-password | INTEGRATED | Real API | `F/settings/screens/ChangePasswordScreen.tsx` → `changePasswordService.ts::update` |
| MyListings | GET/customer/listings | INTEGRATED Active/Expired; Completed unsupported | Account pages; separate preview | `F/listings/screens/MyListingsScreen.tsx` → `hooks/useMyListings.ts` → `myListingsService.ts::getMyListings` → `myListingsApiService.ts::getOwnListingsPage` |
| Own ListingDetails, same screen with returnTo=MyListings | GET/customer/listings/{id} | INTEGRATED; owner read | Private DTO | useListingDetails private branch → `F/listings/services/ownListingDetailsService.ts::getOwnListingDetails` |
| PostListing/SendParcel/CarryParcel + review step | GET/categories/countries/cities/currencies; POST/customer/listings | INTEGRATED; real references;201 Pending0 | API options + multi-step draft | `F/post-listing/screens/PostListingScreen.tsx`, `ListingReviewScreen.tsx::CreateReview` → `hooks/useCreateListing.ts` → `createListingService.ts::createListing`; ListingReferencePicker |
| Create Listing image/review retry | POST/customer/listings/{id}/image | INTEGRATED after confirmed creation; image-only retry | Local preview/server image | `F/post-listing/components/ListingImageInput.tsx`; useCreateListing → `listingImageUploadService.ts::uploadListingImage` |
| Edit Listing, shared Post form mode | Owner detail/reference GETs; PUT/customer/listings/{id} | INTEGRATED; partial changed fields | Owner DTO + separate edit draft | ListingDetails Edit → `F/post-listing/components/ListingEditLoader.tsx` → `updateListingService.ts::{loadListingEdit,updateListing}`; useUpdateListing; ListingReviewScreen.EditReview |
| Own ListingDetails Remove uploaded image | DELETE/customer/listings/{id}/image | INTEGRATED; owned uploaded image + Cancel/Remove | Authoritative owner image/cache refresh | ListingDetailsScreen:556 → `F/listings/hooks/useRemoveListingImage.ts::confirm` → `listingImageDeleteService.ts::removeListingImage` |
| Messages/Conversations | GET/customer/conversations | INTEGRATED; loading/empty/retry/pages | Account inbox; separate local demo | `F/messages/screens/MessagesScreens.tsx::RealInbox` → `hooks/useInbox.ts` → `inboxService.ts::getInboxPage` |
| Chat | Conversation/history GETs; Send/read POSTs | All four INTEGRATED | Real history; separate demo | `F/messages/screens/ChatScreen.tsx` → `hooks/useChat.ts` → `chatService.ts::{getConversation,getMessages,sendMessage}`; useMarkConversationRead |
| MyReviews visitors/your tabs | GET received/given reviews | Both INTEGRATED; independent pages/totals | Real reviewer/reviewed identity/rating/comment/date | `F/reviews/screens/MyReviewsScreen.tsx` → `hooks/useReviews.ts::{useVisitorReviews,useYourReviews}` → reviewsService.feed → visitorReviewsService |
| CustomDrawerContent | Shared Profile data; POST/auth/logout | INTEGRATED; cache observer avoids another profile fetch | Profile cache/Login fallback | `src/navigation/components/CustomDrawerContent.tsx` → `F/auth/services/sessionLogout.ts::logoutSession` → logoutApiService.revoke |
| Bottom Tabs | No standalone request | Navigation/auth gates; children fetch | Navigation | `src/navigation/BottomTabNavigator.tsx` |
| Settings | POST/auth/logout; account navigation | INTEGRATED logout; other settings local | Auth/location/native metadata | `F/settings/screens/SettingsScreen.tsx::logoutSession` |
| ContactUs / root ContactSupport | None | Unconnected form; outside37 | Empty support configuration | `F/support/screens/{ContactUsScreen,ContactSupportScreen}.tsx`; services/contactService.ts::submit |
| HelpSupport | None | ContactUs navigation | Local copy | `F/settings/screens/HelpSupportScreen.tsx` |
| About; PrivacyPolicy; TermsConditions; Disclaimer | None | Local content/readers; not missing APIs | Bundled content/native version/approved external links | `F/about/screens/AboutScreen.tsx`; `F/legal/screens/*`, `services/*Service.ts`, components/LegalDocumentReader.tsx |
| SavedListings; Notifications; Tracking | None | Registered placeholders | PlaceholderScreen | `F/saved/screens/SavedListingsScreen.tsx`; `F/notifications/screens/NotificationsScreen.tsx`; `F/tracking/screens/TrackingScreen.tsx` |

There is no separate Categories/Popular Locations/Own Listing Details/Submit Review screen: these are sections, pickers, shared ListingDetails modes or dialogs. Edit Listing is Post form mode. ProfileScreens/PostScreens/settings About compatibility exports are aliases, not duplicate implementations.

## C. Exact37-operation checklist

All paths include `/api/v1`. Backend authority: sibling `friendie_logistics_backend/routes/api.php`; exact controller methods were inspected where needed. Central transport: `src/services/api/apiClient.ts` plus existing auth/error interceptors. Private services use captured secure Bearer/session checks; public services explicitly suppress authentication.

| # | Method | Endpoint | Consuming screen | Status | Evidence |
|---:|---|---|---|---|---|
| 1 | GET | /api/v1/health | None required | NOT APPLICABLE | HealthController.__invoke returns operational status/api_version; no frontend health request or required end-user health workflow. Not counted as integrated. |
| 2 | GET | /api/v1/home | Home candidate | NOT INTEGRATED | No frontend call/registry entry; homeService latest/destinations static-only. Backend HomeController returns categories/featured_listings/latest_listings. |
| 3 | GET | /api/v1/categories | Home, Create/Edit Listing | INTEGRATED | F/home/services/categoriesService.ts::getCategories → apiClient.get(endpoints.categories), data.items; homeService and listingReferencesService consume it. |
| 4 | GET | /api/v1/countries | Create/Edit Listing | INTEGRATED | F/post-listing/services/listingReferencesService.ts::getListingReferences('countries') → ListingReferencePicker/edit initialization. |
| 5 | GET | /api/v1/cities | Create/Edit Listing | INTEGRATED | Same service('cities',countryId), params.country_id and matching response country validation. |
| 6 | GET | /api/v1/currencies | Create/Edit Listing | INTEGRATED | Same service('currencies'); real codes and reference registry feed form choice. |
| 7 | GET | /api/v1/listings | Listings, Results, Search | INTEGRATED | F/listings/services/publicListingsService.ts::getPublicListings → GET endpoints.listings; items/pagination normalized into cards. Filter limitations below. |
| 8 | GET | /api/v1/listings/{id} | Public ListingDetails | INTEGRATED | publicListingsService.getPublicListingDetails → GET listing path; matching ID/schema; WeakMap remote identity. |
| 9 | POST | /api/v1/auth/register | Register | INTEGRATED | F/auth/services/registrationService.ts::register posts endpoints.register; form payload and acceptance handling. |
| 10 | POST | /api/v1/auth/login | Login | INTEGRATED | F/auth/services/authService.ts::login posts endpoints.login; loginResponseSchema, secureStorage.setSession, auth/pending transition. |
| 11 | POST | /api/v1/auth/forgot-password | ForgotPassword | INTEGRATED | passwordResetService.ts::request posts endpoints.forgotPassword; privacy-preserving response validated. |
| 12 | POST | /api/v1/auth/reset-password | Placeholder route | NOT INTEGRATED | F/auth/screens/AuthScreens.tsx only PlaceholderScreen; no request/service. |
| 13 | POST | /api/v1/auth/resend-verification | None | NOT INTEGRATED | Backend route exists; no matching frontend call, endpoint entry or resend action. |
| 14 | GET | /api/v1/auth/me | No correct current call | NOT INTEGRATED | authService.restore uses local getSession; legacy hydrate points at endpoints.me='/user'. |
| 15 | POST | /api/v1/auth/logout | Profile/Drawer/Settings | INTEGRATED | F/auth/services/sessionLogout.ts → authService.logout → logoutApiService.ts::revoke; token cleanup follows confirmation. |
| 16 | GET | /api/v1/customer/dashboard | ProfileDashboard | INTEGRATED | F/dashboard/hooks/useProfileDashboard.ts → services/dashboardService.ts::summary; dedicated summary response. |
| 17 | GET | /api/v1/customer/profile | Home/Profile/EditProfile; Drawer cache observer | INTEGRATED | F/profile/services/profileService.ts::getProfile; profileResponseSchema/normalizeProfile; useProfile owner key. |
| 18 | PUT | /api/v1/customer/profile | EditProfile Save | INTEGRATED | profileEditService.ts::save posts changed JSON via apiClient.put(endpoints.profile); profile/reauth flags parsed. |
| 19 | POST | /api/v1/customer/profile/avatar | EditProfile picker + Save | INTEGRATED | profileAvatarService.ts::uploadProfileAvatar; exact multipart avatar,200 URL; profileEditService/save → shared profile cache. |
| 20 | DELETE | /api/v1/customer/profile/avatar | No server deletion action | NOT INTEGRATED | Remove Photo only sets local removal draft; profileEditService removeAvatar guard rejects Save; no matching DELETE call. |
| 21 | POST | /api/v1/customer/change-password | ChangePassword | INTEGRATED | F/settings/services/changePasswordService.ts::update posts endpoints.changePassword; screen mutation invokes it. |
| 22 | GET | /api/v1/customer/listings | MyListings Active/Expired | INTEGRATED | F/listings/services/myListingsService.ts::getMyListings → myListingsApiService.ts::getOwnListingsPage; status1/2,page/per_page. |
| 23 | POST | /api/v1/customer/listings | Post/Create review | INTEGRATED | F/post-listing/hooks/useCreateListing.ts → createListingService.ts::createListing;201 Pending0 DTO verified. |
| 24 | GET | /api/v1/customer/listings/{id} | Own details/edit/image reconciliation | INTEGRATED | F/listings/services/ownListingDetailsService.ts::getOwnListingDetails; private useListingDetails and loadListingEdit. |
| 25 | PUT | /api/v1/customer/listings/{id} | Edit Listing review | INTEGRATED | F/post-listing/services/updateListingService.ts::updateListing; apiClient.put(myListings/id,changed fields); useUpdateListing/EditReview. |
| 26 | DELETE | /api/v1/customer/listings/{id} | No successful workflow | BACKEND BLOCKED | Laravel CustomerListingController.destroy explicitly returns409 until safe retention policy approved; never destructively tested. |
| 27 | POST | /api/v1/customer/listings/{id}/image | Create image/review retry | INTEGRATED | F/post-listing/services/listingImageUploadService.ts::uploadListingImage; multipart image after authoritative creation; image-only retry. |
| 28 | DELETE | /api/v1/customer/listings/{id}/image | Own details confirmation | INTEGRATED | F/listings/services/listingImageDeleteService.ts::removeListingImage; DELETE exact image path, no body; useRemoveListingImage.confirm. |
| 29 | GET | /api/v1/customer/conversations | Messages/Conversations | INTEGRATED | F/messages/services/inboxService.ts::getInboxPage → useInbox/RealInbox; items/pagination/unread/real ID navigation. |
| 30 | GET | /api/v1/customer/conversations/{id} | Chat | INTEGRATED | chatService.ts::getConversation → readChat(base ID path); useChat.conversation → participant header. |
| 31 | GET | /api/v1/customer/conversations/{id}/messages | Chat | INTEGRATED | chatService.getMessages → readChat(path+'/messages',page/per_page); ordered/deduplicated useChat pages/bubbles. |
| 32 | POST | /api/v1/customer/conversations | Public details initial dialog | INTEGRATED | createConversationService.ts::createOrReuseConversation; post_ads_id/message;200/201 parsed; useInitialConversation navigates real conversation ID. |
| 33 | POST | /api/v1/customer/conversations/{id}/messages | Chat Send | INTEGRATED | chatService.sendMessage posts message;201 authoritative record; useChat confirmed insertion/unknown-delivery guard. |
| 34 | POST | /api/v1/customer/conversations/{id}/read | Active visible Chat | INTEGRATED | useMarkConversationRead → chatService.markConversationRead; POST(path+'/read',undefined), no body; authoritative Inbox/Dashboard invalidation. |
| 35 | GET | /api/v1/customer/reviews/received | Dashboard preview; MyReviews visitors | INTEGRATED | F/reviews/services/visitorReviewsService.ts::getReceivedVisitorReviews → shared getReviewFeed('received'); independent UI pagination scopes. |
| 36 | GET | /api/v1/customer/reviews/given | MyReviews your tab | INTEGRATED | Same service.getGivenReviews → getReviewFeed('given'); reviewsService.authored and useYourReviews. |
| 37 | POST | /api/v1/customer/reviews | Public details review dialog | INTEGRATED | F/reviews/services/submitReviewService.ts::submitReview; post_ads_id/rating/review,201 record checks; useSubmitReview refreshes Given appropriately. |

## Search/filter and reference-data detail

`publicListingsService.publicSearchParams` is the real builder. Optional parameters absent from UI do not make an otherwise working GET endpoint missing.

| Supported backend parameter | Actual wiring/limitation |
|---|---|
| search | Home/Search query → trimmed search, adapter max100. Home input/schema allow200, so101–200 fail before HTTP. |
| category_id | Home category.id → filters.category → validated numeric ID. |
| from_country_id / from_city_id | Adapter maps filters.from IDs, but current manual RouteLocationPicker normally supplies no backend IDs and clears IDs after label edits. No real country/city selector is connected to Search. |
| to_country_id / to_city_id | Same limitation. destinationCountry.id can map to to_country_id, but Home locations are static/unavailable rather than real reference choices. |
| ad_type | send/carry → exact Send/Carring; reachable through Home/type filters. |
| weight | weightKg → integer weight. Home form permits positive decimals/rejects0 while real adapter requires integers/allows0: inconsistent UI validation. |
| departure_on | Exact date or range whose start=end; multi-day ranges are rejected before HTTP. |
| sort | No SearchFilters property/publicSearchParams wiring; uses backend default ordering. |
| page | Infinite-query page starting1; existing end/duplicate-page guards. |
| per_page | Fixed20; no user page-size selector. |

Radius/GPS proximity, verifiedOnly=true, availableNow=true and legacy origin/destination text are unsupported by this exact contract. The real adapter raises validation errors rather than sending invented keys. Local/demo filter behavior is not real server support. Filter-scoped query keys/AbortSignals are present; no runtime network race experiment was performed in this audit.

Reference consumers:

- Categories: Home/HomeSearchCard/View All and Create/Edit Listing. Optional service search exists without a dedicated category-search screen.
- Countries/cities/currencies: `F/post-listing/components/ListingReferencePicker.tsx` and edit initialization call `listingReferencesService.getListingReferences`. City requests include country_id and verify returned ownership; origin/destination state is separate.
- Register uses `F/auth/schemas/registerSchema.ts::phoneCountries` and configured registrationCountryIds, not GET/countries/cities/currencies.
- Search/Filters use manual RouteLocationPicker, native GPS/geocoder/local stores, not those reference APIs. Creation's real reference selectors do not automatically fix Search.

## D. Missing APIs and partial workflows

| Missing operation | Affected workflow / missing behavior | Existing UI | Required frontend work | New visible UI authorization? |
|---|---|---|---|---|
| GET/home | Home aggregate/latest not fetched | Home sections/cards/loading/retry | Verify/map Home response into existing sections and coordinate Categories fetches. Featured data does not authorize a new section. | No for wiring existing sections; yes for new UI. |
| POST/auth/reset-password | Password reset form/submission/token flow missing | Route with token/email params; placeholder | Verify complete rules/response/deep-link behavior; add actual reset form/service. | **Yes**, missing controls. |
| POST/auth/resend-verification | No resend request/action | Register email feedback/Login | Verify complete privacy/validation contract; add approved resend entry point/request guards. | **Yes**, new action/form. |
| GET/auth/me | Current restore local; legacy path wrong | Existing bootstrap/session restore | Verify actual DTO, correct path/parser, and deliberately integrate restore validation preserving current cleanup. | No inherently new UI. |
| DELETE/customer/profile/avatar | Saved image cannot be deleted | Existing Remove/Restore/Save local draft | Verify exact delete response/recovery semantics; connect existing action and shared cache; keep local selection removal separate. | Existing action available; any new confirmation/control requires authorization. |

Additional partial workflows, not extra missing operations:

1. Real Search/Filters need reference-ID choices and validation/query agreement. Visible selector changes require scoped authorization. Do not invent radius/verification/availability endpoints.
2. Sort is not wired. A new visible sort control needs authorization.
3. MyListings correctly maps Active→Published1 and Expired→Expired2. Completed has no backend equivalent; Pending0 exists but has no tab. A Pending-view UI is a separate decision, not a new API. Do not relabel Pending as Completed.
4. Own listing DTOs provide location IDs/areas. Cards use area/Location unavailable instead of fabricated country/city names; references resolve names for edit prefilling, not all cards/details.
5. `reviewRequest()` is the parcel-request workflow, not Submit Review. Request submission/contact permission remains unavailable; no request endpoint is in this checklist.
6. Real Profile header statistics/review averages are not fabricated. Dashboard uses actual summary fields; no average-rating operation exists among these37.

## E. Static/demo and informational screens

- `src/constants/appConfig.ts` enables staticMarketplaceEnabled in __DEV__ or native staticTesting builds. `isListingDemoMode` delegates to that gate. Therefore debug/static public listing/details and Home destinations/latest can be fixtures even though real services exist. Release real-data mode uses actual listings. Device-native runtime flags were not queried.
- Home Categories use fixtures only with native staticTestingBuild AND marketplace mode. Plain debug can therefore show real numeric category IDs beside fixture listings. `demoListings.getDemoListings` matches fixture category names, so those numeric selections yield no matching fixtures; no automatic ID translation/fake matching results were found.
- Remote object provenance prevents fixture listings from real Create/Reuse or Submit Review. Listing creation uses verified real reference IDs; image upload/delete use confirmed creation/owner records. Numeric identity alone is not proof.
- Private Profile/MyListings/review/inbox/chat paths have separate real-account guards. Demo Login/Chat are local, not backend session proof.
- SavedListings, Notifications and Tracking are actual placeholders. Bookmarks elsewhere are account-keyed AsyncStorage; none of these missing workflows adds another operation to the37 count.
- About/onboarding are local content. Legal services read bundled draft/approved documents; editorial approval is a content concern, not a missing legal API.
- ContactUs/ContactSupport share one form. `F/support/services/contactService.ts::supportConfig` has no email/phone/address/hours and categories is empty; submit validates then rejects without HTTP. No mailto:/tel: action was found there. There is no Contact Us endpoint in the37 contract; do not invent one or count a missing38th operation.

## F. Duplicate, incorrect and dormant usage

1. **Verified dormant wrong path:** endpoints.me='/user'; authService.hydrate would GET/api/v1/user, while the backend route is GET/api/v1/auth/me. With current loginApiEnabled=true, restore uses getSession. A legacy branch can invoke hydrate if Login API is disabled and authApiVerified enabled; it is not a working auth/me integration.
2. `listingsService.buildListingSearchParams` contains proposed radius/verified_only/available_now/nested-route parameters but is not used by real getListings. Do not report its fields as actual HTTP traffic.
3. Layered services are generally adapters, not duplicate clients/transports: Received reviews share one HTTP/parser across Dashboard/MyReviews; Drawer observes profile cache without another GET; owner detail reads are reused for edit/image reconciliation. Only one Axios.create was found in src/services/api/apiClient.ts.
4. Chat history's initial page1 read followed by the actual latest page is intentional pagination initialization. Mark as Read is an intentional guarded lifecycle mutation, not a duplicate Send operation.
5. Create/Reuse distinguishes201 (initial message persisted; no Send POST) from200 (draft handoff for explicit Chat Send). useInitialConversation also preserves a conflicting existing Chat draft. No automatic second POST for the initial message was found.
6. Compatibility screen exports are aliases, not independently fetching copies. reviewsService.summary is unavailable for real users and used for demo summary; it is not an unintegrated fourth Reviews endpoint. Its mapWebsiteReview helper is legacy compatibility, not the actual API parser.
7. No other wrong method/path was established for the30 integrated operations. This does not claim zero possible runtime duplicate requests: no network/device trace was captured.
8. Registry/proposed-contract comments and prior reports can lag actual code. They were not treated as authoritative proof of current integration.

## G. Recommended next tasks

1. Integrate GET/home for existing Home data/latest cards. Backend HomeController returns categories/featured_listings/latest_listings, **not popular-location rankings**. A countries catalogue alone does not establish popularity; obtain a data/UX decision instead of inventing rankings.
2. Complete real Search/Filters reference selection and supported-query/UI validation compatibility, preserving existing public browsing and fixture separation.
3. Integrate saved-avatar DELETE through verified contract and approved existing/new interactions. Avatar POST is already implemented; do not recreate Task18 as missing.
4. Integrate correct GET/auth/me validation without breaking secure local restoration or conditional401 cleanup.
5. Implement Reset Password and Resend Verification after full contract checks and authorization for missing visible controls.
6. Keep listing DELETE blocked until backend retention policy changes are separately authorized. Do not substitute archive/status changes.
7. Scope Contact Us/content/placeholder work separately with authoritative requirements. Do not invent APIs to improve the37 count.

## H. Verification levels and limitations

| Level | Actual evidence |
|---|---|
| Source code verified | Current routes/screens/hooks/services/registry/config inspected; read-only Laravel routes and relevant controllers inspected. Exact methods/paths and reachable real-data branches traced above. |
| Automated tests verified | Prior authorized Task18 artifacts inspected, **not rerun for this audit**: `.validation/task18/full-complete.json` records93passed/0failed/2skipped suites;1,356passed/0failed/2skipped tests, exit0. `.validation/task18/regression-verified.json`:21suites/405PASS, exit0. These are controlled tests, not live backend proof or coverage of missing operations. |
| Static/build evidence | Prior Task18 final TypeScript/scoped ESLint exit0. Its already-running Android arm64 build completed during inspection: `.validation/task18/android-arm64.log`, BUILD SUCCESSFUL1m46s,407tasks/16executed/391up-to-date, exit0. **No tests/builds were started for the audit.** Prior Task18 report text still has pending markers; actual artifacts establish execution. |
| Live authenticated API | **NOT VERIFIED.** No authenticated request/mutation performed in audit. Prior Task18 public connectivity probe timed out after10s, HTTP000/curl28; it does not verify protected APIs. |
| Physical device | **NOT VERIFIED.** No installed-app operation/gallery upload performed. |
| Screenshot visual equivalence | **NOT VERIFIED.** Source/test evidence is not rendered visual equivalence. |

Only `docs/SCREEN_WISE_API_INTEGRATION_AUDIT.md` was written for this audit. No frontend source/UI/navigation/API contract/config/dependency/test, Laravel/website/admin, database/schema/migration or business-rule changes were made. Existing Task15–18 work was not undone or edited.
