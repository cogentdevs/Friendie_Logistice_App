import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { AppState, TextInput, FlatList } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import * as contactService from '../src/features/deals/dealContactService';
import { chatAuthorizationFixture } from '../test/fixtures/dealContact';
import { ChatScreen } from '../src/features/messages/screens/ChatScreen';
import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { useChatDrafts } from '../src/features/messages/store/chatDraftStore';
import { useChat } from '../src/features/messages/hooks/useChat';
import { useProfileDashboard } from '../src/features/dashboard/hooks/useProfileDashboard';
import { dashboardService } from '../src/features/dashboard/services/dashboardService';
import * as visitors from '../src/features/reviews/services/visitorReviewsService';
import { clearPrivateAccountMemory } from '../src/features/auth/services/sessionLogout';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
jest.mock('@react-navigation/elements', () => ({
  ...jest.requireActual('@react-navigation/elements'),
  useHeaderHeight: () => 56,
}));
const metadata = {
  deal_id: 9,
  id: 42,
  listing: { id: 501, title: 'Parcel' },
  other_participant: { id: 9, display_name: 'Real participant' },
  created_at: null,
};
const item = {
  id: 10,
  conversation_id: 42,
  sender: { id: 8, display_name: 'Self' },
  message: 'Outgoing actual',
  created_at: '2026-11-17 10:00:00',
  message_on: null,
  is_read: false,
};
let tree: ReactTestRenderer, client: QueryClient;
const adapter = apiClient.defaults.adapter;
const nav = {
  setOptions: jest.fn(),
  getState: () => ({ index: 1 }),
  goBack: jest.fn(),
  replace: jest.fn(),
};
let empty: boolean, fail: boolean, requests: string[];
async function settle() {
  await Renderer.act(async () => {
    await new Promise<void>(done => setTimeout(done, 30));
  });
}
function Screen({ id = '42' }: { id?: string }) {
  return (
    <ChatScreen
      navigation={
        nav as unknown as React.ComponentProps<typeof ChatScreen>['navigation']
      }
      route={{ key: 'chat', name: 'Chat', params: { conversationId: id } }}
    />
  );
}
async function mount(node?: React.ReactNode) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        {node ?? <Screen />}
      </QueryClientProvider>,
    );
  });
  await settle();
  await settle();
}
beforeEach(() => {
  jest.spyOn(contactService, 'readDealContact').mockImplementation(async () => {
    return chatAuthorizationFixture(metadata.listing.id);
  });
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
  });
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Self', email: 'self@example.test' });
  useDevelopmentStore.setState({ previewActive: false });
  useChatDrafts.getState().clear();
  jest
    .spyOn(secureStorage, 'getToken')
    .mockResolvedValue('chat-screen-test-token');
  jest.spyOn(Toast, 'show').mockImplementation(() => {});
  nav.setOptions.mockClear();
  nav.goBack.mockClear();
  empty = false;
  fail = false;
  requests = [];
  apiClient.defaults.adapter = async config => {
    requests.push(config.url!);
    expect(config.method).toBe('get');
    expect(config.headers.Authorization).toBe('Bearer chat-screen-test-token');
    if (fail) throw new axios.AxiosError('Offline', 'ERR_NETWORK', config);
    const isHistory = config.url!.endsWith('/messages');
    return {
      status: 200,
      statusText: '',
      config,
      headers: {},
      data: {
        success: true,
        message: 'OK',
        data: isHistory
          ? {
              items: empty
                ? []
                : [
                    {
                      ...item,
                      id: 9,
                      sender: { id: 9, display_name: 'Real participant' },
                      message: 'Incoming actual',
                      created_at: null,
                    },
                    item,
                  ],
              pagination: {
                current_page: 1,
                per_page: 20,
                total: empty ? 0 : 2,
                last_page: 1,
              },
            }
          : metadata,
      },
    };
  };
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
  });
  client?.clear();
  apiClient.defaults.adapter = adapter;
  jest.restoreAllMocks();
});
test('real list presentation, rather than inbox/loading, triggers exactly one bodyless read POST', async () => {
  const original = apiClient.defaults.adapter as import('axios').AxiosAdapter;
  let reads = 0;
  apiClient.defaults.adapter = async config => {
    if (config.url?.endsWith('/read')) {
      reads++;
      expect(config.method).toBe('post');
      expect(config.data).toBeUndefined();
      expect(config.params).toBeUndefined();
      return {
        status: 200,
        statusText: '',
        config,
        headers: {},
        data: {
          success: true,
          message: 'OK',
          data: { conversation_id: 42, marked_read: 1, unread_count: 0 },
        },
      };
    }
    return original(config);
  };
  await mount();
  expect(reads).toBe(0);
  const list = tree.root.findByType(FlatList);
  const row = list.props.data[0];
  await Renderer.act(async () =>
    list.props.onViewableItemsChanged({
      viewableItems: [{ item: row, isViewable: true }],
    }),
  );
  await settle();
  await settle();
  expect(reads).toBe(1);
  await Renderer.act(async () =>
    list.props.onViewableItemsChanged({
      viewableItems: [{ item: row, isViewable: true }],
    }),
  );
  await settle();
  expect(reads).toBe(1);
});
test('actual API history uses correct bubbles, sender alignment, missing-time fallback and eligible composer', async () => {
  const post = jest.spyOn(apiClient, 'post');
  await mount();
  expect(requests).toEqual([
    '/customer/conversations/42',
    '/customer/conversations/42/messages',
  ]);
  const bubbles = tree.root.findAll(
    node => node.props.message && typeof node.props.outgoing === 'boolean',
  );
  expect(
    bubbles.map(node => [node.props.message.id, node.props.outgoing]),
  ).toEqual([
    ['10', true],
    ['9', false],
  ]);
  expect(
    tree.root.findAll(node => node.props.children === 'Time unavailable')
      .length,
  ).toBeGreaterThan(0);
  expect(
    tree.root
      .findByType(FlatList)
      .props.data.map((row: { message: { id: string } }) => row.message.id),
  ).toEqual(['10', '9']);
  await Renderer.act(async () => {
    tree.root.findByType(TextInput).props.onChangeText('Do not send');
  });
  const send = tree.root.findAll(
    node =>
      node.props.accessibilityLabel === 'Send message' &&
      typeof node.props.onPress === 'function',
  )[0];
  expect(send.props.disabled).toBe(false);
  expect(post).not.toHaveBeenCalled();
  expect(useChatDrafts.getState().threads['8:42'].outbox).toEqual([]);
  expect(Toast.show).not.toHaveBeenCalled();
  const header = nav.setOptions.mock.calls.at(-1)![0];
  await Renderer.act(async () => {
    header.headerLeft().props.onPress();
  });
  expect(nav.goBack).toHaveBeenCalledTimes(1);
});
test('empty history is truthful and preserves composer', async () => {
  empty = true;
  await mount();
  expect(
    tree.root.findAll(node => node.props.children === 'No messages yet.')
      .length,
  ).toBeGreaterThan(0);
  expect(tree.root.findByType(TextInput)).toBeDefined();
});

test('legacy participant history remains visible with a disabled composer and no contact fetch', async () => {
  const reads = apiClient.defaults.adapter as import('axios').AxiosAdapter;
  apiClient.defaults.adapter = async config => {
    const result = await reads(config);
    return config.url === '/customer/conversations/42'
      ? {
          ...result,
          data: { ...result.data, data: { ...metadata, deal_id: null } },
        }
      : result;
  };
  await mount();
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(2);
  expect(
    tree.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Send message' &&
        typeof node.props.onPress === 'function',
    )[0].props.disabled,
  ).toBe(true);
  expect(contactService.readDealContact).not.toHaveBeenCalled();
});
test('existing Send button uses POST and shows only the acknowledged server message', async () => {
  await mount();
  let acknowledge!: () => void;
  let posts = 0;
  const reads = apiClient.defaults.adapter as import('axios').AxiosAdapter;
  apiClient.defaults.adapter = async config => {
    if (config.method === 'get') return reads(config);
    expect(config.method).toBe('post');
    expect(config.url).toBe('/customer/conversations/42/messages');
    expect(JSON.parse(config.data)).toEqual({ message: 'New actual message' });
    posts++;
    await new Promise<void>(resolve => {
      acknowledge = resolve;
    });
    return {
      status: 201,
      statusText: '',
      config,
      headers: {},
      data: {
        success: true,
        message: 'Message sent successfully.',
        data: { ...item, id: 11, message: 'New actual message' },
      },
    };
  };
  await Renderer.act(async () => {
    tree.root.findByType(TextInput).props.onChangeText('New actual message');
  });
  await Renderer.act(async () => {
    const button = tree.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Send message' &&
        typeof node.props.onPress === 'function',
    )[0];
    button.props.onPress();
    button.props.onPress();
  });
  expect(posts).toBe(1);
  expect(tree.root.findByType(TextInput).props.value).toBe(
    'New actual message',
  );
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(2);
  await Renderer.act(async () => {
    acknowledge();
  });
  await settle();
  await settle();
  expect(tree.root.findByType(TextInput).props.value).toBe('');
  expect(
    tree.root
      .findByType(FlatList)
      .props.data.map((row: { message: { id: string } }) => row.message.id),
  ).toEqual(['11', '10', '9']);
});
test('existing loader remains while metadata is pending', async () => {
  let finish!: (value: unknown) => void;
  jest.spyOn(apiClient, 'get').mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await mount();
  expect(
    tree.root.findAll(
      node => node.props.accessibilityLabel === 'Loading messages',
    ).length,
  ).toBeGreaterThan(0);
  await Renderer.act(async () => {
    finish({
      status: 200,
      data: { success: true, message: 'OK', data: metadata },
    });
  });
  await settle();
  await settle();
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(2);
});
test('existing earlier-history pagination loads preceding page once and keeps backend ID order', async () => {
  const pages: number[] = [];
  apiClient.defaults.adapter = async config => {
    if (!config.url!.endsWith('/messages'))
      return {
        status: 200,
        statusText: '',
        config,
        headers: {},
        data: { success: true, message: 'OK', data: metadata },
      };
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
        data: {
          items: [{ ...item, id: number === 2 ? 21 : 10 }],
          pagination: {
            current_page: number,
            per_page: 20,
            total: 21,
            last_page: 2,
          },
        },
      },
    };
  };
  await mount();
  expect(pages).toEqual([1, 2]);
  await Renderer.act(async () => {
    const list = tree.root.findByType(FlatList);
    list.props.onEndReached();
    list.props.onEndReached();
  });
  await settle();
  expect(pages).toEqual([1, 2, 1]);
  expect(
    tree.root
      .findByType(FlatList)
      .props.data.map((row: { message: { id: string } }) => row.message.id),
  ).toEqual(['21', '10']);
});
test('switching conversation ignores old room response and never shows another room message', async () => {
  let finish!: (value: unknown) => void;
  jest.spyOn(apiClient, 'get').mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await mount();
  apiClient.defaults.adapter = async config => ({
    status: 200,
    statusText: '',
    config,
    headers: {},
    data: {
      success: true,
      message: 'OK',
      data: config.url!.endsWith('/messages')
        ? {
            items: [],
            pagination: {
              current_page: 1,
              per_page: 20,
              total: 0,
              last_page: 1,
            },
          }
        : { ...metadata, id: 43 },
    },
  });
  await Renderer.act(async () => {
    tree.update(
      <QueryClientProvider client={client}>
        <Screen id="43" />
      </QueryClientProvider>,
    );
  });
  await Renderer.act(async () => {
    finish({
      status: 200,
      data: { success: true, message: 'OK', data: metadata },
    });
  });
  await settle();
  await settle();
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(0);
  expect(client.getQueryData(['chat.history.read', 8, '42'])).toBeUndefined();
});
test('logout clears history cache and a guest cannot fetch private chat', async () => {
  await mount();
  expect(client.getQueryData(['chat.history.read', 8, '42'])).toBeDefined();
  const before = requests.length;
  await Renderer.act(async () => {
    useAuthStore.getState().clear();
    clearPrivateAccountMemory(client);
  });
  await settle();
  expect(client.getQueryData(['chat.history.read', 8, '42'])).toBeUndefined();
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(0);
  expect(requests).toHaveLength(before);
});
test('failed initial load is inline; explicit retry failures produce one Toast', async () => {
  fail = true;
  await mount();
  expect(Toast.show).not.toHaveBeenCalled();
  const retry = tree.root.findAll(
    node => node.props.title === 'Retry conversation',
  )[0];
  await Renderer.act(async () => {
    retry.props.onPress();
    retry.props.onPress();
  });
  await settle();
  expect(Toast.show).toHaveBeenCalledTimes(1);
  fail = false;
  await Renderer.act(async () => {
    tree.root
      .findAll(node => node.props.title === 'Retry conversation')[0]
      .props.onPress();
  });
  await settle();
  await settle();
  expect(
    tree.root.findAll(
      node => node.props.message && typeof node.props.outgoing === 'boolean',
    ),
  ).toHaveLength(2);
});
test('read keys do not invalidate Inbox or the mounted Dashboard unread summary', async () => {
  const summary = jest.spyOn(dashboardService, 'summary').mockResolvedValue({
    listings: { total: 1, published: 1, pending: 0, expired: 0 },
    unread_messages: 99,
    reviews_received: 0,
  });
  jest.spyOn(visitors, 'getReceivedVisitorReviews').mockResolvedValue({
    items: [],
    nextPage: null,
    pagination: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
  });
  let chat!: ReturnType<typeof useChat>,
    dashboard!: ReturnType<typeof useProfileDashboard>;
  function Harness() {
    chat = useChat('42');
    dashboard = useProfileDashboard();
    return null;
  }
  await mount(<Harness />);
  client.setQueryDefaults(['messages.inbox'], { gcTime: Infinity });
  client.setQueryData(['messages.inbox', 8], { unchanged: true });
  await Renderer.act(async () => {
    await chat.refresh();
  });
  await settle();
  expect(dashboard.messages.data).toBe(99);
  expect(summary).toHaveBeenCalledTimes(1);
  expect(client.getQueryData(['messages.inbox', 8])).toEqual({
    unchanged: true,
  });
});
