import React from 'react';
import Renderer from 'react-test-renderer';
import {
  QueryClient,
  QueryClientProvider,
  notifyManager,
} from '@tanstack/react-query';
import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import {
  getNotifications,
  getNotificationCounts,
  markNotificationRead,
} from '../src/features/notifications/notificationsService';
import { NotificationsScreen } from '../src/features/notifications/screens/NotificationsScreen';
import { AppButton } from '../src/components/ui/AppButton';
import { refreshDealData } from '../src/features/deals/dealsService';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
const route = {
  from_country_id: 1,
  from_city_id: 2,
  to_country_id: 3,
  to_city_id: 4,
  from_country_name: 'Country',
  from_city_name: 'City',
  to_country_name: null,
  to_city_name: null,
};
const item = {
  id: 7,
  event: 'request_submitted',
  deal_id: 9,
  deal_status: 'pending',
  is_read: false,
  read_at: null,
  created_at: '2026-11-25T10:00:00Z',
  is_pending_task: true,
  visible: true,
  allowed_actions: ['accept', 'reject'],
  summary: {
    parcel_title: 'Parcel',
    weight_kg: 5,
    route,
    sender: { id: 1, display_name: null },
    carrier: { id: 2, display_name: null },
  },
};
const response = (data: unknown) => ({
  status: 200,
  data: { success: true, message: 'OK', data },
});
const page = (items: unknown[], current = 1, last = 1) => ({
  items,
  pagination: {
    current_page: current,
    last_page: last,
    per_page: 20,
    total: items.length,
  },
});
let tree: Renderer.ReactTestRenderer | undefined, client: QueryClient;
const navigate = jest.fn();
beforeEach(() => {
  notifyManager.setScheduler(callback => callback());
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  useAuthStore
    .getState()
    .setUser({ id: 1, name: 'Member', email: 'member@example.test' });
  jest
    .spyOn(secureStorage, 'getToken')
    .mockResolvedValue('notification-test-token');
});
afterEach(() => {
  Renderer.act(() => tree?.unmount());
  tree = undefined;
  client.clear();
  useAuthStore.getState().clear();
  jest.restoreAllMocks();
  jest.clearAllMocks();
  notifyManager.setScheduler(callback => setTimeout(callback, 0));
});
test('exact authenticated feed/counts/read endpoints and empty JSON read body', async () => {
  const get = jest
    .spyOn(apiClient, 'get')
    .mockResolvedValueOnce(
      response(page([{ ...item, phone: 'private' }], 2, 2)),
    )
    .mockResolvedValueOnce(
      response({ unread_count: 3, pending_task_count: 2 }),
    );
  const result = await getNotifications(2);
  expect(result.items[0]).not.toHaveProperty('phone');
  expect(get).toHaveBeenNthCalledWith(
    1,
    '/customer/notifications',
    expect.objectContaining({
      params: { filter: 'all', page: 2, per_page: 20 },
      headers: { Authorization: 'Bearer notification-test-token' },
    }),
  );
  expect(await getNotificationCounts()).toEqual({
    unread_count: 3,
    pending_task_count: 2,
  });
  const post = jest
    .spyOn(apiClient, 'post')
    .mockResolvedValue(
      response({ ...item, is_read: true, read_at: '2026-11-25T10:01:00Z' }),
    );
  expect((await markNotificationRead(7)).visible).toBe(true);
  expect(post).toHaveBeenCalledWith(
    '/customer/notifications/7/read',
    {},
    expect.objectContaining({
      headers: { Authorization: 'Bearer notification-test-token' },
    }),
  );
});
test('guest does not call notification APIs', async () => {
  useAuthStore.getState().clear();
  const get = jest.spyOn(apiClient, 'get');
  await expect(getNotifications()).rejects.toMatchObject({
    kind: 'unauthorized',
  });
  expect(get).not.toHaveBeenCalled();
});
test('stale account response is ignored', async () => {
  let finish!: (value: any) => void;
  jest.spyOn(apiClient, 'get').mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const pending = getNotificationCounts();
  while (!finish) await Promise.resolve();
  useAuthStore.getState().clear();
  finish(response({ unread_count: 1, pending_task_count: 1 }));
  await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
});
test('invalid response never becomes a valid count', async () => {
  jest
    .spyOn(apiClient, 'get')
    .mockResolvedValue(response({ unread_count: -1, pending_task_count: 0 }));
  await expect(getNotificationCounts()).rejects.toMatchObject({
    kind: 'unknown',
  });
});
async function mount() {
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <NotificationsScreen
          navigation={{ navigate } as never}
          route={{ key: 'notifications', name: 'Notifications' }}
        />
      </QueryClientProvider>,
    );
  });
}
function buttons() {
  return tree!.root.findAllByType(AppButton);
}
function mocks(updated: typeof item) {
  let read = false;
  const get = jest.spyOn(apiClient, 'get').mockImplementation(async url =>
    url.endsWith('/counts')
      ? response({
          unread_count: read ? 0 : 1,
          pending_task_count: updated.is_pending_task ? 1 : 0,
        })
      : response(page(read ? [updated] : [item])),
  );
  const post = jest.spyOn(apiClient, 'post').mockImplementation(async () => {
    read = true;
    return response(updated);
  });
  return { get, post };
}
test.each([true, false])(
  'server visibility after read is respected: %s',
  async visible => {
    const { post } = mocks({
      ...item,
      is_read: true,
      visible,
      is_pending_task: visible,
    });
    await mount();
    await Renderer.act(async () => {
      buttons()
        .find(button => button.props.title === 'View deal 9')!
        .props.onPress();
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(buttons().some(button => button.props.title === 'View deal 9')).toBe(
      visible,
    );
    expect(navigate).toHaveBeenCalledWith('DealDetails', { dealId: 9 });
  },
);
test('duplicate taps submit only one read request', async () => {
  mocks({ ...item, is_read: true });
  let finish!: (value: any) => void;
  const post = jest.mocked(apiClient.post).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await mount();
  await Renderer.act(async () => {
    const button = buttons().find(b => b.props.title === 'View deal 9')!;
    button.props.onPress();
    button.props.onPress();
    await Promise.resolve();
  });
  expect(post).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => finish(response({ ...item, is_read: true })));
});
test('deal changes invalidate account-scoped notification feed and counts', async () => {
  client.setQueryData(['notifications', 1, 'feed'], {});
  client.setQueryData(['notifications', 1, 'counts'], {});
  client.setQueryData(['notifications', 2, 'counts'], {});
  await refreshDealData(client);
  expect(
    client.getQueryState(['notifications', 1, 'feed'])?.isInvalidated,
  ).toBe(true);
  expect(
    client.getQueryState(['notifications', 1, 'counts'])?.isInvalidated,
  ).toBe(true);
  expect(
    client.getQueryState(['notifications', 2, 'counts'])?.isInvalidated,
  ).toBe(false);
});
test('logout clears notification cache and hides content', async () => {
  mocks({ ...item, is_read: true });
  await mount();
  await Renderer.act(async () => useAuthStore.getState().clear());
  expect(client.getQueryData(['notifications', 1, 'feed'])).toBeUndefined();
  expect(buttons().some(button => button.props.title === 'View deal 9')).toBe(
    false,
  );
});

test('pagination follows server pages and deduplicates notification IDs', async () => {
  jest
    .spyOn(apiClient, 'get')
    .mockImplementation(async (url, config) =>
      url.endsWith('/counts')
        ? response({ unread_count: 2, pending_task_count: 1 })
        : response(
            (config?.params as { page?: number } | undefined)?.page === 2
              ? page([item, { ...item, id: 8, deal_id: 10 }], 2, 2)
              : page([item], 1, 2),
          ),
    );
  await mount();
  await Renderer.act(async () =>
    buttons()
      .find(button => button.props.title === 'Load more notifications')!
      .props.onPress(),
  );
  expect(
    buttons().filter(button => button.props.title === 'View deal 9'),
  ).toHaveLength(1);
  expect(buttons().some(button => button.props.title === 'View deal 10')).toBe(
    true,
  );
  expect(
    buttons().some(button => button.props.title === 'Load more notifications'),
  ).toBe(false);
});
test('empty notifications display the existing empty state and no fabricated records', async () => {
  jest
    .spyOn(apiClient, 'get')
    .mockImplementation(async url =>
      url.endsWith('/counts')
        ? response({ unread_count: 0, pending_task_count: 0 })
        : response(page([])),
    );
  await mount();
  expect(JSON.stringify(tree!.toJSON())).toContain('No notifications.');
  expect(
    buttons().some(button => button.props.title.startsWith('View deal')),
  ).toBe(false);
});
