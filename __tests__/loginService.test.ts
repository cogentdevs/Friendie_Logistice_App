import * as Keychain from 'react-native-keychain';
import { appConfig } from '../src/constants/appConfig';
import { apiClient } from '../src/services/api/apiClient';
import { authService } from '../src/features/auth/services/authService';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
const original = {
  url: appConfig.apiBaseUrl,
  verified: appConfig.authApiVerified,
};
const credentials = {
  email: '  TRAVELLER@Example.Test ',
  password: 'fixture password',
};
beforeEach(() => {
  appConfig.apiBaseUrl = 'https://api.example.test';
  appConfig.authApiVerified = true;
  useAuthStore.getState().clear();
});
afterEach(() => {
  appConfig.apiBaseUrl = original.url;
  appConfig.authApiVerified = original.verified;
  jest.restoreAllMocks();
});
test('unverified auth contract sends no credentials to the API', async () => {
  appConfig.authApiVerified = false;
  const post = jest.spyOn(apiClient, 'post');
  await expect(authService.login(credentials)).rejects.toThrow(
    'currently unavailable',
  );
  expect(post).not.toHaveBeenCalled();
});
test('successful Sanctum contract stores token securely before loading the validated user', async () => {
  const events: string[] = [];
  const user = {
    id: 1,
    name: 'Fixture traveller',
    email: 'traveller@example.test',
  };
  jest
    .spyOn(apiClient, 'post')
    .mockResolvedValue({ data: { token: 'fixture-token' } });
  jest.spyOn(secureStorage, 'setToken').mockImplementation(async () => {
    events.push('stored');
  });
  jest.spyOn(apiClient, 'get').mockImplementation(async () => {
    events.push('profile');
    expect(useAuthStore.getState().status).toBe('guest');
    return { data: { data: user } };
  });
  await authService.login(credentials);
  expect(apiClient.post).toHaveBeenCalledWith(
    '/auth/login',
    {
      email: 'traveller@example.test',
      password: 'fixture password',
      device_name: 'Friendie mobile',
    },
    { signal: expect.any(AbortSignal) },
  );
  expect(secureStorage.setToken).toHaveBeenCalledWith('fixture-token');
  expect(events).toEqual(['stored', 'profile']);
  expect(useAuthStore.getState().status).toBe('authenticated');
  expect(useAuthStore.getState().user).toEqual(user);
});
test('malformed token response never stores credentials or opens the app', async () => {
  jest.spyOn(apiClient, 'post').mockResolvedValue({ data: { token: '' } });
  const save = jest.spyOn(secureStorage, 'setToken');
  await expect(authService.login(credentials)).rejects.toThrow();
  expect(save).not.toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
});
test('keychain refusing a write prevents profile hydration and authentication', async () => {
  jest
    .spyOn(apiClient, 'post')
    .mockResolvedValue({ data: { token: 'fixture-token' } });
  jest.spyOn(Keychain, 'setGenericPassword').mockResolvedValueOnce(false);
  const get = jest.spyOn(apiClient, 'get');
  await expect(authService.login(credentials)).rejects.toThrow(
    'securely store',
  );
  expect(get).not.toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
});
test('invalid profile removes the newly saved token and leaves a guest', async () => {
  jest
    .spyOn(apiClient, 'post')
    .mockResolvedValue({ data: { token: 'fixture-token' } });
  jest.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: { id: 1 } } });
  const remove = jest.spyOn(secureStorage, 'removeToken').mockResolvedValue();
  await expect(authService.login(credentials)).rejects.toThrow();
  expect(remove).toHaveBeenCalledTimes(1);
  expect(useAuthStore.getState().status).toBe('guest');
});
