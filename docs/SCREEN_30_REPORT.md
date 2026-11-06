# Screen 30 - Account Settings

## Files and UI
- Replaced `src/features/settings/screens/SettingsScreen.tsx` placeholder with a white safe-area Settings header and sectioned scrollable cards: Account, Preferences, Privacy & Legal, Information, Account actions.
- Burgundy Lucide icons, navy labels, thin separators, pale pink Preferences card, descriptive rows and practical touch targets use centralized theme tokens.
- Existing Settings Drawer registration now hides its default header, avoiding duplicate headers. No new routes/screens/navigators or dependencies were added.
- Existing shared LogoutConfirmationModal gained an optional busy state: confirm shows loading, cancellation is disabled and hardware modal dismissal is blocked during submission. Existing consumers retain their default behavior.
- Added Settings tests and extended existing real-router Settings assertions in App.test.tsx. README updated with access/report link.

## Destinations
- Edit Profile: existing MainTabs > ProfileStack > EditProfile, preserving Profile as that editor's base route.
- Change Password: existing ChangePassword route, returns to Settings through its existing behavior.
- Location Preferences: existing MainTabs > ListingsStack > Filters, with Listings as the base route. This deliberately opens the supported search-location workflow rather than creating a duplicate location-preferences screen. Filters keeps its existing Listings/Search return behavior.
- Privacy Policy, Terms & Conditions, Disclaimer: existing root legal routes; Back restores Settings.
- About Us, Help & Support: existing drawer destinations with their existing back behavior.
- Contact Us: existing public ContactSupport root route; Back restores Settings.
- Logout: existing confirmation modal and logoutSession, which clears Keychain-backed session and user caches and requests authentication navigation after confirmed cleanup. Failures leave session intact and display an error; duplicate actions are guarded.

## Preference sources and unavailable features
The saved location summary reads the existing useLocationStore. AppBootstrap already rehydrates its validated AsyncStorage-backed state. Settings does not request GPS, display precise coordinates, or duplicate/store separate preference values. Changes made in the existing Filters workflow use that same existing persistence mechanism.

Notification Preferences is visibly disabled with an unavailable explanation: no preference UI or account-wide notification contract exists. The existing uiStore.notificationsEnabled value is a saved permission-request result, not evidence of working account-wide notification delivery preferences, so it is not presented as a functional toggle. No fake notification toggle/backend success was added. Language is omitted because no localization exists. Account Verification is omitted because no supported self-verification route/API is available.

The app version comes from the existing installed-native metadata adapter, with an unavailable fallback. No package.json version or screenshot value is substituted.

## Scope and remaining dependencies
Existing legal draft states, profile/password API gates and support integration limitations are preserved. Their endpoints are not invented here. Backend account-wide notification preferences, localization and a verified account-verification workflow remain dependencies before enabling those options.

## Validation
Executed results are recorded below after completion. No physical-device or iOS layout check is claimed without execution.

Executed validation:
- TypeScript, full ESLint and whitespace diff check passed.
- Six focused suites passed, 51 tests: Settings, Profile, App navigation, preferences, location and sessionLogout. Coverage includes all Settings row destinations/disabled options, native version, saved location summary without coordinate exposure, logout confirmation/cancellation, failed secure cleanup, duplicate prevention while pending, and Settings > Privacy/Contact > Back plus Change Password return navigation.
- Android arm64-v8a debug build/install passed on Infinix X655C, 407 tasks (17 executed), 1m 20s. Existing Gradle deprecation warnings remain.
- Foreground-guarded device inspection returned not_foreground. Physical Settings layout, font-scaling and native touch validation remain unverified. iOS build was not executed on Windows.
- No full-repository test rerun is claimed.
