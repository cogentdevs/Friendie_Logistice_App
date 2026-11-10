import { Alert } from 'react-native';
import { navigationRef } from '../../../navigation/navigationRef';
import { useAuthStore } from '../../../store/authStore';
import {
  beginAuthFlow,
  clearAuthFlow,
  useAuthFlowStore,
} from '../store/authFlowStore';
import {
  pendingActionSchema,
  PendingAction,
} from '../types/pendingAction.types';
import { authActionTarget } from './authActionResolver';
import { cancelLoginAttempt } from './authService';

export function cancelAuthentication() {
  cancelLoginAttempt();
  clearAuthFlow();
}
export function requireAuth(
  action: PendingAction,
  entry: 'Login' | 'Register' = 'Login',
): boolean {
  const parsed = pendingActionSchema.safeParse(action);
  if (!parsed.success) {
    Alert.alert(
      'Unable to continue',
      'This action has an invalid destination.',
    );
    return false;
  }
  // Preserve the originating public stack when resuming a listing UI.
  const root = navigationRef.isReady()
    ? navigationRef.getRootState()
    : undefined;
  const drawer = root?.routes.find(route => route.name === 'AppDrawer')?.state;
  const tabs = drawer?.routes.find(route => route.name === 'MainTabs')?.state;
  const listingStack =
    tabs?.routes[tabs.index ?? 0]?.name === 'HomeStack'
      ? 'HomeStack'
      : 'ListingsStack';
  if (!beginAuthFlow(parsed.data, listingStack, entry)) return false;
  coordinateAuthentication();
  return true;
}
function dismissAuthentication() {
  const state = navigationRef.getRootState();
  if (!state) return;
  const index = state.routes.findIndex(route => route.name === 'AuthStack');
  if (index < 0) return;
  const routes = state.routes.slice(0, index);
  navigationRef.resetRoot(
    routes.length
      ? { ...state, routes, index: routes.length - 1 }
      : { index: 0, routes: [{ name: 'AppDrawer' }] },
  );
}
// Called after auth state commits and on navigation readiness/state changes, never a timer.
export function coordinateAuthentication() {
  if (!navigationRef.isReady()) return;
  const auth = useAuthStore.getState();
  if (auth.status === 'restoring') return;
  const state = navigationRef.getRootState();
  if (!state) return;
  if (
    !state.routeNames.includes('AppDrawer') ||
    !state.routeNames.includes('AuthStack')
  )
    return;
  const flow = useAuthFlowStore.getState().flow;
  const authOpen = state.routes.some(route => route.name === 'AuthStack');
  if (flow?.phase === 'resuming') return;
  if (flow?.phase === 'login' && !authOpen) {
    cancelAuthentication();
    return;
  }
  if (auth.status === 'authenticated' && auth.user) {
    if (!flow && !authOpen) return;
    if (flow)
      useAuthFlowStore.setState({ flow: { ...flow, phase: 'resuming' } });
    dismissAuthentication();
    clearAuthFlow();
    navigationRef.navigate(
      'AppDrawer',
      flow
        ? authActionTarget(flow.action, flow.listingStack)
        : {
            screen: 'MainTabs',
            params: { screen: 'HomeStack', params: { screen: 'Home' } },
          },
    );
    return;
  }
  if (flow?.phase === 'waiting') {
    useAuthFlowStore.setState({ flow: { ...flow, phase: 'login' } });
    if (!authOpen) navigationRef.navigate('AuthStack', { screen: flow.entry });
  }
}
