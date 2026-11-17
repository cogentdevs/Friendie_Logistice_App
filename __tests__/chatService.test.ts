import axios from 'axios';
import { apiClient } from '../src/services/api/apiClient';
import { appConfig } from '../src/constants/appConfig';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import {
  getConversation,
  getMessages,
  sendMessage,
  normalizeChatTime,
  chatSendConfigured,
} from '../src/features/messages/services/chatService';

const member = { id: 8, name: 'Member', email: 'm@example.test' };
const metadata = {
  id: 42,
  listing: { id: 501, title: null },
  other_participant: { id: 9, display_name: 'Traveller' },
  created_at: null,
};
const message = {
  id: 10,
  conversation_id: 42,
  sender: { id: 9, display_name: 'Traveller' },
  message: 'Actual message',
  created_at: '2026-11-17 10:00:00',
  message_on: '17 Nov 2026',
  is_read: false,
};
const page = (
  current = 1,
  last = 1,
  items: Array<
    Omit<typeof message, 'created_at'> & { created_at: string | null }
  > = [message],
) => ({
  items,
  pagination: {
    current_page: current,
    per_page: 20,
    total: last * 20,
    last_page: last,
  },
});
const originalAdapter = apiClient.defaults.adapter;
let data: unknown, calls: number;
beforeEach(() => {
  useAuthStore.getState().setUser(member);
  useDevelopmentStore.setState({ previewActive: false });
  jest
    .spyOn(secureStorage, 'getToken')
    .mockResolvedValue('chat-read-test-token');
  data = metadata;
  calls = 0;
  apiClient.defaults.adapter = async config => {
    calls++;
    expect(config.method).toBe('get');
    expect(config.baseURL).toBe(appConfig.apiBaseUrl);
    expect(config.headers.Authorization).toBe('Bearer chat-read-test-token');
    return {
      status: 200,
      statusText: '',
      config,
      headers: {},
      data: { success: true, message: 'OK', data },
    };
  };
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
});
test('verified metadata GET parses participant and keeps private contact/presence unavailable', async () => {
  const get = jest.spyOn(apiClient, 'get');
  expect(await getConversation('42')).toEqual({
    id: '42',
    canSend: true,
    participant: { id: 9, name: 'Traveller' },
  });
  expect(get).toHaveBeenCalledWith(
    '/customer/conversations/42',
    expect.objectContaining({
      headers: { Authorization: 'Bearer chat-read-test-token' },
    }),
  );
  expect(get.mock.calls[0][1]?.params).toBeUndefined();
});
test('history preserves real IDs, sender, full body, UTC timestamp and read proof', async () => {
  data = page(1, 1, [{ ...message, message: 'x'.repeat(6000), is_read: true }]);
  const get = jest.spyOn(apiClient, 'get');
  const result = await getMessages('42', null);
  expect(result.data[0]).toMatchObject({
    id: '10',
    conversationId: '42',
    senderId: 9,
    body: 'x'.repeat(6000),
    createdAt: '2026-11-17T10:00:00.000Z',
    status: 'read',
  });
  expect(get).toHaveBeenCalledWith(
    '/customer/conversations/42/messages',
    expect.objectContaining({ params: { page: 1, per_page: 20 } }),
  );
});
test('newest page is resolved first, then earlier pages use documented page parameters', async () => {
  const pages: number[] = [];
  apiClient.defaults.adapter = async config => {
    const number = config.params.page;
    pages.push(number);
    return {
      status: 200,
      statusText: '',
      config,
      headers: {},
      data: {
        success: true,
        message: 'OK',
        data: page(number, 3, [{ ...message, id: number * 10 }]),
      },
    };
  };
  expect((await getMessages('42', null)).nextCursor).toBe('2');
  expect((await getMessages('42', '2')).nextCursor).toBe('1');
  expect((await getMessages('42', '1')).nextCursor).toBeNull();
  expect(pages).toEqual([1, 3, 2, 1]);
});
test('empty history and null timestamp are truthful; unread does not invent sent/delivered status', async () => {
  data = page(1, 1, [{ ...message, created_at: null }]);
  expect((await getMessages('42', null)).data[0]).toMatchObject({
    createdAt: null,
  });
  expect((await getMessages('42', null)).data[0].status).toBeUndefined();
  data = page(1, 1, []);
  expect((await getMessages('42', null)).data).toEqual([]);
});
test('guest/demo cannot access the private transport; demo stays separate', async () => {
  useAuthStore.getState().clear();
  await expect(getConversation('42')).rejects.toMatchObject({ status: 401 });
  expect(calls).toBe(0);
});
test.each(['0', '-1', 'x', '01', '9007199254740992'])(
  'rejects invalid room %s without HTTP',
  async id => {
    await expect(getConversation(id)).rejects.toMatchObject({ status: 404 });
    expect(calls).toBe(0);
  },
);
test.each(['opaque/cursor==', '0', '100001'])(
  'rejects undocumented page token %s',
  async cursor => {
    await expect(getMessages('42', cursor)).rejects.toMatchObject({
      kind: 'validation',
    });
    expect(calls).toBe(0);
  },
);
test.each([
  null,
  { ...metadata, id: 43 },
  { ...metadata, other_participant: { id: 8, display_name: 'Self' } },
])('rejects invalid metadata %j', async value => {
  data = value;
  await expect(getConversation('42')).rejects.toBeDefined();
});
test.each([
  page(1, 1, [{ ...message, conversation_id: 43 }]),
  page(2),
  page(1, 1, [message, message]),
  page(1, 1, [{ ...message, created_at: 'invalid' }]),
  page(1, 1, [message, { ...message, id: 9 }]),
])('rejects mismatched, malformed or out-of-order history', async value => {
  data = value;
  await expect(getMessages('42', null)).rejects.toBeDefined();
});
test.each([401, 403, 404, 422, 429, 500])(
  'handles actual HTTP %s without returning private data',
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
          data: { message: 'Failure' },
        },
      );
    };
    await expect(getConversation('42')).rejects.toMatchObject({ status });
  },
);
test.each(['ERR_NETWORK', 'ECONNABORTED'])(
  'network/timeout %s preserves current session',
  async code => {
    apiClient.defaults.adapter = async config => {
      throw new axios.AxiosError('Failed', code, config);
    };
    await expect(getMessages('42', null)).rejects.toMatchObject({
      kind: 'network',
    });
    expect(useAuthStore.getState().user).toBe(member);
  },
);
test.each(['logout', 'switch', 'token', 'abort'])(
  'late response after %s is ignored',
  async change => {
    const controller = new AbortController();
    apiClient.defaults.adapter = async config => {
      if (change === 'logout') useAuthStore.getState().clear();
      if (change === 'switch')
        useAuthStore.getState().setUser({ ...member, id: 10 });
      if (change === 'token')
        jest.mocked(secureStorage.getToken).mockResolvedValue('new-token');
      if (change === 'abort') controller.abort();
      return {
        status: 200,
        statusText: '',
        config,
        headers: {},
        data: { success: true, message: 'OK', data: metadata },
      };
    };
    await expect(
      getConversation('42', controller.signal),
    ).rejects.toBeDefined();
  },
);
test('guest send cannot transmit without authentication', async () => {
  const post = jest.spyOn(apiClient, 'post');
  useAuthStore.getState().clear();
  expect(chatSendConfigured()).toBe(false);
  await expect(sendMessage('42', 'Do not send', 'client-1')).rejects.toThrow(
    'Sign in',
  );
  expect(post).not.toHaveBeenCalled();
});
test('UTC conversion handles explicit offsets, missing values and invalid timestamps safely', () => {
  expect(normalizeChatTime('2026-11-17T15:00:00+05:00')).toBe(
    '2026-11-17T10:00:00.000Z',
  );
  expect(normalizeChatTime(null)).toBeNull();
  expect(() => normalizeChatTime('not a date')).toThrow();
});
