import axios from 'axios';
import { apiClient } from '../src/services/api/apiClient';
import { authService } from '../src/features/auth/services/authService';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
const user = { id: 7, name: 'Server name', email: 'account@example.test' };
const adapter = apiClient.defaults.adapter;
let token: string | null;
let requests: number;
const response = (config: any, data: unknown = user) => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
  data: { success: true, message: 'Account retrieved successfully.', data },
});
beforeEach(() => {
  useAuthStore.getState().clear();
  useDevelopmentStore.setState({ previewActive: false });
  token = 'dummy-current-account-token';
  requests = 0;
  jest
    .spyOn(secureStorage, 'getSession')
    .mockImplementation(async () =>
      token ? { token, user: { ...user, name: 'Cached' } } : null,
    );
  jest.spyOn(secureStorage, 'getToken').mockImplementation(async () => token);
  jest
    .spyOn(secureStorage, 'removeTokenIfCurrent')
    .mockImplementation(async (expected, current) => {
      if (token !== expected || !current()) return false;
      token = null;
      return true;
    });
  apiClient.defaults.adapter = async config => {
    requests++;
    expect(config.url).toBe('/auth/me');
    expect(config.method).toBe('get');
    expect(config.headers.Authorization).toBe(
      'Bearer dummy-current-account-token',
    );
    expect(config.params).toBeUndefined();
    expect(config.data).toBeUndefined();
    return response(config);
  };
});
afterEach(async () => {
  useDevelopmentStore.setState({ previewActive: false });
  token = null;
  await authService.restore();
  apiClient.defaults.adapter = adapter;
  jest.restoreAllMocks();
  useAuthStore.getState().clear();
});
test('server identity replaces cached identity only after GET confirmation', async () => {
  await authService.restore();
  expect(requests).toBe(1);
  expect(useAuthStore.getState().user).toEqual(user);
  expect(secureStorage.removeTokenIfCurrent).not.toHaveBeenCalled();
});
test('no token stays guest and sends no private request', async () => {
  token = null;
  await authService.restore();
  expect(requests).toBe(0);
  expect(useAuthStore.getState().status).toBe('guest');
});
test('demo preview never verifies stored credentials against Laravel', async () => {
  useDevelopmentStore.setState({ previewActive: true });
  await authService.restore();
  await authService.retryRestore();
  expect(requests).toBe(0);
  expect(useAuthStore.getState().status).toBe('guest');
});
test.each([401, 403, 429, 500])(
  'HTTP %s clears only definitive invalid credentials',
  async status => {
    apiClient.defaults.adapter = async config => {
      requests++;
      throw new axios.AxiosError(
        'private',
        'ERR_BAD_RESPONSE',
        config,
        undefined,
        { status, statusText: '', headers: {}, config, data: {} },
      );
    };
    if (status === 401) await authService.restore();
    else await expect(authService.restore()).rejects.toMatchObject({ status });
    expect(token === null).toBe(status === 401);
    expect(useAuthStore.getState().status).toBe('guest');
    expect(requests).toBe(1);
  },
);
test.each(['ERR_NETWORK', 'ECONNABORTED'])(
  '%s retains token and retries only on later explicit lifecycle',
  async code => {
    apiClient.defaults.adapter = async config => {
      requests++;
      throw new axios.AxiosError('offline', code, config);
    };
    await expect(authService.restore()).rejects.toMatchObject({
      kind: 'network',
    });
    expect(token).not.toBeNull();
    expect(requests).toBe(1);
    expect(useAuthStore.getState().user).toBeNull();
    apiClient.defaults.adapter = async config => {
      requests++;
      return response(config);
    };
    await authService.retryRestore();
    expect(requests).toBe(2);
    expect(useAuthStore.getState().user).toEqual(user);
    await authService.retryRestore();
    expect(requests).toBe(2);
  },
);
test.each([{}, { id: 7 }, { ...user, id: 8 }])(
  'invalid or mismatching identity never restores: %p',
  async data => {
    apiClient.defaults.adapter = async config => response(config, data);
    await expect(authService.restore()).rejects.toMatchObject({
      kind: 'unknown',
    });
    expect(token).not.toBeNull();
    expect(useAuthStore.getState().status).toBe('guest');
  },
);
test.each(['logout', 'account', 'token', 'abort'])(
  'pending GET cannot survive %s change',
  async change => {
    let complete!: () => void;
    let started!: () => void;
    const ready = new Promise<void>(resolve => {
      started = resolve;
    });
    apiClient.defaults.adapter = config =>
      new Promise(resolve => {
        complete = () => resolve(response(config));
        started();
      });
    const controller = new AbortController();
    const attempt = authService
      .restore(controller.signal)
      .catch(error => error);
    await ready;
    expect(useAuthStore.getState().user).toBeNull();
    if (change === 'logout') await authService.logout();
    if (change === 'account')
      useAuthStore.getState().setUser({ ...user, id: 9 });
    if (change === 'token') token = 'replacement-token';
    if (change === 'abort') controller.abort();
    complete();
    expect(await attempt).toMatchObject({ kind: 'cancelled' });
    expect(useAuthStore.getState().user?.id).toBe(
      change === 'account' ? 9 : undefined,
    );
  },
);
test('concurrent restoration shares one request', async () => {
  await Promise.all([
    authService.restore(),
    authService.restore(),
    authService.restore(),
  ]);
  expect(requests).toBe(1);
});
test('an aborted bootstrap flight does not block its replacement attempt', async () => {
  let complete!: () => void;
  let started!: () => void;
  const ready = new Promise<void>(resolve => {
    started = resolve;
  });
  apiClient.defaults.adapter = config => {
    requests++;
    if (requests === 1)
      return new Promise(resolve => {
        complete = () => resolve(response(config));
        started();
      });
    return Promise.resolve(response(config));
  };
  const controller = new AbortController();
  const first = authService.restore(controller.signal).catch(error => error);
  await ready;
  controller.abort();
  await authService.restore(new AbortController().signal);
  complete();
  expect(await first).toMatchObject({ kind: 'cancelled' });
  expect(requests).toBe(2);
  expect(useAuthStore.getState().user).toEqual(user);
});
