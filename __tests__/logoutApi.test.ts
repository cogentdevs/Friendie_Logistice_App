import axios from 'axios';
import * as Keychain from 'react-native-keychain';
import { apiClient } from '../src/services/api/apiClient';
import { authService } from '../src/features/auth/services/authService';
import { logoutApiService } from '../src/features/auth/services/logoutApiService';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { secureStorage } from '../src/services/storage/secureStorage';
const user = { id: 8, name: 'Member', email: 'member@example.test' };
const success = { success: true, message: 'Logout successful.', data: {} };
const originalAdapter = apiClient.defaults.adapter;
let record: { username: string; password: string } | false;
function respond(data: unknown = success, status = 200) {
  apiClient.defaults.adapter = async config => ({
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  record = { username: JSON.stringify(user), password: 'contract-test-token' };
  useAuthStore.getState().setUser(user);
  useDevelopmentStore.setState({ previewActive: false });
  jest
    .spyOn(Keychain, 'getGenericPassword')
    .mockImplementation(async () => record as never);
  jest.spyOn(Keychain, 'resetGenericPassword').mockImplementation(async () => {
    record = false;
    return true;
  });
  respond();
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
  useDevelopmentStore.setState({ previewActive: false });
});
test('real logout sends one empty POST with snapshot Bearer and removes secure session only after confirmed response', async () => {
  let count = 0;
  apiClient.defaults.adapter = async config => {
    count++;
    expect(config.url).toBe('/auth/logout');
    expect(config.data).toBeUndefined();
    expect(config.method).toBe('post');
    expect(config.headers.Authorization).toBe('Bearer contract-test-token');
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(record).not.toBe(false);
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      data: success,
    };
  };
  await authService.logout();
  expect(count).toBe(1);
  expect(record).toBe(false);
  expect(useAuthStore.getState().status).toBe('guest');
  expect(await secureStorage.getSession()).toBeNull();
  let authorization: unknown;
  apiClient.defaults.adapter = async config => {
    authorization = config.headers.Authorization;
    return { status: 200, statusText: 'OK', headers: {}, config, data: {} };
  };
  await apiClient.get('/protected-test');
  expect(authorization).toBeUndefined();
});
test('server 401 is already-invalid, not a claim of successful revocation, and safely removes local session', async () => {
  respond({ success: false, message: 'Unauthenticated.' }, 401);
  expect(await logoutApiService.revoke('contract-test-token')).toBe(
    'already-invalid',
  );
  await authService.logout();
  expect(record).toBe(false);
  expect(useAuthStore.getState().status).toBe('guest');
});
test.each([403, 429, 500])(
  'HTTP %s retains token and identity for retry without exposing server details',
  async status => {
    apiClient.defaults.adapter = async config => {
      throw new axios.AxiosError(
        'failed',
        'ERR_BAD_RESPONSE',
        config,
        undefined,
        {
          status,
          statusText: '',
          headers: {},
          config,
          data: { message: 'private exception and SQL' },
        },
      );
    };
    await expect(authService.logout()).rejects.toMatchObject({ status });
    expect(record).not.toBe(false);
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
  },
);
test.each(['ERR_NETWORK', 'ECONNABORTED'])(
  '%s preserves real session and allows a successful retry',
  async code => {
    apiClient.defaults.adapter = async config => {
      throw new axios.AxiosError('private connection details', code, config);
    };
    await expect(authService.logout()).rejects.toMatchObject({
      kind: 'network',
    });
    expect(record).not.toBe(false);
    expect(useAuthStore.getState().status).toBe('authenticated');
    respond();
    await authService.logout();
    expect(record).toBe(false);
  },
);
test.each([
  {},
  { success: false, message: 'Failed', data: {} },
  {
    success: true,
    message: 'Logout successful.',
    data: { token: 'unexpected' },
  },
])(
  'unexpected response never clears a potentially valid session',
  async data => {
    respond(data);
    await expect(authService.logout()).rejects.toMatchObject({
      kind: 'unknown',
    });
    expect(record).not.toBe(false);
    expect(useAuthStore.getState().status).toBe('authenticated');
  },
);
test('duplicate calls share one logout; new login cannot race with revocation', async () => {
  let finish!: () => void, started!: () => void;
  const ready = new Promise<void>(resolve => {
    started = resolve;
  });
  let count = 0;
  apiClient.defaults.adapter = config =>
    new Promise(resolve => {
      count++;
      finish = () =>
        resolve({
          status: 200,
          statusText: '',
          headers: {},
          config,
          data: success,
        });
      started();
    });
  const first = authService.logout(),
    second = authService.logout();
  expect(first).toBe(second);
  await ready;
  await expect(
    authService.login({ email: user.email, password: 'unused' }),
  ).rejects.toMatchObject({ kind: 'cancelled' });
  expect(count).toBe(1);
  finish();
  await first;
  expect(record).toBe(false);
});
test('demo/guest logout is local and never calls Laravel even with a stale stored token', async () => {
  useAuthStore.getState().clear();
  useDevelopmentStore.setState({ previewActive: true });
  const post = jest.spyOn(apiClient, 'post');
  await authService.logout();
  expect(post).not.toHaveBeenCalled();
  expect(record).toBe(false);
});
test('native credential cleanup failure is not reported as logout success', async () => {
  jest.spyOn(Keychain, 'resetGenericPassword').mockResolvedValue(false);
  await expect(authService.logout()).rejects.toThrow('Could not clear');
  expect(record).not.toBe(false);
  expect(useAuthStore.getState().status).toBe('authenticated');
});
test('late startup restoration cannot restore a session after logout', async () => {
  let finish!: (value: { token: string; user: typeof user }) => void;
  jest.spyOn(secureStorage, 'getSession').mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const restore = authService.restore().catch(error => error);
  await authService.logout();
  finish({ token: 'old-token', user });
  expect(await restore).toMatchObject({ kind: 'cancelled' });
  expect(useAuthStore.getState().status).toBe('guest');
});
test('late logout response cannot remove a replacement account token or identity', async () => {
  let finish!: () => void, started!: () => void;
  const ready = new Promise<void>(resolve => {
    started = resolve;
  });
  apiClient.defaults.adapter = config =>
    new Promise(resolve => {
      finish = () =>
        resolve({
          status: 200,
          statusText: '',
          headers: {},
          config,
          data: success,
        });
      started();
    });
  const logout = authService.logout().catch(error => error);
  await ready;
  const other = { id: 9, name: 'Other', email: 'other@example.test' };
  useAuthStore.getState().setUser(other);
  record = { username: JSON.stringify(other), password: 'replacement-token' };
  finish();
  expect(await logout).toMatchObject({ kind: 'cancelled' });
  expect(record && record.password).toBe('replacement-token');
  expect(useAuthStore.getState().user?.id).toBe(9);
});

test('explicit Logout token cannot be replaced by a later Keychain value in the interceptor', async () => {
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('different-token');
  apiClient.defaults.adapter = async config => {
    expect(config.headers.Authorization).toBe('Bearer snapshot-token');
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      data: success,
    };
  };
  expect(await logoutApiService.revoke('snapshot-token')).toBe('revoked');
});
