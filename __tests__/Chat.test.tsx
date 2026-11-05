import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as service from '../src/features/messages/services/chatService';
import {
  useChat,
  orderedMessages,
} from '../src/features/messages/hooks/useChat';
import { useChatDrafts } from '../src/features/messages/store/chatDraftStore';
import { useAuthStore } from '../src/store/authStore';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
let current: ReturnType<typeof useChat>,
  tree: ReactTestRenderer,
  client: QueryClient;
function Harness({ id = '42' }: { id?: string }) {
  current = useChat(id);
  return null;
}
async function settle() {
  await Renderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(() => resolve(), 25));
  });
}
async function mount() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );
  });
  await settle();
}
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
  });
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'm@example.test' });
  useChatDrafts.getState().clear();
  jest.spyOn(service, 'chatSendConfigured').mockReturnValue(true);
  jest
    .spyOn(service, 'getConversation')
    .mockResolvedValue({
      id: '42',
      canSend: true,
      participant: { id: 9, name: 'Traveller', deleted: false },
    });
  jest
    .spyOn(service, 'getMessages')
    .mockResolvedValue({ data: [], nextCursor: null });
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client?.clear();
  });
  jest.restoreAllMocks();
});
test('pending is optimistic, duplicate tap sends once, acknowledgement replaces local row', async () => {
  let acknowledge!: (message: service.ChatMessage) => void;
  const send = jest.spyOn(service, 'sendMessage').mockImplementation(
    () =>
      new Promise(resolve => {
        acknowledge = resolve;
      }),
  );
  await mount();
  await settle();
  await Renderer.act(async () => {
    current.setDraft('Hello');
  });
  let pending!: Promise<void>;
  await Renderer.act(async () => {
    pending = current.send();
    current.send();
  });
  expect(send).toHaveBeenCalledTimes(1);
  expect(current.thread.outbox[0].state).toBe('pending');
  expect(current.server).toEqual([]);
  const clientId = send.mock.calls[0][2];
  await Renderer.act(async () => {
    acknowledge({
      id: 's1',
      conversationId: '42',
      senderId: 8,
      body: 'Hello',
      clientId,
      createdAt: new Date().toISOString(),
      status: 'sent',
    });
    await pending;
  });
  await settle();
  expect(current.thread.outbox).toEqual([]);
  expect(current.server).toHaveLength(1);
  expect(current.server[0].status).toBe('sent');
});
test('failed retry keeps original idempotency key and draft remains separate', async () => {
  const send = jest
    .spyOn(service, 'sendMessage')
    .mockRejectedValueOnce(Error('offline'))
    .mockImplementationOnce(async (_id, body, clientId) => ({
      id: 's1',
      conversationId: '42',
      senderId: 8,
      body,
      clientId,
      createdAt: new Date().toISOString(),
      status: 'delivered',
    }));
  await mount();
  await settle();
  await Renderer.act(async () => {
    current.setDraft('Original');
  });
  await Renderer.act(async () => {
    await current.send();
  });
  const clientId = current.thread.outbox[0].clientId;
  expect(current.thread.outbox[0].state).toBe('failed');
  await Renderer.act(async () => {
    current.setDraft('Unsent draft');
    await current.retry(clientId);
  });
  expect(send.mock.calls[1][2]).toBe(clientId);
  expect(current.thread.draft).toBe('Unsent draft');
  expect(current.server[0].status).toBe('delivered');
});
test('draft survives remount and is cleared on logout', async () => {
  await mount();
  await Renderer.act(async () => {
    current.setDraft('Private draft');
    tree.unmount();
  });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );
  });
  await settle();
  expect(current.thread.draft).toBe('Private draft');
  await Renderer.act(async () => {
    useAuthStore.getState().clear();
  });
  expect(useChatDrafts.getState().threads).toEqual({});
});
test('deleted participant cannot send and chronological pages deduplicate', async () => {
  jest
    .spyOn(service, 'getConversation')
    .mockResolvedValue({
      id: '42',
      canSend: false,
      participant: { id: 9, name: 'Deleted', deleted: true },
    });
  const send = jest.spyOn(service, 'sendMessage');
  await mount();
  await settle();
  expect(current.canSend).toBe(false);
  await Renderer.act(async () => {
    current.setDraft('Hello');
    await current.send();
  });
  expect(send).not.toHaveBeenCalled();
  const a: service.ChatMessage = {
      id: 'a',
      conversationId: '42',
      senderId: 9,
      body: 'A',
      createdAt: '2026-11-05T09:00:00Z',
    },
    b = { ...a, id: 'b', createdAt: '2026-11-05T10:00:00Z' };
  expect(
    orderedMessages([
      { data: [b], nextCursor: 'a' },
      { data: [a, b], nextCursor: null },
    ]).map(item => item.id),
  ).toEqual(['a', 'b']);
});
