import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { ChatScreen } from '../src/features/messages/screens/ChatScreen';
import { useChat } from '../src/features/messages/hooks/useChat';
import { navigationRef } from '../src/navigation/navigationRef';
import { ApiError } from '../src/types/api';
jest.mock('../src/features/messages/hooks/useChat', () => ({
  useChat: jest.fn(),
}));
jest.mock('@react-navigation/elements', () => ({
  ...jest.requireActual('@react-navigation/elements'),
  useHeaderHeight: () => 56,
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
let tree: ReactTestRenderer;
const nav = {
  setOptions: jest.fn(),
  getState: () => ({ index: 0 }),
  replace: jest.fn(),
  goBack: jest.fn(),
};
let state: any;
async function mount() {
  await Renderer.act(async () => {
    tree = Renderer.create(
      <ChatScreen
        route={{
          key: 'chat',
          name: 'Chat',
          params: {
            conversationId: 'real-42',
            returnTo: { stack: 'ListingsStack', listingId: '12' },
          },
        }}
        navigation={
          nav as unknown as React.ComponentProps<
            typeof ChatScreen
          >['navigation']
        }
      />,
    );
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  state = {
    owner: 8,
    thread: { draft: 'Hello', outbox: [] },
    server: [
      {
        id: 'm1',
        senderId: 9,
        conversationId: 'real-42',
        body: 'Incoming',
        createdAt: '2026-11-05T09:00:00Z',
      },
      {
        id: 'm2',
        senderId: 8,
        conversationId: 'real-42',
        body: 'Outgoing',
        createdAt: '2026-11-05T10:00:00Z',
        status: 'sent',
      },
    ],
    conversation: {
      isSuccess: true,
      isPending: false,
      isError: false,
      data: {
        id: 'real-42',
        canSend: true,
        participant: { id: 9, name: 'Traveller', deleted: false },
      },
    },
    messages: {
      isSuccess: true,
      isPending: false,
      isError: false,
      hasNextPage: false,
    },
    canSend: true,
    error: '',
    send: jest.fn().mockResolvedValue(undefined),
    retry: jest.fn().mockResolvedValue(undefined),
    setDraft: jest.fn(),
    refresh: jest.fn(),
  };
  (useChat as jest.Mock).mockImplementation(() => state);
});
afterEach(async () => {
  await Renderer.act(async () => tree?.unmount());
  jest.restoreAllMocks();
});
test('bubbles preserve real statuses and composer uses lifecycle callbacks without fake presence', async () => {
  await mount();
  expect(useChat).toHaveBeenCalledWith('real-42');
  const bubbles = tree.root.findAll(
    node =>
      node.props.message &&
      typeof node.props.outgoing === 'boolean' &&
      node.props.retry,
  );
  expect(bubbles).toHaveLength(2);
  expect(
    bubbles.find(node => node.props.message.body === 'Incoming')!.props
      .outgoing,
  ).toBe(false);
  expect(
    tree.root.findAll(node => node.props.accessibilityLabel === 'delivered'),
  ).toHaveLength(0);
  const input = tree.root.findByType(TextInput);
  await Renderer.act(async () => {
    input.props.onChangeText('Draft');
  });
  expect(state.setDraft).toHaveBeenCalledWith('Draft');
  const send = tree.root.findAll(
    node =>
      node.props.accessibilityLabel === 'Send message' &&
      typeof node.props.onPress === 'function',
  )[0];
  await Renderer.act(async () => send.props.onPress());
  expect(state.send).toHaveBeenCalledTimes(1);
  expect(
    tree.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Attachments unavailable' &&
        node.props.disabled === true,
    ).length,
  ).toBeGreaterThan(0);
  const header = nav.setOptions.mock.calls.at(-1)![0].headerTitle();
  let headerTree!: ReactTestRenderer;
  await Renderer.act(async () => {
    headerTree = Renderer.create(header);
  });
  expect(
    headerTree.root.findAll(node => node.props.children === 'Online'),
  ).toHaveLength(0);
  await Renderer.act(async () => headerTree.unmount());
});
test('header Back restores the originating listing flow', async () => {
  jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
  const navigate = jest
    .spyOn(navigationRef, 'navigate')
    .mockImplementation(() => {});
  await mount();
  await Renderer.act(async () =>
    nav.setOptions.mock.calls.at(-1)![0].headerLeft().props.onPress(),
  );
  expect(nav.replace).toHaveBeenCalledWith('Conversations');
  expect(navigate).toHaveBeenCalledWith('AppDrawer', {
    screen: 'MainTabs',
    params: {
      screen: 'ListingsStack',
      params: { screen: 'ListingDetails', params: { listingId: '12' } },
    },
  });
});
test('unauthorized conversation hides content and disables sending', async () => {
  state.canSend = false;
  state.conversation = {
    isError: true,
    isPending: false,
    error: new ApiError('Forbidden', 'forbidden', 403),
  };
  await mount();
  expect(
    tree.root.findAll(node => node.props.children === 'Incoming'),
  ).toHaveLength(0);
  expect(
    tree.root.findAll(
      node => node.props.children === 'Conversation unavailable',
    ).length,
  ).toBeGreaterThan(0);
});
