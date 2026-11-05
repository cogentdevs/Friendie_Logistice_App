import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './navigationTypes';
import { useAuthStore } from '../store/authStore';
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
export type NotificationTarget =
  | { type: 'listing'; id: string }
  | { type: 'chat'; id: string }
  | { type: 'notifications' };
let pending: NotificationTarget | undefined;
export function clearPendingNotification() {
  pending = undefined;
}
export function routeNotification(target: NotificationTarget) {
  pending = target;
  flushPendingNotification();
}
export function flushPendingNotification() {
  if (
    !pending ||
    !navigationRef.isReady() ||
    useAuthStore.getState().status !== 'authenticated' ||
    !navigationRef.getRootState()?.routeNames.includes('AppDrawer')
  )
    return;
  const target = pending;
  pending = undefined;
  if (target.type === 'listing')
    navigationRef.navigate('AppDrawer', {
      screen: 'MainTabs',
      params: {
        screen: 'ListingsStack',
        params: { screen: 'ListingDetails', params: { listingId: target.id } },
      },
    });
  else if (target.type === 'chat')
    navigationRef.navigate('AppDrawer', {
      screen: 'MainTabs',
      params: {
        screen: 'MessagesStack',
        params: { screen: 'Chat', params: { conversationId: target.id } },
      },
    });
  else navigationRef.navigate('AppDrawer', { screen: 'Notifications' });
}
