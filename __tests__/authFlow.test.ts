import { Alert } from 'react-native';
import { navigationRef } from '../src/navigation/navigationRef';
import { useAuthStore } from '../src/store/authStore';
import {
  useAuthFlowStore,
  clearAuthFlow,
} from '../src/features/auth/store/authFlowStore';
import {
  requireAuth,
  coordinateAuthentication,
  cancelAuthentication,
} from '../src/features/auth/services/authFlowCoordinator';
import { authActionTarget } from '../src/features/auth/services/authActionResolver';
import { authService } from '../src/features/auth/services/authService';
import { secureStorage } from '../src/services/storage/secureStorage';
import { apiClient } from '../src/services/api/apiClient';
import { appConfig } from '../src/constants/appConfig';
import {
  permittedPhone,
  ListingDetail,
} from '../src/features/listings/services/listingDetailsService';
import {
  chatPhone,
  Conversation,
} from '../src/features/messages/services/chatService';
let state: any;
let navigate: jest.SpyInstance;
const member = { id: 8, name: 'Member', email: 'member@example.test' };
const oldBase = appConfig.apiBaseUrl,
  oldVerified = appConfig.authApiVerified;
beforeEach(() => {
  clearAuthFlow();
  useAuthStore.getState().clear();
  state = {
    key: 'root',
    type: 'stack',
    stale: false,
    routeNames: ['AppDrawer', 'AuthStack'],
    index: 0,
    routes: [{ key: 'public-origin', name: 'AppDrawer' }],
  };
  jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
  jest.spyOn(navigationRef, 'getRootState').mockImplementation(() => state);
  navigate = jest
    .spyOn(navigationRef, 'navigate')
    .mockImplementation((name: any) => {
      if (name === 'AuthStack') {
        state.routes.push({ key: 'auth', name });
        state.index++;
      }
    });
  jest.spyOn(navigationRef, 'resetRoot').mockImplementation((next: any) => {
    state = next;
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  cancelAuthentication();
  jest.restoreAllMocks();
  appConfig.apiBaseUrl = oldBase;
  appConfig.authApiVerified = oldVerified;
});
test('guest rapid taps open one Login and retain first intended action', () => {
  expect(
    requireAuth({ type: 'POST_LISTING', params: { listingType: 'carry' } }),
  ).toBe(true);
  expect(requireAuth({ type: 'OPEN_PROFILE' })).toBe(false);
  coordinateAuthentication();
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(useAuthFlowStore.getState().flow?.action.type).toBe('POST_LISTING');
});
test('actual authenticated transition consumes once and preserves origin route key', () => {
  requireAuth({
    type: 'OPEN_MESSAGES',
    params: { conversationId: 'thread-42' },
  });
  useAuthStore.getState().setUser(member);
  coordinateAuthentication();
  coordinateAuthentication();
  expect(state.routes).toEqual([{ key: 'public-origin', name: 'AppDrawer' }]);
  expect(navigate).toHaveBeenCalledTimes(2);
  expect(navigate).toHaveBeenLastCalledWith(
    'AppDrawer',
    expect.objectContaining({
      params: expect.objectContaining({ screen: 'MessagesStack' }),
    }),
  );
  expect(useAuthFlowStore.getState().flow).toBeNull();
});
test('already authenticated goes directly without Login', () => {
  useAuthStore.getState().setUser(member);
  requireAuth({ type: 'POST_LISTING', params: { listingType: 'send' } });
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(navigate.mock.calls[0][0]).toBe('AppDrawer');
});
test('restoring waits then resolves as guest; navigation readiness also waits', () => {
  useAuthStore.setState({ status: 'restoring', user: null });
  requireAuth({ type: 'OPEN_PROFILE' });
  expect(navigate).not.toHaveBeenCalled();
  useAuthStore.getState().clear();
  coordinateAuthentication();
  expect(navigate).toHaveBeenCalledWith('AuthStack', { screen: 'Login' });
});
test('restoring can resolve authenticated without showing Login', () => {
  useAuthStore.setState({ status: 'restoring', user: null });
  requireAuth({ type: 'OPEN_PROFILE' });
  useAuthStore.getState().setUser(member);
  coordinateAuthentication();
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(navigate.mock.calls[0][0]).toBe('AppDrawer');
});
test('cancellation and removed AuthStack never execute pending action', () => {
  requireAuth({ type: 'OPEN_PROFILE' });
  state.routes.pop();
  coordinateAuthentication();
  expect(useAuthFlowStore.getState().flow).toBeNull();
  useAuthStore.getState().setUser(member);
  coordinateAuthentication();
  expect(navigate).toHaveBeenCalledTimes(1);
});
test('invalid IDs do not open auth or create a pending flow', () => {
  expect(
    requireAuth({ type: 'SAVE_LISTING', params: { listingId: '../private' } }),
  ).toBe(false);
  expect(useAuthFlowStore.getState().flow).toBeNull();
  expect(navigate).not.toHaveBeenCalled();
});
test('request/contact/save only resume details UI without backend operations', () => {
  for (const type of [
    'REQUEST_LISTING',
    'VIEW_CONTACT',
    'SAVE_LISTING',
  ] as const) {
    expect(
      authActionTarget({ type, params: { listingId: '12' } }, 'HomeStack'),
    ).toEqual({
      screen: 'MainTabs',
      params: {
        screen: 'HomeStack',
        params: {
          screen: 'ListingDetails',
          params: {
            listingId: '12',
            resumeAction:
              type === 'SAVE_LISTING'
                ? 'save'
                : type === 'REQUEST_LISTING'
                ? 'request'
                : 'contact',
          },
        },
      },
    });
  }
});
test('unavailable navigator defers until registered and ready', () => {
  const ready = jest.spyOn(navigationRef, 'isReady').mockReturnValue(false);
  requireAuth({ type: 'OPEN_PROFILE' });
  expect(navigate).not.toHaveBeenCalled();
  ready.mockReturnValue(true);
  coordinateAuthentication();
  expect(navigate).toHaveBeenCalledTimes(1);
});
test('login alone and unverified contact flags cannot unlock a phone', () => {
  useAuthStore.getState().setUser(member);
  for (const status of ['none', 'pending', 'rejected', 'accepted'] as const) {
    expect(
      permittedPhone({
        requestStatus: status,
        contact: { callPermitted: true, phone: '+923001234567' },
      } as ListingDetail),
    ).toBeUndefined();
  }
  expect(
    chatPhone({
      participant: {
        deleted: false,
        callPermitted: true,
        phone: '+923001234567',
      },
    } as Conversation),
  ).toBeUndefined();
});
test('cancelled late login response never writes a token or authenticates', async () => {
  appConfig.apiBaseUrl = 'https://api.example.test';
  appConfig.authApiVerified = true;
  let finish!: (response: any) => void;
  jest.spyOn(apiClient, 'post').mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const store = jest.spyOn(secureStorage, 'setToken');
  const controller = new AbortController();
  const attempt = authService.login(
    { email: 'member@example.test', password: 'password' },
    controller.signal,
  );
  controller.abort();
  finish({ data: { token: 'never-store' } });
  await expect(attempt).rejects.toMatchObject({ kind: 'cancelled' });
  expect(store).not.toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
});

test('login failure retains the pending action for retry', async () => {
  requireAuth({ type: 'OPEN_PROFILE' });
  const id = useAuthFlowStore.getState().flow?.id;
  appConfig.apiBaseUrl = 'https://api.example.test';
  appConfig.authApiVerified = true;
  jest
    .spyOn(apiClient, 'post')
    .mockRejectedValue(new Error('Network unavailable'));
  await expect(
    authService.login({ email: 'member@example.test', password: 'password' }),
  ).rejects.toThrow('Network unavailable');
  coordinateAuthentication();
  expect(useAuthFlowStore.getState().flow?.id).toBe(id);
  expect(useAuthStore.getState().status).toBe('guest');
});
test('logout clears an unfinished pending flow', async () => {
  const {
    logoutSession,
  } = require('../src/features/auth/services/sessionLogout');
  const { QueryClient } = require('@tanstack/react-query');
  requireAuth({ type: 'OPEN_PROFILE' });
  jest.spyOn(authService, 'logout').mockResolvedValue(undefined);
  await logoutSession(new QueryClient());
  expect(useAuthFlowStore.getState().flow).toBeNull();
});
