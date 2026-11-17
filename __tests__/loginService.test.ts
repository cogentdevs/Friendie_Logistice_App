import * as Keychain from 'react-native-keychain';
import { appConfig } from '../src/constants/appConfig';
import { apiClient } from '../src/services/api/apiClient';
import { authService } from '../src/features/auth/services/authService';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
const original = {
  url: appConfig.apiBaseUrl,
  verified: appConfig.authApiVerified,
  login: appConfig.loginApiEnabled,
};
const originalNativeWrite = jest
  .mocked(Keychain.setGenericPassword)
  .getMockImplementation()!;
const user = {
  id: 1,
  name: 'Fixture traveller',
  email: 'traveller@example.test',
};
const loginReply = () => ({
  status: 200,
  data: {
    success: true,
    message: 'Login successful.',
    data: { token: 'fixture-token', token_type: 'Bearer', user },
  },
});
const credentials = {
  email: '  TRAVELLER@Example.Test ',
  password: 'fixture password',
};
beforeEach(() => {
  jest.clearAllMocks();
  appConfig.apiBaseUrl = 'https://api.example.test';
  appConfig.authApiVerified = true;
  appConfig.loginApiEnabled = true;
  useAuthStore.getState().clear();
});
afterEach(() => {
  appConfig.apiBaseUrl = original.url;
  appConfig.authApiVerified = original.verified;
  appConfig.loginApiEnabled = original.login;
  jest.restoreAllMocks();
  jest
    .mocked(Keychain.setGenericPassword)
    .mockReset()
    .mockImplementation(originalNativeWrite);
  useAuthStore.getState().clear();
});
test('disabled Login API sends no credentials to the server', async () => {
  appConfig.loginApiEnabled = false;
  const post = jest.spyOn(apiClient, 'post');
  await expect(authService.login(credentials)).rejects.toMatchObject({
    kind: 'unknown',
  });
  expect(post).not.toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
});
test('successful Laravel Login stores the verified token and user securely before authentication', async () => {
  const events: string[] = [];
  jest.spyOn(apiClient, 'post').mockResolvedValue(loginReply());
  const persist = secureStorage.setSession;
  const save = jest
    .spyOn(secureStorage, 'setSession')
    .mockImplementation(async (token, identity) => {
      expect(useAuthStore.getState().status).toBe('guest');
      await persist(token, identity);
      events.push('stored');
    });
  const get = jest.spyOn(apiClient, 'get');
  const unsubscribe = useAuthStore.subscribe(state => {
    if (state.status === 'authenticated') events.push('authenticated');
  });
  try {
    await authService.login(credentials);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/auth/login',
      {
        email: 'traveller@example.test',
        password: 'fixture password',
      },
      { signal: expect.any(AbortSignal), headers: { Authorization: false } },
    );
    expect(save).toHaveBeenCalledWith('fixture-token', user);
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      JSON.stringify(user),
      'fixture-token',
      expect.objectContaining({ service: 'com.friendie.logistics.session' }),
    );
    expect(get).not.toHaveBeenCalled();
    expect(events).toEqual(['stored', 'authenticated']);
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().user).toEqual(user);
  } finally {
    unsubscribe();
  }
});
test('malformed token response never stores credentials or opens the app', async () => {
  const reply = loginReply();
  reply.data.data.token = '';
  jest.spyOn(apiClient, 'post').mockResolvedValue(reply);
  const save = jest.spyOn(secureStorage, 'setSession');
  await expect(authService.login(credentials)).rejects.toThrow();
  expect(save).not.toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
});
test('keychain refusing a session write prevents authentication without an unrelated profile request', async () => {
  jest.spyOn(apiClient, 'post').mockResolvedValue(loginReply());
  jest.spyOn(Keychain, 'setGenericPassword').mockResolvedValueOnce(false);
  const get = jest.spyOn(apiClient, 'get');
  await expect(authService.login(credentials)).rejects.toThrow(
    'securely store',
  );
  expect(get).not.toHaveBeenCalled();
  expect(Keychain.setGenericPassword).toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
});
test('invalid inline Login user is rejected before saving or deleting a session', async () => {
  const reply = loginReply();
  jest.spyOn(apiClient, 'post').mockResolvedValue({
    ...reply,
    data: { ...reply.data, data: { ...reply.data.data, user: { id: 1 } } },
  });
  const get = jest.spyOn(apiClient, 'get');
  const save = jest.spyOn(secureStorage, 'setSession');
  const remove = jest.spyOn(secureStorage, 'removeToken').mockResolvedValue();
  await expect(authService.login(credentials)).rejects.toThrow();
  expect(save).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
});
test('cancellation after secure persistence removes the newly saved credential and leaves a guest', async () => {
  jest.spyOn(apiClient, 'post').mockResolvedValue(loginReply());
  const controller = new AbortController();
  const persist = secureStorage.setSession;
  jest
    .spyOn(secureStorage, 'setSession')
    .mockImplementation(async (token, identity) => {
      await persist(token, identity);
      controller.abort();
    });
  const remove = jest.spyOn(secureStorage, 'removeToken');
  await expect(
    authService.login(credentials, controller.signal),
  ).rejects.toMatchObject({ kind: 'cancelled' });
  expect(remove).toHaveBeenCalledTimes(1);
  expect(useAuthStore.getState().status).toBe('guest');
});
