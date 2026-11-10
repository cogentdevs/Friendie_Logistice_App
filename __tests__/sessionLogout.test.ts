import {
  navigationRef,
  routeNotification,
  flushPendingNotification,
  clearPendingNotification,
} from '../src/navigation/navigationRef';
import { clearPrivateAccountMemory } from '../src/features/auth/services/sessionLogout';
import { QueryClient } from '@tanstack/react-query';
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logoutSession } from '../src/features/auth/services/sessionLogout';
import { secureStorage } from '../src/services/storage/secureStorage';
import { apiClient } from '../src/services/api/apiClient';
import { appConfig } from '../src/constants/appConfig';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { useListingBookmarks } from '../src/features/listings/store/bookmarkStore';
import { useListingDraft } from '../src/features/post-listing/store/listingDraftStore';
import { useChatDrafts } from '../src/features/messages/store/chatDraftStore';
import { useSearchStore } from '../src/features/search/store/searchStore';
let client: QueryClient,
  previous: { base: string; verified: boolean; ui: boolean };
beforeEach(() => {
  jest.clearAllMocks();
  previous = {
    base: appConfig.apiBaseUrl,
    ui: appConfig.uiPreviewEnabled,
    verified: appConfig.authApiVerified,
  };
  appConfig.authApiVerified = false;
  useDevelopmentStore.setState({
    previewActive: false,
    authEntryRequested: false,
  });
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'm@example.test' });
  client = new QueryClient();
});
afterEach(() => {
  client.clear();
  appConfig.apiBaseUrl = previous.base;
  appConfig.uiPreviewEnabled = previous.ui;
  appConfig.authApiVerified = previous.verified;
  jest.restoreAllMocks();
});
test('logout clears secure credentials and per-user caches and returns guest access without touching onboarding', async () => {
  await AsyncStorage.setItem('friendie.bookmarks.8', '[12]');
  useListingBookmarks.setState({ owner: 8, ids: [12] });
  useListingDraft
    .getState()
    .update({ type: 'carry', date: '2099-11-12', weight: '12' });
  useChatDrafts.getState().draft('8:42', 'Private draft');
  useSearchStore.getState().setFilters({ query: 'Private query' });
  client.setQueryData(['private'], { name: 'Private' });
  const post = jest.spyOn(apiClient, 'post'),
    remove = jest.spyOn(secureStorage, 'removeToken');
  const result = await logoutSession(client);
  expect(result.cacheCleared).toBe(true);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(post).not.toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
  expect(client.getQueryData(['private'])).toBeUndefined();
  expect(useChatDrafts.getState().threads).toEqual({});
  expect(useListingDraft.getState().values.weight).toBe('');
  expect(useSearchStore.getState().filters).toEqual({});
  expect(await AsyncStorage.getItem('friendie.bookmarks.8')).toBeNull();
  expect(useDevelopmentStore.getState().authEntryRequested).toBe(false);
});
test('Keychain failure keeps the real session and navigation state intact', async () => {
  jest.spyOn(secureStorage, 'removeToken').mockRejectedValue(Error('Locked'));
  client.setQueryData(['private'], { id: 8 });
  await expect(logoutSession(client)).rejects.toThrow('Locked');
  expect(useAuthStore.getState().status).toBe('authenticated');
  expect(useDevelopmentStore.getState().authEntryRequested).toBe(false);
  expect(client.getQueryData(['private'])).toEqual({ id: 8 });
});
test('offline remote revocation does not prevent safe local logout', async () => {
  appConfig.apiBaseUrl = 'https://example.test';
  appConfig.authApiVerified = true;
  const post = jest
    .spyOn(apiClient, 'post')
    .mockRejectedValue(Error('offline'));
  await expect(logoutSession(client)).resolves.toMatchObject({
    cacheCleared: true,
  });
  expect(post).toHaveBeenCalledWith('/auth/logout');
  expect(useAuthStore.getState().status).toBe('guest');
});
test('concurrent logout attempts share a single cleanup operation', async () => {
  const remove = jest.spyOn(secureStorage, 'removeToken').mockResolvedValue();
  const first = logoutSession(client),
    second = logoutSession(client);
  expect(first).toBe(second);
  await first;
  expect(remove).toHaveBeenCalledTimes(1);
});
test('native reset failure with credentials still present is not treated as successful logout', async () => {
  jest.spyOn(Keychain, 'resetGenericPassword').mockResolvedValue(false);
  jest.spyOn(Keychain, 'getGenericPassword').mockResolvedValue({
    service: 'test',
    username: 'sanctum',
    password: 'test-token',
    storage: 'KeystoreAESGCM' as Keychain.STORAGE_TYPE,
  } as Exclude<Awaited<ReturnType<typeof Keychain.getGenericPassword>>, false>);
  await expect(secureStorage.removeToken()).rejects.toThrow('Could not clear');
});

test('query cancellation failure cannot prevent credential and private-state cleanup', async () => {
  jest
    .spyOn(client, 'cancelQueries')
    .mockRejectedValue(new Error('cancel failed'));
  const remove = jest.spyOn(secureStorage, 'removeToken').mockResolvedValue();
  client.setQueryData(['private'], { id: 8 });
  await logoutSession(client);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(useAuthStore.getState().status).toBe('guest');
  expect(client.getQueryData(['private'])).toBeUndefined();
});
test('real authenticated session still attempts verified revocation when a preview flag is stale', async () => {
  appConfig.apiBaseUrl = 'https://example.test';
  appConfig.authApiVerified = true;
  appConfig.uiPreviewEnabled = true;
  useDevelopmentStore.setState({ previewActive: true });
  const post = jest
    .spyOn(apiClient, 'post')
    .mockRejectedValue(new Error('offline'));
  const remove = jest.spyOn(secureStorage, 'removeToken').mockResolvedValue();
  client.setQueryData(['private'], { id: 8 });
  await logoutSession(client);
  expect(post).toHaveBeenCalledWith('/auth/logout');
  expect(remove).toHaveBeenCalledTimes(1);
  expect(client.getQueryData(['private'])).toBeUndefined();
  expect(useAuthStore.getState().status).toBe('guest');
  expect(useDevelopmentStore.getState().authEntryRequested).toBe(false);
});

test('account replacement discards a queued notification from the previous session', () => {
  const ready = jest.spyOn(navigationRef, 'isReady').mockReturnValue(false);
  const navigate = jest
    .spyOn(navigationRef, 'navigate')
    .mockImplementation(() => {});
  routeNotification({ type: 'chat', id: 'old-private-room' });
  clearPrivateAccountMemory(client);
  useAuthStore
    .getState()
    .setUser({ id: 9, name: 'Other', email: 'other@example.test' });
  ready.mockReturnValue(true);
  jest
    .spyOn(navigationRef, 'getRootState')
    .mockReturnValue({ routeNames: ['AppDrawer'] } as never);
  flushPendingNotification();
  try {
    expect(navigate).not.toHaveBeenCalled();
  } finally {
    clearPendingNotification();
  }
});
