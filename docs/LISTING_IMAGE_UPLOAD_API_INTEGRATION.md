# Task 15 - Listing Image Upload API integration

## Outcome and original UI blocker

Implemented the explicitly approved optional image flow inside the existing Post/Create Listing form and review step. Earlier inspection found no listing-image picker, preview, selected-image state or retry action. The user's follow-up authorized Choose image, local preview, local Remove, upload outcome/progress feedback and definite-failure image-only Retry. Those specific controls are now added using existing Friendie primitives; no additional image-management screen or navigation route was added.

Existing Carry/Send, title/category/currency, real country-dependent cities, dates, optional integer weight and Create Listing JSON behavior remain. No image is included in Create JSON. Existing dirty work was preserved; no reset, branch change or commit occurred.

## A. Authoritative contract (Laravel read-only inspection)

Sources in sibling friendie_logistics_backend:

- routes/api.php
- app/Http/Controllers/Api/V1/CustomerListingController.php: uploadImage, owned, editable, lockCustomer, input, limit
- app/Services/Api/CustomerListingImageService.php
- app/Support/Api/PublicData.php: image/mediaBaseUrl
- app/Support/ApiResponse.php

**POST /api/v1/customer/listings/{id}/image**, Sanctum customer Bearer, multipart/form-data, exactly one required file part **image**. The frontend reuses endpoints.myListings plus the confirmed ID and /image on the centralized Axios instance. No hardcoded host, second client, query/body extras or duplicate API prefix.

Verified validation:

- Required actual decodable file/image.
- MIME: image/jpeg, image/png, image/webp.
- Extensions: jpg, jpeg, png, webp. No GIF, HEIC, SVG, video or Base64 JSON support was invented.
- Maximum 2048 KiB: **2,097,152 bytes** inclusive.
- Both width and height: **1..2048 pixels** inclusive.
- No separately declared byte minimum beyond a valid decodable image; frontend rejects empty/unavailable file-size metadata rather than fabricating bytes or assuming the maximum is satisfied.
- One image. Ownership is created_by=current customer; invalid/missing/non-owned ID returns 404. Current active, verified eligible customer/token are rechecked under transaction lock. Supported listing statuses are existing 0/1/2; unsupported status returns 409.
- Image operation limit: 10 attempts/account/IP per hour, 429 with Retry-After. No verified idempotency key/exactly-once guarantee.

Success is **HTTP 200**:

```ts
{
  success: true,
  message: 'Listing image updated successfully.',
  data: { image_url: string | null }
}
```

Response contains no listing ID or full record. A usable absolute HTTP(S) image URL is required to confirm a usable saved-image result in the frontend. A null/invalid URL or malformed/incorrect-status success is held as uncertain and reconciled with owner details where possible; no URL is fabricated.

Backend decodes via GD/Intervention, scales down within 420x340, encodes JPEG quality85 and writes a unique api_listing_{id}_{random32hex}.jpg in existing public/frontend/img/listing. Frontend does not crop, resize, edit or construct this filename.

**Replacement is supported:** uploading assigns the newly stored file to the owned listing and updates updated_at without changing listing status. The operation does not call image DELETE or remove the old stored image through another endpoint. Repeated uploads can create distinct files, so retry is not assumed harmless/idempotent. Transaction failure discards only the current new file. Image deletion remains outside scope.

## B. Added UI and selection behavior

- Optional Choose image button on the existing Post form uses installed react-native-image-picker gallery API, one photo, supported MIME filter, no Base64 or extra metadata request and no new dependency/native permission configuration.
- Selected local image previews immediately using React Native Image, with a local unavailable-preview fallback on decoding/loading error.
- Local Remove clears only the unsaved draft selection and makes no API request. Selection is locked while a confirmed listing has retained upload/recovery context, preventing a different selection from silently replacing that request.
- Review displays the selected image, real created listing ID, upload progress and outcome. Definite failure shows Retry image upload. Unknown/pending outcomes keep Retry disabled. Confirmed response URLs replace local preview state when retained on screen.
- Native picker cancellation preserves the existing image. Permission/picker errors use the existing Toast. Invalid selected metadata is retained for local inspection/removal where safe and cannot be submitted.
- Picker and validation callbacks check mount/current account; delayed selection cannot restore another account's image.

Selection service validates native picker URI/type/fileSize. Android content:// and file:// remain intact. Absolute local picker paths become file:// URIs; no content URI is rewritten into a guessed filesystem path. Remote/data URLs and control characters reject. Missing filename receives a safe MIME-compatible multipart filename; unsafe filename characters are not copied into multipart headers. An explicitly unsupported extension is rejected, and filename extension alone never establishes MIME/validity.

**Dimensions/accessibility:** React Native Image.getSize decodes the local URI and provides actual width/height; supplied picker dimensions are not trusted as proof. Validation runs after selection, before creation, and again before upload/retry to detect expired/inaccessible content. Limits include 1px and 2048px boundaries. A native decode failure rejects without POST. Byte size must be finite, positive, available from the native picker and <=2 MiB; unavailable size fails closed with reselect guidance. Laravel remains authoritative for actual uploaded bytes, MIME and decoding. No file contents are logged or converted to Base64.

## C. Request implementation and identity safety

- Existing createListingService retains the actual parsed 201 record on its account/session-scoped submission entry and exposes an identity check for that exact record.
- Upload requires that current-session confirmed record object, not a bare numeric ID, cloned fixture or navigation guess. The primary authorized integration is newly created listings; no owner-details edit/replace action was added.
- uploadListingImage validates file, reads actual secure token, uses FormData.append('image', {uri,name,type}) and POSTs to the confirmed listing ID.
- The JSON default is overridden with multipart/form-data using the existing profile-upload strategy; no hand-built boundary or JSON.stringify(FormData). The React Native adapter supplies the actual transport boundary.
- The focused adapter test runs actual centralized Axios transforms with React Native's real FormData polyfill and confirms that one file descriptor survives as multipart rather than a JSON/URI string.
- User-object/status, token identity, AbortSignal and generation guards surround asynchronous work. Missing secure credentials follow existing conditional token/session cleanup. Guest/demo cannot upload. Backend 403/404/ownership and eligibility checks are respected.

The service's account/listing attempt guard prevents concurrent and confirmed replay requests, including new hook instances/remounts. Retry also verifies it still owns the current recovery object, so an old callback after success cannot restore obsolete recovery or send again. Only a confirmed rejection or a pre-dispatch validation failure permits another explicit upload. No timer/effect/focus/login callback sends a multipart request.

## D. Create -> upload outcomes

| Outcome | Behavior |
|---|---|
| No image selected | Original Task 14 Create-only flow; no upload POST |
| Invalid selected image | No Create or upload POST; complete draft/preview retained |
| Create rejected | Existing Create feedback/guard handling; no upload |
| Create timeout/unknown | Existing unknown-creation protection and full image draft retained; no guessed ID/upload |
| Create 201 + image 200 usable URL | One combined success Toast, authoritative invalidation, unchanged submitted draft clears, existing owner-details navigation |
| Create 201 + definite image rejection | Listing remains created (initial status Pending); ID/image/full submitted draft retained; clear image-failure feedback; explicit image-only Retry available |
| Create 201 + timeout/lost response/server error/malformed image response | Warning, retained context, owner GET reconciliation when current/not cancelled; no automatic upload retry or listing recreation |
| Navigation before image dispatch | Confirmed ID is retained as not uploaded; explicit safe image-only continuation/retry, never a second Create |
| Image confirmed but cache refresh fails | Remains confirmed; warning to refresh, no unsafe duplicate upload |

Retry uses only retained listing/image context. It cannot call POST /customer/listings. Double taps/concurrent handlers are blocked by hook and service guards. Full recovery context resides in the existing session-cleared listing draft store. Discarding the editable working copy cannot erase the confirmed-ID recovery context and accidentally authorize recreating that listing. Logout/account replacement clears it, including same-ID session replacement.

An uncertain upload invokes the existing owner-details GET when safely possible and records the observed image URL. A changed URL alone is not proof that this particular selected image was stored; another update could explain it. Without a returned matching confirmation or documented reconciliation/idempotency support, uncertain Retry stays disabled. No automatic resend or false delivery claim.

Newer user edits are preserved rather than cleared by the old submission's success. Draft/image state and mutation guards are memory-only, consistent with the existing Post architecture; application termination/new login is not a durable idempotency guarantee. Native provider URI access may expire and is revalidated before each attempted upload.

## E. Cache and image synchronization

Creation retains Task 14 authoritative My Listings/Dashboard invalidation. Successful image upload separately cancels stale reads then invalidates:

- ['myListings.read', 'user:' + accountId]
- ['ownListingDetails', accountId, String(listingId)]
- Real public listings and the corresponding public listing-details queries, excluding demo/static data. No pending record is manually inserted or made public.

Active queries refetch, inactive queries are invalidated for normal next access. The existing owner-details navigation loads the actual backend image. No manual listing records, status changes, pagination rewrites, ordering guesses or counter arithmetic occur. Dashboard is not invalidated a second time solely for the image; no unread/review/statistics changes are invented.

A verified image-rendering bug was fixed minimally: Details previously retained one boolean failed-cover flag for the same listing ID, hiding a newly returned cover URL after an earlier failure. Failure now belongs to the URL that failed. A new authoritative URL renders normally, and a late error from the old URL cannot hide it. Existing cover layout/dimensions/placeholder/style are unchanged. A regression test exercises both cases on the same owned listing ID. The new local preview also scopes failure to its URI, with a separate regression ensuring an older preview error cannot hide a different newly selected image.

Image URLs come directly from the existing API serializer/resolver. Backend media configuration uses api.public_base_url with app.url fallback, validates filename/path containment/file and may return null if unavailable. No device host, relative-media-root assumption, random cache buster, new storage provider or backend storage modification. Unique backend filenames already avoid same-URL replacement caching. Upload success feedback confirms only the saved image; it does not assume the listing is still Pending during a later retry. Current status remains authoritative through owner-details reads.

MyListingCard has no existing listing-cover display; no image card redesign was added. Its read DTO remains synchronized through the existing cache. There was no existing owner image-edit UI to reuse, so this task adds no such action/screen.

## F. Errors and notifications

HTTP 400/401/403/404/409/413/415/422/429 are treated as rejected operations where applicable; safe explicit image-only retry retains file/context. HTTP 500, lost network response, timeout, post-dispatch cancellation and malformed success remain potentially processed/uncertain. Unknown codes do not imply safe retry. Not all listed codes are claimed to originate from Laravel's controller.

All new notification feedback uses only react-native-toast-message / Toast.show with the unchanged global white-card, left-bar styling and existing colors. Selection/progress/outcome inline feedback belongs to the approved form controls. No extra notification popup/root/library, Alert notification, ToastAndroid or Snackbar was introduced. Existing Post leave-confirmation dialogs remain genuine confirmations.

## G. Files changed for Task 15

Production:

1. src/features/post-listing/services/listingImageSelection.ts (new) - native selection, URI/metadata and decoded-dimension validation.
2. src/features/post-listing/services/listingImageUploadService.ts (new) - multipart endpoint, confirmed-record proof, session/duplicate/unknown guards and errors.
3. src/features/post-listing/components/ListingImageInput.tsx (new) - approved picker/preview/local Remove.
4. src/features/post-listing/types/listingDraft.ts - optional image draft fields only; Create payload remains explicit JSON fields.
5. src/features/post-listing/store/listingDraftStore.ts - existing store's account-cleared image recovery context.
6. src/features/post-listing/services/createListingService.ts - retain authoritative confirmed record/proof; prevent resetting creation while recovery exists.
7. src/features/post-listing/hooks/useCreateListing.ts - sequence/outcomes, image-only retry and cache synchronization.
8. src/features/post-listing/screens/PostListingScreen.tsx - authorized optional image controls.
9. src/features/post-listing/screens/ListingReviewScreen.tsx - authorized preview/progress/outcome/Retry.
10. src/features/listings/screens/ListingDetailsScreen.tsx - cover failure scoped to URL, with unchanged appearance.

Tests/documentation:

11. __tests__/listingImageUploadApi.test.ts (new)
12. __tests__/ListingImageFlow.test.tsx (new)
13. __tests__/ListingDetails.test.tsx - same-ID new-cover/late-error regression; earlier work/assertions preserved.
14. docs/LISTING_IMAGE_UPLOAD_API_INTEGRATION.md - original blocker replaced with authorized implementation and actual verification.

No endpoint/client/configuration/dependency/native file changes. Existing unrelated dirty/untracked files remain untouched by Task 15. Logs/results are under .validation/task15; initial status snapshot is .validation/task15-status-before.txt.

## H. Actual verification

Final verification against the current Task 15 source:

| Check | Actual result | Exit | Evidence |
|---|---|---|---|
| Focused image/Create/Post/Details regressions | **7 suites, 221 PASS**, 0 FAIL, 0 SKIP; 18.956 seconds | 0 | .validation/task15/focused-finalized.json/.log/.exit.txt |
| Unfiltered full Jest suite | **90 suites: 88 PASS, 2 existing skipped; 1198 tests: 1196 PASS, 0 FAIL, 2 existing SKIP**; 178.475 seconds | 0 | .validation/task15/full-final.json/.log/.exit.txt |
| TypeScript | PASS, no diagnostics | 0 | .validation/task15/typecheck-final.log/.exit.txt |
| Scoped ESLint | PASS, no warnings/errors | 0 | .validation/task15/eslint-final.log/.exit.txt |
| Android arm64 debug | BUILD SUCCESSFUL in 11m14s; 407 tasks, 28 executed / 379 up-to-date | 0 | .validation/task15/android-delivery.log/.exit.txt |
| Non-mutating public connectivity | Connection refused / HTTP 000 | 7 | .validation/task15/connectivity.log/.exit.txt |

Exact commands (stdout/stderr and actual native exit codes saved separately):

```powershell
npx jest __tests__/listingImageUploadApi.test.ts __tests__/ListingImageFlow.test.tsx __tests__/CreateListing.test.tsx __tests__/createListingApi.test.ts __tests__/PostListing.test.tsx __tests__/ListingDetails.test.tsx __tests__/ownListingDetails.test.ts --runInBand --testTimeout=60000 --json --outputFile=.validation/task15/focused-finalized.json
npx jest --runInBand --testTimeout=60000 --json --outputFile=.validation/task15/full-final.json
npx tsc --noEmit
npx eslint src/features/post-listing src/features/listings/screens/ListingDetailsScreen.tsx __tests__/listingImageUploadApi.test.ts __tests__/ListingImageFlow.test.tsx __tests__/ListingDetails.test.tsx
# Working directory: android
.\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain
```

Focused inventory: 69 Listing Image API/selection tests, 20 image-flow/UI/controller tests, 19 Listing Details tests, 27 owner-details tests, 19 existing Create controller tests, 55 existing Create API/reference tests and 12 Post tests. The Task 15 inventory adds 90 tests relative to 1106 PASS: 89 tests in the two new suites plus one same-ID cover regression in the existing details suite. No existing test was deleted, weakened or newly skipped; no snapshots were updated.

Coverage includes JPEG/PNG/WebP, exact byte/dimension boundaries, unsupported MIME/extension, unreliable metadata/URI/decode failure, one multipart file field, real-ID provenance, actual Axios transform/header behavior, cancellation, Gallery cancel/permission failures, local preview/Remove, 201-before-200 sequencing, absent image, no upload on rejected/unknown Create, separate creation/upload outcomes, definite-failure image-only Retry, unknown hold/reconciliation, no second Create, duplicate/stale Retry handlers, session/account/blur/unmount protection, cache invalidation/counter preservation and old-image-error/new-image-URL rendering.

The full unfiltered run includes existing My Listings, owner/public details, Categories, Login/Logout/session, Profile/avatar/password, Dashboard, Given/Received/Submit Reviews, Inbox/Chat History/Send/Read/Create-Reuse, guest/demo/static and App navigation regressions. The stale Retry, same-ID cover and different-local-preview regressions are explicitly present and PASS in the full JSON. The two existing environment-gated skips remain registration.live.test.ts and categories.live.test.ts. Existing React act warnings and registration diagnostic output are recorded, not hidden or treated as failing assertions.

An earlier full/build execution lost its process handles when the environment resumed. No success was inferred from those incomplete logs; they were preserved as full-interrupted.log and android-arm64-interrupted.log. The final full-final/android-delivery commands above were started again and their actual completed results are the report's evidence.

Initial focused development run exposed Node's global FormData lacking React Native file-part semantics in the new tests. The tests now bootstrap the actual installed native polyfill before Axios, following the existing profile-avatar tests. TypeScript overload/fixture annotations in test helpers were corrected. Production multipart logic was not weakened, no tests were deleted/newly skipped, and earlier failed logs remain available.

## I. Live API and device status

A non-mutating Categories request used the existing generated environment's apiBaseUrl; it returned **curl exit 7, HTTP 000, connection refused**. No development host was hardcoded in application code or changed. No test credentials were supplied/invented, no authenticated creation/upload was executed against live Laravel, and no live duplicate listing/image was created for testing.

**LIVE AUTHENTICATED API: NOT VERIFIED**

**PHYSICAL DEVICE: NOT VERIFIED**

Device gallery permissions/content-URI lifetime, real file delivery/backend persistence, Android rendering/navigation, media URL reachability and real ownership/eligibility responses remain unverified. Android output artifact exists at android/app/build/outputs/apk/debug/app-debug.apk. Gradle reported packageDebug UP-TO-DATE and reused the existing debug APK; build success is not device deployment/rendering verification. Build logs include nonfatal cross-drive native-library hard-link fallback to copying and Gradle deprecation notices. No APK installation/device control is claimed. Automated fixtures are dummy server-shaped data, not live API evidence.

## J. Remaining limits and scope confirmation

UI authorization blocker is resolved. No new UI approval is required for the implemented five controls. Unknown delivery cannot safely be auto-unlocked using an image URL alone; lack of backend correlation/idempotency remains an explicit recovery limitation. Unknown or unavailable native byte-size metadata rejects safely rather than allowing an unchecked large upload. Session-only recovery does not survive application termination.

No Laravel, website, admin, database, table/column, migration, storage, business-rule or listing-status changes. No image deletion, listing update/delete, avatar API or unrelated endpoint was implemented. No new API client, auth store, image cache or notification library. No unrelated layout, theme, font, card, navigation, Bottom Tab or Drawer redesign. Existing Create/Carry/Send/reference, My Listings/Details, Profile/Dashboard, Reviews, Messaging, guest/demo and public marketplace integrations remain preserved and are covered by the regression results above.
