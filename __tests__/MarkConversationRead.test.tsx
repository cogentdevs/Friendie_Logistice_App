import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from '@tanstack/react-query';
import * as service from '../src/features/messages/services/chatService';
import { useMarkConversationRead } from '../src/features/messages/hooks/useMarkConversationRead';
import { useAuthStore } from '../src/store/authStore';
import { useChatDrafts } from '../src/features/messages/store/chatDraftStore';
import { ApiError } from '../src/types/api';
let tree: ReactTestRenderer, client: QueryClient;
const message: service.ChatMessage = {
  id: '10',
  conversationId: '42',
  senderId: 9,
  body: 'Incoming',
  createdAt: null,
};
let items: service.ChatMessage[],
  enabled: boolean,
  visible: string | undefined,
  version: number,
  room: string;
function Probe() {
  useMarkConversationRead(room, enabled, visible, items, version);
  return null;
}
const element = () => (
  <QueryClientProvider client={client}>
    <React.StrictMode>
      <Probe />
    </React.StrictMode>
  </QueryClientProvider>
);
async function settle() {
  await Renderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 20));
  });
}
async function mount() {
  await Renderer.act(async () => {
    tree = Renderer.create(element());
  });
  await settle();
  await settle();
}
async function update() {
  await Renderer.act(async () => {
    tree.update(element());
  });
  await settle();
  await settle();
}
beforeEach(() => {
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'm@example.test' });
  useChatDrafts.getState().draft('8:42', 'Keep my draft');
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  client.setQueryData(['messages.inbox', 8], {
    pages: [{ items: [{ id: 42, unread_count: 5 }] }],
    pageParams: [1],
  });
  client.setQueryData(['profileDashboard', 'user:8', 'summary'], {
    unread_messages: 5,
    listings: { published: 7 },
    reviews_received: 6,
  });
  jest.spyOn(service, 'markConversationRead').mockResolvedValue({
    conversation_id: 42,
    marked_read: 5,
    unread_count: 0,
  });
  items = [message];
  enabled = true;
  visible = '10';
  version = 1;
  room = '42';
});
afterEach(async () => {
  await Renderer.act(async () => tree?.unmount());
  client.clear();
  jest.restoreAllMocks();
});
test('presentation marks once under Strict Mode; invalidates authoritative counters without inventing numbers', async () => {
  await mount();
  await update();
  expect(service.markConversationRead).toHaveBeenCalledTimes(1);
  expect(service.markConversationRead).toHaveBeenCalledWith(
    '42',
    expect.any(AbortSignal),
  );
  expect(client.getQueryState(['messages.inbox', 8])?.isInvalidated).toBe(true);
  expect(
    client.getQueryState(['profileDashboard', 'user:8', 'summary'])
      ?.isInvalidated,
  ).toBe(true);
  expect(
    client.getQueryData(['profileDashboard', 'user:8', 'summary']),
  ).toEqual({
    unread_messages: 5,
    listings: { published: 7 },
    reviews_received: 6,
  });
  expect(useChatDrafts.getState().threads['8:42'].draft).toBe('Keep my draft');
});
test.each([
  'inactive',
  'unpresented',
  'not-latest',
  'already-read',
  'outgoing',
  'empty',
  'guest',
])('%s cannot trigger read', async condition => {
  if (condition === 'inactive') enabled = false;
  if (condition === 'unpresented') visible = undefined;
  if (condition === 'not-latest') visible = '9';
  if (condition === 'already-read') items = [{ ...message, status: 'read' }];
  if (condition === 'outgoing') items = [{ ...message, senderId: 8 }];
  if (condition === 'outgoing' || condition === 'already-read')
    client.setQueryData(['messages.inbox', 8], {
      pages: [{ items: [{ id: 42, unread_count: 0 }] }],
      pageParams: [1],
    });
  if (condition === 'empty') items = [];
  if (condition === 'guest') useAuthStore.getState().clear();
  await mount();
  expect(service.markConversationRead).not.toHaveBeenCalled();
});
test('earlier pages and refocus do not repeat; new unread actual ID permits a future read', async () => {
  await mount();
  items = [{ ...message, id: '2' }, message];
  version++;
  await update();
  enabled = false;
  await update();
  enabled = true;
  await update();
  expect(service.markConversationRead).toHaveBeenCalledTimes(1);
  items = [...items, { ...message, id: '11' }];
  visible = '11';
  version++;
  await update();
  expect(service.markConversationRead).toHaveBeenCalledTimes(2);
});
test('unknown outcome uses safe invalidation, no POST loop, preserves draft', async () => {
  jest
    .mocked(service.markConversationRead)
    .mockRejectedValue(new ApiError('Timeout', 'network'));
  await mount();
  await update();
  expect(service.markConversationRead).toHaveBeenCalledTimes(1);
  expect(client.getQueryState(['messages.inbox', 8])?.isInvalidated).toBe(true);
  expect(useChatDrafts.getState().threads['8:42'].draft).toBe('Keep my draft');
});
test.each(['logout', 'account', 'conversation', 'away'])(
  'late response after %s cannot synchronize stale state',
  async change => {
    let finish!: () => void;
    jest.mocked(service.markConversationRead).mockImplementation(
      () =>
        new Promise(resolve => {
          finish = () =>
            resolve({ conversation_id: 42, marked_read: 1, unread_count: 0 });
        }),
    );
    await mount();
    await Renderer.act(async () => {
      if (change === 'logout') useAuthStore.getState().clear();
      if (change === 'account')
        useAuthStore
          .getState()
          .setUser({ id: 12, name: 'Other', email: 'other@example.test' });
      if (change === 'conversation') {
        room = '43';
        visible = undefined;
      }
      if (change === 'away') enabled = false;
    });
    await update();
    await Renderer.act(async () => finish());
    await settle();
    expect(client.getQueryState(['messages.inbox', 8])?.isInvalidated).toBe(
      false,
    );
  },
);
test('authoritative Inbox unread count permits conversation-level acknowledgement when older unread rows are outside the latest page', async () => {
  items = [{ ...message, senderId: 8 }];
  await mount();
  expect(service.markConversationRead).toHaveBeenCalledTimes(1);
  expect(client.getQueryData(['messages.inbox', 8])).toMatchObject({
    pages: [{ items: [{ unread_count: 5 }] }],
  });
});
test('active authoritative GET replaces unread summary; older pending GET cannot restore stale counts', async () => {
  const key = ['profileDashboard', 'user:8', 'summary'];
  let oldFinish!: (data: { unread_messages: number }) => void;
  let requests = 0;
  const observer = new QueryObserver(client, {
    queryKey: key,
    staleTime: 0,
    queryFn: async () => {
      requests++;
      if (requests === 1)
        return new Promise<{ unread_messages: number }>(resolve => {
          oldFinish = resolve;
        });
      return { unread_messages: 2 };
    },
  });
  const unsubscribe = observer.subscribe(() => {});
  await mount();
  await settle();
  expect(requests).toBe(2);
  expect(client.getQueryData(key)).toEqual({ unread_messages: 2 });
  oldFinish({ unread_messages: 99 });
  await settle();
  expect(client.getQueryData(key)).toEqual({ unread_messages: 2 });
  unsubscribe();
});
test('concurrent consumers share one account/conversation operation', async () => {
  let finish!: () => void;
  jest.mocked(service.markConversationRead).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = () =>
          resolve({ conversation_id: 42, marked_read: 1, unread_count: 0 });
      }),
  );
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <Probe />
        <Probe />
      </QueryClientProvider>,
    );
  });
  await settle();
  expect(service.markConversationRead).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => finish());
  await settle();
  await settle();
  expect(service.markConversationRead).toHaveBeenCalledTimes(1);
});
test('cache subscription preserves active Inbox query function, pages and authoritative refresh', async () => {
  let requests = 0;
  const observer = new QueryObserver(client, {
    queryKey: ['messages.inbox', 8],
    staleTime: Infinity,
    queryFn: async () => {
      requests++;
      return {
        pages: [{ items: [{ id: 42, unread_count: 0 }] }],
        pageParams: [1],
      };
    },
  });
  const unsubscribe = observer.subscribe(() => {});
  await mount();
  await settle();
  expect(requests).toBe(1);
  expect(client.getQueryData(['messages.inbox', 8])).toEqual({
    pages: [{ items: [{ id: 42, unread_count: 0 }] }],
    pageParams: [1],
  });
  expect(service.markConversationRead).toHaveBeenCalledTimes(1);
  unsubscribe();
});
