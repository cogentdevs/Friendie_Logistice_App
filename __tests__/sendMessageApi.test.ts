import axios from 'axios';
import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import {
  sendMessage,
  validateMessageText,
} from '../src/features/messages/services/chatService';
const member = { id: 8, name: 'Member', email: 'm@example.test' };
const row = {
  id: 99,
  conversation_id: 42,
  sender: { id: 8, display_name: 'Member' },
  message: 'Hello',
  created_at: '2026-11-17 10:00:00',
  message_on: '17 Nov 2026',
  is_read: false,
};
const adapter = apiClient.defaults.adapter;
let calls: number, response: unknown;
beforeEach(() => {
  useAuthStore.getState().setUser(member);
  useDevelopmentStore.setState({ previewActive: false });
  jest
    .spyOn(secureStorage, 'getToken')
    .mockResolvedValue('send-contract-test-token');
  calls = 0;
  response = {
    success: true,
    message: 'Message sent successfully.',
    data: row,
  };
  apiClient.defaults.adapter = async config => {
    calls++;
    expect(config.url).toBe('/customer/conversations/42/messages');
    expect(config.method).toBe('post');
    expect(config.headers.Authorization).toBe(
      'Bearer send-contract-test-token',
    );
    expect(config.headers['Idempotency-Key']).toBeUndefined();
    expect(JSON.parse(config.data)).toEqual({ message: 'Hello' });
    return { status: 201, statusText: '', config, headers: {}, data: response };
  };
});
afterEach(() => {
  apiClient.defaults.adapter = adapter;
  jest.restoreAllMocks();
});
test('sends exact verified JSON once and maps only server-confirmed identity/time', async () => {
  expect(await sendMessage('42', 'Hello', 'unused-local-key')).toEqual({
    id: '99',
    conversationId: '42',
    senderId: 8,
    body: 'Hello',
    createdAt: '2026-11-17T10:00:00.000Z',
  });
  expect(calls).toBe(1);
});
test.each(['', '  \n\t', 'x'.repeat(10001), 'hi\0there'])(
  'rejects invalid draft without POST',
  async body => {
    await expect(sendMessage('42', body, 'unused')).rejects.toMatchObject({
      kind: 'validation',
    });
    expect(calls).toBe(0);
  },
);
test('10000 Unicode codepoints are accepted, without modifying or truncating the payload', async () => {
  const body = '😀'.repeat(10000);
  expect(() => validateMessageText(body)).not.toThrow();
  apiClient.defaults.adapter = async config => {
    expect(JSON.parse(config.data)).toEqual({ message: body });
    return {
      status: 201,
      statusText: '',
      config,
      headers: {},
      data: { success: true, message: 'OK', data: { ...row, message: body } },
    };
  };
  expect((await sendMessage('42', body, 'unused')).body).toBe(body);
});
test.each([400, 401, 403, 404, 422, 429, 500])(
  'actual HTTP %s is rejected without retry',
  async status => {
    let count = 0;
    apiClient.defaults.adapter = async config => {
      count++;
      throw new axios.AxiosError('Failure', undefined, config, undefined, {
        status,
        statusText: '',
        config,
        headers: {},
        data: { message: 'Failure', errors: { message: ['Invalid message.'] } },
      });
    };
    await expect(sendMessage('42', 'Hello', 'unused')).rejects.toMatchObject({
      status,
    });
    expect(count).toBe(1);
  },
);
test.each(['ERR_NETWORK', 'ECONNABORTED'])(
  'ambiguous network/timeout %s is never retried',
  async code => {
    let count = 0;
    apiClient.defaults.adapter = async config => {
      count++;
      throw new axios.AxiosError('Failure', code, config);
    };
    await expect(sendMessage('42', 'Hello', 'unused')).rejects.toMatchObject({
      kind: 'network',
    });
    expect(count).toBe(1);
  },
);
test.each([
  null,
  { ...row, id: 0 },
  { ...row, conversation_id: 43 },
  { ...row, sender: { id: 9, display_name: 'Other' } },
  { ...row, message: 'Other body' },
])('invalid acknowledgement is never a successful send', async data => {
  response = { success: true, message: 'OK', data };
  await expect(sendMessage('42', 'Hello', 'unused')).rejects.toBeDefined();
});
test.each(['logout', 'switch', 'token'])(
  'ignores late acknowledgement after %s',
  async change => {
    apiClient.defaults.adapter = async config => {
      if (change === 'logout') useAuthStore.getState().clear();
      if (change === 'switch')
        useAuthStore.getState().setUser({ ...member, id: 10 });
      if (change === 'token')
        jest
          .mocked(secureStorage.getToken)
          .mockResolvedValue('replacement-token');
      return {
        status: 201,
        statusText: '',
        config,
        headers: {},
        data: response,
      };
    };
    await expect(sendMessage('42', 'Hello', 'unused')).rejects.toMatchObject({
      kind: 'cancelled',
    });
  },
);
test('guest and invalid room IDs never send', async () => {
  await expect(sendMessage('bad', 'Hello', 'unused')).rejects.toMatchObject({
    status: 404,
  });
  useAuthStore.getState().clear();
  await expect(sendMessage('42', 'Hello', 'unused')).rejects.toMatchObject({
    status: 401,
  });
  expect(calls).toBe(0);
});
test('missing local token clears only current credentials and never posts', async () => {
  jest.mocked(secureStorage.getToken).mockResolvedValue(null);
  jest.spyOn(secureStorage, 'removeTokenIfCurrent').mockResolvedValue(true);
  await expect(sendMessage('42', 'Hello', 'unused')).rejects.toMatchObject({
    status: 401,
  });
  expect(calls).toBe(0);
  expect(useAuthStore.getState().status).toBe('guest');
});
test('whitespace is sent unchanged; only authoritative server normalization is accepted', async () => {
  apiClient.defaults.adapter = async config => {
    expect(JSON.parse(config.data)).toEqual({ message: '  Hello  ' });
    return { status: 201, statusText: '', config, headers: {}, data: response };
  };
  expect((await sendMessage('42', '  Hello  ', 'unused')).body).toBe('Hello');
});
