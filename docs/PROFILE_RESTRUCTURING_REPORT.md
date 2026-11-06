# Profile Dashboard restructuring

## Approved mobile menu

ProfileScreen now renders exactly seven ProfileMenuRow components in this order:

| Label | Lucide icon | Existing destination |
| --- | --- | --- |
| Dashboard | LayoutDashboard | MainTabs -> HomeStack -> Home |
| Edit Profile | UserRound | ProfileStack -> EditProfile |
| My Listing | List | MyListings |
| Messages | MessageCircle | MainTabs -> MessagesStack -> Conversations |
| Reviews | Star | MyReviews |
| Change Password | LockKeyhole | ChangePassword with returnTo Profile |
| Logout | LogOut | LogoutConfirmationModal |

All rows use centralized burgundy/navy tokens, a chevron, thin divider and minimum 52px touch area. Saved Listings, Payment Methods, Notifications and Help & Support no longer appear in this menu. Their existing app routes/features remain available elsewhere. Home was not modified.

The burgundy gradient, actual identity/avatar, read-only confirmed verification and floating Listings/Reviews/Rating card remain. Missing stats retain placeholders; zero values remain actual zero values. The optional Settings gear retains access to the existing Settings page, whose only action is the approved Change Password flow. No extra Profile menu row was added.

## Logout

The previous Profile implementation used native Alert confirmation; no LogoutConfirmationModal component existed. Added one focused reusable modal within the Profile feature. Cancel and Android modal dismissal do nothing to the session; Confirm closes the dialog and runs the existing guarded logoutSession flow. Secure credential removal, user cache/draft cleanup, Auth reset and cleanup failure reporting are unchanged. No new modal navigation route or NavigationContainer was created.

## Edit Profile

The editor now contains only photo, Full Name, Email Address, Country (calling code) and Phone Number. City, Area and Bio are absent from this form; the shared location features and the optional location data read from existing profiles were not deleted. Existing country metadata can help prefill the calling code without displaying City/Area fields. Unknown/shared calling codes are not assigned a guessed country.

Name/email/phone and selected supported calling country are required through RHF + Zod. Existing calling-code choices remain PK, AE, SA, GB and US. Broader country coverage requires a supported validated catalogue/numbering contract; unsupported country selections are not invented. The form preserves unknown existing numbers and asks for a supported selection before submission.

Upload New Photo opens the installed native camera/library picker for a local unsaved preview. Remove Photo stages removal locally; Restore original photo cancels replacement/removal. The original cached/server photo remains untouched before a confirmed Save. Both replacements and removals participate in unsaved-navigation confirmation.

Client selection accepts local JPEG/PNG with known size up to 10 * 1024 * 1024 bytes, reflecting the supplied website maximum. This is client validation, not a claim of verified Laravel upload rules. Backend MIME/content validation and its exact size policy still need confirmation. Permission/cancellation/native error states and Settings fallback are preserved. No EXIF/base64 or private values are logged.

profileEditService validates the limited domain fields and mutually exclusive replacement/removal intent but still makes no guessed API request. Upload/update/remove endpoints and field mapping are unverified, so actual Save is honestly unavailable and cannot fake an update/removal. Existing owner-checked cache/auth updates remain prepared for a verified authoritative response only.

## Password and navigation

Reused the existing ChangePasswordScreen. Its three fields, toggles, backend-policy handling, safe session cleanup and errors remain; CTA now reads Change Password. Typed optional returnTo Profile lets header/success return to Profile when opened there. Settings explicitly clears that return target so its existing Back to Settings flow remains correct.

Edit Profile hides the existing bottom bar while active, including UI preview, and restores it on return. Change Password remains in its existing full-screen Drawer route outside MainTabs. The five normal tabs and drawer remain intact. No new navigator, duplicated screen or unrelated route removal was introduced.

## Backend contracts

Existing endpoints remain /user for guarded profile reads and /auth/logout for verified remote logout, with local Keychain cleanup still working offline. Profile reads require PROFILE_API_VERIFIED and valid owner identity; remote logout requires AUTH_API_VERIFIED. Preview fixtures remain explicitly development-only. A real authenticated profile now takes precedence even if an old preview flag remains set.

Still unverified: profile update, avatar upload/removal, broader calling-country support, email/phone re-verification and authenticated password-change policy/endpoint/session contract. No new endpoint or successful response was invented. Laravel must enforce ownership, password validation, media validation and authoritative verification/session status.

## Modified/created files

- src/features/profile/screens/ProfileScreen.tsx
- src/features/profile/components/ProfileMenuRow.tsx
- src/features/profile/components/LogoutConfirmationModal.tsx (new)
- src/features/profile/screens/EditProfileScreen.tsx
- src/features/profile/schemas/editProfileSchema.ts
- src/features/profile/services/profilePhotoService.ts, profileEditService.ts, profileService.ts
- src/features/profile/hooks/useProfile.ts
- src/features/settings/screens/ChangePasswordScreen.tsx, SettingsScreen.tsx (return target only)
- src/navigation/navigationTypes.ts, components/CustomTabBar.tsx
- jest.setup.js
- __tests__/Profile.test.tsx, EditProfile.test.tsx, profileEdit.test.ts, profileService.test.ts, ChangePassword.test.tsx, App.test.tsx
- README.md and this report

This report supersedes the old Profile/Edit Profile menu, location-field and 5 MB preview descriptions in earlier screen reports. The current request did not include a visible website image; its explicit approved options and form specification supplied the content target, while the existing mobile design was preserved.

## Validation

Final results recorded below. Native Android/iOS runtime and live Laravel integration limits are reported separately.

- TypeScript: passed.
- ESLint: passed with no warnings.
- Full Jest suite: 38 suites / 247 tests passed. Coverage includes exact seven-row menu and removed options, actual/unknown verification and stats, every approved menu destination, tab hiding/restoration, cancel/confirm Logout and secure cleanup, required editor fields, 10 MB boundary, photo removal/restore drafts, validation/conflicts, real-session-over-preview precedence and password error/revocation flows. Existing Home/global feature tests also passed.


- Android: npm run android succeeded in 55 seconds; APK installed on Infinix X655C and launch completed. Existing Gradle deprecation warnings remain.
- Physical smoke check: entered the existing Sign In UI preview and opened Profile. Guarded native hierarchy confirmed Dashboard, Edit Profile, My Listing, Messages, Reviews, Change Password and Logout. Opened Edit Profile and confirmed Upload New Photo, Remove Photo, 10 MB text, name/email/phone fields and country-calling-code selector; Android hardware Back returned to Profile. Component/navigation tests verify tab hiding/restoration; a Profile tab action was also absent from the native editor hierarchy.
- Remaining runtime limits: no pixel-by-pixel/large-font visual review, camera/gallery hardware selection or live backend writes were performed. iOS runtime is not available on this Windows host. Physical inspection/control remained limited to the Friendie app.

