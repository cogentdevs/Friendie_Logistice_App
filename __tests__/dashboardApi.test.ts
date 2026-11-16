import axios from 'axios';
import { apiClient } from '../src/services/api/apiClient';
import {
  dashboardService,
  dashboardErrorMessage,
} from '../src/features/dashboard/services/dashboardService';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { appConfig } from '../src/constants/appConfig';
const member = { id: 8, name: 'Member', email: 'member@example.test' };
const summary = {
  listings: { total: 15, published: 4, pending: 9, expired: 2 },
  unread_messages: 6,
  reviews_received: 17,
};
const originalAdapter = apiClient.defaults.adapter;
const originalPreview = appConfig.uiPreviewEnabled;
let token: string | null;
let body: unknown;
let calls: number;
beforeEach(() => {
  token = 'dashboard-contract-test-token';
  body = {
    success: true,
    message: 'Dashboard retrieved successfully.',
    data: summary,
  };
  calls = 0;
  useAuthStore.getState().setUser(member);
  useDevelopmentStore.setState({ previewActive: false });
  jest.spyOn(secureStorage, 'getToken').mockImplementation(async () => token);
  apiClient.defaults.adapter = async config => {
    calls++;
    return { status: 200, statusText: 'OK', config, headers: {}, data: body };
  };
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  appConfig.uiPreviewEnabled = originalPreview;
  jest.restoreAllMocks();
});
test('one captured Bearer GET maps actual server counters without using page lengths', async () => {
  apiClient.defaults.adapter = async config => {
    calls++;
    expect(config.url).toBe('/customer/dashboard');
    expect(config.method).toBe('get');
    expect(config.headers.Authorization).toBe(
      'Bearer dashboard-contract-test-token',
    );
    expect(config.params).toBeUndefined();
    expect(config.data).toBeUndefined();
    expect(config.baseURL).toBe(appConfig.apiBaseUrl);
    return { status: 200, statusText: 'OK', config, headers: {}, data: body };
  };
  expect(await dashboardService.summary()).toEqual(summary);
  expect(calls).toBe(1);
});
test('real zero counters remain zero', async () => {
  const empty = {
    listings: { total: 0, published: 0, pending: 0, expired: 0 },
    unread_messages: 0,
    reviews_received: 0,
  };
  body = { success: true, message: 'OK', data: empty };
  expect(await dashboardService.summary()).toEqual(empty);
});
test.each([
  {},
  { success: true, message: 'OK', data: {} },
  { success: true, message: 'OK', data: { ...summary, unread_messages: -1 } },
  { success: false, message: 'Failed', data: summary },
])('invalid response cannot invent counts %j', async invalid => {
  body = invalid;
  await expect(dashboardService.summary()).rejects.toMatchObject({
    kind: 'unknown',
  });
});
test.each(['guest', 'demo'])(
  '%s never calls the authenticated Dashboard endpoint',
  async mode => {
    useAuthStore.getState().clear();
    appConfig.uiPreviewEnabled = true;
    useDevelopmentStore.setState({ previewActive: mode === 'demo' });
    await expect(dashboardService.summary()).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    expect(calls).toBe(0);
    expect(secureStorage.getToken).not.toHaveBeenCalled();
  },
);
test('missing token follows existing conditional credential cleanup', async () => {
  token = null;
  const remove = jest
    .spyOn(secureStorage, 'removeTokenIfCurrent')
    .mockResolvedValue(true);
  await expect(dashboardService.summary()).rejects.toMatchObject({
    kind: 'unauthorized',
  });
  expect(remove).toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
  expect(calls).toBe(0);
});
test.each(['logout', 'switch', 'same-account-login', 'token-change', 'abort'])(
  'late %s response cannot enter the current session cache',
  async action => {
    const controller = new AbortController();
    apiClient.defaults.adapter = async config => {
      if (action === 'logout') useAuthStore.getState().clear();
      if (action === 'switch')
        useAuthStore.getState().setUser({ ...member, id: 9 });
      if (action === 'same-account-login')
        useAuthStore.getState().setUser({ ...member });
      if (action === 'token-change') token = 'changed-contract-test-token';
      if (action === 'abort') controller.abort();
      return { status: 200, statusText: 'OK', config, headers: {}, data: body };
    };
    await expect(
      dashboardService.summary(controller.signal),
    ).rejects.toMatchObject({ kind: 'cancelled' });
  },
);
test.each([403, 404, 429, 500, undefined])(
  'failure %s never clears a valid session or leaks raw details in Toast copy',
  async status => {
    apiClient.defaults.adapter = async config => {
      throw new axios.AxiosError(
        'private detail',
        'ERR_NETWORK',
        config,
        undefined,
        status
          ? {
              status,
              statusText: 'Failure',
              config,
              headers: {},
              data: { message: 'private backend detail' },
            }
          : undefined,
      );
    };
    const error = await dashboardService.summary().catch(value => value);
    expect(dashboardErrorMessage(error)).not.toContain('private');
    expect(useAuthStore.getState().user).toBe(member);
  },
);
test('401 follows the existing interceptor expiry policy for the captured token', async () => {
  jest.spyOn(secureStorage, 'removeTokenIfCurrent').mockResolvedValue(true);
  apiClient.defaults.adapter = async config => {
    throw new axios.AxiosError(
      'unauthorized',
      'ERR_BAD_RESPONSE',
      config,
      undefined,
      {
        status: 401,
        statusText: 'Unauthorized',
        config,
        headers: {},
        data: {},
      },
    );
  };
  await expect(dashboardService.summary()).rejects.toMatchObject({
    kind: 'unauthorized',
  });
  expect(useAuthStore.getState().status).toBe('guest');
});
