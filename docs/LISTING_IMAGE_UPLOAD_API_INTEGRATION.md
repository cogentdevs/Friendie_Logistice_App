# Task 15 - Listing Image Upload inspection and UI authorization blocker

## Status

**Blocked before application implementation: required listing-image UI does not exist.**

Task 15 section 23 explicitly requires: "If a new visible control is required, request explicit UI authorization before adding it." Section 10 also forbids adding a new visible upload/replace action without approval. This attachment authorizes integration with an existing picker; it does not authorize introducing the missing Post image controls. The prior Task 14 approval covered title, category, currency, dates, country/city selectors and Create listing only.

No application code, tests, dependencies, configuration, backend or database were changed for Task 15. This inspection report is the only Task 15 file created. Existing dirty/untracked work was preserved.

## A. Actual frontend inventory

Read the Task 15 attachment, Create Listing/My Listings/Own Listing Details/Create-Reuse reports and actual source.

- PostListingScreen has Carry/Send, Title, Category, Currency, From/To, departure/arrival calendars, optional weight and Continue. It has **no image selection button, image placeholder, preview, removal control or selected-image field**.
- ListingReviewScreen has the existing summary, Create listing and Edit listing details. It has **no upload status or image-only retry action**.
- listingDraftStore is the existing memory-only, session-cleared form store; its ListingDraft contains no image value.
- useCreateListing calls JSON Create, verifies 201/Pending, refreshes My Listings/Dashboard, clears only the unchanged submitted draft and opens existing owner Listing Details using the server ID. Image upload must be sequenced before final draft clearing/navigation, retaining separate creation/upload outcomes.
- MyListingCard currently has no listing cover-image display or image-edit action. No new card image should be added just to implement upload.
- ListingDetailsScreen renders the authoritative coverImageUrl through the existing Image/placeholder; there is no owner image-replace action to reuse.
- Existing profile photo selection and multipart upload are available elsewhere, using installed react-native-image-picker, but a profile avatar UI is not an existing listing picker.
- Installed picker Asset fields are uri, originalPath, type, fileName, fileSize, width, height and other optional metadata. ImagePickerResponse provides assets, didCancel, errorCode and errorMessage. file/content URI, cancellation, permission and optional metadata handling must follow this installed API.
- Existing profilePhotoService validates local file/content URIs, JPEG/PNG/WebP, known size and dimensions, and handles gallery cancellation/permissions. Its profile-specific operation must not be used as the listing upload endpoint or changed unnecessarily.
- Existing profileAvatarService demonstrates React Native FormData and overriding the client's JSON Content-Type with multipart/form-data, without a manually supplied boundary. Reuse that existing Axios strategy for listing upload, not another client or library.

Relevant source:

- src/features/post-listing/screens/PostListingScreen.tsx
- src/features/post-listing/screens/ListingReviewScreen.tsx
- src/features/post-listing/hooks/useCreateListing.ts
- src/features/post-listing/services/createListingService.ts
- src/features/post-listing/types/listingDraft.ts
- src/features/post-listing/store/listingDraftStore.ts
- src/features/profile/services/profilePhotoService.ts
- src/features/profile/services/profileAvatarService.ts
- src/features/listings/components/MyListingCard.tsx
- src/features/listings/screens/ListingDetailsScreen.tsx
- src/features/listings/hooks/useListingDetails.ts
- src/services/api/apiClient.ts

## B. Verified Laravel contract (read-only source)

Sources in sibling friendie_logistics_backend:

- routes/api.php
- app/Http/Controllers/Api/V1/CustomerListingController.php: uploadImage, owned, editable, lockCustomer, input and limit
- app/Services/Api/CustomerListingImageService.php
- app/Support/Api/PublicData.php: image/mediaBaseUrl
- app/Support/ApiResponse.php

**POST /api/v1/customer/listings/{id}/image**, real customer Sanctum Bearer token, multipart, exactly one required field **image**, containing a file. No other body fields or query parameters are allowed.

Verified validation:

- required, file, decodable image;
- MIME: image/jpeg, image/png, image/webp;
- filename extensions: jpg, jpeg, png, webp;
- maximum 2048 KiB = 2,097,152 bytes;
- dimensions: width and height each 1..2048 pixels;
- no separately declared positive byte minimum beyond valid decodable image;
- no GIF, HEIC, SVG, video, Base64 JSON or multiple-image contract.

Ownership is scoped by created_by=current customer. Missing, invalid or another customer's ID returns 404. Inside the transaction Laravel rechecks an active verified eligible customer/current token and locks/reloads the owned listing. Allowed listing statuses are exactly 0/1/2; unsupported statuses reject with 409. Upload does not publish a Pending listing or alter status.

Image mutation rate limit is 10 attempts/account/IP per hour, shared with the image operation; 429 includes Retry-After. No idempotency key or exactly-once behavior is established.

**Success is HTTP 200**, not 201:

```ts
{
  success: true,
  message: 'Listing image updated successfully.',
  data: { image_url: string | null }
}
```

The response does not return a listing ID/full listing; retain the verified ID from creation/current owned context. A null/unusable image_url cannot be represented as a usable visible saved image and needs an authoritative owner-details refresh/unconfirmed-image outcome rather than a fabricated URL.

The server decodes the upload using GD/Intervention, scales down within 420x340 and writes JPEG quality85 to the existing public/frontend/img/listing directory. It generates a unique api_listing_{id}_{random32hex}.jpg filename per upload. Do not perform new frontend cropping/editing, infer this filename or construct it locally.

**Replacement is supported:** the same owned listing's image field and updated_at are replaced; status and other fields are unchanged. The old image is not deleted by a separate endpoint in this operation. Transaction failure discards only this request's new file. Repeated successful uploads produce different files, so repeat POSTs are not assumed harmless/idempotent. DELETE /customer/listings/{id}/image is out of scope and must never be called automatically.

Errors retain existing success:false/message/errors envelope handling. Known validation/eligibility/ownership/status/rate rules produce 422/401/403/404/409/429; 400/413/415/500 and network/timeout responses must also be handled if encountered without claiming every code originates from this controller.

## C. Image URLs and cache design

PublicData::image validates the stored filename, actual file and public-root containment, then returns an absolute URL using configured api.public_base_url with app.url fallback. Invalid/missing media configuration/file can yield null. Existing mobile listing services validate/use image_url directly. No hardcoded server/device domain, request-host assumption, path guessing or random cache-busting timestamp is needed. Successful uploads generate distinct filenames/URLs.

After confirmed upload, cancel stale reads and invalidate the existing relevant keys, then use authoritative reads rather than inserting the local URI as server data:

- current account My Listings: ['myListings.read', 'user:' + id]
- correct private details: ['ownListingDetails', customerId, String(listingId)]
- applicable existing public listing/detail queries, respecting backend publication rules and avoiding demo-data replacement

Do not change Dashboard statistics for an image upload. Existing Create Listing Dashboard invalidation remains separate and must not be duplicated because an image was uploaded. Do not add cover-image UI to MyListingCard, force Pending into public results, change pagination/status filters or invent listing counts.

## D. Minimum concrete UI proposal needing approval

On the existing Post form only:

1. Add an **optional Choose image** action opening the installed gallery picker, one image only.
2. Add one local selected-image preview using existing Friendie components/theme.
3. Add **Remove selected image** for the unsaved local choice; this only clears local state, never calls DELETE.

On the existing review step only:

4. Show the selected image and creation/upload outcome/loading feedback.
5. Add **Retry image upload** only for a confirmed-created listing with a definite failed image upload. It must reuse the retained real listing ID and must never reissue Create Listing.

No new screen, navigation route, listing-card redesign, camera/crop/gallery feature, backend changes or owner-details replacement control is proposed. Reuse the existing gallery library, Image, themed button/layout primitives, draft store, secure session and Axios client. No new dependency is presently justified.

These controls are reviewable and necessary: without a selector there is no actual user-chosen file to submit; silently uploading a placeholder or routing the profile-avatar picker into a different workflow would violate the task. A retained image-only recovery action is needed because no suitable existing retry action exists.

## E. Planned sequencing and safety after authorization

- Validate the local selected file with verified image constraints before Create; preserve cancellation/selection errors and existing input. Keep local preview distinct from confirmed backend image.
- Extend the existing account-cleared draft/recovery state minimally; do not add a duplicate auth/image cache architecture.
- Explicit Create -> verify actual 201/Pending and real ID -> optional image-only multipart POST -> refresh authoritative listing state -> truthful single outcome Toast/navigation.
- No selected image keeps existing Create behavior and makes no image request.
- Create failure or unknown Create outcome makes no upload call; retain all draft data and existing unknown-creation guard.
- Create confirmed / image rejected: retain the created ID and selected image; report listing created/image not uploaded. Any approved Retry action calls only the image endpoint.
- Create confirmed / upload timeout, cancellation after dispatch, malformed success or server failure: hold outcome as uncertain, preserve recovery context, perform safe authoritative GET reconciliation where possible, never blindly resend or infer the chosen file was saved solely from an unrelated URL change.
- Service/session-scoped in-flight guards must survive remount; no effects/focus/login callbacks may trigger a new mutation. No automatic POST retry.
- Current user object/token/owner identity, AbortSignal and generation checks prevent stale account results/navigation. Logout/session replacement clears private recovery/image state. Demo/fixture IDs are never eligible merely because numeric.
- Override JSON headers using the existing RN FormData multipart strategy; exactly one image part with actual accessible URI, supported MIME and compatible filename. No Base64 conversion, fabricated file contents or hand-built boundary.
- Treat optional/missing picker metadata conservatively and leave actual file decoding/size/ownership enforcement authoritative to Laravel. URI existence/readability cannot be proved just by matching a URI string; native picker access and runtime upload errors must be handled.
- Use only existing Toast.show configuration for notification feedback; preserve real confirmation dialogs.

## F. Verification and actual changes

Executed source/report inspection and git-status review. No mutation or live request was executed for Task 15. Only this report was created.

**Task 15 focused tests, regression/full suite, TypeScript, scoped ESLint and Android build: NOT RUN.** There is no authorized reachable listing-image UI integration to verify yet. Prior Task 14 results (1106 PASS, 2 skips, build/static checks PASS) are historical and are not claimed as Task 15 verification.

**LIVE AUTHENTICATED API: NOT VERIFIED**

**PHYSICAL DEVICE: NOT VERIFIED**

Prior server timeouts remain historical context; connectivity was not assumed fixed and no successful authenticated upload/device rendering is claimed.

## G. Remaining blocker and scope confirmation

Required next decision: explicit authorization for the five minimal optional-image/preview/local-remove/review-feedback/image-only-retry additions listed in section D. Backend route/validation/storage/response rules are available; missing UI authorization is the immediate blocker.

No Laravel, website/admin, database, schema, migration, storage, business-rule, listing-status, API-contract, application UI/navigation, production/test source, dependency or configuration changes. No image DELETE or unrelated API implementation. Task 15 is **not complete**; implementation can continue after approval of the concrete UI proposal.
