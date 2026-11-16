import axios from 'axios';
import { apiClient } from '../src/services/api/apiClient';
import { authService } from '../src/features/auth/services/authService';
import { appConfig } from '../src/constants/appConfig';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
const user = { id: 4, name: 'Member', email: 'member@example.test' };
const adapter = apiClient.defaults.adapter;
beforeEach(() => {
  useAuthStore.getState().clear();
});
afterEach(() => {
  apiClient.defaults.adapter = adapter;
  jest.restoreAllMocks();
});
test('real login sends exactly email/password publicly and stores confirmed session without profile call', async () => {
  const save = jest.spyOn(secureStorage, 'setSession').mockResolvedValue();
  const read = jest.spyOn(secureStorage, 'getToken');
  let count = 0;
  apiClient.defaults.adapter = async config => {
    count++;
    expect(config.url).toBe('/auth/login');
    expect(config.baseURL).toBe(appConfig.apiBaseUrl);
    expect(JSON.parse(config.data)).toEqual({
      email: user.email,
      password: 'secret',
    });
    expect(config.headers.Authorization).toBe(false);
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      data: {
        success: true,
        data: { token: 'real-contract-test-token', token_type: 'Bearer', user },
      },
    };
  };
  await authService.login({
    email: ' MEMBER@example.test ',
    password: 'secret',
  });
  expect(count).toBe(1);
  expect(read).not.toHaveBeenCalled();
  expect(save).toHaveBeenCalledWith('real-contract-test-token', user);
  expect(useAuthStore.getState().user).toEqual(user);
});
test.each([
  {},
  { success: true, data: { token: 'bad', token_type: 'Other', user } },
  { success: false, data: { token: 'bad', token_type: 'Bearer', user } },
])('invalid responses never establish session', async data => {
  const save = jest.spyOn(secureStorage, 'setSession');
  apiClient.defaults.adapter = async config => ({
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    data,
  });
  await expect(
    authService.login({ email: user.email, password: 'secret' }),
  ).rejects.toMatchObject({ kind: 'unknown' });
  expect(save).not.toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
});
test.each([401, 403, 422, 429, 500])(
  'HTTP %s is safe and cannot establish session',
  async status => {
    apiClient.defaults.adapter = async config => {
      throw new axios.AxiosError(
        'failure',
        'ERR_BAD_RESPONSE',
        config,
        undefined,
        {
          status,
          statusText: '',
          headers: {},
          config,
          data: {
            message: 'private server details',
            errors: { email: ['Check email'] },
          },
        },
      );
    };
    await expect(
      authService.login({ email: user.email, password: 'secret' }),
    ).rejects.toMatchObject({ status });
    expect(useAuthStore.getState().status).toBe('guest');
  },
);
test('network failure retains guest state', async () => {
  apiClient.defaults.adapter = async config => {
    throw new axios.AxiosError('connection failed', 'ERR_NETWORK', config);
  };
  await expect(
    authService.login({ email: user.email, password: 'secret' }),
  ).rejects.toMatchObject({ kind: 'network' });
  expect(useAuthStore.getState().status).toBe('guest');
});
test('startup restores securely saved login without calling another endpoint', async () => {
  jest
    .spyOn(secureStorage, 'getSession')
    .mockResolvedValue({ token: 'stored-token', user });
  const get = jest.spyOn(apiClient, 'get');
  await authService.restore();
  expect(get).not.toHaveBeenCalled();
  expect(useAuthStore.getState().user).toEqual(user);
});
test('guest logout without a token stays local', async () => {
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue(null);
  const post = jest.spyOn(apiClient, 'post');
  await authService.logout();
  expect(post).not.toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
});
test('demo credentials never reach backend', async () => {
  const post = jest.spyOn(apiClient, 'post');
  await expect(
    authService.login({
      email: 'demo@friendie.test',
      password: 'Friendie@123',
    }),
  ).rejects.toMatchObject({ kind: 'forbidden' });
  expect(post).not.toHaveBeenCalled();
});
