import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KeyboardAvoidingView, Modal } from 'react-native';
import Toast from 'react-native-toast-message';
import * as contactService from '../src/features/deals/dealContactService';
import { chatAuthorizationFixture } from '../test/fixtures/dealContact';
import { useInitialConversation } from '../src/features/messages/hooks/useInitialConversation';
import { InitialMessageDialog } from '../src/features/listings/components/InitialMessageDialog';
import { AppInput } from '../src/components/ui/AppInput';
import { AppButton } from '../src/components/ui/AppButton';
import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { getPublicListingDetails } from '../src/features/listings/services/publicListingsService';
import {
  useChatDrafts,
  threadKey,
} from '../src/features/messages/store/chatDraftStore';
import { navigationRef } from '../src/navigation/navigationRef';
import * as authFlow from '../src/features/auth/services/authFlowCoordinator';
import { authActionTarget } from '../src/features/auth/services/authActionResolver';
import { ApiError } from '../src/types/api';
import {
  publicListingFixture,
  conversationCreatedFixture,
} from '../test/fixtures/publicListing';
let tree: ReactTestRenderer,
  client: QueryClient,
  hook: ReturnType<typeof useInitialConversation>;
let row: Awaited<ReturnType<typeof getPublicListingDetails>>;
let focused = true;
function Harness() {
  hook = useInitialConversation(row, focused, 'ListingsStack', 9);
  return (
    <InitialMessageDialog
      visible={hook.visible}
      draft={hook.draft}
      busy={hook.busy}
      blocked={hook.blocked}
      onChange={hook.setDraft}
      onSend={hook.send}
      onCancel={hook.close}
    />
  );
}
beforeEach(async () => {
  jest.spyOn(contactService, 'readDealContact').mockImplementation(async () => chatAuthorizationFixture());
  focused = true;
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'm@example.test' });
  useDevelopmentStore.setState({ previewActive: false });
  useChatDrafts.getState().clear();
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('hook-test-token');
  jest.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: { success: true, data: publicListingFixture },
  });
  jest
    .spyOn(apiClient, 'post')
    .mockResolvedValue({ status: 201, data: conversationCreatedFixture });
  jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
  jest.spyOn(navigationRef, 'navigate').mockImplementation(() => {});
  jest.spyOn(Toast, 'show').mockImplementation(() => {});
  row = await getPublicListingDetails('123');
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
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
  });
  client.clear();
  jest.restoreAllMocks();
});
const open = async (text = 'Hello') => {
  await Renderer.act(async () => {
    hook.open();
  });
  await Renderer.act(async () => {
    hook.setDraft(text);
  });
};
test('authorized dialog is accessible, multiline and keyboard-aware; Cancel never POSTs', async () => {
  await open();
  expect(hook.visible).toBe(true);
  expect(tree.root.findByType(Modal).props.visible).toBe(true);
  expect(tree.root.findByType(AppInput).props.multiline).toBe(true);
  expect(tree.root.findByType(AppInput).props.label).toBe('Initial message');
  expect(tree.root.findByType(KeyboardAvoidingView)).toBeTruthy();
  await Renderer.act(async () => {
    tree.root
      .findAllByType(AppButton)
      .find(button => button.props.title === 'Cancel')!
      .props.onPress();
  });
  expect(hook.visible).toBe(false);
  expect(hook.draft).toBe('Hello');
  expect(apiClient.post).not.toHaveBeenCalled();
});
test.each(['', ' \n\t'])(
  'empty/whitespace input does not submit (%#)',
  async body => {
    await open(body);
    await Renderer.act(async () => {
      await hook.send();
    });
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalled();
  },
);
test('201 uses existing Chat route and GET history lifecycle without inserting a bubble or a second POST', async () => {
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  await open();
  await Renderer.act(async () => {
    await hook.send();
  });
  expect(navigationRef.navigate).toHaveBeenCalledWith('AppDrawer', {
    screen: 'MainTabs',
    params: {
      screen: 'MessagesStack',
      params: {
        screen: 'Chat',
        params: {
          conversationId: '42',
          returnToDeal: 9,
        },
      },
    },
  });
  expect(useChatDrafts.getState().threads[threadKey(8, '42')]).toBeUndefined();
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['chat.history.read', 8, '42'],
    exact: true,
    refetchType: 'none',
  });
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['chat.conversation.read', 8, '42'],
    exact: true,
    refetchType: 'none',
  });
  expect(apiClient.post).toHaveBeenCalledTimes(1);
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['messages.inbox', 8],
    refetchType: 'active',
  });
  expect(
    client.getQueryData(['profileDashboard', 'user:8', 'summary']),
  ).toBeUndefined();
});
test('200 transfers actual unsent draft; never calls Send Message', async () => {
  jest
    .mocked(apiClient.post)
    .mockResolvedValue({
      status: 200,
      data: {
        ...conversationCreatedFixture,
        message: 'Conversation already exists.',
      },
    });
  await open('Distinct unsent text');
  await Renderer.act(async () => {
    await hook.send();
  });
  expect(useChatDrafts.getState().threads[threadKey(8, '42')]?.draft).toBe(
    'Distinct unsent text',
  );
  expect(useChatDrafts.getState().threads[threadKey(8, '42')]?.outbox).toEqual(
    [],
  );
  expect(apiClient.post).toHaveBeenCalledTimes(1);
  expect(Toast.show).not.toHaveBeenCalled();
});
test('200 never overwrites another unsent draft; retrying navigation does not POST again', async () => {
  useChatDrafts.getState().draft(threadKey(8, '42'), 'Existing text');
  jest
    .mocked(apiClient.post)
    .mockResolvedValue({
      status: 200,
      data: {
        ...conversationCreatedFixture,
        message: 'Conversation already exists.',
      },
    });
  await open();
  await Renderer.act(async () => {
    await hook.send();
  });
  expect(useChatDrafts.getState().threads[threadKey(8, '42')]?.draft).toBe(
    'Existing text',
  );
  expect(hook.draft).toBe('Hello');
  expect(navigationRef.navigate).not.toHaveBeenCalled();
  await Renderer.act(async () => {
    await hook.send();
  });
  expect(apiClient.post).toHaveBeenCalledTimes(1);
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'warning' }),
  );
});
test('guest gate resumes message entry, never sends automatically', async () => {
  const gate = jest.spyOn(authFlow, 'requireAuth').mockReturnValue(true);
  await Renderer.act(async () => {
    useAuthStore.getState().clear();
  });
  await Renderer.act(async () => {
    hook.open();
  });
  expect(gate).toHaveBeenCalledWith({
    type: 'START_CONVERSATION',
    params: { listingId: '123' },
  });
  expect(
    authActionTarget({
      type: 'START_CONVERSATION',
      params: { listingId: '123' },
    }),
  ).toMatchObject({
    params: {
      params: { params: { listingId: '123', resumeAction: 'message' } },
    },
  });
  expect(hook.visible).toBe(false);
  expect(apiClient.post).not.toHaveBeenCalled();
});
test('double tap while pending issues exactly one POST and draft remains until confirmed', async () => {
  let resolve!: (value: unknown) => void;
  jest.mocked(apiClient.post).mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  await open();
  let operation!: Promise<void>;
  await Renderer.act(async () => {
    operation = hook.send();
    hook.send();
    await Promise.resolve();
  });
  expect(hook.draft).toBe('Hello');
  expect(hook.busy).toBe(true);
  expect(apiClient.post).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => {
    resolve({ status: 201, data: conversationCreatedFixture });
    await operation;
  });
  expect(hook.draft).toBe('');
});
test('timeout preserves draft and blocks repeat sending across dialog close/reopen', async () => {
  jest
    .mocked(apiClient.post)
    .mockRejectedValue(new ApiError('Timeout', 'network'));
  await open();
  await Renderer.act(async () => {
    await hook.send();
  });
  expect(hook.blocked).toBe(true);
  expect(hook.draft).toBe('Hello');
  await Renderer.act(async () => {
    hook.close();
    hook.open();
  });
  await Renderer.act(async () => {
    await hook.send();
  });
  expect(apiClient.post).toHaveBeenCalledTimes(1);
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'warning' }),
  );
});
test.each(['logout', 'switch', 'blur'])(
  'pending completion after %s cannot navigate',
  async mode => {
    let resolve!: (value: unknown) => void;
    jest.mocked(apiClient.post).mockImplementation(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    );
    await open();
    let operation!: Promise<void>;
    await Renderer.act(async () => {
      operation = hook.send();
      await Promise.resolve();
    });
    await Renderer.act(async () => {
      if (mode === 'logout') useAuthStore.getState().clear();
      else if (mode === 'switch')
        useAuthStore
          .getState()
          .setUser({ id: 55, name: 'Other', email: 'other@example.test' });
      else {
        focused = false;
        tree.update(
          <QueryClientProvider client={client}>
            <Harness />
          </QueryClientProvider>,
        );
      }
    });
    await Renderer.act(async () => {
      resolve({ status: 201, data: conversationCreatedFixture });
      await operation;
    });
    expect(navigationRef.navigate).not.toHaveBeenCalled();
    if (mode !== 'blur')
      expect(
        useChatDrafts.getState().threads[threadKey(8, 'initial:deal:9')],
      ).toBeUndefined();
  },
);

test('Cancel during submission preserves draft, aborts navigation and prevents blind resend', async () => {
  let resolve!: (value: unknown) => void;
  jest.mocked(apiClient.post).mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  await open();
  let operation!: Promise<void>;
  await Renderer.act(async () => {
    operation = hook.send();
    await Promise.resolve();
  });
  await Renderer.act(async () => {
    hook.close();
  });
  await Renderer.act(async () => {
    resolve({ status: 201, data: conversationCreatedFixture });
    await operation;
  });
  expect(navigationRef.navigate).not.toHaveBeenCalled();
  expect(hook.draft).toBe('Hello');
  await Renderer.act(async () => {
    hook.open();
    await hook.send();
  });
  expect(apiClient.post).toHaveBeenCalledTimes(1);
});
