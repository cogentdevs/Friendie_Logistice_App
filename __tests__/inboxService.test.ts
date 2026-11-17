import axios from 'axios';
import { apiClient } from '../src/services/api/apiClient';
import { appConfig } from '../src/constants/appConfig';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import {
  getInboxPage,
  inboxErrorMessage,
} from '../src/features/messages/services/inboxService';
import { inboxPageFixture, inboxItemFixture } from '../test/fixtures/inbox';
import { ApiError } from '../src/types/api';

const member = { id: 8, name: 'Member', email: 'member@example.test' };
const adapter = apiClient.defaults.adapter;
let body: unknown;
let calls: number;
beforeEach(() => {
  useAuthStore.getState().setUser(member);
  useDevelopmentStore.setState({ previewActive: false });
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('inbox-test-token');
  body = {
    success: true,
    message: 'Conversations retrieved successfully.',
    data: inboxPageFixture(),
  };
  calls = 0;
  apiClient.defaults.adapter = async config => {
    calls++;
    expect(config.method).toBe('get');
    expect(config.baseURL).toBe(appConfig.apiBaseUrl);
    expect(config.url).toBe('/customer/conversations');
    expect(config.params).toEqual({ page: 1, per_page: 20 });
    expect(config.headers.Authorization).toBe('Bearer inbox-test-token');
    expect(config.data).toBeUndefined();
    return { status: 200, statusText: '', config, headers: {}, data: body };
  };
});
afterEach(() => {
  apiClient.defaults.adapter = adapter;
  useDevelopmentStore.setState({ previewActive: false });
  jest.restoreAllMocks();
});
test('verified private GET preserves room, participant, listing, preview, dates and unread', async () => {
  const result = await getInboxPage();
  expect(result).toEqual(inboxPageFixture());
  expect(calls).toBe(1);
});
test('nullable fields and empty inbox are preserved without fake values', async () => {
  const item = {
    ...inboxItemFixture,
    listing: { id: 501, title: null },
    other_participant: { id: 9, display_name: null },
    created_at: null,
    last_message: null,
    last_message_at: null,
    unread_count: 0,
  };
  body = {
    success: true,
    message: 'OK',
    data: { ...inboxPageFixture(), items: [item] },
  };
  expect((await getInboxPage()).items).toEqual([item]);
  body = {
    success: true,
    message: 'OK',
    data: {
      items: [],
      pagination: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
    },
  };
  expect((await getInboxPage()).items).toEqual([]);
});
test('documented page size and page are sent', async () => {
  apiClient.defaults.adapter = async config => {
    expect(config.params).toEqual({ page: 3, per_page: 50 });
    return {
      status: 200,
      statusText: '',
      config,
      headers: {},
      data: {
        success: true,
        message: 'OK',
        data: {
          items: [],
          pagination: {
            current_page: 3,
            per_page: 50,
            total: 100,
            last_page: 2,
          },
        },
      },
    };
  };
  expect((await getInboxPage(3, undefined, 50)).pagination.current_page).toBe(
    3,
  );
});
test.each([
  [0, 20],
  [1, 0],
  [1, 51],
  [100001, 20],
  [1.5, 20],
])('rejects invalid pagination %s/%s without HTTP', async (page, size) => {
  await expect(getInboxPage(page, undefined, size)).rejects.toMatchObject({
    kind: 'validation',
  });
  expect(calls).toBe(0);
});
test('guest and demo cannot fetch private inbox', async () => {
  useAuthStore.getState().clear();
  await expect(getInboxPage()).rejects.toMatchObject({ status: 401 });
  useDevelopmentStore.setState({ previewActive: true });
  await expect(getInboxPage()).rejects.toMatchObject({ status: 401 });
  expect(calls).toBe(0);
});
test('unknown private fields are not published into inbox cache', async () => {
  body = {
    success: true,
    message: 'OK',
    data: {
      ...inboxPageFixture(),
      items: [
        {
          ...inboxItemFixture,
          phone: 'private',
          other_participant: {
            ...inboxItemFixture.other_participant,
            email: 'private',
          },
        },
      ],
    },
  };
  const result = await getInboxPage();
  expect(result.items[0]).toEqual(inboxItemFixture);
});
test.each([
  null,
  { success: false },
  { success: true, message: 'OK', data: [] },
  {
    success: true,
    message: 'OK',
    data: {
      ...inboxPageFixture(),
      items: [{ ...inboxItemFixture, unread_count: -1 }],
    },
  },
  {
    success: true,
    message: 'OK',
    data: {
      ...inboxPageFixture(),
      items: [inboxItemFixture, inboxItemFixture],
    },
  },
  {
    success: true,
    message: 'OK',
    data: {
      ...inboxPageFixture(),
      items: [
        {
          ...inboxItemFixture,
          other_participant: { id: 8, display_name: 'Self' },
        },
      ],
    },
  },
  {
    success: true,
    message: 'OK',
    data: {
      ...inboxPageFixture(),
      pagination: { ...inboxPageFixture().pagination, current_page: 2 },
    },
  },
])('rejects invalid envelope or records %j', async invalid => {
  body = invalid;
  await expect(getInboxPage()).rejects.toMatchObject({ kind: 'unknown' });
});
test.each([401, 403, 404, 429, 500])(
  'normalizes actual HTTP %s without success',
  async status => {
    apiClient.defaults.adapter = async config => {
      throw new axios.AxiosError(
        'Request failed',
        undefined,
        config,
        undefined,
        {
          status,
          statusText: '',
          config,
          headers: {},
          data: { message: 'Server message' },
        },
      );
    };
    await expect(getInboxPage()).rejects.toMatchObject({ status });
  },
);
test.each(['ERR_NETWORK', 'ECONNABORTED'])(
  'handles network/timeout %s',
  async code => {
    apiClient.defaults.adapter = async config => {
      throw new axios.AxiosError('Failed', code, config);
    };
    await expect(getInboxPage()).rejects.toMatchObject({ kind: 'network' });
    expect(useAuthStore.getState().user).toBe(member);
  },
);
test.each(['logout', 'switch', 'token', 'abort'])(
  'ignores late inbox after %s',
  async change => {
    const controller = new AbortController();
    apiClient.defaults.adapter = async config => {
      if (change === 'logout') useAuthStore.getState().clear();
      if (change === 'switch')
        useAuthStore.getState().setUser({ ...member, id: 10 });
      if (change === 'token')
        jest.mocked(secureStorage.getToken).mockResolvedValue('new-token');
      if (change === 'abort') controller.abort();
      return { status: 200, statusText: '', config, headers: {}, data: body };
    };
    await expect(getInboxPage(1, controller.signal)).rejects.toBeDefined();
  },
);
test('missing token clears only the current session without HTTP', async () => {
  jest.mocked(secureStorage.getToken).mockResolvedValue(null);
  jest.spyOn(secureStorage, 'removeTokenIfCurrent').mockResolvedValue(true);
  await expect(getInboxPage()).rejects.toMatchObject({ status: 401 });
  expect(calls).toBe(0);
});
test('safe actionable error copy does not expose server exception details', () => {
  expect(inboxErrorMessage(new Error('SQLSTATE secret'))).not.toContain(
    'SQLSTATE',
  );
  expect(inboxErrorMessage(new ApiError('secret', 'network'))).toContain(
    'connect',
  );
});
