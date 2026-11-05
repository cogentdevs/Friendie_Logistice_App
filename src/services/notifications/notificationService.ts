import { Platform } from 'react-native';
import { requestNotifications } from 'react-native-permissions';
import { getApps } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  onNotificationOpenedApp,
  getInitialNotification,
  requestPermission,
  setBackgroundMessageHandler,
  RemoteMessage,
} from '@react-native-firebase/messaging';
import { appConfig } from '../../constants/appConfig';
import { routeNotification } from '../../navigation/navigationRef';
import { useUIStore } from '../../store/uiStore';
function configured() {
  return appConfig.firebaseEnabled && getApps().length > 0;
}
function route(message: RemoteMessage | null) {
  const data = message?.data;
  if (!data) return;
  if (data.type === 'listing' && typeof data.id === 'string')
    routeNotification({ type: 'listing', id: data.id });
  else if (data.type === 'chat' && typeof data.id === 'string')
    routeNotification({ type: 'chat', id: data.id });
  else routeNotification({ type: 'notifications' });
}
export const notificationService = {
  isConfigured: configured,
  async requestPermission() {
    if (!configured()) throw Error('Firebase is not configured.');
    const granted =
      Platform.OS === 'android'
        ? (await requestNotifications(['alert', 'sound', 'badge'])).status ===
          'granted'
        : [1, 2].includes(await requestPermission(getMessaging()));
    await useUIStore.getState().setNotificationsEnabled(granted);
    return granted;
  },
  async getDeviceToken() {
    if (!configured()) throw Error('Firebase is not configured.');
    return getToken(getMessaging());
  },
  onForeground(handler: (message: RemoteMessage) => void) {
    return configured() ? onMessage(getMessaging(), handler) : () => {};
  },
  onTokenRefresh(handler: (token: string) => void) {
    return configured() ? onTokenRefresh(getMessaging(), handler) : () => {};
  },
  registerBackgroundHandler() {
    if (configured())
      setBackgroundMessageHandler(getMessaging(), async _message => {
        /* Persist inbox data here when the Laravel contract is defined. No navigation in a headless task. */
      });
  },
  start() {
    if (!configured()) return () => {};
    const unsubscribe = onNotificationOpenedApp(getMessaging(), route);
    getInitialNotification(getMessaging())
      .then(route)
      .catch(() => {});
    return unsubscribe;
  },
};
