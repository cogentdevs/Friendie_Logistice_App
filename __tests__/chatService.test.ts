import { appConfig } from '../src/constants/appConfig';
import { apiClient } from '../src/services/api/apiClient';
import { useAuthStore } from '../src/store/authStore';
import {
  getConversation,
  getMessages,
  sendMessage,
} from '../src/features/messages/services/chatService';
const member = { id: 8, name: 'Member', email: 'm@example.test' };
let config: { url: string; chat: boolean; idem: boolean };
beforeEach(() => {
  config = {
    url: appConfig.apiBaseUrl,
    chat: appConfig.chatApiVerified,
    idem: appConfig.chatIdempotencyVerified,
  };
  useAuthStore.getState().setUser(member);
});
afterEach(() => {
  appConfig.apiBaseUrl = config.url;
  appConfig.chatApiVerified = config.chat;
  appConfig.chatIdempotencyVerified = config.idem;
  jest.restoreAllMocks();
});
test('unverified chat and guest access never transmit a request', async () => {
  appConfig.chatApiVerified = false;
  const get = jest.spyOn(apiClient, 'get');
  await expect(getConversation('42')).rejects.toThrow('unavailable');
  useAuthStore.getState().clear();
  await expect(getMessages('42', null)).rejects.toThrow('Sign in');
  expect(get).not.toHaveBeenCalled();
});
test('sending requires verified idempotency and retry reuses the exact key', async () => {
  appConfig.apiBaseUrl = 'https://example.test';
  appConfig.chatApiVerified = true;
  appConfig.chatIdempotencyVerified = false;
  const post = jest.spyOn(apiClient, 'post');
  await expect(sendMessage('42', 'hello', 'client-1')).rejects.toThrow('retry');
  expect(post).not.toHaveBeenCalled();
  appConfig.chatIdempotencyVerified = true;
  post.mockResolvedValue({
    data: {
      data: {
        id: 'server-1',
        conversationId: '42',
        senderId: 8,
        body: 'hello',
        createdAt: '2026-11-05T10:00:00Z',
        clientId: 'client-1',
        status: 'sent',
      },
    },
  });
  await sendMessage('42', ' hello ', 'client-1');
  await sendMessage('42', 'hello', 'client-1');
  for (const call of post.mock.calls)
    expect(call).toEqual([
      '/conversations/42/messages',
      { body: 'hello', clientId: 'client-1' },
      { headers: { 'Idempotency-Key': 'client-1' } },
    ]);
});
test('cross-conversation payloads are rejected and opaque cursors are supported', async () => {
  appConfig.apiBaseUrl = 'https://example.test';
  appConfig.chatApiVerified = true;
  const get = jest
    .spyOn(apiClient, 'get')
    .mockResolvedValue({
      data: {
        data: [
          {
            id: 'm1',
            conversationId: 'other',
            senderId: 8,
            body: 'hello',
            createdAt: '2026-11-05T10:00:00Z',
          },
        ],
        nextCursor: null,
      },
    });
  await expect(getMessages('42', 'opaque/cursor==')).rejects.toThrow(
    'unavailable',
  );
  expect(get).toHaveBeenCalledWith('/conversations/42/messages', {
    signal: undefined,
    params: { before: 'opaque/cursor==' },
  });
});
