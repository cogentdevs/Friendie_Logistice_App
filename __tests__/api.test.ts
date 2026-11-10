import axios from 'axios';
import { installInterceptors } from '../src/services/api/interceptors';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
function clientFor(status: number, data = {}) {
  const client = axios.create({
    baseURL: 'https://api.example.test',
    adapter: async config => {
      throw new axios.AxiosError(
        'failure',
        'ERR_BAD_RESPONSE',
        config,
        undefined,
        { status, statusText: '', data, config, headers: {} },
      );
    },
  });
  installInterceptors(client);
  return client;
}
test('a revoked token clears secure storage and protected state', async () => {
  useAuthStore
    .getState()
    .setUser({ id: 1, name: 'Test', email: 'test@example.test' });
  require('react-native-keychain').getGenericPassword.mockResolvedValue({
    password: 'revoked',
  });
  await expect(clientFor(401).get('/user')).rejects.toMatchObject({
    kind: 'unauthorized',
    status: 401,
  });
  expect(
    require('react-native-keychain').resetGenericPassword,
  ).toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
});
test.each([
  [403, 'forbidden'],
  [404, 'not-found'],
  [429, 'rate-limit'],
  [500, 'server'],
])('normalizes HTTP %s', async (status, kind) => {
  await expect(clientFor(status as number).get('/')).rejects.toMatchObject({
    kind,
  });
});
test('Laravel validation errors retain field messages', async () => {
  await expect(
    clientFor(422, {
      message: 'Invalid email',
      errors: { email: ['Invalid email'] },
    }).post('/auth/login'),
  ).rejects.toMatchObject({
    kind: 'validation',
    fields: { email: ['Invalid email'] },
  });
});
test('tokens are attached to API requests', async () => {
  jest.spyOn(secureStorage, 'getToken').mockResolvedValueOnce('token');
  const client = axios.create({
    baseURL: 'https://api.example.test',
    adapter: async config => ({
      data: config.headers.Authorization,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }),
  });
  installInterceptors(client);
  expect((await client.get('/')).data).toBe('Bearer token');
});

afterEach(() => {
  jest.restoreAllMocks();
  require('react-native-keychain').getGenericPassword.mockResolvedValue(false);
});
test('a delayed unauthorized response cannot revoke a newer account session', async () => {
  const keychain = require('react-native-keychain');
  keychain.getGenericPassword.mockResolvedValue({ password: 'old-token' });
  useAuthStore
    .getState()
    .setUser({ id: 1, name: 'Old', email: 'old@example.test' });
  let fail!: () => void;
  let started!: () => void;
  const dispatched = new Promise<void>(resolve => {
    started = resolve;
  });
  const client = axios.create({
    baseURL: 'https://api.example.test',
    adapter: config =>
      new Promise((_resolve, reject) => {
        fail = () =>
          reject(
            new axios.AxiosError(
              'failure',
              'ERR_BAD_RESPONSE',
              config,
              undefined,
              { status: 401, statusText: '', data: {}, config, headers: {} },
            ),
          );
        started();
      }),
  });
  installInterceptors(client);
  const pending = client.get('/user');
  await dispatched;
  keychain.getGenericPassword.mockResolvedValue({ password: 'new-token' });
  useAuthStore
    .getState()
    .setUser({ id: 2, name: 'New', email: 'new@example.test' });
  keychain.resetGenericPassword.mockClear();
  fail();
  await expect(pending).rejects.toMatchObject({ kind: 'unauthorized' });
  expect(keychain.resetGenericPassword).not.toHaveBeenCalled();
  expect(useAuthStore.getState().user?.id).toBe(2);
});
