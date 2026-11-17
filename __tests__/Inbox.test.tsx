import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { ScrollView } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { ConversationsScreen } from '../src/features/messages/screens/MessagesScreens';
import { useInbox } from '../src/features/messages/hooks/useInbox';
import * as service from '../src/features/messages/services/inboxService';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { appConfig } from '../src/constants/appConfig';
import { clearPrivateAccountMemory } from '../src/features/auth/services/sessionLogout';
import { apiClient } from '../src/services/api/apiClient';
import { inboxPageFixture, inboxItemFixture } from '../test/fixtures/inbox';
import { ApiError } from '../src/types/api';
import { useProfileDashboard } from '../src/features/dashboard/hooks/useProfileDashboard';
import { dashboardService } from '../src/features/dashboard/services/dashboardService';
import * as visitors from '../src/features/reviews/services/visitorReviewsService';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
let tree: ReactTestRenderer, client: QueryClient;
const nav = { navigate: jest.fn(), getParent: jest.fn() };
const member = { id: 8, name: 'Member', email: 'member@example.test' };
const previewConfig = appConfig.uiPreviewEnabled;
async function settle() {
  await Renderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 30));
  });
}
async function mount(children?: React.ReactNode) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        {children ?? (
          <ConversationsScreen
            navigation={
              nav as unknown as React.ComponentProps<
                typeof ConversationsScreen
              >['navigation']
            }
            route={{ key: 'inbox', name: 'Conversations' }}
          />
        )}
      </QueryClientProvider>,
    );
  });
  await settle();
}
const text = (value: string) =>
  tree.root.findAll(node => node.props.children === value).length;
async function scroll() {
  await Renderer.act(async () => {
    tree.root.findByType(ScrollView).props.onScroll({
      nativeEvent: {
        layoutMeasurement: { height: 500 },
        contentOffset: { y: 800 },
        contentSize: { height: 1000 },
      },
    });
  });
  await settle();
}
beforeEach(() => {
  useAuthStore.getState().setUser(member);
  useDevelopmentStore.setState({ previewActive: false });
  jest.spyOn(service, 'getInboxPage').mockResolvedValue(inboxPageFixture());
  jest.spyOn(Toast, 'show').mockImplementation(() => {});
  nav.navigate.mockClear();
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
  });
  client?.clear();
  appConfig.uiPreviewEnabled = previewConfig;
  jest.restoreAllMocks();
});
test('real cards display backend participant/preview/unread and keep the room ID route', async () => {
  const get = jest.spyOn(apiClient, 'get'),
    post = jest.spyOn(apiClient, 'post');
  await mount();
  expect(text('Other customer (2 unread)')).toBeGreaterThan(0);
  expect(text(inboxItemFixture.last_message)).toBeGreaterThan(0);
  const button = tree.root.findAll(
    node =>
      node.props.accessibilityLabel ===
        'Open chat with Other customer, 2 unread messages' &&
      typeof node.props.onPress === 'function',
  )[0];
  await Renderer.act(async () => {
    button.props.onPress();
  });
  expect(nav.navigate).toHaveBeenCalledWith('Chat', { conversationId: '71' });
  expect(service.getInboxPage).toHaveBeenCalledTimes(1);
  expect(get).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
  expect(Toast.show).not.toHaveBeenCalled();
});
test('loading then empty inbox uses truthful existing components', async () => {
  let finish!: (value: ReturnType<typeof inboxPageFixture>) => void;
  jest.mocked(service.getInboxPage).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await mount();
  expect(text('Loading conversations...')).toBeGreaterThan(0);
  await Renderer.act(async () => {
    finish({
      items: [],
      pagination: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
    });
  });
  await settle();
  expect(text('No conversations yet.')).toBeGreaterThan(0);
});
test('missing nullable identity and preview use truthful fallbacks', async () => {
  jest.mocked(service.getInboxPage).mockResolvedValue({
    ...inboxPageFixture(),
    items: [
      {
        ...inboxItemFixture,
        other_participant: { id: 9, display_name: null },
        last_message: null,
        last_message_at: null,
        unread_count: 0,
      },
    ],
  });
  await mount();
  expect(text('Name unavailable')).toBeGreaterThan(0);
  expect(text('No message preview available.')).toBeGreaterThan(0);
});
test('scroll pagination deduplicates overlapping IDs and stops at the final page', async () => {
  jest.mocked(service.getInboxPage).mockImplementation(async page => ({
    items:
      page === 1
        ? [inboxItemFixture]
        : [inboxItemFixture, { ...inboxItemFixture, id: 72 }],
    pagination: {
      current_page: page ?? 1,
      per_page: 20,
      total: 21,
      last_page: 2,
    },
  }));
  await mount();
  await scroll();
  expect(service.getInboxPage).toHaveBeenLastCalledWith(2, expect.any(Object));
  expect(
    client.getQueryData<{ pages: unknown[] }>(['messages.inbox', 8])?.pages,
  ).toHaveLength(2);
  expect(
    tree.root.findAll(
      node =>
        node.props.accessibilityRole === 'button' &&
        node.props.accessibilityLabel?.startsWith('Open chat') &&
        typeof node.type === 'string',
    ),
  ).toHaveLength(2);
  await scroll();
  expect(service.getInboxPage).toHaveBeenCalledTimes(2);
});
test('explicit retry failures use one Toast and rapid taps share one request', async () => {
  jest
    .mocked(service.getInboxPage)
    .mockRejectedValue(new ApiError('offline', 'network'));
  await mount();
  expect(Toast.show).not.toHaveBeenCalled();
  const retry = tree.root.findAll(node => node.props.title === 'Try again')[0];
  await Renderer.act(async () => {
    retry.props.onPress();
    retry.props.onPress();
  });
  await settle();
  expect(service.getInboxPage).toHaveBeenCalledTimes(2);
  expect(Toast.show).toHaveBeenCalledTimes(1);
});
test('pagination error preserves cards and explicit retry retries the failed page', async () => {
  let fail = true;
  jest.mocked(service.getInboxPage).mockImplementation(async page => {
    if (page === 2 && fail) throw new ApiError('offline', 'network');
    return {
      ...inboxPageFixture(page),
      pagination: {
        current_page: page ?? 1,
        per_page: 20,
        total: 21,
        last_page: 2,
      },
    };
  });
  await mount();
  await scroll();
  expect(text('Other customer (2 unread)')).toBeGreaterThan(0);
  const count = jest.mocked(service.getInboxPage).mock.calls.length;
  await scroll();
  expect(service.getInboxPage).toHaveBeenCalledTimes(count);
  fail = false;
  await Renderer.act(async () => {
    tree.root
      .findAll(node => node.props.title === 'Try again')[0]
      .props.onPress();
  });
  await settle();
  expect(service.getInboxPage).toHaveBeenLastCalledWith(2, expect.any(Object));
});
test('guest/demo do not fetch private conversations and demo cards remain local', async () => {
  useAuthStore.getState().clear();
  await mount();
  expect(service.getInboxPage).not.toHaveBeenCalled();
  appConfig.uiPreviewEnabled = true;
  await Renderer.act(async () => {
    useDevelopmentStore.setState({ previewActive: true });
  });
  expect(text('UI preview - demo conversations')).toBeGreaterThan(0);
  expect(service.getInboxPage).not.toHaveBeenCalled();
});
test('account replacement and logout cannot show the old inbox; existing cleanup clears cache', async () => {
  await mount();
  jest
    .mocked(service.getInboxPage)
    .mockResolvedValue({ ...inboxPageFixture(), items: [] });
  await Renderer.act(async () => {
    useAuthStore.getState().setUser({ ...member, id: 10 });
  });
  await settle();
  expect(text('Other customer (2 unread)')).toBe(0);
  await Renderer.act(async () => {
    useAuthStore.getState().clear();
    clearPrivateAccountMemory(client);
  });
  expect(text('Other customer (2 unread)')).toBe(0);
  expect(client.getQueryData(['messages.inbox', 8])).toBeUndefined();
});
test('refresh refetches without duplicate flight or changing the Dashboard summary', async () => {
  let inbox!: ReturnType<typeof useInbox>;
  function Harness() {
    inbox = useInbox();
    return null;
  }
  await mount(<Harness />);
  const summary = { unread_messages: 99 };
  client.setQueryDefaults(['profileDashboard'], { gcTime: Infinity });
  client.setQueryData(['profileDashboard', 'user:8', 'summary'], summary);
  await Renderer.act(async () => {
    await Promise.all([inbox.refresh(), inbox.refresh()]);
  });
  expect(service.getInboxPage).toHaveBeenCalledTimes(2);
  expect(
    client.getQueryData(['profileDashboard', 'user:8', 'summary']),
  ).toEqual(summary);
});

test('inbox reads and refresh do not refetch the mounted Dashboard or replace authoritative unread count', async () => {
  const summary = jest.spyOn(dashboardService, 'summary').mockResolvedValue({
    listings: { total: 12, published: 4, pending: 5, expired: 3 },
    unread_messages: 99,
    reviews_received: 2,
  });
  jest.spyOn(visitors, 'getReceivedVisitorReviews').mockResolvedValue({
    items: [],
    nextPage: null,
    pagination: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
  });
  let inbox!: ReturnType<typeof useInbox>,
    dashboard!: ReturnType<typeof useProfileDashboard>;
  function Probe() {
    inbox = useInbox();
    dashboard = useProfileDashboard();
    return null;
  }
  await mount(<Probe />);
  expect(dashboard.messages.data).toBe(99);
  await Renderer.act(async () => {
    await inbox.refresh();
  });
  await settle();
  expect(dashboard.messages.data).toBe(99);
  expect(summary).toHaveBeenCalledTimes(1);
});
