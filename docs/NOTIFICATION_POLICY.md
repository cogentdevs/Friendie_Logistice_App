# Required notification library and presentation

Use only react-native-toast-message and Toast.show() for notification feedback.
AppProviders mounts AppToast once, after navigation content within SafeAreaProvider.
Never add another host to a screen or navigator.

AppToast uses the library BaseToast with one shared white card: 10dp corners,
6dp left bar, subtle shadow/elevation, 16dp horizontal screen inset, dark bold
15dp title and gray 13dp description. The card grows with wrapped text instead
of using the library default fixed height. Top offset is safe-area top plus 12dp.
Existing 10-second duration and tap dismissal are preserved.

Registered types (standard title; left-bar color only):
- success: Success; #4CAF50
- error: Error; #E53935
- warning: Warning; #F59E0B
- rejected: Rejected; #6B7280
- info: Information; #2196F3

Existing text1 operation context and text2 message are retained in the description;
a repeated standard title is omitted. The compatibility showToast(title, message,
type = 'info') delegates to Toast.show without owning state or timers.

Successful operations use success; failures use error; local validation warnings
use warning. Use rejected only for a verified explicit business rejection, never
as a blanket classification for HTTP errors. No current rejection is fabricated.

The library replaces its single active notification, avoiding stacked cards.
Existing submission guards prevent duplicate requests; Axios does not emit Toasts.
Emit feedback once from the operation handler, not from several layers.

No notification Alert, ToastAndroid, Snackbar, custom popup or additional library.
Inline field errors and actual confirmation/choice dialogs remain permitted.
Older notification Alerts in unrelated screens (including Drawer/Profile local
cleanup errors and ContactUs) remain a separate cleanup task; no screen redesign
or unrelated workflow migration is part of this presentation change.
