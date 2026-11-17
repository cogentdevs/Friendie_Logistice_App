import axios from 'axios';
import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import * as development from '../src/store/developmentStore';
import { markConversationRead } from '../src/features/messages/services/chatService';
const member = { id: 8, name: 'Member', email: 'm@example.test' };
const adapter = apiClient.defaults.adapter;
let calls = 0;
let data: unknown;
beforeEach(() => {
  useAuthStore.getState().setUser({ ...member });
  useDevelopmentStore.setState({ previewActive: false });
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('read-test-token');
  calls = 0;
  data = {
    success: true,
    message: 'Messages marked as read.',
    data: { conversation_id: 42, marked_read: 3, unread_count: 0 },
  };
  apiClient.defaults.adapter = async config => {
    calls++;
    expect(config.url).toBe('/customer/conversations/42/read');
    expect(config.method).toBe('post');
    expect(config.headers.Authorization).toBe('Bearer read-test-token');
    expect(config.data).toBeUndefined();
    expect(config.params).toBeUndefined();
    return { status: 200, statusText: '', config, headers: {}, data };
  };
});
afterEach(() => {
  apiClient.defaults.adapter = adapter;
  jest.restoreAllMocks();
});
test('bodyless authenticated POST parses exact authoritative response', async () => {
  expect(await markConversationRead('42')).toEqual({
    conversation_id: 42,
    marked_read: 3,
    unread_count: 0,
  });
  expect(calls).toBe(1);
});
test.each([
  null,
  {},
  { conversation_id: 43, marked_read: 1, unread_count: 0 },
  { conversation_id: 42, marked_read: -1, unread_count: 0 },
])('rejects malformed acknowledgement %p', async value => {
  data = { success: true, message: 'OK', data: value };
  await expect(markConversationRead('42')).rejects.toMatchObject({
    kind: 'unknown',
  });
});
test.each([400, 401, 403, 404, 422, 429, 500])(
  'HTTP %s is normalized without retry',
  async status => {
    apiClient.defaults.adapter = async config => {
      calls++;
      throw new axios.AxiosError('Failure', undefined, config, undefined, {
        status,
        statusText: '',
        config,
        headers: {},
        data: { message: 'Failure' },
      });
    };
    await expect(markConversationRead('42')).rejects.toMatchObject({ status });
    expect(calls).toBe(1);
  },
);
test.each(['ERR_NETWORK', 'ECONNABORTED'])(
  '%s never automatically retries',
  async code => {
    apiClient.defaults.adapter = async config => {
      calls++;
      throw new axios.AxiosError('Failure', code, config);
    };
    await expect(markConversationRead('42')).rejects.toMatchObject({
      kind: 'network',
    });
    expect(calls).toBe(1);
  },
);
test.each(['logout', 'switch', 'token'])(
  'rejects late response after %s',
  async change => {
    apiClient.defaults.adapter = async config => {
      if (change === 'logout') useAuthStore.getState().clear();
      if (change === 'switch')
        useAuthStore.getState().setUser({ ...member, id: 9 });
      if (change === 'token')
        jest.mocked(secureStorage.getToken).mockResolvedValue('replacement');
      return { status: 200, statusText: '', config, headers: {}, data };
    };
    await expect(markConversationRead('42')).rejects.toMatchObject({
      kind: 'cancelled',
    });
  },
);
test('guest, invalid ID, missing token and aborted request do not POST', async () => {
  await expect(markConversationRead('bad')).rejects.toMatchObject({
    status: 404,
  });
  const controller = new AbortController();
  controller.abort();
  await expect(
    markConversationRead('42', controller.signal),
  ).rejects.toMatchObject({ kind: 'cancelled' });
  jest.mocked(secureStorage.getToken).mockResolvedValue(null);
  await expect(markConversationRead('42')).rejects.toMatchObject({
    status: 401,
  });
  useAuthStore.getState().clear();
  await expect(markConversationRead('42')).rejects.toMatchObject({
    status: 401,
  });
  expect(calls).toBe(0);
});
test('explicit demo preview never posts to Laravel', async () => {
  jest.spyOn(development, 'isUiPreviewActive').mockReturnValue(true);
  await expect(markConversationRead('42')).rejects.toMatchObject({ kind: 'cancelled' });
  expect(calls).toBe(0);
});
