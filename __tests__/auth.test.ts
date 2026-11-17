import { authService } from '../src/features/auth/services/authService';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { ApiError } from '../src/types/api';
import { appConfig } from '../src/constants/appConfig';
import { apiClient } from '../src/services/api/apiClient';
import * as Keychain from 'react-native-keychain';
const originalBase = appConfig.apiBaseUrl,
  originalVerified = appConfig.authApiVerified,
  originalLogin = appConfig.loginApiEnabled;
const user = { id: 8, name: 'Stored member', email: 'stored@example.test' };
const originalNativeRead = jest
  .mocked(Keychain.getGenericPassword)
  .getMockImplementation()!;
beforeEach(async () => {
  jest.clearAllMocks();
  expect(await Keychain.getGenericPassword()).toBe(false);
  appConfig.apiBaseUrl = 'https://api.example.test';
  appConfig.authApiVerified = true;
  appConfig.loginApiEnabled = true;
  useAuthStore.getState().clear();
});
afterEach(() => {
  appConfig.apiBaseUrl = originalBase;
  appConfig.authApiVerified = originalVerified;
  appConfig.loginApiEnabled = originalLogin;
  jest.restoreAllMocks();
  jest
    .mocked(Keychain.getGenericPassword)
    .mockReset()
    .mockImplementation(originalNativeRead);
  useAuthStore.getState().clear();
});
test('a revoked legacy session finishes restoration as a guest', async () => {
  // Explicit coverage of the retained legacy branch; real Login restoration
  // below reads the secure session and does not claim server revalidation.
  appConfig.loginApiEnabled = false;
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('revoked');
  jest.spyOn(authService, 'hydrate').mockImplementation(async () => {
    useAuthStore.getState().clear();
    throw new ApiError('Revoked', 'unauthorized', 401);
  });
  await expect(authService.restore()).resolves.toBeUndefined();
  expect(useAuthStore.getState().status).toBe('guest');
});
test('secure-session read failure propagates without deleting the credential', async () => {
  const read = jest
    .spyOn(secureStorage, 'getSession')
    .mockRejectedValue(new ApiError('Storage unavailable', 'network'));
  const remove = jest.spyOn(secureStorage, 'removeToken');
  const hydrate = jest.spyOn(authService, 'hydrate');
  await expect(authService.restore()).rejects.toMatchObject({
    kind: 'network',
  });
  expect(remove).not.toHaveBeenCalled();
  expect(read).toHaveBeenCalledTimes(1);
  expect(hydrate).not.toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
});
test('valid secure session restores its owner once without a server validation request', async () => {
  const read = jest
    .spyOn(secureStorage, 'getSession')
    .mockResolvedValue({ token: 'stored-test-token', user });
  const get = jest.spyOn(apiClient, 'get');
  await authService.restore();
  expect(read).toHaveBeenCalledTimes(1);
  expect(get).not.toHaveBeenCalled();
  expect(useAuthStore.getState().user).toEqual(user);
  expect(useAuthStore.getState().status).toBe('authenticated');
});
test('missing stored session returns to guest without private requests', async () => {
  jest.spyOn(secureStorage, 'getSession').mockResolvedValue(null);
  const get = jest.spyOn(apiClient, 'get');
  await authService.restore();
  expect(useAuthStore.getState().status).toBe('guest');
  expect(useAuthStore.getState().user).toBeNull();
  expect(get).not.toHaveBeenCalled();
});
test('malformed stored identity is not restored as an authenticated session', async () => {
  jest.spyOn(Keychain, 'getGenericPassword').mockResolvedValue({
    username: JSON.stringify({ id: user.id }),
    password: 'malformed-session-test-token',
    service: 'com.friendie.logistics.session',
    storage: 'KeystoreAESGCM_NoAuth' as Keychain.STORAGE_TYPE,
  });
  const read = jest.spyOn(secureStorage, 'getSession');
  const get = jest.spyOn(apiClient, 'get');
  await authService.restore();
  expect(read).toHaveBeenCalledTimes(1);
  expect(useAuthStore.getState().status).toBe('guest');
  expect(useAuthStore.getState().user).toBeNull();
  expect(get).not.toHaveBeenCalled();
});
test('cancelled secure-session restoration cannot restore an old account', async () => {
  let finish!: (value: { token: string; user: typeof user }) => void;
  jest.spyOn(secureStorage, 'getSession').mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const controller = new AbortController();
  const pending = authService.restore(controller.signal);
  controller.abort();
  const replacement = { ...user, id: 9, email: 'replacement@example.test' };
  useAuthStore.getState().setUser(replacement);
  finish({ token: 'old-test-token', user });
  await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
  expect(useAuthStore.getState().user).toBe(replacement);
});

test('an incompatible profile response never authenticates the user', async () => {
  useAuthStore.getState().clear();
  jest.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: { id: 1 } } });
  await expect(authService.hydrate()).rejects.toThrow();
  expect(useAuthStore.getState().status).toBe('guest');
});

test('late profile response after startup cancellation cannot authenticate a user', async () => {
  useAuthStore.getState().clear();
  let finish!: (value: unknown) => void;
  jest.spyOn(apiClient, 'get').mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const controller = new AbortController();
  const restore = authService.hydrate(controller.signal);
  controller.abort();
  finish({
    data: { data: { id: 4, name: 'Late member', email: 'late@example.test' } },
  });
  await expect(restore).rejects.toMatchObject({ kind: 'cancelled' });
  expect(useAuthStore.getState().status).toBe('guest');
});
