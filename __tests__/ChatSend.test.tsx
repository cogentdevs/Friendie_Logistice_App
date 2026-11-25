import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import * as service from '../src/features/messages/services/chatService';
import { useChat } from '../src/features/messages/hooks/useChat';
import { useChatDrafts } from '../src/features/messages/store/chatDraftStore';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { clearPrivateAccountMemory } from '../src/features/auth/services/sessionLogout';
import { ApiError } from '../src/types/api';
import { useProfileDashboard } from '../src/features/dashboard/hooks/useProfileDashboard';
import { dashboardService } from '../src/features/dashboard/services/dashboardService';
import * as visitors from '../src/features/reviews/services/visitorReviewsService';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
let chat!: ReturnType<typeof useChat>,
  tree: ReactTestRenderer,
  client: QueryClient;
const member = { id: 8, name: 'Member', email: 'm@example.test' };
const confirmed: service.ChatMessage = {
  id: '99',
  conversationId: '42',
  senderId: 8,
  body: 'Hello',
  createdAt: '2026-11-17T10:00:00.000Z',
};
function Probe({ id = '42' }: { id?: string }) {
  chat = useChat(id);
  return null;
}
async function settle() {
  await Renderer.act(async () => {
    await new Promise<void>(done => setTimeout(done, 30));
  });
}
async function mount(children?: React.ReactNode) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        {children ?? <Probe />}
      </QueryClientProvider>,
    );
  });
  await settle();
  await settle();
}
async function draft(text = 'Hello') {
  await Renderer.act(async () => {
    chat.setDraft(text);
  });
}
beforeEach(() => {
  useAuthStore.getState().setUser(member);
  useDevelopmentStore.setState({ previewActive: false });
  useChatDrafts.getState().clear();
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
  });
  jest.spyOn(Toast, 'show').mockImplementation(() => {});
  jest.spyOn(service, 'getConversation').mockResolvedValue({
    id: '42',
    canSend: true,
    dealId: 9,
    writeUntil: Date.now() + 60000,
    participant: { id: 9, name: 'Other' },
  });
  jest
    .spyOn(service, 'getMessages')
    .mockResolvedValue({ data: [], nextCursor: null });
  jest.spyOn(service, 'sendMessage').mockResolvedValue(confirmed);
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
  });
  client?.clear();
  jest.restoreAllMocks();
});
test('double tap sends once; no optimistic real bubble or draft clearing before acknowledgement', async () => {
  let finish!: (value: service.ChatMessage) => void;
  jest.mocked(service.sendMessage).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await mount();
  await draft();
  let pending!: Promise<void>;
  await Renderer.act(async () => {
    pending = chat.send();
    chat.send();
  });
  expect(service.sendMessage).toHaveBeenCalledTimes(1);
  expect(chat.thread.draft).toBe('Hello');
  expect(chat.thread.outbox).toEqual([]);
  expect(chat.server).toEqual([]);
  expect(chat.sending).toBe(true);
  await Renderer.act(async () => {
    finish(confirmed);
    await pending;
  });
  await settle();
  expect(chat.thread.draft).toBe('');
  expect(chat.server).toEqual([confirmed]);
  expect(chat.sending).toBe(false);
  jest
    .mocked(service.getMessages)
    .mockResolvedValue({ data: [confirmed], nextCursor: null });
  await Renderer.act(async () => {
    await chat.refresh();
  });
  await settle();
  expect(chat.server.map(item => item.id)).toEqual(['99']);
  expect(Toast.show).not.toHaveBeenCalled();
});
test('edits made during a send are retained after success', async () => {
  let finish!: (value: service.ChatMessage) => void;
  jest.mocked(service.sendMessage).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await mount();
  await draft();
  let pending!: Promise<void>;
  await Renderer.act(async () => {
    pending = chat.send();
  });
  await draft('Next message');
  await Renderer.act(async () => {
    finish(confirmed);
    await pending;
  });
  await settle();
  expect(chat.thread.draft).toBe('Next message');
  expect(chat.server).toEqual([confirmed]);
});
test.each([400, 403, 404, 422, 429])(
  'definitive HTTP %s preserves draft, creates no sent bubble, allows manual correction',
  async status => {
    jest.mocked(service.sendMessage).mockRejectedValue(
      new ApiError('Rejected', 'validation', status, {
        message: ['Message validation failed.'],
      }),
    );
    await mount();
    await draft();
    await Renderer.act(async () => {
      await chat.send();
    });
    await settle();
    expect(chat.thread.draft).toBe('Hello');
    expect(chat.server).toEqual([]);
    expect(chat.thread.outbox).toEqual([]);
    expect(useChatDrafts.getState().threads['8:42'].uncertain).toBeUndefined();
    expect(Toast.show).toHaveBeenCalledTimes(1);
  },
);
test.each(['network', 'server', 'unknown'] as const)(
  'ambiguous %s outcome preserves draft and blocks even stale callback retries',
  async kind => {
    jest
      .mocked(service.sendMessage)
      .mockRejectedValue(
        new ApiError('Failure', kind, kind === 'server' ? 500 : undefined),
      );
    await mount();
    await draft();
    const originalSend = chat.send;
    await Renderer.act(async () => {
      await originalSend();
    });
    await settle();
    await Renderer.act(async () => {
      await originalSend();
      await chat.send();
    });
    expect(service.sendMessage).toHaveBeenCalledTimes(1);
    expect(chat.thread.draft).toBe('Hello');
    expect(chat.server).toEqual([]);
    expect(chat.canSend).toBe(false);
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'warning',
        text1: 'Delivery not confirmed',
      }),
    );
  },
);
test('uncertain delivery is reconciled only by later authoritative history, without resending', async () => {
  jest
    .mocked(service.sendMessage)
    .mockRejectedValue(new ApiError('Timeout', 'network'));
  await mount();
  await draft();
  jest
    .mocked(service.getMessages)
    .mockResolvedValue({ data: [confirmed], nextCursor: null });
  await Renderer.act(async () => {
    await chat.send();
  });
  await settle();
  await settle();
  expect(service.sendMessage).toHaveBeenCalledTimes(1);
  expect(chat.server).toEqual([confirmed]);
  expect(chat.thread.draft).toBe('');
});
test.each(['logout', 'switch', 'unmount'])(
  'late send after %s does not insert or clear another session draft',
  async change => {
    let finish!: (value: service.ChatMessage) => void;
    jest.mocked(service.sendMessage).mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    await mount();
    await draft();
    let pending!: Promise<void>;
    await Renderer.act(async () => {
      pending = chat.send();
    });
    await Renderer.act(async () => {
      if (change === 'logout') {
        useAuthStore.getState().clear();
        clearPrivateAccountMemory(client);
      }
      if (change === 'switch')
        useAuthStore.getState().setUser({ ...member, id: 10 });
      if (change === 'unmount') tree.unmount();
    });
    await Renderer.act(async () => {
      finish(confirmed);
      await pending;
    });
    await settle();
    const cache = client.getQueryData<{
      pages: { data: service.ChatMessage[] }[];
    }>(['chat.history.read', 8, '42']);
    expect(cache?.pages.flatMap(page => page.data) ?? []).not.toContainEqual(
      confirmed,
    );
    expect(Toast.show).not.toHaveBeenCalled();
  },
);
test('invalid input validates without posting or adding a fake bubble', async () => {
  await mount();
  await draft('   ');
  await Renderer.act(async () => {
    await chat.send();
  });
  expect(service.sendMessage).not.toHaveBeenCalled();
  expect(chat.thread.draft).toBe('   ');
  expect(chat.server).toEqual([]);
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'warning' }),
  );
});
test('malformed Laravel field errors use safe text without crashing or clearing the draft', async () => {
  jest
    .mocked(service.sendMessage)
    .mockRejectedValue(
      new ApiError('Failure', 'validation', 422, {
        message: [{ unsafe: true }] as unknown as string[],
      }),
    );
  await mount();
  await draft();
  await Renderer.act(async () => {
    await chat.send();
  });
  await settle();
  expect(chat.thread.draft).toBe('Hello');
  expect(chat.server).toEqual([]);
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ text2: 'Check your message and try again.' }),
  );
});
test('conversation switch cannot insert a late acknowledged message into either room', async () => {
  let finish!: (value: service.ChatMessage) => void;
  jest.mocked(service.sendMessage).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await mount();
  await draft();
  let pending!: Promise<void>;
  await Renderer.act(async () => {
    pending = chat.send();
  });
  jest.mocked(service.getConversation).mockResolvedValue({
    id: '43',
    canSend: true,
    dealId: 10,
    writeUntil: Date.now() + 60000,
    participant: { id: 9, name: 'Other' },
  });
  await Renderer.act(async () => {
    tree.update(
      <QueryClientProvider client={client}>
        <Probe id="43" />
      </QueryClientProvider>,
    );
  });
  await settle();
  await Renderer.act(async () => {
    finish(confirmed);
    await pending;
  });
  await settle();
  expect(chat.server).toEqual([]);
  expect(chat.sending).toBe(false);
  const cache = client.getQueryData<{
    pages: { data: service.ChatMessage[] }[];
  }>(['chat.history.read', 8, '42']);
  expect(cache?.pages.flatMap(page => page.data) ?? []).not.toContainEqual(
    confirmed,
  );
});
test('confirmed send preserves pagination and marks Inbox stale without changing its unread values', async () => {
  await mount();
  await draft();
  client.setQueryDefaults(['messages.inbox'], { gcTime: Infinity });
  const inbox = { unread_count: 7 };
  client.setQueryData(['messages.inbox', 8], inbox);
  await Renderer.act(async () => {
    await chat.send();
  });
  await settle();
  expect(client.getQueryData(['messages.inbox', 8])).toEqual(inbox);
  expect(client.getQueryState(['messages.inbox', 8])?.isInvalidated).toBe(true);
  expect(
    client.getQueryData<{ pageParams: unknown[] }>([
      'chat.history.read',
      8,
      '42',
    ])?.pageParams,
  ).toEqual([null]);
});
test('confirmed message preserves loaded older pages and their page parameters', async () => {
  await mount();
  await Renderer.act(async () => {
    client.setQueryData(['chat.history.read', 8, '42'], {
      pages: [
        {
          data: [{ ...confirmed, id: '10', body: 'Earlier' }],
          nextCursor: '1',
        },
        { data: [{ ...confirmed, id: '5', body: 'Oldest' }], nextCursor: null },
      ],
      pageParams: [null, '1'],
    });
  });
  await draft();
  await Renderer.act(async () => {
    await chat.send();
  });
  await settle();
  expect(chat.server.map(message => message.id)).toEqual(['5', '10', '99']);
  expect(
    client.getQueryData<{ pageParams: unknown[] }>([
      'chat.history.read',
      8,
      '42',
    ])?.pageParams,
  ).toEqual([null, '1']);
});
test('successful Send neither changes nor refetches the mounted Dashboard unread counter', async () => {
  const summary = jest.spyOn(dashboardService, 'summary').mockResolvedValue({
    listings: { total: 1, published: 1, pending: 0, expired: 0 },
    unread_messages: 77,
    reviews_received: 0,
  });
  jest.spyOn(visitors, 'getReceivedVisitorReviews').mockResolvedValue({
    items: [],
    nextPage: null,
    pagination: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
  });
  let dashboard!: ReturnType<typeof useProfileDashboard>;
  function Combined() {
    chat = useChat('42');
    dashboard = useProfileDashboard();
    return null;
  }
  await mount(<Combined />);
  await draft();
  await Renderer.act(async () => {
    await chat.send();
  });
  await settle();
  expect(dashboard.messages.data).toBe(77);
  expect(summary).toHaveBeenCalledTimes(1);
});
